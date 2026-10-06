/* =====================================================================
   Reign of Fire — interface
   Three tabs (Today · Progress · Plan) plus a full-screen workout mode.
   All maths lives in engine.js; this file only draws and reacts.
   ===================================================================== */
(function () {
  "use strict";
  const E = window.Engine, P = window.PLAN, EX = E.EX;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fw = E.fmtW;
  const app = $("#app"), wk = $("#workout"), layer = $("#layer"), restEl = $("#rest");

  const ui = { tab: "today", lift: "bench", info: {}, workoutOpen: false };
  let draft = E.getDraft();

  /* ---------------------------------------------------------- theme */
  function applyTheme() {
    let t = "auto";
    try { t = localStorage.getItem("rof-theme") || "auto"; } catch (e) {}
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    return t;
  }
  applyTheme();

  /* ---------------------------------------------------------- small helpers */
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  function wl(key, w) {
    const k = EX[key].kind;
    if (k === "none") return "Bodyweight";
    if (k === "bw") return w > 0 ? `BW +${fw(w)} kg` : "Bodyweight";
    if (k === "db") return `${fw(w)} kg each`;
    return `${fw(w)} kg`;
  }
  function repsLabel(key, t) {
    const ex = EX[key];
    if (ex.type === "amrap") return `${t.sets} × max`;
    const r = t.reps, same = r.every((x) => x === r[0]);
    const u = ex.type === "time" ? "s" : ex.perSide ? " /leg" : ex.unit === "steps" ? " steps" : "";
    return `${t.sets} × ${same ? r[0] : r.join("/")}${u}`;
  }
  function rangeLabel(key) {
    const ex = EX[key];
    if (ex.type === "amrap") return `${ex.sets} × AMRAP`;
    const u = ex.type === "time" ? " sec" : ex.perSide ? " each" : ex.unit === "steps" ? " steps" : "";
    return `${ex.sets} × ${ex.lo === ex.hi ? ex.lo : ex.lo + "–" + ex.hi}${u}`;
  }
  function badge(key, t) {
    const map = {
      up: () => (t.last && t.w > t.last.w ? `↑ +${fw(t.w - t.last.w)} kg` : "↑ up"),
      reps: () => `↑ +${E.unit(key) === "sec" ? "time" : "reps"}`,
      hold: () => "repeat", beat: () => "beat it", top: () => "top", stall: () => "stalled",
      deload: () => "deload", new: () => "new", set: () => "set",
    };
    return `<span class="trend ${t.status}">${esc((map[t.status] || (() => ""))())}</span>`;
  }
  const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  const restFor = (key) => (EX[key].compound ? E.state.settings.restLong : E.state.settings.restShort);
  function estMinutes(day) {
    let s = 8 * 60;
    for (const k of day.ex) { const t = E.target(k); s += t.sets * (restFor(k) + 40); }
    return Math.round(s / 300) * 5;
  }
  function plateText(key, w) {
    if (EX[key].kind !== "barbell") return "";
    const bar = E.state.settings.bar;
    if (w < bar) return `Below the ${bar} kg bar`;
    const p = E.plates(w);
    return p.length ? `${p.join(" + ")} per side` : "Empty bar";
  }
  const icon = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2c1.2 4 6 6.3 6 11.3A6 6 0 0 1 6 13.3c0-2.4 1-4 2.4-5.4.3 1.9 1.2 3 2.4 3.6 0-3.6.2-6.8 1.2-9.5z"/></svg>',
  };

  /* ---------------------------------------------------------- toast & sheets */
  let toastT;
  function toast(msg) {
    clearTimeout(toastT);
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    toastT = setTimeout(() => t.remove(), 2600);
  }

  function sheet(html, handlers = {}, { onClose } = {}) {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    layer.appendChild(scrim);
    const close = () => { scrim.remove(); onClose && onClose(); };
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) return close();
      const a = e.target.closest("[data-act]");
      if (a && handlers[a.dataset.act]) handlers[a.dataset.act](a, close, scrim);
    });
    const f = scrim.querySelector("[autofocus]");
    if (f) setTimeout(() => f.focus(), 50);
    return { el: scrim, close };
  }
  function confirmSheet({ title, text, ok = "OK", cancel = "Cancel", danger = false }) {
    return new Promise((res) => {
      let done = false;
      sheet(`<h3>${esc(title)}</h3><p class="muted">${text}</p><div class="actions"><button class="btn" data-act="no">${esc(cancel)}</button><button class="btn ${danger ? "danger" : "primary"}" data-act="yes">${esc(ok)}</button></div>`,
        { yes: (_, c) => { done = true; c(); res(true); }, no: (_, c) => { done = true; c(); res(false); } },
        { onClose: () => { if (!done) res(false); } });
    });
  }

  /* ====================================================================
     TODAY
     ==================================================================== */
  function viewToday() {
    const t = E.today(), p = E.plan(t), b = E.blockInfo(t);
    const title = draft ? "Workout in progress" : p.reason === "done" ? "Session done" : p.reason === "scheduled" ? `${p.primary.label} day` : p.reason === "catchup" ? "Catch-up day" : "Rest day";
    return `
      <header class="top">
        <div><div class="eyebrow">${esc(E.fmtDate(t, { weekday: "long", day: "numeric", month: "long" }))}</div><h1>${esc(title)}</h1></div>
        <span class="chip ${b.deload || b.due ? "ember" : ""}">${b.deload ? "Deload week" : b.due ? "Deload due" : `Week ${b.week} of ${b.target}`}</span>
      </header>
      ${weekStrip(t, p)}
      ${heroCard(p)}
      ${headsUpBlock(t)}
      ${habitsCard(t)}
      ${weighCard(t)}`;
  }

  function weekStrip(t, p) {
    const mon = E.mondayOf(t), doneKeys = new Set(p.done.map((s) => s.day));
    let h = '<div class="week" aria-label="This week">';
    for (let i = 0; i < 7; i++) {
      const d = E.addDays(mon, i), planned = P.days.find((x) => x.dow === i + 1);
      const did = p.done.some((s) => s.date === d);
      let cls = did ? "done" : planned ? (d < t && !doneKeys.has(planned.key) ? "miss" : "plan") : "off";
      const label = did ? "trained" : planned ? (cls === "miss" ? `missed ${planned.label}` : planned.label) : "rest";
      h += `<div class="wd ${cls} ${d === t ? "today" : ""}" title="${esc(E.fmtDate(d))}: ${esc(label)}"><b>${"MTWTFSS"[i]}</b><i></i></div>`;
    }
    return h + "</div>";
  }

  function previewList(day, max = 4) {
    const rows = day.ex.slice(0, max).map((k) => {
      const t = E.target(k);
      const show = ["up", "reps", "stall", "new", "deload"].includes(t.status);
      return `<li><span>${esc(EX[k].name)}${show ? badge(k, t) : ""}</span><span class="tw">${esc(wl(k, t.w))} · ${esc(repsLabel(k, t))}</span></li>`;
    }).join("");
    const more = day.ex.length > max ? `<li><span class="muted">+ ${day.ex.length - max} more</span><span></span></li>` : "";
    return `<ul class="preview">${rows}${more}</ul>`;
  }

  function heroCard(p) {
    if (draft) {
      const day = E.dayByKey(draft.day);
      const all = Object.values(draft.ex).reduce((a, e) => a + e.sets.length, 0);
      const done = Object.values(draft.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
      return `<section class="card hero"><div class="kicker">In progress</div><h2>${esc(day.label)}</h2>
        <div class="muted">${done} of ${all} sets · started ${Math.max(1, Math.round((Date.now() - draft.start) / 60000))} min ago</div>
        <div class="progressbar"><i style="width:${all ? (done / all) * 100 : 0}%"></i></div>
        <div style="margin-top:16px"><button class="btn primary big" data-act="resume">Resume workout</button></div>
        <div class="alt"><button class="btn ghost sm" data-act="discard">Discard</button></div></section>`;
    }
    if (p.reason === "done") {
      const s = p.doneToday, day = E.dayByKey(s.day), nx = E.nextScheduled();
      const sets = Object.values(s.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
      return `<section class="card hero"><div class="kicker">Done today ✓</div><h2>${esc(day ? day.label : "Workout")}</h2>
        <div class="muted">${Math.round((s.end - s.start) / 60000)} min · ${sets} sets logged</div>
        ${nx ? `<p class="muted small" style="margin:12px 0 0">Next up: <b style="color:var(--text)">${esc(nx.day.label)}</b> on ${esc(E.fmtDate(nx.date, { weekday: "long" }))}. Eat, sleep, recover.</p>` : ""}
        <div class="alt" style="gap:8px"><button class="btn sm" data-act="session" data-id="${s.id}">View session</button><button class="btn ghost sm" data-act="choose">Train again</button></div></section>`;
    }
    if (p.primary) {
      const day = p.primary;
      const kicker = p.reason === "catchup" ? `Missed ${day.day} — catch it up` : E.activeDeload() ? "Today · deload" : "Today";
      return `<section class="card hero"><div class="kicker">${esc(kicker)}</div><h2>${esc(day.label)}</h2>
        <div class="muted">${day.ex.length} exercises · ~${estMinutes(day)} min</div>
        ${previewList(day)}
        <button class="btn primary big" data-act="start" data-day="${day.key}">Start workout</button>
        <div class="alt"><button class="btn ghost sm" data-act="choose">Choose a different workout</button></div></section>`;
    }
    const nx = E.nextScheduled();
    return `<section class="card hero"><div class="kicker">Recover</div><h2>Rest day</h2>
      <div class="muted">${p.done.length} of ${P.days.length} sessions done this week.${nx ? ` Next: <b style="color:var(--text)">${esc(nx.day.label)}</b> on ${esc(E.fmtDate(nx.date, { weekday: "long" }))}.` : ""}</div>
      ${nx ? previewList(nx.day, 3) : ""}
      <div class="alt"><button class="btn ghost sm" data-act="choose">Train anyway</button></div></section>`;
  }

  function headsUpBlock(t) {
    const items = E.headsUp(t);
    if (!items.length) return "";
    return `<div class="section-label">Heads up</div><div class="alerts">${items.map((a) => `
      <div class="alert ${a.tone}"><span class="dot"></span><div class="body"><b>${esc(a.title)}</b><span>${esc(a.text)}</span></div>
      ${a.action ? `<button class="btn sm" data-act="alert" data-a="${esc(a.action)}">${esc(a.actionLabel)}</button>` : ""}</div>`).join("")}</div>`;
  }

  function ring(frac) {
    const r = 15, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>${frac <= 0 ? "" : `<circle cx="19" cy="19" r="${r}" fill="none" stroke="var(--ember)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 19 19)"/>`}</svg>`;
  }

  function habitsCard(t) {
    const list = E.habitList(), done = E.habitsOn(t), n = list.filter((h) => done[h.id]).length;
    return `<div class="section-label">Daily habits</div><section class="card">
      <div class="card-head"><div><h2>${n === list.length ? "All done — nice" : `${n} of ${list.length} done`}</h2><span class="muted small">Tap as you go. Resets at midnight.</span></div>${ring(list.length ? n / list.length : 0)}</div>
      <div class="habits">${list.map((h) => `<button class="habit ${done[h.id] ? "on" : ""}" data-act="habit" data-id="${h.id}" aria-pressed="${!!done[h.id]}" title="${esc(h.detail)}"><span class="ic">✓</span><span>${esc(h.label)}</span></button>`).join("")}</div>
    </section>`;
  }

  function weighCard(t) {
    const tr = E.bwTrend(), todayEntry = E.state.bw[t] && !E.state.bw[t].del ? E.state.bw[t].kg : "";
    const label = { ok: "On track", low: "Too slow", high: "Too fast", need: "Trend" }[tr.verdict];
    return `<div class="section-label">Bodyweight</div><section class="card">
      <div class="card-head"><h2>Morning weigh-in</h2>${tr.avg7 ? `<span class="muted small">7-day avg <b class="num" style="color:var(--text);font-size:17px">${tr.avg7.toFixed(1)}</b> kg</span>` : ""}</div>
      <form class="weigh" data-form="bw"><input id="bw-in" name="kg" type="number" inputmode="decimal" step="0.1" min="30" max="250" placeholder="${tr.last ? tr.last.kg : "kg"}" value="${todayEntry}" aria-label="Bodyweight in kg"><button class="btn primary" type="submit">${todayEntry ? "Update" : "Save"}</button></form>
      <div class="verdict"><span class="badge ${tr.verdict}">${label}</span><span>${esc(tr.text)}</span></div>
    </section>`;
  }

  /* ====================================================================
     PROGRESS
     ==================================================================== */
  const charts = {};

  function viewProgress() {
    const ss = E.sessionsSorted(), week = E.weekSessions();
    const keys = Object.keys(EX);
    if (!keys.includes(ui.lift)) ui.lift = "bench";
    const main = ["bench", "squat", "deadlift", "ohp", "row", "incline_bb", "front_squat", "rdl", "pullup", "pullup_w"];
    const others = keys.filter((k) => !main.includes(k));
    return `
      <header class="top"><div><div class="eyebrow">Your numbers</div><h1>Progress</h1></div></header>
      <div class="kpis">
        <div class="kpi"><div class="v">${week.length}<small>/${P.days.length}</small></div><div class="k">This week</div></div>
        <div class="kpi"><div class="v">${E.weekStreak()}</div><div class="k">Week streak</div></div>
        <div class="kpi"><div class="v">${ss.length}</div><div class="k">Workouts</div></div>
      </div>
      <div class="section-label">Strength</div>
      <div class="pills" role="tablist">${main.map((k) => `<button class="pill ${ui.lift === k ? "on" : ""}" data-act="lift" data-k="${k}" role="tab" aria-selected="${ui.lift === k}">${esc(short(k))}</button>`).join("")}
        <select class="pill ${others.includes(ui.lift) ? "on" : ""}" data-change="lift" aria-label="More exercises"><option value="">More…</option>${others.map((k) => `<option value="${k}" ${ui.lift === k ? "selected" : ""}>${esc(EX[k].name)}</option>`).join("")}</select>
      </div>
      ${liftCard(ui.lift)}
      <div class="section-label">Bodyweight & food</div>
      ${bwCard()}
      <div class="section-label">Consistency</div>
      ${heatCard()}
      <div class="section-label">History</div>
      ${historyCard(ss)}`;
  }
  function short(k) {
    return { bench: "Bench", squat: "Squat", deadlift: "Deadlift", ohp: "OHP", row: "Row", incline_bb: "Incline", front_squat: "Front squat", rdl: "RDL", pullup: "Pull-ups", pullup_w: "Wtd pull-ups" }[k] || EX[k].name;
  }

  function liftCard(key) {
    const ex = EX[key], s = E.liftSeries(key), t = E.target(key), isLoad = E.loaded(key);
    const metric = isLoad ? "Estimated 1-rep max" : ex.type === "time" ? "Total hold time" : "Total reps";
    const unit = isLoad ? "kg" : ex.type === "time" ? "sec" : "reps";
    const best = s.length ? Math.max(...s.map((p) => p.score)) : 0;
    const first = s[0], last = s[s.length - 1];
    const delta = s.length > 1 ? last.score - first.score : 0;
    return `<section class="card">
      <div class="card-head"><div><h2>${esc(ex.name)}</h2><span class="muted small">${metric}${isLoad ? " (Epley)" : ""} · per session</span></div></div>
      <div class="big-stat"><span class="v">${s.length ? fw(Math.round(last.score * 10) / 10) : "—"}</span><span class="muted">${unit}</span>
        ${s.length > 1 ? `<span class="trend ${delta >= 0 ? "up" : "stall"}">${delta >= 0 ? "+" : ""}${fw(Math.round(delta * 10) / 10)} since ${esc(E.fmtDate(first.date, { day: "numeric", month: "short" }))}</span>` : ""}</div>
      ${s.length >= 2 ? chart("lift", s.map((p) => ({ d: p.date, y: p.score, tip: `${isLoad ? "≈" + fw(Math.round(p.score * 10) / 10) + " kg 1RM" : p.score + " " + unit}<br>${esc(wl(key, p.w))} × ${p.sets.join(", ")}` })), { unit }) : `<div class="empty">${s.length ? "One session logged — the chart appears after your next one." : "Log this lift and your trend line shows up here."}</div>`}
      <dl class="kv" style="margin-top:14px"><dt>Next session</dt><dd>${esc(wl(key, t.w))} · ${esc(repsLabel(key, t))}</dd><dt>Best</dt><dd>${best ? fw(Math.round(best * 10) / 10) + " " + unit : "—"}</dd><dt>Rule</dt><dd class="rule" style="font-weight:500">${esc(ex.rule)}</dd></dl>
    </section>`;
  }

  function bwCard() {
    const tr = E.bwTrend(), s = tr.series, kc = E.state.settings.kcal;
    const avgAt = (d) => { const xs = s.filter((p) => p.date <= d && E.diffDays(d, p.date) < 7); return xs.reduce((a, p) => a + p.kg, 0) / xs.length; };
    const pts = s.slice(-90).map((p) => ({ d: p.date, y: avgAt(p.date), raw: p.kg, tip: `${p.kg} kg logged<br>7-day avg ${avgAt(p.date).toFixed(1)} kg` }));
    const label = { ok: "On track", low: "Too slow", high: "Too fast", need: "Building trend" }[tr.verdict];
    return `<section class="card">
      <div class="card-head"><div><h2>Lean gain tracker</h2><span class="muted small">Target ${P.nutrition.gainPerWeek.join("–")} kg/week</span></div></div>
      <div class="big-stat"><span class="v">${tr.rate != null ? (tr.rate >= 0 ? "+" : "") + tr.rate.toFixed(2) : "—"}</span><span class="muted">kg/week</span>${tr.avg7 ? `<span class="muted">· avg ${tr.avg7.toFixed(1)} kg</span>` : ""}</div>
      ${pts.length >= 2 ? chart("bw", pts, { unit: "kg", raw: true }) + `<div class="legend"><span><i style="background:var(--ember)"></i>7-day average</span><span><i style="background:var(--faint);border-radius:50%"></i>Daily weigh-in</span></div>` : `<div class="empty">Weigh-ins from the Today tab build this chart.</div>`}
      <div class="verdict"><span class="badge ${tr.verdict}">${label}</span><span>${esc(tr.text)}</span></div>
      <div class="field" style="margin-top:12px;border-top:1px solid var(--line)"><label>Daily calories<small>Plan range ${P.nutrition.calories.join("–")} kcal</small></label>
        <div class="mini"><button class="step" data-act="kcal" data-d="-50" aria-label="Less">−</button><span class="v">${kc}</span><button class="step" data-act="kcal" data-d="50" aria-label="More">+</button></div></div>
      ${tr.adjust ? `<button class="btn primary" style="width:100%;margin-top:8px" data-act="kcal-apply" data-d="${tr.adjust}">Apply suggestion: ${kc + tr.adjust} kcal/day</button>` : ""}
      <dl class="kv" style="margin-top:12px"><dt>Protein</dt><dd>${P.nutrition.protein.join("–")} g</dd><dt>Fat</dt><dd>${P.nutrition.fat.join("–")} g</dd><dt>Carbs</dt><dd>${esc(P.nutrition.carbs)}</dd><dt>Creatine</dt><dd>${esc(P.nutrition.creatine)}</dd><dt>Sleep</dt><dd>${esc(P.nutrition.sleep)}</dd></dl>
    </section>`;
  }

  function heatCard() {
    const t = E.today(), weeks = 17, start = E.addDays(E.mondayOf(t), -7 * (weeks - 1));
    const trained = new Set(E.sessionsSorted().map((s) => s.date));
    let cells = "", tDays = 0, hSum = 0, hN = 0;
    for (let i = 0; i < weeks * 7; i++) {
      const d = E.addDays(start, i);
      if (d > t) { cells += '<i class="f"></i>'; continue; }
      const h = E.habitScore(d);
      if (E.diffDays(t, d) < 28) { hSum += h; hN++; if (trained.has(d)) tDays++; }
      const cls = trained.has(d) ? "t" : h >= 0.7 ? "h2" : h > 0 ? "h1" : "";
      cells += `<i class="${cls}" title="${esc(E.fmtDate(d))}${trained.has(d) ? " · trained" : ""}${h ? ` · habits ${Math.round(h * 100)}%` : ""}"></i>`;
    }
    return `<section class="card">
      <div class="card-head"><div><h2>Last 4 months</h2><span class="muted small">Last 28 days: ${tDays} sessions · habits ${hN ? Math.round((hSum / hN) * 100) : 0}%</span></div></div>
      <div class="heat" aria-label="Training and habits calendar">${cells}</div>
      <div class="legend"><span><i style="background:var(--ember)"></i>Trained</span><span><i style="background:color-mix(in srgb,var(--ember) 45%,var(--surface-2))"></i>Habits 70%+</span><span><i style="background:color-mix(in srgb,var(--ember) 22%,var(--surface-2))"></i>Some habits</span></div>
    </section>`;
  }

  function historyCard(ss) {
    if (!ss.length) return `<section class="card"><div class="empty">Finished workouts land here.</div></section>`;
    const all = ss.slice().reverse(), shown = ui.allHistory ? all : all.slice(0, 6);
    const rows = shown.map((s) => {
      const day = E.dayByKey(s.day), sets = Object.values(s.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
      return `<li><button class="row" data-act="session" data-id="${s.id}"><span class="l"><b>${esc(day ? day.label : s.day)}${s.deload ? ' <span class="trend deload">deload</span>' : ""}</b><span>${esc(E.fmtDate(s.date))}</span></span><span class="r">${sets} sets<small>${Math.round((s.end - s.start) / 60000)} min</small></span></button></li>`;
    }).join("");
    return `<section class="card" style="padding-top:4px;padding-bottom:4px"><ul class="list">${rows}</ul>${all.length > 6 ? `<div class="alt" style="margin:0 0 10px"><button class="btn ghost sm" data-act="hist">${ui.allHistory ? "Show less" : `Show all ${all.length}`}</button></div>` : ""}</section>`;
  }

  /* ---------- tiny SVG line chart with hover */
  function chart(id, pts, { unit = "", raw = false } = {}) {
    const W = 340, H = 170, L = 36, R = 10, T = 10, B = 22;
    const d0 = pts[0].d, xs = pts.map((p) => E.diffDays(p.d, d0)), span = Math.max(1, xs[xs.length - 1]);
    const ys = pts.map((p) => p.y).concat(raw ? pts.map((p) => p.raw) : []);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const padY = Math.max((hi - lo) * 0.15, unit === "kg" ? 1 : 2);
    lo -= padY; hi += padY;
    const niceStep = (r) => { const s = r / 3, m = Math.pow(10, Math.floor(Math.log10(s))); return [1, 2, 2.5, 5, 10].map((k) => k * m).find((k) => k >= s); };
    const st = niceStep(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    const X = (x) => L + ((W - L - R) * x) / span, Y = (y) => T + (H - T - B) * (1 - (y - lo) / (hi - lo));
    let g = "";
    for (let v = lo; v <= hi + 1e-9; v += st) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${fw(Math.round(v * 10) / 10)}</text>`;
    const fmtD = (d) => E.fmtDate(d, { day: "numeric", month: "short" });
    g += `<text class="axis" x="${L}" y="${H - 4}">${esc(fmtD(pts[0].d))}</text><text class="axis" x="${W - R}" y="${H - 4}" text-anchor="end">${esc(fmtD(pts[pts.length - 1].d))}</text>`;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
    const rawDots = raw ? pts.map((p, i) => `<circle class="raw" cx="${X(xs[i])}" cy="${Y(p.raw)}" r="2.5"/>`).join("") : "";
    const dots = !raw && pts.length <= 40 ? pts.map((p, i) => `<circle class="pt" cx="${X(xs[i])}" cy="${Y(p.y)}" r="4"/>`).join("") : "";
    charts[id] = { pts: pts.map((p, i) => ({ x: X(xs[i]), y: Y(p.y), d: p.d, tip: p.tip })), W, H, T, B };
    return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${g}${rawDots}<path class="line" d="${path}"/>${dots}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><circle class="pt hov" r="5" style="display:none"/></svg></div>`;
  }
  function chartHover(e) {
    const el = e.target.closest(".chart");
    if (!el) return;
    const c = charts[el.dataset.chart]; if (!c) return;
    const svg = el.querySelector("svg"), r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.W;
    let best = c.pts[0];
    for (const p of c.pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    const xh = svg.querySelector(".xh"), hv = svg.querySelector(".hov");
    xh.setAttribute("x1", best.x); xh.setAttribute("x2", best.x); xh.style.display = "";
    hv.setAttribute("cx", best.x); hv.setAttribute("cy", best.y); hv.style.display = "";
    let tip = el.querySelector(".tip");
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; el.appendChild(tip); }
    tip.innerHTML = `${esc(E.fmtDate(best.d))}<br><b>${best.tip}</b>`;
    const px = (best.x / c.W) * r.width, py = (best.y / c.H) * r.height - 10;
    tip.style.left = Math.min(Math.max(px, 70), r.width - 70) + "px";
    tip.style.top = py + "px";
  }
  function chartLeave(e) {
    const el = e.target;
    if (!el.classList || !el.classList.contains("chart")) return;
    el.querySelectorAll(".xh,.hov").forEach((n) => (n.style.display = "none"));
    const tip = el.querySelector(".tip"); if (tip) tip.remove();
  }

  /* ====================================================================
     PLAN
     ==================================================================== */
  function viewPlan() {
    const st = E.state.settings, cfg = E.syncCfg();
    let theme = "auto"; try { theme = localStorage.getItem("rof-theme") || "auto"; } catch (e) {}
    const days = P.days.map((d) => `
      <details class="card" ${ui.openDay === d.key ? "open" : ""} data-day="${d.key}"><summary><div><h2>${esc(d.label)}</h2><span class="muted small">${esc(d.day)} · ${d.ex.length} exercises</span></div></summary>
        <div class="inner"><ul class="list">${d.ex.map((k) => { const t = E.target(k); return `
          <li><button class="row" data-act="setw" data-k="${k}"><span class="l"><b>${esc(EX[k].name)}</b><span>${esc(rangeLabel(k))}${EX[k].warmup ? " · warm-up ramp" : ""}</span><span class="rule" style="display:block">${esc(EX[k].rule)}</span></span><span class="r">${esc(wl(k, t.w))}<small>${EX[k].kind === "none" ? "" : "tap to set"}</small></span></button></li>`; }).join("")}</ul></div></details>`).join("");

    const chores = E.choreList().map((c) => { const s = E.choreStatus(c); return `
      <li><div class="row"><span class="l"><b>${esc(c.label)}</b><span>Every ${c.every} days${c.note ? " · " + esc(c.note) : ""} · ${s.known ? (s.due ? `<b style="display:inline;color:var(--amber)">due</b>` : `next in ${s.left} d`) : "not tracked yet"}</span></span><button class="btn sm" data-act="chore" data-id="${c.id}">${c.group === "Kit" ? "Bought" : "Done"}</button></div></li>`; }).join("");

    const toggles = [["adapalene", "Adapalene (habit)", "Shows a nightly tick-off"], ["adapgel", "Adapalene (restock)", "Restock reminder"], ["lotion", "Body lotion", "Restock reminder"]];

    return `
      <header class="top"><div><div class="eyebrow">Reign of Fire</div><h1>Plan</h1></div></header>
      <div class="section-label">Training · 4 days a week</div>
      <div class="stack">${days}</div>

      <div class="section-label">How the app coaches you</div>
      <details class="card"><summary><div><h2>The rules</h2><span class="muted small">Your programme notes — the app applies these automatically</span></div></summary>
        <div class="inner note">${P.notes.map(([h, b]) => `<p><b>${esc(h)}</b>${esc(b)}</p>`).join("")}
        <p><b>What the app does for you</b>Pre-fills every weight and rep target from your last session, works out warm-up sets and plates per side, starts the right rest timer, holds weight after a miss, flags a lift stuck for 3 sessions, schedules your deload week and reads your weigh-ins to tune calories.</p></div></details>

      <div class="section-label">Skin & grooming</div>
      <details class="card"><summary><div><h2>Routine</h2><span class="muted small">AM, PM, body, grooming, habits</span></div></summary>
        <div class="inner"><table class="routine">${P.skincare.map(([cat, step, what, note]) => `<tr><td>${esc(cat)}<br><b style="color:var(--text)">${esc(step)}</b></td><td>${esc(what)}${note ? `<small>${esc(note)}</small>` : ""}</td></tr>`).join("")}</table>
        <div style="margin-top:12px">${toggles.map(([id, l, s]) => `<div class="field"><label>${esc(l)}<small>${esc(s)}</small></label><button class="toggle ${st.optional[id] ? "on" : ""}" data-act="opt" data-id="${id}" role="switch" aria-checked="${!!st.optional[id]}" aria-label="${esc(l)}"></button></div>`).join("")}</div></div></details>
      <section class="card" style="margin-top:14px;padding-top:4px;padding-bottom:4px"><ul class="list">${chores}</ul></section>

      <div class="section-label">Settings</div>
      <section class="card">
        ${miniField("Barbell weight", "Used for plates & warm-ups", "bar", st.bar, " kg", 2.5)}
        ${miniField("Dumbbell jumps", "Smallest DB increase at your gym", "dbStep", st.dbStep, " kg", 0.5)}
        ${miniField("Rest · heavy lifts", "Bench, squat, deadlift, OHP, rows", "restLong", st.restLong, "s", 15)}
        ${miniField("Rest · accessories", "Isolation & accessory work", "restShort", st.restShort, "s", 15)}
        ${miniField("Deload every", "This training week is the easy one", "deloadWeek", st.deloadWeek, " wk", 1)}
        <div class="field"><label>Timer sound<small>Beep + buzz when rest ends</small></label><button class="toggle ${st.sound ? "on" : ""}" data-act="sound" role="switch" aria-checked="${!!st.sound}" aria-label="Timer sound"></button></div>
        <div class="field"><label>Theme</label><div class="btn-row">${["auto", "dark", "light"].map((t) => `<button class="pill ${theme === t ? "on" : ""}" data-act="theme" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div></div>
      </section>

      <div class="section-label">Sync between devices</div>
      <section class="card">
        <p class="muted small" style="margin-top:0">Optional. Your data lives on this device. To use it on your phone <i>and</i> laptop, paste a GitHub token with only the <b>gist</b> scope — the app keeps a private gist in your account and merges both ways.</p>
        ${cfg.token ? `<div class="field"><label>Connected<small>${cfg.last ? "Last sync " + new Date(cfg.last).toLocaleString() : "Not synced yet"}${cfg.error ? ` · <span style="color:var(--amber)">${esc(cfg.error)}</span>` : ""}</small></label><button class="btn primary sm" data-act="sync">Sync now</button></div>
          <div class="btn-row" style="margin-top:6px"><button class="btn ghost sm" data-act="unsync">Disconnect</button></div>`
        : `<form data-form="token" class="weigh"><input class="text-in" name="token" type="password" autocomplete="off" placeholder="ghp_… or github_pat_…" aria-label="GitHub token" style="font-family:var(--body);font-size:15px"><button class="btn primary" type="submit">Connect</button></form>
          <p class="small" style="margin-bottom:0"><a class="link" href="https://github.com/settings/tokens/new?scopes=gist&description=Reign%20of%20Fire%20tracker" target="_blank" rel="noopener">Create a token (gist scope only) ↗</a></p>`}
      </section>

      <div class="section-label">Your data</div>
      <section class="card"><div class="btn-row">
        <button class="btn sm" data-act="export">Back up (.json)</button>
        <button class="btn sm" data-act="csv">Export log (.csv)</button>
        <button class="btn sm" data-act="import">Restore / merge</button>
        <button class="btn sm danger" data-act="reset">Erase all</button>
      </div><input type="file" id="import-file" accept="application/json,.json" hidden></section>
      <p class="muted small" style="text-align:center;margin-top:20px">Works offline · add to your home screen for an app-like experience</p>`;
  }
  function miniField(label, sub, key, v, unit, step) {
    return `<div class="field"><label>${esc(label)}<small>${esc(sub)}</small></label><div class="mini"><button class="step" data-act="setting" data-k="${key}" data-d="${-step}" aria-label="Decrease">−</button><span class="v">${fw(v)}${unit}</span><button class="step" data-act="setting" data-k="${key}" data-d="${step}" aria-label="Increase">+</button></div></div>`;
  }

  /* ====================================================================
     WORKOUT MODE
     ==================================================================== */
  let wakeLock = null;
  async function keepAwake() { try { if ("wakeLock" in navigator && ui.workoutOpen) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {} }
  function release() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }

  function openWorkout() {
    if (!draft) return;
    ui.workoutOpen = true;
    wk.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    renderWorkout();
    keepAwake();
  }
  function closeWorkout() {
    ui.workoutOpen = false;
    wk.classList.add("hidden");
    document.body.style.overflow = "";
    release();
    render();
  }
  const persist = () => E.setDraft(draft);

  function renderWorkout() {
    if (!draft) return;
    const day = E.dayByKey(draft.day);
    const keys = Object.keys(draft.ex);
    wk.innerHTML = `
      <div class="wk-bar"><button class="icon-btn" data-act="wk-min" aria-label="Back to Today">${icon.back}</button>
        <div class="t"><h2>${esc(day.label)}${draft.deload ? ' <span class="trend deload">deload</span>' : ""}</h2><div class="sub"><span id="wk-clock">${mmss(Math.floor((Date.now() - draft.start) / 1000))}</span> · <span id="wk-count"></span></div><div class="progressbar"><i id="wk-prog"></i></div></div>
        <button class="btn primary sm" data-act="wk-finish">Finish</button></div>
      <div class="wk-body">
        <button class="gw ${draft.generalWarm ? "on" : ""}" data-act="wk-gw"><span class="check">✓</span><span>General warm-up<br><span class="muted small" style="font-weight:500">5–10 min light cardio + dynamic mobility</span></span></button>
        ${keys.map((k) => `<div id="card-${k}">${exCard(k)}</div>`).join("")}
        <p class="hint" style="text-align:center">Tap a circle when the set is done · tap again for one less rep · hold to type a number</p>
        <button class="btn big primary" data-act="wk-finish" style="margin-top:8px">Finish workout</button>
      </div>`;
    updateWkHeader();
  }
  function updateWkHeader() {
    if (!draft) return;
    const all = Object.values(draft.ex).reduce((a, e) => a + e.sets.length, 0);
    const done = Object.values(draft.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
    const c = $("#wk-count"), p = $("#wk-prog");
    if (c) c.textContent = `${done}/${all} sets`;
    if (p) p.style.width = (all ? (done / all) * 100 : 0) + "%";
  }
  function exCard(key) {
    const ex = EX[key], e = draft.ex[key], tg = E.target(key, { deload: draft.deload });
    const complete = e.sets.every(Boolean);
    const unitTxt = ex.type === "time" ? "s" : "";
    const step = weightStep(key);
    const warm = ex.warmup ? E.warmupSets(key, e.w) : [];
    const sets = e.sets.map((s, i) => {
      const tr = e.t.reps[i];
      const cls = !s ? "" : ex.type === "amrap" ? "hit amrap" : s.r >= tr ? "hit" : "miss";
      const label = s ? s.r + unitTxt : ex.type === "amrap" ? (tr ? tr : "?") : tr + unitTxt;
      return `<button class="set ${cls}" data-set="${i}" data-k="${key}" aria-label="Set ${i + 1}: ${s ? "logged " + s.r : "target " + (tr || "max")}">${label}<span class="sn">${i + 1}</span></button>`;
    }).join("");
    const last = tg.last ? `${esc(wl(key, tg.last.w))} × ${tg.last.sets.map((x) => (x ? x.r : "–")).join(", ")}${tg.lastDate ? ` <span class="small">(${esc(E.fmtDate(tg.lastDate))})</span>` : ""}` : "First time";
    return `<article class="card ex ${complete ? "complete" : ""}">
      <div class="ex-top"><h3 class="ex-name">${esc(ex.name)}</h3><button class="icon-btn" style="width:36px;height:36px;color:var(--muted)" data-act="wk-info" data-k="${key}" aria-label="Details" aria-expanded="${!!ui.info[key]}">${icon.info}</button></div>
      <div class="ex-target">${esc(repsLabel(key, e.t))}${ex.kind !== "none" ? ` · <b style="color:var(--text)">${esc(wl(key, e.t.w))}</b>` : ""} ${badge(key, tg)}</div>
      ${tg.msg && tg.status !== "hold" ? `<div class="ex-msg ${tg.status}">${esc(tg.msg)}</div>` : tg.status === "hold" ? `<div class="ex-msg">${esc(tg.msg)}</div>` : ""}
      ${ex.kind !== "none" ? `<div class="wrow"><button class="step" data-act="wk-w" data-k="${key}" data-d="${-step}" aria-label="Less weight">−</button><div class="wval">${ex.kind === "bw" && e.w === 0 ? "BW" : fw(e.w)}<small>${ex.kind === "bw" && e.w === 0 ? "" : ex.kind === "bw" ? "kg +" : "kg"}</small></div><button class="step" data-act="wk-w" data-k="${key}" data-d="${step}" aria-label="More weight">+</button><div class="plates">${esc(plateText(key, e.w))}${ex.kind === "db" ? "per dumbbell" : ""}</div></div>` : ""}
      ${warm.length ? `<div class="warm"><span class="lbl">Warm-up ramp</span>${warm.map((w, i) => `<button class="wu ${e.warm[i] ? "on" : ""}" data-act="wk-wu" data-k="${key}" data-i="${i}">${w.label === "Bar" ? "Bar" : fw(w.w)} × ${w.r}</button>`).join("")}</div>` : ""}
      <div class="sets">${sets}</div>
      ${ui.info[key] ? `<div class="info"><div><b>Rule:</b> ${esc(ex.rule)}</div><div><b>Last time:</b> ${last}</div><div><b>Rest:</b> ${mmss(restFor(key))} between sets</div>${tg.status === "stall" ? `<button class="btn sm" data-act="wk-reset" data-k="${key}">Reset to ${fw(E.roundFor(ex.kind, (tg.last ? tg.last.w : e.w) * 0.9))} kg for today</button>` : ""}</div>` : ""}
    </article>`;
  }
  function weightStep(key) {
    const ex = EX[key];
    if (ex.kind === "db") return E.state.settings.dbStep;
    if (ex.kind === "bw") return ex.inc || 2.5;
    return ex.kind === "machine" ? ex.inc : 2.5;
  }
  function refreshCard(key) { const c = $("#card-" + key); if (c) c.innerHTML = exCard(key); updateWkHeader(); }

  function nextOpen(afterKey) {
    const keys = Object.keys(draft.ex);
    for (let i = keys.indexOf(afterKey) + 1; i < keys.length; i++) if (!draft.ex[keys[i]].sets.every(Boolean)) return keys[i];
    return null;
  }
  function anyOpenSets() { return Object.values(draft.ex).some((e) => e.sets.some((s) => !s)); }

  function logSet(key, i, r, fresh) {
    const e = draft.ex[key];
    e.sets[i] = r == null ? null : { r };
    persist();
    refreshCard(key);
    if (fresh && r != null) {
      vibrate(15);
      if (anyOpenSets()) {
        const doneEx = e.sets.every(Boolean);
        const nk = doneEx ? nextOpen(key) : key;
        startRest(restFor(key), nk ? (doneEx ? `Next: ${EX[nk].name}` : `Next: set ${e.sets.findIndex((s) => !s) + 1}`) : "Last sets left");
        if (doneEx && nk) setTimeout(() => { const c = $("#card-" + nk); c && c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 350);
      } else { stopRest(); toast("All sets done — hit Finish 🔥"); }
    }
  }
  function tapSet(key, i) {
    unlockAudio();
    const ex = EX[key], e = draft.ex[key], cur = e.sets[i];
    if (!cur) {
      if (ex.type === "amrap") return setEditor(key, i);
      return logSet(key, i, e.t.reps[i], true);
    }
    const nr = cur.r - (ex.type === "time" ? 5 : 1);
    logSet(key, i, nr < 0 ? null : nr, false);
    vibrate(8);
  }

  function setEditor(key, i) {
    const ex = EX[key], e = draft.ex[key], wasEmpty = !e.sets[i];
    const tgt = e.t.reps[i] || 8, isT = ex.type === "time", st = isT ? 5 : 1;
    let v = e.sets[i] ? e.sets[i].r : tgt;
    const quick = () => { const out = []; for (let d = -3; d <= 3; d++) { const q = tgt + d * (isT ? 10 : 1); if (q >= 0) out.push(q); } return out; };
    const body = () => `<h3>${esc(ex.name)}</h3><div class="muted">Set ${i + 1} · target ${ex.type === "amrap" ? "as many as possible" : tgt + (isT ? " sec" : " " + E.unit(key))}</div>
      <div class="bigstep"><button class="step" data-act="dn" aria-label="Less">−</button><div class="v" id="ed-v">${v}</div><button class="step" data-act="upv" aria-label="More">+</button></div>
      <div class="quick">${quick().map((q) => `<button data-act="q" data-v="${q}" class="${q === v ? "on" : ""}">${q}</button>`).join("")}</div>
      <div class="actions"><button class="btn" data-act="clear">${wasEmpty ? "Cancel" : "Clear set"}</button><button class="btn primary" data-act="save">Save</button></div>`;
    const s = sheet(body(), {
      dn: (_, c, el) => { v = Math.max(0, v - st); el.querySelector(".sheet").innerHTML = '<div class="grab"></div>' + body(); },
      upv: (_, c, el) => { v += st; el.querySelector(".sheet").innerHTML = '<div class="grab"></div>' + body(); },
      q: (b, c, el) => { v = +b.dataset.v; el.querySelector(".sheet").innerHTML = '<div class="grab"></div>' + body(); },
      clear: (_, c) => { c(); if (!wasEmpty) logSet(key, i, null, false); },
      save: (_, c) => { c(); unlockAudio(); logSet(key, i, v, wasEmpty); },
    });
    return s;
  }

  async function finishFlow() {
    const ex = Object.entries(draft.ex);
    const touched = ex.filter(([, e]) => e.sets.some(Boolean));
    if (!touched.length) {
      if (await confirmSheet({ title: "Nothing logged yet", text: "Discard this workout? Nothing will be saved.", ok: "Discard", danger: true })) { E.setDraft(null); draft = null; stopRest(); closeWorkout(); }
      return;
    }
    const skipped = ex.filter(([, e]) => !e.sets.some(Boolean)).map(([k]) => EX[k].name);
    const partial = touched.filter(([, e]) => e.sets.some((s) => !s)).map(([k]) => EX[k].name);
    if (skipped.length || partial.length) {
      const txt = [skipped.length ? `<b>Skipped</b> (won't affect progression): ${esc(skipped.join(", "))}.` : "", partial.length ? `<b>Unfinished sets</b> count as missed, so the weight holds next time: ${esc(partial.join(", "))}.` : ""].filter(Boolean).join("<br><br>");
      if (!(await confirmSheet({ title: "Finish now?", text: txt, ok: "Finish", cancel: "Keep going" }))) return;
    }
    const res = E.finishDraft(draft);
    draft = null;
    stopRest();
    closeWorkout();
    const tt = $(".toast"); if (tt) tt.remove();
    summary(res);
    autoSync(true);
  }

  function describeChange(c) {
    const k = c.key, ex = EX[k], to = c.to;
    const u = ex.type === "time" ? "s" : "";
    if (ex.kind !== "none" && to.w !== c.from.w) return `${wl(k, c.from.w)} → <b>${wl(k, to.w)}</b>`;
    const fr = Math.min(...(c.from.reps.length ? c.from.reps : [0])), tr = Math.min(...to.reps);
    if (ex.type === "amrap") return `beat ${c.did.reduce((a, b) => a + b, 0)} reps`;
    if (tr !== fr) return `${fr}${u} → <b>${tr}${u}</b> ${E.unit(k) === "sec" ? "" : E.unit(k)}`;
    return `<span class="muted">repeat</span>`;
  }
  function summary(res) {
    const day = E.dayByKey(res.session.day);
    const vol = res.volume >= 1000 ? (res.volume / 1000).toFixed(1) + "t" : Math.round(res.volume) + "kg";
    sheet(`<div style="color:var(--ember)">${icon.flame}</div><h3>${esc(day.label)} complete</h3><div class="muted">${res.session.deload ? "Deload session — progression untouched." : "Your next targets are already set."}</div>
      <div class="summary-stats"><div class="stat"><div class="v">${res.mins}</div><div class="k">minutes</div></div><div class="stat"><div class="v">${res.setsDone}</div><div class="k">sets</div></div><div class="stat"><div class="v">${vol}</div><div class="k">volume</div></div></div>
      ${res.prs.map((p) => `<div class="pr">${icon.flame}<span>New best: ${esc(EX[p.key].name)} <span class="muted small">(${E.loaded(p.key) ? "≈" + fw(Math.round(p.cur * 10) / 10) + " kg 1RM" : p.cur + " " + E.unit(p.key)})</span></span></div>`).join("")}
      ${res.session.deload ? "" : `<div class="section-label" style="margin-left:0">Next time</div><ul class="changes">${res.changes.map((c) => `<li><span>${esc(EX[c.key].name)}</span><span class="to">${describeChange(c)}</span></li>`).join("")}</ul>`}
      <div class="actions"><button class="btn primary big" data-act="ok">Done</button></div>`, { ok: (_, c) => c() });
  }

  /* ---------- rest timer */
  let rest = null, restTick = null, actx = null;
  function unlockAudio() {
    if (!E.state.settings.sound) return;
    try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {}
  }
  function beep() {
    if (!E.state.settings.sound || !actx) return;
    try {
      const t0 = actx.currentTime;
      [0, 0.22, 0.44].forEach((d, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = i === 2 ? 1175 : 880; o.type = "sine";
        g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
        o.connect(g).connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + 0.2);
      });
    } catch (e) {}
  }
  function startRest(sec, label) {
    rest = { end: Date.now() + sec * 1000, total: sec, label, fired: false };
    restEl.classList.remove("hidden", "done");
    clearInterval(restTick); restTick = setInterval(tickRest, 250); tickRest();
  }
  function stopRest() { rest = null; clearInterval(restTick); restTick = null; restEl.classList.add("hidden"); }
  function tickRest() {
    if (!rest) return stopRest();
    const left = Math.ceil((rest.end - Date.now()) / 1000);
    if (left <= 0 && !rest.fired) { rest.fired = true; beep(); vibrate([220, 120, 220]); restEl.classList.add("done"); }
    if (left < -25) return stopRest();
    const pct = Math.max(0, Math.min(100, (1 - (rest.end - Date.now()) / (rest.total * 1000)) * 100));
    restEl.innerHTML = left > 0
      ? `<span class="tm">${mmss(left)}</span><span class="lbl">Rest<br>${esc(rest.label)}</span><button data-r="-15" aria-label="15 seconds less">−15</button><button data-r="30" aria-label="30 seconds more">+30</button><button data-r="skip">Skip</button><i class="bar" style="width:${pct}%"></i>`
      : `<span class="tm">GO</span><span class="lbl">Rest over<br>${esc(rest.label)}</span><button data-r="skip">OK</button>`;
  }
  restEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-r]"); if (!b || !rest) return;
    if (b.dataset.r === "skip") return stopRest();
    rest.end += +b.dataset.r * 1000; rest.total += +b.dataset.r; rest.fired = false; restEl.classList.remove("done"); tickRest();
  });

  /* ---------- workout events (tap / long-press on set circles) */
  let press = null;
  wk.addEventListener("pointerdown", (e) => {
    const s = e.target.closest(".set"); if (!s) return;
    press = { el: s, x: e.clientX, y: e.clientY, long: false, t: setTimeout(() => { if (!press) return; press.long = true; vibrate(25); setEditor(s.dataset.k, +s.dataset.set); }, 450) };
  });
  wk.addEventListener("pointermove", (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.t); press = null; } });
  wk.addEventListener("pointercancel", () => { if (press) clearTimeout(press.t); press = null; });
  wk.addEventListener("pointerup", (e) => {
    if (!press) return;
    clearTimeout(press.t);
    const s = e.target.closest(".set");
    if (!press.long && s === press.el) tapSet(s.dataset.k, +s.dataset.set);
    press = null;
  });
  wk.addEventListener("contextmenu", (e) => { if (e.target.closest(".set")) e.preventDefault(); });
  wk.addEventListener("click", (e) => {
    const s = e.target.closest(".set");
    if (s && e.detail === 0) return tapSet(s.dataset.k, +s.dataset.set); // keyboard
    const a = e.target.closest("[data-act]"); if (!a || !draft) return;
    const k = a.dataset.k, act = a.dataset.act;
    if (act === "wk-min") closeWorkout();
    else if (act === "wk-finish") finishFlow();
    else if (act === "wk-gw") { draft.generalWarm = !draft.generalWarm; persist(); a.classList.toggle("on", draft.generalWarm); }
    else if (act === "wk-info") { ui.info[k] = !ui.info[k]; refreshCard(k); }
    else if (act === "wk-w") { const e2 = draft.ex[k]; e2.w = Math.max(0, Math.round((e2.w + +a.dataset.d) * 100) / 100); persist(); refreshCard(k); }
    else if (act === "wk-wu") { const e2 = draft.ex[k]; e2.warm[+a.dataset.i] = !e2.warm[+a.dataset.i]; persist(); refreshCard(k); if (e2.warm[+a.dataset.i]) { unlockAudio(); startRest(60, "Warm-up · keep building"); } }
    else if (act === "wk-reset") { const e2 = draft.ex[k], ex = EX[k], tg = E.target(k); e2.w = E.roundFor(ex.kind, (tg.last ? tg.last.w : e2.w) * 0.9); persist(); refreshCard(k); toast(`${ex.name} reset to ${fw(e2.w)} kg`); }
  });

  /* ====================================================================
     TAB ACTIONS
     ==================================================================== */
  function chooseWorkout() {
    sheet(`<h3>Pick a workout</h3><div class="muted">Targets carry over no matter which day you train.</div><ul class="list" style="margin-top:8px">${P.days.map((d) => `<li><button class="row" data-act="go" data-day="${d.key}"><span class="l"><b>${esc(d.label)}</b><span>${esc(d.day)} · ${d.ex.length} exercises</span></span><span class="r">~${estMinutes(d)}<small>min</small></span></button></li>`).join("")}</ul>`,
      { go: (b, c) => { c(); startWorkout(b.dataset.day); } });
  }
  function startWorkout(dayKey) {
    unlockAudio();
    draft = E.newDraft(dayKey);
    ui.info = {};
    wk.scrollTop = 0;
    openWorkout();
  }

  function sessionSheet(id) {
    const s = E.state.sessions[id]; if (!s) return;
    const day = E.dayByKey(s.day);
    const rows = Object.entries(s.ex).map(([k, e]) => `<li><div class="row"><span class="l"><b>${esc(EX[k] ? EX[k].name : k)}</b><span>${esc(EX[k] ? wl(k, e.w) : e.w)}</span></span><span class="r">${e.sets.map((x) => (x ? x.r : "–")).join(" · ")}</span></div></li>`).join("");
    sheet(`<h3>${esc(day ? day.label : "Workout")}</h3><div class="muted">${esc(E.fmtDate(s.date, { weekday: "long", day: "numeric", month: "long" }))} · ${Math.round((s.end - s.start) / 60000)} min${s.deload ? " · deload" : ""}</div><ul class="list" style="margin-top:10px">${rows}</ul>
      <div class="actions"><button class="btn danger" data-act="del">Delete</button><button class="btn primary" data-act="ok">Close</button></div>`,
      { ok: (_, c) => c(), del: async (_, c) => { c(); if (await confirmSheet({ title: "Delete this session?", text: "Targets will recalculate from your remaining history.", ok: "Delete", danger: true })) { E.deleteSession(id); toast("Session deleted"); } } });
  }

  function setWeightSheet(key) {
    const ex = EX[key]; if (ex.kind === "none") return;
    const t = E.target(key, { deload: false });
    let w = t.w; const st = weightStep(key);
    const body = () => `<h3>${esc(ex.name)}</h3><div class="muted">Set your working weight. The app progresses from here.</div>
      <div class="bigstep"><button class="step" data-act="dn">−</button><div class="v">${fw(w)}</div><button class="step" data-act="upw">+</button></div>
      <div class="muted small" style="text-align:center">${esc(ex.kind === "db" ? "kg per dumbbell" : ex.kind === "bw" ? "kg added to bodyweight" : "kg")} ${ex.kind === "barbell" ? "· " + esc(plateText(key, w)) : ""}</div>
      <div class="actions"><button class="btn" data-act="cancel">Cancel</button><button class="btn primary" data-act="save">Save</button></div>`;
    sheet(body(), {
      dn: (_, c, el) => { w = Math.max(0, Math.round((w - st) * 100) / 100); el.querySelector(".sheet").innerHTML = '<div class="grab"></div>' + body(); },
      upw: (_, c, el) => { w = Math.round((w + st) * 100) / 100; el.querySelector(".sheet").innerHTML = '<div class="grab"></div>' + body(); },
      cancel: (_, c) => c(),
      save: (_, c) => { c(); E.resetLift(key, w); toast(`${ex.name}: ${wl(key, w)}`); },
    });
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  const actions = {
    start: (b) => startWorkout(b.dataset.day),
    resume: () => openWorkout(),
    discard: async () => { if (await confirmSheet({ title: "Discard workout?", text: "Sets you've logged in this session will be lost.", ok: "Discard", danger: true })) { E.setDraft(null); draft = null; stopRest(); render(); } },
    choose: () => chooseWorkout(),
    session: (b) => sessionSheet(b.dataset.id),
    habit: (b) => { E.toggleHabit(b.dataset.id); vibrate(8); },
    alert: async (b) => {
      const a = b.dataset.a;
      if (a === "start-deload") { if (await confirmSheet({ title: "Start deload week?", text: "For 7 days: 1–2 fewer sets per exercise at ~65% load, same reps. Progression pauses, then resumes.", ok: "Start deload" })) { E.startDeload(); toast("Deload week started"); } }
      else if (a === "end-deload") { E.endDeload(); toast("Deload ended — back to full targets"); }
      else if (a === "focus-bw") { const i = $("#bw-in"); i && (i.scrollIntoView({ behavior: "smooth", block: "center" }), setTimeout(() => i.focus(), 300)); }
      else if (a.startsWith("chore:")) { E.doChore(a.slice(6)); toast("Logged"); }
      else if (a.startsWith("reset:")) { const k = a.slice(6), t = E.baseTarget(k), w = E.roundFor(EX[k].kind, (t.last ? t.last.w : t.w) * 0.9); E.resetLift(k, w); toast(`${EX[k].name} reset to ${fw(w)} kg`); }
    },
    lift: (b) => { ui.lift = b.dataset.k; render(); },
    hist: () => { ui.allHistory = !ui.allHistory; render(); },
    kcal: (b) => { const s = E.state.settings; s.kcal = Math.max(1200, s.kcal + +b.dataset.d); E.touch(s); E.save(); },
    "kcal-apply": (b) => { const s = E.state.settings; s.kcal += +b.dataset.d; E.touch(s); E.save(); toast(`Calorie target: ${s.kcal} kcal/day`); },
    setw: (b) => setWeightSheet(b.dataset.k),
    chore: (b) => { E.doChore(b.dataset.id); toast("Logged — reminder reset"); },
    opt: (b) => { const s = E.state.settings; s.optional = { ...s.optional, [b.dataset.id]: !s.optional[b.dataset.id] }; E.touch(s); E.save(); },
    setting: (b) => {
      const s = E.state.settings, k = b.dataset.k, lim = { bar: [5, 25], dbStep: [0.5, 5], restLong: [60, 300], restShort: [30, 180], deloadWeek: [4, 8] }[k];
      s[k] = Math.min(lim[1], Math.max(lim[0], Math.round((s[k] + +b.dataset.d) * 100) / 100)); E.touch(s); E.save();
    },
    sound: () => { const s = E.state.settings; s.sound = !s.sound; E.touch(s); E.save(); },
    theme: (b) => { try { localStorage.setItem("rof-theme", b.dataset.t); } catch (e) {} applyTheme(); render(); },
    sync: () => manualSync(),
    unsync: async () => { if (await confirmSheet({ title: "Disconnect sync?", text: "Data stays on this device and in your gist. You can reconnect any time.", ok: "Disconnect" })) { E.setSyncCfg({}); render(); } },
    export: () => download(`reign-of-fire-backup-${E.today()}.json`, E.exportJSON(), "application/json"),
    csv: () => download(`reign-of-fire-log-${E.today()}.csv`, E.exportCSV(), "text/csv"),
    import: () => $("#import-file").click(),
    reset: async () => { if (await confirmSheet({ title: "Erase everything?", text: "All workouts, weigh-ins and habits on this device will be deleted. Back up first if unsure.", ok: "Erase", danger: true })) { E.resetAll(); draft = null; toast("All data erased"); } },
  };

  app.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a && actions[a.dataset.act]) actions[a.dataset.act](a);
  });
  app.addEventListener("change", async (e) => {
    if (e.target.dataset.change === "lift" && e.target.value) { ui.lift = e.target.value; render(); }
    if (e.target.id === "import-file" && e.target.files[0]) {
      try { E.importJSON(await e.target.files[0].text()); draft = E.getDraft(); toast("Backup merged in"); } catch (err) { toast("That file couldn't be read"); }
      e.target.value = "";
    }
  });
  app.addEventListener("toggle", (e) => { if (e.target.dataset && e.target.dataset.day && e.target.open) ui.openDay = e.target.dataset.day; }, true);
  app.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.dataset.form === "bw") {
      const kg = parseFloat(String(f.kg.value).replace(",", "."));
      if (!(kg > 30 && kg < 250)) return toast("Enter your weight in kg");
      E.logBW(Math.round(kg * 10) / 10); toast("Weigh-in saved");
    }
    if (f.dataset.form === "token") {
      const tok = f.token.value.trim(); if (!tok) return;
      E.setSyncCfg({ token: tok }); manualSync();
    }
  });
  app.addEventListener("pointermove", chartHover);
  app.addEventListener("pointerdown", chartHover);
  app.addEventListener("pointerleave", chartLeave, true);

  /* ---------- sync */
  let syncT;
  async function manualSync() {
    try { toast("Syncing…"); await E.sync(); draft = E.getDraft(); toast("Synced with GitHub"); } catch (e) { toast(e.message); }
    render();
  }
  function autoSync(now) {
    if (!E.syncCfg().token) return;
    clearTimeout(syncT);
    syncT = setTimeout(() => E.sync().catch(() => {}), now ? 300 : 8000);
  }

  /* ====================================================================
     RENDER & BOOT
     ==================================================================== */
  const views = { today: viewToday, progress: viewProgress, plan: viewPlan };
  function render() {
    const tab = (location.hash || "#today").slice(1);
    ui.tab = views[tab] ? tab : "today";
    const y = window.scrollY;
    app.innerHTML = `<div class="view">${views[ui.tab]()}</div>`;
    if (render.lastTab === ui.tab) { window.scrollTo(0, y); app.firstElementChild.style.animation = "none"; }
    render.lastTab = ui.tab;
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.dataset.tab === ui.tab));
  }
  E.onChange((o) => {
    if (!ui.workoutOpen) render();
    if (!o.synced) autoSync(o.important);
  });
  window.addEventListener("hashchange", () => { render.lastTab = null; render(); window.scrollTo(0, 0); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { if (ui.workoutOpen) keepAwake(); else render(); if (rest) tickRest(); }
  });

  render();
  if (draft && Date.now() - draft.start < 4 * 3600 * 1000) openWorkout();
  setInterval(() => { // workout clock
    if (!ui.workoutOpen || !draft) return;
    const c = $("#wk-clock"); if (c) c.textContent = mmss(Math.floor((Date.now() - draft.start) / 1000));
  }, 1000);
  if (E.syncCfg().token) E.sync().catch(() => {});
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
