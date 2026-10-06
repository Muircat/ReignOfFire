/* =====================================================================
   Reign of Fire — engine
   Storage, sync-safe merging, progression maths, deload scheduling,
   bodyweight trend analysis and reminders. No UI code lives here.
   ===================================================================== */
(function () {
  "use strict";
  const P = window.PLAN;
  const KEY = "rof-data-v1";
  const DRAFT_KEY = "rof-draft-v1";
  const SYNC_KEY = "rof-sync-v1";
  const DAY = 86400000;

  /* ---------------------------------------------------------- dates */
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY); // a - b
  const dow = (s) => { const g = parse(s).getDay(); return g === 0 ? 7 : g; }; // 1 = Mon … 7 = Sun
  const mondayOf = (s) => addDays(s, 1 - dow(s));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  /* ---------------------------------------------------------- state */
  const DEFAULT_SETTINGS = {
    bar: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    dbStep: 2,
    restLong: 150,
    restShort: 75,
    deloadWeek: 6,          // the Nth training week is the deload week
    kcal: 2950,
    optional: { adapalene: false, lotion: false, adapgel: false },
    sound: true,
    u: 0,
  };

  function blank() {
    return { v: 1, sessions: {}, bw: {}, habits: {}, chores: {}, overrides: {}, deloads: {}, settings: { ...DEFAULT_SETTINGS } };
  }

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function normalise(s) {
    const b = blank();
    s = s && typeof s === "object" ? s : {};
    for (const k of ["sessions", "bw", "habits", "chores", "overrides", "deloads"]) b[k] = s[k] && typeof s[k] === "object" ? s[k] : {};
    b.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    b.settings.optional = { ...DEFAULT_SETTINGS.optional, ...((s.settings || {}).optional || {}) };
    return b;
  }

  let state = normalise(JSON.parse(safeGet(KEY) || "null"));
  const listeners = new Set();
  function save(opts = {}) {
    safeSet(KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(opts));
  }
  const now = () => Date.now();
  const touch = (o) => ((o.u = now()), o);

  /* Merge two states record-by-record, newest edit wins. Deletions are
     tombstones ({del:true}) so they propagate between devices too. */
  function merge(a, b) {
    a = normalise(a); b = normalise(b);
    const out = blank();
    for (const k of ["sessions", "bw", "habits", "chores", "overrides", "deloads"]) {
      const keys = new Set([...Object.keys(a[k]), ...Object.keys(b[k])]);
      for (const id of keys) {
        const x = a[k][id], y = b[k][id];
        out[k][id] = !x ? y : !y ? x : (y.u || 0) > (x.u || 0) ? y : x;
      }
    }
    out.settings = (b.settings.u || 0) > (a.settings.u || 0) ? b.settings : a.settings;
    return out;
  }

  /* ---------------------------------------------------------- lookups */
  const EX = P.exercises;
  const dayByKey = (k) => P.days.find((d) => d.key === k);
  const live = (map) => Object.values(map).filter((r) => r && !r.del);
  const sessionsSorted = () => live(state.sessions).sort((a, b) => a.start - b.start);

  function roundFor(kind, w) {
    const step = kind === "db" ? state.settings.dbStep : kind === "bw" ? 0.5 : 2.5;
    return Math.max(0, Math.round(w / step) * step);
  }
  const fmtW = (w) => (Math.round(w * 100) / 100).toString();

  /* Plates per side for a barbell weight */
  function plates(total) {
    const bar = state.settings.bar;
    let side = (total - bar) / 2;
    if (side <= 0) return [];
    const out = [];
    for (const p of [...state.settings.plates].sort((a, b) => b - a)) {
      while (side >= p - 1e-9) { out.push(p); side -= p; }
    }
    return out;
  }

  function warmupSets(key, work) {
    const ex = EX[key];
    if (!ex.warmup) return [];
    const bar = state.settings.bar;
    return P.warmups[ex.warmup]
      .map(([pct, reps]) => ({ w: pct === 0 ? bar : Math.max(bar, roundFor("barbell", work * pct)), r: reps, label: pct === 0 ? "Bar" : `${Math.round(pct * 100)}%` }))
      .filter((s, i, arr) => i === 0 || s.w < work); // never warm up at or above the work weight
  }

  /* ---------------------------------------------------------- deload */
  function activeDeload(on = today()) {
    return live(state.deloads).find((d) => d.start <= on && on <= d.end) || null;
  }
  function lastDeloadEnd(before = today()) {
    const ds = live(state.deloads).filter((d) => d.start <= before).sort((a, b) => (a.end < b.end ? 1 : -1));
    return ds[0] ? ds[0].end : null;
  }
  /* Training weeks since the last deload (weeks containing ≥1 normal session) */
  function blockInfo(on = today()) {
    const since = lastDeloadEnd(on);
    const thisMon = mondayOf(on);
    const weeks = new Set();
    for (const s of sessionsSorted()) {
      if (s.deload) continue;
      if (since && s.date <= since) continue;
      const m = mondayOf(s.date);
      if (m < thisMon) weeks.add(m);
    }
    const week = weeks.size + 1;          // the week you're in now
    const target = state.settings.deloadWeek;
    const deload = activeDeload(on);
    return { week, target, due: !deload && week >= target, soon: !deload && week === target - 1, deload };
  }
  function startDeload() {
    const id = uid();
    const start = today();
    state.deloads[id] = touch({ id, start, end: addDays(start, 6) });
    save();
  }
  function endDeload() {
    const d = activeDeload();
    if (d) { d.end = addDays(today(), -1) < d.start ? d.start : addDays(today(), -1); if (d.end < d.start) d.del = true; touch(d); save(); }
  }

  /* ---------------------------------------------------------- progression */
  /* What should you lift next time? Walks your history for this exercise
     and applies the plan's rules. Deload sessions are ignored. */
  function history(key, { includeDeload = false, excludeId = null } = {}) {
    return sessionsSorted().filter((s) => s.id !== excludeId && (includeDeload || !s.deload) && s.ex && s.ex[key] && logged(s.ex[key]).length);
  }
  const logged = (e) => (e.sets || []).filter((x) => x && x.r != null);

  function evaluate(key, e) {
    // Did this logged exercise hit its own targets?
    const ex = EX[key];
    const t = e.t || { sets: ex.sets, reps: Array(ex.sets).fill(ex.lo) };
    const reps = Array.from({ length: t.sets }, (_, i) => (e.sets[i] && e.sets[i].r != null ? e.sets[i].r : 0));
    const hit = ex.type === "amrap" ? true : reps.every((r, i) => r >= (t.reps[i] || 0));
    return { reps, hit, min: Math.min(...reps), total: reps.reduce((a, b) => a + b, 0) };
  }

  function baseTarget(key, opts = {}) {
    const ex = EX[key];
    const hist = history(key, opts);
    const ov = state.overrides[key] && !state.overrides[key].del ? state.overrides[key] : null;
    const last = hist[hist.length - 1];
    const reps = (n) => Array(ex.sets).fill(n);

    if (ov && (!last || ov.u > last.end)) {
      return { w: ov.w, reps: reps(ex.type === "amrap" ? (last ? Math.max(...evaluate(key, last.ex[key]).reps) : 8) : ov.r || ex.lo), status: "set", msg: "Set manually", last: last && last.ex[key], fails: 0 };
    }
    if (!last) {
      return { w: ex.start, reps: reps(ex.type === "amrap" ? 8 : ex.lo), status: "new", msg: "First time — pick a weight that leaves ~2 reps in the tank", last: null, fails: 0 };
    }

    const le = last.ex[key];
    const ev = evaluate(key, le);
    // consecutive misses at this weight
    let fails = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const e = hist[i].ex[key];
      if (e.w !== le.w || evaluate(key, e).hit) break;
      fails++;
    }
    const fullCount = logged(le).length >= ev.reps.length;
    let w = le.w, r, status, msg;

    if (ex.type === "linear") {
      if (ev.hit && fullCount) { w = roundFor(ex.kind, le.w + ex.inc); status = "up"; msg = `+${fmtW(ex.inc)} kg — you hit every rep last time`; }
      else { status = "hold"; msg = fails >= 2 ? "Missed twice — same weight, own the form" : "Same weight — finish every rep this time"; }
      r = reps(ex.lo);
    } else if (ex.type === "amrap") {
      const avg = ev.total / ev.reps.length;
      if (avg >= ex.amrapGoal) { w = roundFor(ex.kind, le.w + ex.inc); status = "up"; msg = `Averaged ${avg.toFixed(1)}/set — add ${fmtW(ex.inc)} kg`; r = reps(Math.max(6, ex.amrapGoal - 4)); }
      else { status = "beat"; msg = `Beat ${ev.total} total reps (goal: avg ${ex.amrapGoal}/set)`; r = ev.reps.slice(); }
    } else {
      // double progression (reps or seconds)
      const topAll = fullCount && ev.min >= ex.hi;
      if (topAll && ex.inc > 0) { w = roundFor(ex.kind, le.w + ex.inc); r = reps(ex.lo); status = "up"; msg = `Top of range on every set — +${fmtW(ex.inc)} kg${ex.kind === "db" ? " per DB" : ""}, back to ${ex.lo}`; }
      else if (topAll) { r = reps(ex.hi); status = "top"; msg = "Top of range — make it harder (slower, longer range)"; }
      else {
        const next = Math.min(ex.hi, Math.max(ex.lo, ev.min + (ex.step || 1)));
        const prevT = le.t ? Math.min(...le.t.reps) : ex.lo;
        r = reps(next);
        status = next > prevT ? "reps" : "hold";
        msg = status === "reps" ? `Aim for +${next - prevT} ${unit(key)} per set` : fails >= 2 ? "Missed twice — same target, own the form" : "Same target — get every set there";
      }
    }
    if (fails >= 3 && ex.inc > 0 && ex.type !== "amrap") {
      status = "stall";
      msg = `Stuck ${fails} sessions — consider resetting 10% to ${fmtW(roundFor(ex.kind, le.w * 0.9))} kg and building back`;
    }
    return { w, reps: r, status, msg, last: le, fails, lastDate: last.date };
  }

  function target(key, opts = {}) {
    const ex = EX[key];
    const t = baseTarget(key, opts);
    const d = opts.deload != null ? opts.deload : !!activeDeload();
    const sets = d ? Math.max(1, ex.sets - (ex.sets >= 5 ? 2 : 1)) : ex.sets;
    const out = { ...t, sets, reps: t.reps.slice(0, sets) };
    if (d) { out.w = roundFor(ex.kind, t.w * 0.65); if (ex.kind === "barbell") out.w = Math.max(state.settings.bar, out.w); out.status = "deload"; out.msg = `Deload: ${sets} sets at ~65% — same reps, easy and crisp`; out.normalW = t.w; }
    return out;
  }

  function resetLift(key, w, r) { state.overrides[key] = touch({ w, r }); save(); }

  const unit = (key) => (EX[key].type === "time" ? "sec" : EX[key].unit || "reps");

  /* ---------------------------------------------------------- strength stats */
  const e1rm = (w, r) => (r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));
  const loaded = (key) => ["barbell", "db", "machine"].includes(EX[key].kind);
  function sessionScore(key, e) {
    const sets = logged(e);
    if (!sets.length) return 0;
    if (loaded(key)) return Math.max(...sets.map((s) => e1rm(e.w, Math.min(s.r, 12))));
    return sets.reduce((a, s) => a + s.r, 0); // reps / seconds total
  }
  function liftSeries(key) {
    return history(key, { includeDeload: false }).map((s) => ({ date: s.date, score: sessionScore(key, s.ex[key]), w: s.ex[key].w, sets: logged(s.ex[key]).map((x) => x.r) }));
  }
  function bestBefore(key, beforeStart) {
    let best = 0;
    for (const s of sessionsSorted()) if (s.start < beforeStart && s.ex[key] && !s.deload) best = Math.max(best, sessionScore(key, s.ex[key]));
    return best;
  }

  /* ---------------------------------------------------------- schedule */
  function weekSessions(on = today()) {
    const m = mondayOf(on), sun = addDays(m, 6);
    return sessionsSorted().filter((s) => s.date >= m && s.date <= sun);
  }
  /* Decide what to show on Today: today's session, a missed one to catch up, or rest */
  function plan(on = today()) {
    const done = weekSessions(on);
    const doneKeys = new Set(done.map((s) => s.day));
    const d = dow(on);
    const todays = P.days.find((x) => x.dow === d);
    const doneToday = done.find((s) => s.date === on);
    const missed = P.days.filter((x) => x.dow < d && !doneKeys.has(x.key));
    const upcoming = P.days.filter((x) => x.dow > d && !doneKeys.has(x.key));
    let primary = null, reason = "";
    if (doneToday) reason = "done";
    else if (todays && !doneKeys.has(todays.key)) { primary = todays; reason = "scheduled"; }
    else if (missed.length) { primary = missed[0]; reason = "catchup"; }
    else reason = "rest";
    return { primary, reason, doneToday, missed, upcoming, done, todays };
  }
  function nextScheduled(on = today()) {
    for (let i = 1; i <= 7; i++) { const dt = addDays(on, i); const x = P.days.find((p) => p.dow === dow(dt)); if (x) return { day: x, date: dt }; }
    return null;
  }

  function weekStreak(on = today()) {
    // consecutive weeks with ≥3 sessions; current week counts once it qualifies
    const byWeek = {};
    for (const s of sessionsSorted()) byWeek[mondayOf(s.date)] = (byWeek[mondayOf(s.date)] || 0) + 1;
    let m = mondayOf(on), n = 0;
    if ((byWeek[m] || 0) >= 3) n++;
    m = addDays(m, -7);
    while ((byWeek[m] || 0) >= 3) { n++; m = addDays(m, -7); }
    return n;
  }

  /* ---------------------------------------------------------- bodyweight */
  function bwSeries() {
    return live(state.bw).map((r) => ({ date: r.date, kg: r.kg })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  function bwTrend() {
    const s = bwSeries();
    const t = today();
    const avg = (end) => { const xs = s.filter((p) => p.date <= end && diffDays(end, p.date) < 7); return xs.length ? xs.reduce((a, p) => a + p.kg, 0) / xs.length : null; };
    const win = s.filter((p) => diffDays(t, p.date) <= 28);
    let rate = null;
    if (win.length >= 4 && diffDays(win[win.length - 1].date, win[0].date) >= 10) {
      const xs = win.map((p) => diffDays(p.date, win[0].date)), ys = win.map((p) => p.kg);
      const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
      let num = 0, den = 0;
      xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
      rate = den ? (num / den) * 7 : null;
    }
    const [lo, hi] = P.nutrition.gainPerWeek;
    let verdict = "need", adjust = 0, text;
    if (rate == null) text = s.length ? `Keep weighing in — ${Math.max(0, 4 - win.length)} more entries over 10+ days unlocks your trend.` : "Weigh in most mornings (after the loo, before food). The app turns it into a trend.";
    else {
      const mid = (lo + hi) / 2;
      const kcal = Math.round(((mid - rate) * 7700) / 7 / 50) * 50;
      adjust = Math.max(-300, Math.min(300, kcal));
      if (rate < lo) { verdict = "low"; text = `Gaining ${rate.toFixed(2)} kg/wk — below the ${lo}–${hi} target. Add ~${Math.abs(adjust)} kcal/day.`; }
      else if (rate > hi) { verdict = "high"; text = `Gaining ${rate.toFixed(2)} kg/wk — faster than ${hi}. Trim ~${Math.abs(adjust)} kcal/day to keep it lean.`; adjust = Math.min(adjust, -100); }
      else { verdict = "ok"; adjust = 0; text = `Gaining ${rate.toFixed(2)} kg/wk — right in the ${lo}–${hi} zone. Keep eating like this.`; }
    }
    return { series: s, avg7: s.length ? avg(t) : null, rate, verdict, adjust, text, last: s[s.length - 1] || null };
  }
  function logBW(kg, date = today()) { state.bw[date] = touch({ date, kg }); save(); }

  /* ---------------------------------------------------------- habits & chores */
  const habitList = () => P.habits.filter((h) => !h.optional || state.settings.optional[h.id]);
  function habitsOn(date) { const h = state.habits[date]; return h && !h.del ? h.done || {} : {}; }
  function toggleHabit(id, date = today()) {
    const h = state.habits[date] && !state.habits[date].del ? state.habits[date] : { date, done: {} };
    h.done = { ...h.done, [id]: !h.done[id] };
    if (!h.done[id]) delete h.done[id];
    state.habits[date] = touch(h);
    save();
  }
  function habitScore(date) {
    const list = habitList();
    const d = habitsOn(date);
    return list.length ? list.filter((h) => d[h.id]).length / list.length : 0;
  }
  const choreList = () => P.chores.filter((c) => !c.optional || state.settings.optional[c.id]);
  function choreStatus(c, on = today()) {
    const r = state.chores[c.id];
    if (!r || !r.last) return { known: false, due: false, days: null };
    const since = diffDays(on, r.last);
    return { known: true, since, left: c.every - since, due: since >= c.every, last: r.last };
  }
  function doChore(id, date = today()) { state.chores[id] = touch({ ...(state.chores[id] || {}), id, last: date }); save(); }

  /* Everything the app wants to nudge you about today, most important first */
  function headsUp(on = today()) {
    const items = [];
    const b = blockInfo(on);
    if (b.deload) items.push({ kind: "deload-on", tone: "info", title: "Deload week", text: `Lighter loads until ${fmtDate(b.deload.end)}. Recover, then come back stronger.`, action: "end-deload", actionLabel: "End early" });
    else if (b.due) items.push({ kind: "deload", tone: "warn", title: "Deload week due", text: `${b.week - 1} training weeks done. This week: fewer sets at ~65% — the app adjusts every target.`, action: "start-deload", actionLabel: "Start deload" });
    else if (b.soon) items.push({ kind: "deload-soon", tone: "info", title: "Deload next week", text: `You're in training week ${b.week}. Push this week — easy week follows.` });

    for (const key of Object.keys(EX)) {
      const t = baseTarget(key);
      if (t.status === "stall") items.push({ kind: "stall", tone: "warn", title: `${EX[key].name} has stalled`, text: t.msg, action: `reset:${key}`, actionLabel: "Reset 10%" });
    }
    const bw = bwSeries();
    const lastBW = bw[bw.length - 1];
    if (!lastBW || diffDays(on, lastBW.date) >= 3) items.push({ kind: "weigh", tone: "info", title: "Weigh in", text: lastBW ? `Last weigh-in was ${diffDays(on, lastBW.date)} days ago.` : "Your first weigh-in starts the gain tracker.", action: "focus-bw", actionLabel: "Log weight" });

    for (const c of choreList()) {
      const s = choreStatus(c, on);
      if (s.due) items.push({ kind: "chore", tone: c.group === "Kit" ? "info" : "plain", title: c.label, text: s.since - c.every > 0 ? `${s.since - c.every} days overdue` : "Due today", action: `chore:${c.id}`, actionLabel: c.group === "Kit" ? "Bought" : "Done" });
    }
    return items;
  }

  /* ---------------------------------------------------------- workouts */
  function getDraft() { try { return JSON.parse(safeGet(DRAFT_KEY) || "null"); } catch (e) { return null; } }
  function setDraft(d) { if (d) safeSet(DRAFT_KEY, JSON.stringify(d)); else safeDel(DRAFT_KEY); }

  function newDraft(dayKey) {
    const day = dayByKey(dayKey);
    const deload = !!activeDeload();
    const ex = {};
    for (const k of day.ex) {
      const t = target(k);
      ex[k] = { w: t.w, t: { w: t.w, sets: t.sets, reps: t.reps }, sets: Array(t.sets).fill(null), warm: [] };
    }
    const d = { id: uid(), day: dayKey, date: today(), start: now(), deload, ex, generalWarm: false };
    setDraft(d);
    return d;
  }

  function finishDraft(d) {
    const s = { id: d.id, date: d.date, day: d.day, start: d.start, end: now(), deload: d.deload, ex: {} };
    const prs = [];
    let volume = 0, setsDone = 0;
    for (const [k, e] of Object.entries(d.ex)) {
      const ls = (e.sets || []).map((x) => (x && x.r != null ? { r: x.r } : null));
      if (!ls.some(Boolean)) continue; // skipped entirely → doesn't affect progression
      s.ex[k] = { w: e.w, t: e.t, sets: ls };
      for (const x of ls) if (x) { setsDone++; volume += (loaded(k) ? e.w * (EX[k].kind === "db" ? 2 : 1) : 0) * (EX[k].type === "time" ? 0 : x.r); }
      if (!d.deload) {
        const prev = bestBefore(k, d.start);
        const cur = sessionScore(k, s.ex[k]);
        if (prev > 0 && cur > prev + 1e-6) prs.push({ key: k, prev, cur });
      }
    }
    state.sessions[s.id] = touch(s);
    save({ important: true });
    // "what changes next time": today's numbers → the engine's next target
    const changes = [];
    for (const k of Object.keys(s.ex)) {
      const e = s.ex[k];
      const after = target(k, { deload: false });
      changes.push({ key: k, from: { w: e.w, reps: e.t ? e.t.reps : [] }, to: after, did: e.sets.map((x) => (x ? x.r : 0)) });
    }
    setDraft(null);
    return { session: s, prs, volume, setsDone, changes, mins: Math.round((s.end - s.start) / 60000) };
  }

  function deleteSession(id) { const s = state.sessions[id]; if (s) { s.del = true; touch(s); save({ important: true }); } }

  /* ---------------------------------------------------------- formatting */
  function fmtDate(s, opts = { weekday: "short", day: "numeric", month: "short" }) { return parse(s).toLocaleDateString(undefined, opts); }

  /* ---------------------------------------------------------- export / import */
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) { const incoming = JSON.parse(text); state = merge(state, incoming); save({ important: true }); }
  function exportCSV() {
    const rows = [["date", "workout", "deload", "exercise", "set", "weight_kg", "reps_or_sec", "target"]];
    for (const s of sessionsSorted()) {
      const day = dayByKey(s.day);
      for (const [k, e] of Object.entries(s.ex)) e.sets.forEach((x, i) => { if (x) rows.push([s.date, day ? day.label : s.day, s.deload ? "yes" : "", EX[k] ? EX[k].name : k, i + 1, e.w, x.r, e.t ? e.t.reps[i] : ""]); });
    }
    for (const r of bwSeries()) rows.push([r.date, "bodyweight", "", "", "", r.kg, "", ""]);
    return rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n");
  }
  function resetAll() { state = blank(); setDraft(null); save({ important: true }); }

  /* ---------------------------------------------------------- GitHub Gist sync (optional) */
  const FILE = "reign-of-fire-data.json";
  const syncCfg = () => { try { return JSON.parse(safeGet(SYNC_KEY) || "null") || {}; } catch (e) { return {}; } };
  const setSyncCfg = (c) => safeSet(SYNC_KEY, JSON.stringify(c));
  let syncing = null;
  async function gh(path, token, init = {}) {
    const res = await fetch("https://api.github.com" + path, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    if (!res.ok) throw new Error(res.status === 401 ? "Token rejected — check it has the gist scope" : `GitHub said ${res.status}`);
    return res.json();
  }
  async function sync() {
    const cfg = syncCfg();
    if (!cfg.token) throw new Error("No token set");
    if (syncing) return syncing;
    syncing = (async () => {
      let id = cfg.gistId;
      if (!id) {
        const list = await gh("/gists?per_page=100", cfg.token);
        const found = list.find((g) => g.files && g.files[FILE]);
        if (found) id = found.id;
      }
      let remote = null;
      if (id) {
        const g = await gh(`/gists/${id}`, cfg.token);
        const f = g.files[FILE];
        if (f) remote = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
      }
      const merged = remote ? merge(state, remote) : state;
      state = merged;
      const body = JSON.stringify({ description: "Reign of Fire gym tracker data", files: { [FILE]: { content: JSON.stringify(merged) } } });
      if (id) await gh(`/gists/${id}`, cfg.token, { method: "PATCH", body });
      else { const g = await gh("/gists", cfg.token, { method: "POST", body: JSON.stringify({ ...JSON.parse(body), public: false }) }); id = g.id; }
      setSyncCfg({ ...cfg, gistId: id, last: now(), error: null });
      safeSet(KEY, JSON.stringify(state));
      listeners.forEach((fn) => fn({ synced: true }));
    })().catch((e) => { setSyncCfg({ ...syncCfg(), error: e.message }); throw e; }).finally(() => { syncing = null; });
    return syncing;
  }

  window.Engine = {
    get state() { return state; },
    save, touch, onChange: (fn) => listeners.add(fn), merge,
    today, addDays, diffDays, dow, mondayOf, parse, ymd, fmtDate, fmtW,
    EX, dayByKey, plan, nextScheduled, weekSessions, weekStreak, sessionsSorted,
    target, baseTarget, warmupSets, plates, roundFor, unit, resetLift, logged, evaluate,
    liftSeries, sessionScore, loaded, e1rm,
    blockInfo, startDeload, endDeload, activeDeload,
    bwSeries, bwTrend, logBW,
    habitList, habitsOn, toggleHabit, habitScore, choreList, choreStatus, doChore, headsUp,
    getDraft, setDraft, newDraft, finishDraft, deleteSession,
    exportJSON, importJSON, exportCSV, resetAll,
    syncCfg, setSyncCfg, sync,
  };
})();
