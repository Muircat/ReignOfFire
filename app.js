/* =====================================================================
   Reign of Fire — interface
   Setup → Today · Progress · Me & plan, plus a one-exercise-at-a-time
   workout mode. All maths lives in engine.js; this file draws and reacts.
   ===================================================================== */
(function () {
  "use strict";
  const E = window.Engine, P = window.PLAN, EX = E.EX;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fw = E.fmtW;
  const app = $("#app"), wk = $("#workout"), layer = $("#layer");
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MAIN_LIFTS = ["bench", "squat", "deadlift", "ohp", "row", "incline_bb", "front_squat", "rdl"];

  const ui = { tab: "today", lift: "bench", allHistory: false, openDay: null, setup: null };
  let draft = E.getDraft();

  /* ---------------------------------------------------------- theme (light by default) */
  function theme() { try { return localStorage.getItem("rof-theme") || "light"; } catch (e) { return "light"; } }
  function applyTheme() {
    const t = theme();
    const dark = t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const m = $('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#121212" : "#f8f7f4");
  }
  applyTheme();

  /* ---------------------------------------------------------- helpers */
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
  const restFor = (key) => (EX[key].compound ? E.state.settings.restLong : E.state.settings.restShort);
  const firstName = () => (E.state.profile.name || "").split(" ")[0];

  function wl(key, w) {
    const k = EX[key].kind;
    if (k === "none" || ((k === "bw" || k === "db") && !(w > 0))) return "Bodyweight";
    if (k === "bw") return `BW + ${fw(w)} kg`;
    if (k === "db") return `${fw(w)} kg each`;
    return `${fw(w)} kg`;
  }
  function repsLabel(key, t) {
    const ex = EX[key];
    if (ex.type === "amrap") return `${t.sets} × max`;
    const r = t.reps, same = r.every((x) => x === r[0]);
    const u = ex.type === "time" ? "s" : ex.perSide ? " each leg" : ex.unit === "steps" ? " steps" : "";
    return `${t.sets} × ${same ? r[0] : r.join("/")}${u}`;
  }
  function rangeLabel(key) {
    const ex = EX[key];
    if (ex.type === "amrap") return `${ex.sets} sets of as many as you can`;
    const u = ex.type === "time" ? " sec" : ex.perSide ? " each leg" : ex.unit === "steps" ? " steps" : " reps";
    return `${ex.sets} sets of ${ex.lo === ex.hi ? ex.lo : ex.lo + "–" + ex.hi}${u}`;
  }
  function tiny(key, t) {
    const txt = {
      up: t.last && t.w > t.last.w ? `↑ +${fw(t.w - t.last.w)} kg` : "↑ level up",
      reps: E.unit(key) === "sec" ? "+ time" : "+1 rep",
      stall: "stuck", back: "eased", deload: "light week", new: "new",
    }[t.status];
    return txt ? `<span class="tiny t-${t.status}">${esc(txt)}</span>` : "";
  }
  function estMinutes(day) {
    let s = 8 * 60;
    for (const k of day.ex) { const t = E.target(k); s += t.sets * (restFor(k) + 40); }
    return Math.round(s / 300) * 5;
  }
  const icon = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  };

  /* ---------- barbell picture: one end of the bar with labelled plates in standard colours */
  const PLATE = { 25: ["#e5484d", 74, 22, "#fff"], 20: ["#3e7bfa", 74, 20, "#fff"], 15: ["#f5c518", 66, 19, "#3a2c00"], 10: ["#30a46c", 58, 18, "#fff"], 5: ["#ffffff", 46, 16, "#555"], 2.5: ["#e5484d", 38, 15, "#fff"], 1.25: ["#c9c3bb", 32, 14, "#333"] };
  function barbellPic(total) {
    const ps = E.plates(total);
    const plates = ps.map((p) => { const [c, h, w, ink] = PLATE[p] || ["#999", 30, 14, "#fff"]; return `<span class="plate" style="height:${h}px;width:${w}px;background:${c};color:${ink}"><b>${fw(p)}</b></span>`; }).join("");
    return `<div class="bbar" aria-hidden="true"><span class="shaft"></span><span class="collar"></span>${plates}<span class="sleeve"></span></div>`;
  }
  function loadText(key, w) {
    const ex = EX[key];
    if (ex.kind === "barbell") {
      const bar = E.state.settings.bar, ps = E.plates(w);
      if (w < bar) return `Lighter than the ${bar} kg bar — use a lighter bar or dumbbells`;
      return ps.length ? `Each side: ${ps.join(" + ")} kg` : `Just the empty bar (${bar} kg)`;
    }
    if (ex.kind === "db") return w > 0 ? `Grab two ${fw(w)} kg dumbbells` : "No weights needed";
    if (ex.kind === "machine") return `Set the machine / cable to ${fw(w)} kg`;
    if (ex.kind === "bw") return w > 0 ? `Add ${fw(w)} kg (belt, vest or a dumbbell)` : "Just your bodyweight";
    return "";
  }

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
    const redraw = (h) => { scrim.querySelector(".sheet").innerHTML = '<div class="grab"></div>' + h; };
    return { el: scrim, close, redraw };
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
     SETUP — shown until you press Start
     ==================================================================== */
  function initSetup() {
    const pr = E.state.profile, bw = E.bwSeries();
    ui.setup = {
      step: 0, name: pr.name || "", kg: pr.startKg || (bw.length ? bw[bw.length - 1].kg : ""),
      days: pr.days.slice(), level: pr.level || "new", weights: {},
    };
    resetSetupWeights();
  }
  function resetSetupWeights() {
    const s = ui.setup;
    for (const k of MAIN_LIFTS) s.weights[k] = E.firstWeight(k, s.level);
  }
  function viewSetup() {
    if (!ui.setup) initSetup();
    const s = ui.setup, n = E.sessionsSorted().length;
    const dots = `<div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i <= s.step ? "on" : ""}"></i>`).join("")}</div>`;
    let body = "", next = "Next";
    if (s.step === 0) {
      body = `<img class="logo" src="icon.svg" alt="">
        <h1>Welcome to Reign of Fire</h1>
        <p class="lead">Four workouts, done in order, on whichever days suit you. The app fills in every weight and tells you exactly what to do.</p>
        <label class="small muted" for="su-name" style="font-weight:700">What should we call you?</label>
        <div style="margin-top:8px"><input id="su-name" class="input text" data-su="name" autocomplete="given-name" placeholder="Your name" value="${esc(s.name)}"></div>
        ${n ? `<div class="callout">Welcome back — your ${n} logged workout${n === 1 ? "" : "s"} and weights are kept.</div>` : ""}`;
    } else if (s.step === 1) {
      body = `<h1>What do you weigh today?</h1>
        <p class="lead">Your starting weight. The plan aims for a slow, lean gain of 0.25–0.5 kg a week, and the app tracks it for you.</p>
        <div class="inrow"><input id="su-kg" class="input" data-su="kg" type="number" inputmode="decimal" step="0.1" min="30" max="250" placeholder="e.g. 72.5" value="${esc(s.kg)}"><span class="pill-tag" style="align-self:center">kg</span></div>
        <p class="small muted" style="margin-top:12px">Not sure? Skip it — you can add it any time.</p>`;
    } else if (s.step === 2) {
      body = `<h1>Which days can you train?</h1>
        <p class="lead">Pick your usual days. The four workouts rotate in order, so if you miss a day or switch Thursday for Friday, you just do the next one.</p>
        <div class="daypick">${DAYS.map((d, i) => `<button data-sact="day" data-d="${i + 1}" class="${s.days.includes(i + 1) ? "on" : ""}" aria-pressed="${s.days.includes(i + 1)}">${d[0]}<small>${d}</small></button>`).join("")}</div>
        <p style="text-align:center;font-weight:700;margin-top:16px">${s.days.length} day${s.days.length === 1 ? "" : "s"} a week${s.days.length === 4 ? " — just like the plan" : s.days.length < 3 ? " — slower, but it all counts" : ""}</p>`;
      next = s.days.length ? "Next" : "Pick at least one day";
    } else {
      body = `<h1>How much have you lifted before?</h1>
        <p class="lead">This only sets your first-session weights. After that, your own results decide.</p>
        <button class="choice ${s.level === "new" ? "on" : ""}" data-sact="level" data-l="new"><span class="e">🌱</span><span><b>I'm new to this</b><span>Start light — empty bar on the big lifts</span></span></button>
        <button class="choice ${s.level === "some" ? "on" : ""}" data-sact="level" data-l="some"><span class="e">💪</span><span><b>I've lifted before</b><span>Start at moderate weights</span></span></button>
        <div class="card" style="margin-top:18px;padding:8px 18px">
          ${MAIN_LIFTS.map((k) => {
            const has = E.history(k).length;
            return `<div class="field"><label>${esc(EX[k].name)}<small>${has ? "Using your logged weights" : "First session"}</small></label>${has ? `<span class="muted small" style="font-weight:700">${esc(wl(k, E.target(k).w))}</span>` : `<div class="mini"><button class="rb" data-sact="w" data-k="${k}" data-d="-2.5" aria-label="Less">−</button><span class="v">${fw(s.weights[k])} kg</span><button class="rb" data-sact="w" data-k="${k}" data-d="2.5" aria-label="More">+</button></div>`}</div>`;
          }).join("")}
        </div>
        <p class="small muted" style="margin-top:12px">Everything else starts light, and you can nudge any weight with − / + in the gym.</p>`;
      next = "Start my programme";
    }
    return `<div class="setup">${dots}${body}<div class="grow"></div>
      <div class="foot">${s.step ? '<button class="btn ghost" data-sact="back">Back</button>' : ""}<button class="btn primary big" data-sact="next" ${s.step === 2 && !s.days.length ? "disabled" : ""}>${esc(next)}${s.step === 3 ? " 🔥" : ""}</button></div></div>`;
  }
  function setupAction(a) {
    const s = ui.setup, act = a.dataset.sact;
    if (act === "next") {
      if (s.step === 2 && !s.days.length) return;
      if (s.step < 3) { s.step++; render(); window.scrollTo(0, 0); const f = $(".setup input"); if (f) setTimeout(() => f.focus(), 120); return; }
      const kg = parseFloat(String(s.kg).replace(",", "."));
      const weights = {};
      for (const k of MAIN_LIFTS) if (!E.history(k).length) weights[k] = s.weights[k];
      E.startProgramme({ name: s.name, startKg: kg > 30 && kg < 250 ? Math.round(kg * 10) / 10 : null, days: s.days, level: s.level, weights });
      ui.setup = null;
      location.hash = "#today";
      render();
      toast(firstName() ? `Let's go, ${firstName()} 🔥` : "Let's go 🔥");
    } else if (act === "back") { s.step = Math.max(0, s.step - 1); render(); }
    else if (act === "day") { const d = +a.dataset.d; s.days = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort(); render(); }
    else if (act === "level") { s.level = a.dataset.l; resetSetupWeights(); render(); }
    else if (act === "w") { const k = a.dataset.k; s.weights[k] = Math.max(E.state.settings.bar, s.weights[k] + +a.dataset.d); render(); }
  }

  /* ====================================================================
     TODAY
     ==================================================================== */
  function viewToday() {
    const t = E.today(), p = E.plan(t), b = E.blockInfo(t), nm = firstName();
    const hour = new Date().getHours();
    const hi = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
    return `
      <header class="hello">
        <div><p class="date">${esc(E.fmtDate(t, { weekday: "long", day: "numeric", month: "long" }))}</p><h1>${hi}${nm ? ", " + esc(nm) : ""}</h1></div>
        <span class="pill-tag ${b.deload || b.due ? "hot" : ""}">${b.deload ? "🌿 Light week" : b.due ? "Light week due" : `Week ${b.week}`}</span>
      </header>
      ${heroCard(p)}
      ${weekCard(t, p)}
      ${headsUpBlock(t)}
      ${habitsCard(t)}
      ${weighCard(t)}`;
  }

  function previewList(day, max = 4) {
    const rows = day.ex.slice(0, max).map((k) => {
      const t = E.target(k);
      return `<li><span>${esc(EX[k].name)}${tiny(k, t)}</span><span class="w">${esc(wl(k, t.w))}</span></li>`;
    }).join("");
    const more = day.ex.length > max ? `<li><span class="more">+ ${day.ex.length - max} more</span><span></span></li>` : "";
    return `<ul class="preview">${rows}${more}</ul>`;
  }

  function heroCard(p) {
    if (draft) {
      const day = E.dayByKey(draft.day);
      const all = Object.values(draft.ex).reduce((a, e) => a + e.sets.length, 0);
      const done = Object.values(draft.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
      return `<section class="card hero"><span class="kicker">In progress</span><h2>${esc(day.label)}</h2>
        <p class="focus">${done} of ${all} sets · started ${Math.max(1, Math.round((Date.now() - draft.start) / 60000))} min ago</p>
        <div class="bar-track" style="margin-bottom:20px"><i style="width:${all ? (done / all) * 100 : 0}%"></i></div>
        <button class="btn primary big" data-act="resume">Carry on</button>
        <div class="center"><button class="linkbtn" data-act="discard">Discard this workout</button></div></section>`;
    }
    if (p.reason === "done") {
      const s = p.doneToday, day = E.dayByKey(s.day);
      const sets = Object.values(s.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
      const nx = E.nextScheduled();
      return `<section class="card hero"><span class="kicker" style="color:var(--ok)">Done today ✓</span><h2>${esc(day ? day.label : "Workout")}</h2>
        <p class="focus">${Math.round((s.end - s.start) / 60000)} min · ${sets} sets logged</p>
        <div class="nudge ok"><span class="e">🌙</span><span>Nice work. Next up is <b>${esc(p.next.label)}</b>${nx ? ` — your next training day is ${esc(E.fmtDate(nx.date, { weekday: "long" }))}` : ""}. Eat well and sleep.</span></div>
        <div class="center" style="gap:6px;margin-top:14px"><button class="btn sm" data-act="session" data-id="${s.id}">See what you did</button><button class="linkbtn" data-act="choose">Train again</button></div></section>`;
    }
    const day = p.next, idx = P.days.indexOf(day) + 1;
    const kicker = { scheduled: "Today's workout", "scheduled-catchup": "Today's workout", catchup: "Catch-up day", rest: "Up next", goal: "Bonus session?" }[p.reason];
    let nudge = "";
    const nx = E.nextScheduled();
    if (p.daysSince != null && p.daysSince >= 10) nudge = `<div class="nudge warm"><span class="e">👋</span><span>It's been ${p.daysSince} days — welcome back! Any lift you haven't done for 2+ weeks starts 10% lighter.</span></div>`;
    else if (p.reason === "rest") nudge = `<div class="nudge"><span class="e">☕</span><span>Rest day${nx ? ` — next planned for ${esc(E.fmtDate(nx.date, { weekday: "long" }))}` : ""}. Fancy it today instead? Go for it: the plan just moves along.</span></div>`;
    else if (p.reason === "catchup" || p.reason === "scheduled-catchup") nudge = `<div class="nudge warm"><span class="e">↻</span><span>You missed a session this week — no stress. Nothing gets skipped: ${esc(day.label)} is simply next.</span></div>`;
    else if (p.reason === "goal") nudge = `<div class="nudge ok"><span class="e">🎉</span><span>All ${p.goal} workouts done this week. Anything extra is a bonus.</span></div>`;
    return `<section class="card hero"><span class="kicker">${esc(kicker)}</span><h2>${esc(day.label)}</h2>
      <p class="focus">${esc(day.focus)} · ~${estMinutes(day)} min</p>
      ${nudge}
      ${previewList(day)}
      <button class="btn primary big" data-act="start" data-day="${day.key}">Start workout</button>
      <div class="center"><button class="linkbtn" data-act="choose">Workout ${idx} of 4 · do a different one</button></div></section>`;
  }

  function weekCard(t, p) {
    const mon = E.mondayOf(t), pd = E.planDays();
    let bubbles = "";
    for (let i = 0; i < 7; i++) {
      const d = E.addDays(mon, i), did = p.done.some((s) => s.date === d);
      const cls = did ? "done" : pd.includes(i + 1) ? "plan" : "";
      bubbles += `<div class="day ${cls} ${d === t ? "today" : ""}" title="${esc(E.fmtDate(d))}${did ? " — trained" : pd.includes(i + 1) ? " — training day" : ""}"><span class="b">✓</span>${DAYS[i][0]}</div>`;
    }
    const n = p.done.length;
    return `<section class="card"><div class="card-head"><div><h2>This week</h2><p>${n} of ${p.goal} workouts${n >= p.goal ? " — goal hit 🎉" : ""}</p></div>${E.weekStreak() ? `<span class="pill-tag">🔥 ${E.weekStreak()} wk streak</span>` : ""}</div>
      <div class="week">${bubbles}</div><div class="bar-track"><i style="width:${Math.min(100, (n / p.goal) * 100)}%"></i></div></section>`;
  }

  function headsUpBlock(t) {
    const items = E.headsUp(t);
    if (!items.length) return "";
    const ic = { deload: "🌿", "deload-on": "🌿", "deload-soon": "📅", stall: "⚠️", weigh: "⚖️", chore: "✨" };
    return `<div class="label">Heads up</div><div class="alerts">${items.map((a) => `
      <div class="alert ${a.tone}"><span class="ic">${ic[a.kind] || "•"}</span><div class="body"><b>${esc(a.title)}</b><span>${esc(a.text)}</span></div>
      ${a.action ? `<button class="btn sm" data-act="alert" data-a="${esc(a.action)}">${esc(a.actionLabel)}</button>` : ""}</div>`).join("")}</div>`;
  }

  function ring(frac) {
    const r = 18, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="5"/>${frac > 0 ? `<circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--ok)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 22 22)"/>` : ""}</svg>`;
  }
  function habitsCard(t) {
    const list = E.habitList(), done = E.habitsOn(t), n = list.filter((h) => done[h.id]).length;
    return `<div class="label">Daily habits</div><section class="card">
      <div class="card-head"><div><h2>${n === list.length ? "All done — nice" : `${n} of ${list.length} done`}</h2><p>Tap as you go. Fresh list every morning.</p></div>${ring(list.length ? n / list.length : 0)}</div>
      <div class="habits">${list.map((h) => `<button class="habit ${done[h.id] ? "on" : ""}" data-act="habit" data-id="${h.id}" aria-pressed="${!!done[h.id]}" title="${esc(h.detail)}"><span class="tick">✓</span><span>${esc(h.label)}</span></button>`).join("")}</div>
    </section>`;
  }

  function weighCard(t) {
    const tr = E.bwTrend(), todayEntry = E.state.bw[t] && !E.state.bw[t].del ? E.state.bw[t].kg : "";
    const label = { ok: "On track", low: "Too slow", high: "Too fast", need: "Tip" }[tr.verdict];
    const sk = E.state.profile.startKg, since = sk && tr.avg7 ? tr.avg7 - sk : null;
    return `<div class="label">Bodyweight</div><section class="card">
      <div class="card-head"><div><h2>Morning weigh-in</h2><p>${tr.avg7 ? `7-day average ${tr.avg7.toFixed(1)} kg${since != null ? ` · ${since >= 0 ? "+" : ""}${since.toFixed(1)} kg since you started` : ""}` : "After the loo, before breakfast"}</p></div></div>
      <form class="inrow" data-form="bw"><input id="bw-in" class="input" name="kg" type="number" inputmode="decimal" step="0.1" min="30" max="250" placeholder="${tr.last ? tr.last.kg : "kg"}" value="${todayEntry}" aria-label="Bodyweight in kg"><button class="btn primary" type="submit">${todayEntry ? "Update" : "Save"}</button></form>
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
    const main = ["bench", "squat", "deadlift", "ohp", "row", "incline_bb", "front_squat", "rdl", "pullup"];
    const others = keys.filter((k) => !main.includes(k));
    return `
      <header class="hello"><div><p class="date">Your numbers</p><h1>Progress</h1></div></header>
      <div class="kpis">
        <div class="kpi"><div class="v">${week.length}<small>/${E.weeklyGoal()}</small></div><div class="k">This week</div></div>
        <div class="kpi"><div class="v">${E.weekStreak()}</div><div class="k">Week streak</div></div>
        <div class="kpi"><div class="v">${ss.length}</div><div class="k">Workouts</div></div>
      </div>
      <div class="label">Strength</div>
      <div class="pills" role="tablist">${main.map((k) => `<button class="pill ${ui.lift === k ? "on" : ""}" data-act="lift" data-k="${k}" role="tab" aria-selected="${ui.lift === k}">${esc(short(k))}</button>`).join("")}
        <select class="pill ${others.includes(ui.lift) ? "on" : ""}" data-change="lift" aria-label="More exercises"><option value="">More…</option>${others.map((k) => `<option value="${k}" ${ui.lift === k ? "selected" : ""}>${esc(EX[k].name)}</option>`).join("")}</select>
      </div>
      ${liftCard(ui.lift)}
      <div class="label">Bodyweight & food</div>
      ${bwCard()}
      <div class="label">Consistency</div>
      ${heatCard()}
      <div class="label">History</div>
      ${historyCard(ss)}`;
  }
  function short(k) {
    return { bench: "Bench", squat: "Squat", deadlift: "Deadlift", ohp: "Overhead press", row: "Row", incline_bb: "Incline bench", front_squat: "Front squat", rdl: "RDL", pullup: "Pull-ups" }[k] || EX[k].name;
  }
  function liftCard(key) {
    const ex = EX[key], s = E.liftSeries(key), t = E.target(key), isLoad = E.loaded(key);
    const metric = isLoad ? "Estimated one-rep max" : ex.type === "time" ? "Total hold time" : "Total reps";
    const unit = isLoad ? "kg" : ex.type === "time" ? "sec" : "reps";
    const best = s.length ? Math.max(...s.map((p) => p.score)) : 0;
    const first = s[0], last = s[s.length - 1], delta = s.length > 1 ? last.score - first.score : 0;
    return `<section class="card">
      <div class="card-head"><div><h2>${esc(ex.name)}</h2><p>${metric} · each session</p></div></div>
      <div class="big-stat"><span class="v">${s.length ? fw(Math.round(last.score * 10) / 10) : "—"}</span><span class="muted">${unit}</span>
        ${s.length > 1 ? `<span class="tiny ${delta >= 0 ? "t-up" : "t-stall"}">${delta >= 0 ? "+" : ""}${fw(Math.round(delta * 10) / 10)} since ${esc(E.fmtDate(first.date, { day: "numeric", month: "short" }))}</span>` : ""}</div>
      ${s.length >= 2 ? chart("lift", s.map((p) => ({ d: p.date, y: p.score, tip: `${isLoad ? "≈" + fw(Math.round(p.score * 10) / 10) + " kg 1RM" : p.score + " " + unit}<br>${esc(wl(key, p.w))} × ${p.sets.join(", ")}` })), { unit }) : `<div class="empty">${s.length ? "One session logged — your line appears after the next one." : "Do this exercise and your progress line shows up here."}</div>`}
      <dl class="kv"><dt>Next time</dt><dd>${esc(wl(key, t.w))} · ${esc(repsLabel(key, t))}</dd><dt>Best</dt><dd>${best ? fw(Math.round(best * 10) / 10) + " " + unit : "—"}</dd><dt>Rule</dt><dd class="rule">${esc(ex.rule)}</dd></dl>
    </section>`;
  }
  function bwCard() {
    const tr = E.bwTrend(), s = tr.series, kc = E.state.settings.kcal, sk = E.state.profile.startKg;
    const avgAt = (d) => { const xs = s.filter((p) => p.date <= d && E.diffDays(d, p.date) < 7); return xs.reduce((a, p) => a + p.kg, 0) / xs.length; };
    const pts = s.slice(-90).map((p) => ({ d: p.date, y: avgAt(p.date), raw: p.kg, tip: `${p.kg} kg logged<br>7-day avg ${avgAt(p.date).toFixed(1)} kg` }));
    const label = { ok: "On track", low: "Too slow", high: "Too fast", need: "Building trend" }[tr.verdict];
    return `<section class="card">
      <div class="card-head"><div><h2>Lean gain tracker</h2><p>Target ${P.nutrition.gainPerWeek.join("–")} kg a week${sk ? ` · started at ${sk} kg` : ""}</p></div></div>
      <div class="big-stat"><span class="v">${tr.rate != null ? (tr.rate >= 0 ? "+" : "") + tr.rate.toFixed(2) : "—"}</span><span class="muted">kg/week</span>${tr.avg7 && sk ? `<span class="tiny ${tr.avg7 >= sk ? "t-up" : "t-stall"}">${tr.avg7 >= sk ? "+" : ""}${(tr.avg7 - sk).toFixed(1)} kg total</span>` : ""}</div>
      ${pts.length >= 2 ? chart("bw", pts, { unit: "kg", raw: true }) + `<div class="legend"><span><i style="background:var(--accent)"></i>7-day average</span><span><i style="background:var(--faint);border-radius:50%"></i>Daily weigh-in</span></div>` : `<div class="empty">Weigh-ins on the Today tab build this chart.</div>`}
      <div class="verdict"><span class="badge ${tr.verdict}">${label}</span><span>${esc(tr.text)}</span></div>
      <div class="field" style="margin-top:14px;border-top:1px solid var(--line)"><label>Daily calories<small>Plan range ${P.nutrition.calories.join("–")} kcal</small></label>
        <div class="mini"><button class="rb" data-act="kcal" data-d="-50" aria-label="Less">−</button><span class="v">${kc}</span><button class="rb" data-act="kcal" data-d="50" aria-label="More">+</button></div></div>
      ${tr.adjust ? `<button class="btn primary full" style="margin-top:8px" data-act="kcal-apply" data-d="${tr.adjust}">Use suggestion: ${kc + tr.adjust} kcal a day</button>` : ""}
      <dl class="kv"><dt>Protein</dt><dd>${P.nutrition.protein.join("–")} g</dd><dt>Fat</dt><dd>${P.nutrition.fat.join("–")} g</dd><dt>Carbs</dt><dd>${esc(P.nutrition.carbs)}</dd><dt>Creatine</dt><dd>${esc(P.nutrition.creatine)}</dd><dt>Sleep</dt><dd>${esc(P.nutrition.sleep)}</dd></dl>
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
      <div class="card-head"><div><h2>Last 4 months</h2><p>Past 28 days: ${tDays} workouts · habits ${hN ? Math.round((hSum / hN) * 100) : 0}%</p></div></div>
      <div class="heat" aria-label="Training and habits calendar">${cells}</div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Trained</span><span><i style="background:color-mix(in srgb,var(--accent) 40%,var(--surface-2))"></i>Habits 70%+</span><span><i style="background:color-mix(in srgb,var(--accent) 18%,var(--surface-2))"></i>Some habits</span></div>
    </section>`;
  }
  function historyCard(ss) {
    if (!ss.length) return `<section class="card"><div class="empty">Finished workouts land here.</div></section>`;
    const all = ss.slice().reverse(), shown = ui.allHistory ? all : all.slice(0, 6);
    const rows = shown.map((s) => {
      const day = E.dayByKey(s.day), sets = Object.values(s.ex).reduce((a, e) => a + e.sets.filter(Boolean).length, 0);
      return `<li><button class="row" data-act="session" data-id="${s.id}"><span class="l"><b>${esc(day ? day.label : s.day)}${s.deload ? ' <span class="tiny t-deload">light week</span>' : ""}</b><span>${esc(E.fmtDate(s.date))}</span></span><span class="r">${sets} sets<small>${Math.round((s.end - s.start) / 60000)} min</small></span></button></li>`;
    }).join("");
    return `<section class="card" style="padding-top:6px;padding-bottom:6px"><ul class="list">${rows}</ul>${all.length > 6 ? `<div class="center" style="margin-bottom:8px"><button class="linkbtn" data-act="hist">${ui.allHistory ? "Show less" : `Show all ${all.length}`}</button></div>` : ""}</section>`;
  }

  /* ---------- small SVG line chart with hover */
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
    const area = `${path}L${X(xs[xs.length - 1]).toFixed(1)},${H - B}L${X(0)},${H - B}Z`;
    const rawDots = raw ? pts.map((p, i) => `<circle class="raw" cx="${X(xs[i])}" cy="${Y(p.raw)}" r="2.5"/>`).join("") : "";
    const dots = !raw && pts.length <= 40 ? pts.map((p, i) => `<circle class="pt" cx="${X(xs[i])}" cy="${Y(p.y)}" r="4"/>`).join("") : "";
    charts[id] = { pts: pts.map((p, i) => ({ x: X(xs[i]), y: Y(p.y), d: p.d, tip: p.tip })), W, H };
    return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${g}<path class="area" d="${area}"/>${rawDots}<path class="line" d="${path}"/>${dots}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><circle class="pt hov" r="5" style="display:none"/></svg></div>`;
  }
  function chartHover(e) {
    const el = e.target.closest && e.target.closest(".chart");
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
    tip.style.left = Math.min(Math.max((best.x / c.W) * r.width, 70), r.width - 70) + "px";
    tip.style.top = (best.y / c.H) * r.height - 10 + "px";
  }
  function chartLeave(e) {
    const el = e.target;
    if (!el.classList || !el.classList.contains("chart")) return;
    el.querySelectorAll(".xh,.hov").forEach((n) => (n.style.display = "none"));
    const tip = el.querySelector(".tip"); if (tip) tip.remove();
  }

  /* ====================================================================
     ME & PLAN
     ==================================================================== */
  function viewPlan() {
    const st = E.state.settings, pr = E.state.profile, cfg = E.syncCfg(), b = E.blockInfo(), th = theme();
    const pd = E.planDays();
    const days = P.days.map((d, i) => `
      <details class="card" ${ui.openDay === d.key ? "open" : ""} data-day="${d.key}"><summary><div><h2>${i + 1}. ${esc(d.label)}</h2><p>${esc(d.focus)} · ${d.ex.length} exercises</p></div></summary>
        <div class="inner"><ul class="list">${d.ex.map((k) => { const t = E.target(k); return `
          <li><button class="row" data-act="setw" data-k="${k}"><span class="l"><b>${esc(EX[k].name)}</b><span>${esc(rangeLabel(k))}</span><span class="rule">${esc(EX[k].rule)}</span></span><span class="r">${esc(wl(k, t.w))}<small>${EX[k].kind === "none" ? "" : "tap to change"}</small></span></button></li>`; }).join("")}</ul></div></details>`).join("");

    const chores = E.choreList().map((c) => { const s = E.choreStatus(c); return `
      <li><div class="row"><span class="l"><b>${esc(c.label)}</b><span>Every ${c.every} days${c.note ? " · " + esc(c.note) : ""} · ${s.known ? (s.due ? `<b style="display:inline;color:var(--amber)">due</b>` : `next in ${s.left} d`) : "not tracked yet"}</span></span><button class="btn sm" data-act="chore" data-id="${c.id}">${c.group === "Kit" ? "Bought" : "Done"}</button></div></li>`; }).join("");
    const toggles = [["adapalene", "Adapalene (habit)", "Adds a nightly tick-off"], ["adapgel", "Adapalene (restock)", "Restock reminder"], ["lotion", "Body lotion", "Restock reminder"]];

    return `
      <header class="hello"><div><p class="date">${esc(pr.name || "You")}</p><h1>Me &amp; plan</h1></div></header>

      <section class="card">
        <div class="card-head"><div><h2>You</h2><p>Started ${pr.startDate ? esc(E.fmtDate(pr.startDate, { day: "numeric", month: "long", year: "numeric" })) : "—"} · training week ${b.week}</p></div></div>
        <div class="field"><label for="pf-name">Name</label><input id="pf-name" class="input text" data-pf="name" style="max-width:190px;min-height:44px" value="${esc(pr.name)}" placeholder="Your name"></div>
        <div class="field"><label for="pf-kg">Starting weight<small>Used for "since you started"</small></label><div class="inrow" style="max-width:150px"><input id="pf-kg" class="input" data-pf="startKg" type="number" inputmode="decimal" step="0.1" style="min-height:44px;font-size:17px" value="${pr.startKg || ""}" placeholder="kg"></div></div>
        <div style="padding-top:12px;border-top:1px solid var(--line)"><label style="font-weight:650">Training days<small class="muted" style="display:block;font-size:12px;font-weight:500">Workouts rotate in order — any day counts</small></label>
          <div class="daypick" style="margin-top:12px">${DAYS.map((d, i) => `<button data-act="pday" data-d="${i + 1}" class="${pd.includes(i + 1) ? "on" : ""}" aria-pressed="${pd.includes(i + 1)}">${d[0]}<small>${d}</small></button>`).join("")}</div></div>
        <div class="center" style="margin-top:14px"><button class="linkbtn" data-act="restart">Restart programme from week 1</button></div>
      </section>

      <div class="label">Your 4 workouts · done in this order</div>
      <div class="stack">${days}</div>

      <div class="label">How the app coaches you</div>
      <details class="card"><summary><div><h2>The rules</h2><p>From your plan — applied automatically</p></div></summary>
        <div class="inner note">${P.notes.map(([h, b2]) => `<p><b>${esc(h)}</b>${esc(b2)}</p>`).join("")}
        <p><b>Flexible schedule</b>The four workouts always go in order. Train on any day and you get the next one — missing a day never skips anything. If you haven't done a lift for 2+ weeks, it comes back 10% lighter so you ease in.</p>
        <p><b>What the app works out for you</b>Every weight and rep target from your last session, warm-up sets, the plates for each side of the bar, your rest timer, holding the weight after a miss, flagging a stuck lift, when your light (deload) week is due, and whether to eat a bit more or less.</p></div></details>

      <div class="label">Skin & grooming</div>
      <details class="card"><summary><div><h2>Routine</h2><p>Morning, evening, body, grooming, habits</p></div></summary>
        <div class="inner"><table class="routine">${P.skincare.map(([cat, step, what, note]) => `<tr><td>${esc(cat)}<br><b style="color:var(--text)">${esc(step)}</b></td><td>${esc(what)}${note ? `<small>${esc(note)}</small>` : ""}</td></tr>`).join("")}</table>
        <div style="margin-top:12px">${toggles.map(([id, l, s]) => `<div class="field"><label>${esc(l)}<small>${esc(s)}</small></label><button class="toggle ${st.optional[id] ? "on" : ""}" data-act="opt" data-id="${id}" role="switch" aria-checked="${!!st.optional[id]}" aria-label="${esc(l)}"></button></div>`).join("")}</div></div></details>
      <section class="card" style="margin-top:14px;padding-top:6px;padding-bottom:6px"><ul class="list">${chores}</ul></section>

      <div class="label">Settings</div>
      <section class="card" style="padding-top:8px;padding-bottom:8px">
        ${miniField("Barbell weight", "For plates & warm-ups", "bar", st.bar, " kg", 2.5)}
        ${miniField("Dumbbell jumps", "Smallest step at your gym", "dbStep", st.dbStep, " kg", 0.5)}
        ${miniField("Rest · big lifts", "Bench, squat, deadlift, press, rows", "restLong", st.restLong, "s", 15)}
        ${miniField("Rest · smaller lifts", "Accessory exercises", "restShort", st.restShort, "s", 15)}
        ${miniField("Light week every", "This training week is the easy one", "deloadWeek", st.deloadWeek, " wk", 1)}
        <div class="field"><label>Timer sound<small>Beep + buzz when rest ends</small></label><button class="toggle ${st.sound ? "on" : ""}" data-act="sound" role="switch" aria-checked="${!!st.sound}" aria-label="Timer sound"></button></div>
        <div class="field"><label>Look</label><div class="seg">${["light", "dark", "auto"].map((t) => `<button class="${th === t ? "on" : ""}" data-act="theme" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div></div>
      </section>

      <div class="label">Sync between devices</div>
      <section class="card">
        <p class="muted small" style="margin-top:0">Optional. Your data lives on this device. To use it on your phone <i>and</i> laptop, paste a GitHub token with only the <b>gist</b> scope — the app keeps a private gist and merges both ways.</p>
        ${cfg.token ? `<div class="field"><label>Connected<small>${cfg.last ? "Last sync " + new Date(cfg.last).toLocaleString() : "Not synced yet"}${cfg.error ? ` · <span style="color:var(--amber)">${esc(cfg.error)}</span>` : ""}</small></label><button class="btn primary sm" data-act="sync">Sync now</button></div>
          <div class="btn-row"><button class="linkbtn" data-act="unsync">Disconnect</button></div>`
        : `<form data-form="token" class="inrow"><input class="input text" name="token" type="password" autocomplete="off" placeholder="ghp_… or github_pat_…" aria-label="GitHub token" style="font-size:15px"><button class="btn primary" type="submit">Connect</button></form>
          <p class="small" style="margin-bottom:0"><a href="https://github.com/settings/tokens/new?scopes=gist&description=Reign%20of%20Fire%20tracker" target="_blank" rel="noopener">Create a token (gist scope only) ↗</a></p>`}
      </section>

      <div class="label">Your data</div>
      <section class="card"><div class="btn-row">
        <button class="btn sm" data-act="export">Back up (.json)</button>
        <button class="btn sm" data-act="csv">Export log (.csv)</button>
        <button class="btn sm" data-act="import">Restore / merge</button>
        <button class="btn sm danger" data-act="reset">Erase all</button>
      </div><input type="file" id="import-file" accept="application/json,.json" hidden></section>
      <p class="muted small" style="text-align:center;margin-top:22px">Works offline · add to your home screen for the full-screen app</p>`;
  }
  function miniField(label, sub, key, v, unit, step) {
    return `<div class="field"><label>${esc(label)}<small>${esc(sub)}</small></label><div class="mini"><button class="rb" data-act="setting" data-k="${key}" data-d="${-step}" aria-label="Decrease">−</button><span class="v">${fw(v)}${unit}</span><button class="rb" data-act="setting" data-k="${key}" data-d="${step}" aria-label="Increase">+</button></div></div>`;
  }

  /* ====================================================================
     WORKOUT — one exercise at a time
     ==================================================================== */
  let wakeLock = null;
  async function keepAwake() { try { if ("wakeLock" in navigator && ui.workoutOpen) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {} }
  function release() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
  const persist = () => E.setDraft(draft);
  const keysOf = () => Object.keys(draft.ex);
  const isDone = (k) => draft.ex[k].sets.every(Boolean);

  function openWorkout() {
    if (!draft) return;
    if (draft.cur == null) { const ks = keysOf(); const i = ks.findIndex((k) => !isDone(k)); draft.cur = i < 0 ? 0 : i; }
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
  function goTo(i) {
    draft.cur = Math.max(0, Math.min(keysOf().length - 1, i));
    persist();
    renderWorkout();
    wk.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderWorkout() {
    if (!draft) return;
    const day = E.dayByKey(draft.day), ks = keysOf();
    const all = ks.reduce((a, k) => a + draft.ex[k].sets.length, 0);
    const done = ks.reduce((a, k) => a + draft.ex[k].sets.filter(Boolean).length, 0);
    wk.innerHTML = `
      <div class="wk-head"><div class="row1">
        <button class="round" data-act="wk-min" aria-label="Back to Today">${icon.close}</button>
        <div class="t"><b>${esc(day.label)}${draft.deload ? " · light week" : ""}</b><span><span id="wk-clock">${mmss(Math.floor((Date.now() - draft.start) / 1000))}</span> · ${done}/${all} sets</span></div>
        <button class="btn sm ${done === all ? "primary" : ""}" data-act="wk-finish">Finish</button></div>
        <div class="segs">${ks.map((k, i) => { const e = draft.ex[k], n = e.sets.filter(Boolean).length; return `<button class="${i === draft.cur ? "cur" : n === e.sets.length ? "done" : n ? "part" : ""}" data-act="wk-go" data-i="${i}" aria-label="${esc(EX[k].name)}"></button>`; }).join("")}</div>
      </div>
      <div class="wk-focus">${focusCard(ks[draft.cur], draft.cur, ks.length)}</div>`;
  }

  function focusCard(key, i, n) {
    const ex = EX[key], e = draft.ex[key], tg = E.target(key, { deload: draft.deload });
    const nextIdx = e.sets.findIndex((s) => !s), complete = nextIdx === -1;
    const ri = complete ? 0 : nextIdx;
    const r = e.t.reps[ri];
    // weight box
    let wBox;
    if (ex.kind === "none") wBox = `<div class="l">Weight</div><div class="v word">Body&shy;weight</div>`;
    else {
      const bwZero = (ex.kind === "bw" || ex.kind === "db") && !(e.w > 0);
      const step = weightStep(key);
      wBox = `<div class="l">${ex.kind === "db" ? "Each dumbbell" : ex.kind === "bw" ? "Added weight" : "Weight"}</div>
        <div class="v ${bwZero ? "word" : ""}">${bwZero ? "Body&shy;weight" : `${ex.kind === "bw" ? "+" : ""}${fw(e.w)}<small>kg</small>`}</div>
        <div class="adj"><button data-act="wk-w" data-k="${key}" data-d="${-step}" aria-label="Less weight">−</button><button data-act="wk-w" data-k="${key}" data-d="${step}" aria-label="More weight">+</button></div>`;
    }
    const rBox = ex.type === "amrap"
      ? `<div class="l">Reps</div><div class="v">Max</div><div class="s">${e.t.sets} sets · ${tg.last ? `beat ${tg.last.sets.reduce((a, s) => a + (s ? s.r : 0), 0)} total` : "as many as you can"}</div>`
      : `<div class="l">${ex.type === "time" ? "Hold" : ex.unit === "steps" ? "Steps" : "Reps"}</div><div class="v">${r}${ex.type === "time" ? "<small>sec</small>" : ""}</div><div class="s">${e.t.sets} sets${ex.perSide ? " · each leg" : ""}</div>`;
    const icons = { up: "↑", reps: "＋", hold: "↻", stall: "!", back: "👋", deload: "🌿", new: "✨", set: "✎", beat: "🎯", top: "★" };
    const status = tg.msg ? `<div class="status s-${tg.status}"><span>${icons[tg.status] || "•"}</span><span>${esc(tg.msg)}</span></div>` : "";
    const lt = loadText(key, e.w);
    const loadout = ex.kind === "barbell" ? `<div class="loadout">${e.w >= E.state.settings.bar ? barbellPic(e.w) : ""}<p>${esc(lt)}</p></div>` : lt ? `<div class="loadout"><p style="margin:0">${esc(lt)}</p></div>` : "";
    const warm = ex.warmup ? E.warmupSets(key, e.w) : [];
    const warmBox = warm.length && !e.sets.some(Boolean) ? `<div class="warmbox"><div class="h">Warm up first <span>Lighter sets — tap each as you go</span></div><div class="wus">${warm.map((w, j) => `<button class="wu ${e.warm[j] ? "on" : ""}" data-act="wk-wu" data-k="${key}" data-i="${j}">${w.label === "Bar" ? "Bar" : fw(w.w) + " kg"} × ${w.r}</button>`).join("")}</div></div>` : "";
    const u = ex.type === "time" ? "s" : "";
    const sets = e.sets.map((s, j) => {
      const tr = e.t.reps[j];
      const cls = !s ? (j === nextIdx ? "next" : "") : ex.type === "amrap" ? "hit amrap" : s.r >= tr ? "hit" : "miss";
      const label = s ? s.r + u : ex.type === "amrap" ? (tr || "?") : tr + u;
      return `<button class="set ${cls}" data-set="${j}" data-k="${key}" aria-label="Set ${j + 1}: ${s ? "logged " + s.r : "target " + (tr || "max")}">${label}<span class="n">${j + 1}</span></button>`;
    }).join("");
    const nk = nextOpenFrom(i);
    let action = "";
    if (rest) action += restBox();
    if (complete) {
      action += `<div class="donebox">✓ All ${e.sets.length} sets done</div>`;
      action += nk != null ? `<button class="btn primary big" data-act="wk-go" data-i="${nk}">Next: ${esc(EX[keysOf()[nk]].name)} →</button>` : `<button class="btn primary big" data-act="wk-finish">Finish workout 🎉</button>`;
    } else if (!rest || Date.now() >= rest.end) {
      const doneLabel = ex.type === "amrap" ? `Log set ${nextIdx + 1}` : ex.type === "time" ? `✓ Held ${r} sec — set ${nextIdx + 1}` : `✓ Done set ${nextIdx + 1} of ${e.sets.length}`;
      action += `<button class="btn primary big" data-act="wk-done" data-k="${key}">${doneLabel}</button>
        ${ex.type === "amrap" ? "" : `<div class="center"><button class="linkbtn" data-act="wk-edit" data-k="${key}" data-i="${nextIdx}">Did fewer or more? Tap to adjust</button></div>`}`;
    }
    return `
      <div class="step-of"><span>Exercise ${i + 1} of ${n}</span><button class="linkbtn" style="padding:4px 0" data-act="wk-list">${icon.list.replace("<svg", '<svg width="16" height="16" style="vertical-align:-3px;margin-right:4px"')}All exercises</button></div>
      <h1 class="ex-title">${esc(ex.name)}</h1>
      <p class="cue">${esc((P.cues || {})[key] || ex.rule)} <a href="https://www.youtube.com/results?search_query=${encodeURIComponent("how to " + ex.name.split(" / ")[0] + " proper form")}" target="_blank" rel="noopener">Watch how ↗</a></p>
      <div class="target"><div class="tbox">${wBox}</div><div class="tbox">${rBox}</div></div>
      ${status}
      ${loadout}
      ${warmBox}
      <div class="setsbox"><div class="h">Sets <span>${e.sets.filter(Boolean).length} of ${e.sets.length} done</span></div><div class="sets">${sets}</div></div>
      <div class="action" id="action">${action}</div>
      <div class="navrow">${i > 0 ? `<button class="linkbtn" data-act="wk-go" data-i="${i - 1}">← Previous</button>` : "<span></span>"}${i < n - 1 ? `<button class="linkbtn" data-act="wk-go" data-i="${i + 1}">${complete ? "Next" : "Skip for now"} →</button>` : "<span></span>"}</div>
      <p class="tip-line">Tip: tap a circle to log or take off a rep · hold it to type a number</p>`;
  }
  function weightStep(key) {
    const ex = EX[key];
    if (ex.kind === "db") return E.state.settings.dbStep;
    if (ex.kind === "bw") return ex.inc || 2.5;
    return ex.kind === "machine" ? ex.inc : 2.5;
  }
  function nextOpenFrom(i) {
    const ks = keysOf();
    for (let j = 1; j <= ks.length; j++) { const x = (i + j) % ks.length; if (x !== i && !isDone(ks[x])) return x; }
    return null;
  }
  const anyOpenSets = () => Object.values(draft.ex).some((e) => e.sets.some((s) => !s));

  function logSet(key, i, r, fresh) {
    const e = draft.ex[key];
    e.sets[i] = r == null ? null : { r };
    persist();
    if (fresh && r != null) {
      vibrate(15);
      if (anyOpenSets()) {
        const doneEx = e.sets.every(Boolean);
        const nk = nextOpenFrom(keysOf().indexOf(key));
        startRest(restFor(key), doneEx ? (nk != null ? `Next: ${EX[keysOf()[nk]].name}` : "Almost there") : `Next: set ${e.sets.findIndex((s) => !s) + 1}`);
      } else { stopRest(); toast("Every set done — tap Finish 🎉"); }
    }
    renderWorkout();
  }
  function tapSet(key, i) {
    unlockAudio();
    const ex = EX[key], e = draft.ex[key], cur = e.sets[i];
    if (!cur) { if (ex.type === "amrap") return setEditor(key, i); return logSet(key, i, e.t.reps[i], true); }
    const nr = cur.r - (ex.type === "time" ? 5 : 1);
    vibrate(8);
    logSet(key, i, nr < 0 ? null : nr, false);
  }
  function setEditor(key, i) {
    const ex = EX[key], e = draft.ex[key], wasEmpty = !e.sets[i];
    const tgt = e.t.reps[i] || 8, isT = ex.type === "time", st = isT ? 5 : 1;
    let v = e.sets[i] ? e.sets[i].r : tgt;
    const quick = () => { const out = []; for (let d = -3; d <= 3; d++) { const q = tgt + d * (isT ? 10 : 1); if (q >= 0) out.push(q); } return out; };
    const body = () => `<h3>${esc(ex.name)}</h3><div class="muted">Set ${i + 1} · ${ex.type === "amrap" ? "how many did you get?" : `target ${tgt}${isT ? " sec" : " " + E.unit(key)}`}</div>
      <div class="bigstep"><button class="rb" data-act="dn" aria-label="Less">−</button><div class="v">${v}</div><button class="rb" data-act="upv" aria-label="More">+</button></div>
      <div class="quick">${quick().map((q) => `<button data-act="q" data-v="${q}" class="${q === v ? "on" : ""}">${q}</button>`).join("")}</div>
      <div class="actions"><button class="btn" data-act="clear">${wasEmpty ? "Cancel" : "Clear set"}</button><button class="btn primary" data-act="save">Save</button></div>`;
    const s = sheet(body(), {
      dn: () => { v = Math.max(0, v - st); s.redraw(body()); },
      upv: () => { v += st; s.redraw(body()); },
      q: (b) => { v = +b.dataset.v; s.redraw(body()); },
      clear: (_, c) => { c(); if (!wasEmpty) logSet(key, i, null, false); },
      save: (_, c) => { c(); unlockAudio(); logSet(key, i, v, wasEmpty); },
    });
  }
  function exerciseList() {
    const ks = keysOf();
    sheet(`<h3>All exercises</h3><ul class="list" style="margin-top:8px">${ks.map((k, i) => { const e = draft.ex[k], n = e.sets.filter(Boolean).length; return `<li><button class="row" data-act="go" data-i="${i}"><span class="l"><b>${n === e.sets.length ? "✓ " : ""}${esc(EX[k].name)}</b><span>${esc(wl(k, e.w))} · ${esc(repsLabel(k, e.t))}</span></span><span class="r">${n}/${e.sets.length}<small>sets</small></span></button></li>`; }).join("")}</ul>`,
      { go: (b, c) => { c(); goTo(+b.dataset.i); } });
  }

  async function finishFlow() {
    const ex = Object.entries(draft.ex);
    const touched = ex.filter(([, e]) => e.sets.some(Boolean));
    if (!touched.length) {
      if (await confirmSheet({ title: "Nothing logged yet", text: "Leave without saving this workout?", ok: "Leave", danger: true })) { E.setDraft(null); draft = null; stopRest(); closeWorkout(); }
      return;
    }
    const skipped = ex.filter(([, e]) => !e.sets.some(Boolean)).map(([k]) => EX[k].name);
    const partial = touched.filter(([, e]) => e.sets.some((s) => !s)).map(([k]) => EX[k].name);
    if (skipped.length || partial.length) {
      const txt = [skipped.length ? `<b>Skipped</b> — no effect on your progress: ${esc(skipped.join(", "))}.` : "", partial.length ? `<b>Unfinished</b> — the weight stays the same next time: ${esc(partial.join(", "))}.` : ""].filter(Boolean).join("<br><br>");
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
    const k = c.key, ex = EX[k], to = c.to, u = ex.type === "time" ? "s" : "";
    if (ex.kind !== "none" && to.w !== c.from.w) return `${wl(k, c.from.w)} → <b>${wl(k, to.w)}</b>`;
    if (ex.type === "amrap") return `beat ${c.did.reduce((a, b) => a + b, 0)} reps`;
    const fr = Math.min(...(c.from.reps.length ? c.from.reps : [0])), tr = Math.min(...to.reps);
    if (tr !== fr) return `${fr}${u} → <b>${tr}${u}</b> ${E.unit(k) === "sec" ? "" : E.unit(k)}`;
    return `<span class="muted">same again</span>`;
  }
  function summary(res) {
    const day = E.dayByKey(res.session.day);
    const vol = res.volume >= 1000 ? (res.volume / 1000).toFixed(1) + "t" : Math.round(res.volume) + " kg";
    sheet(`<div class="biglogo">🔥</div><h3 style="margin-top:8px">${esc(day.label)} done${firstName() ? ", " + esc(firstName()) : ""}!</h3><div class="muted">${res.session.deload ? "Light-week session — your progress is untouched." : "Your next targets are already set."}</div>
      <div class="stats3"><div class="stat"><div class="v">${res.mins}</div><div class="k">minutes</div></div><div class="stat"><div class="v">${res.setsDone}</div><div class="k">sets</div></div><div class="stat"><div class="v">${vol}</div><div class="k">lifted</div></div></div>
      ${res.prs.map((p) => `<div class="pr">🏆 <span>New best: ${esc(EX[p.key].name)} <span class="muted small">(${E.loaded(p.key) ? "≈" + fw(Math.round(p.cur * 10) / 10) + " kg 1RM" : p.cur + " " + E.unit(p.key)})</span></span></div>`).join("")}
      ${res.session.deload ? "" : `<div class="label" style="margin-left:0">Next time</div><ul class="changes">${res.changes.map((c) => `<li><span>${esc(EX[c.key].name)}</span><span class="to">${describeChange(c)}</span></li>`).join("")}</ul>`}
      <div class="actions"><button class="btn primary big" data-act="ok">Done</button></div>`, { ok: (_, c) => c() });
  }

  /* ---------- rest timer (lives in the action area) */
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
    clearInterval(restTick); restTick = setInterval(tickRest, 250);
  }
  function stopRest() { const had = !!rest; rest = null; clearInterval(restTick); restTick = null; if (had && ui.workoutOpen && draft) renderWorkout(); }
  function restBox() {
    const left = Math.ceil((rest.end - Date.now()) / 1000);
    const frac = Math.max(0, Math.min(1, (rest.end - Date.now()) / (rest.total * 1000)));
    const R = 46, C = 2 * Math.PI * R;
    if (left <= 0) return `<div class="restbox go" id="restbox"><div style="font-size:44px">💥</div><div style="flex:1"><div class="rt">Go!</div><div class="rl">Rest's over · ${esc(rest.label)}</div><div class="btn-row"><button class="btn primary sm" data-act="rest-skip">I'm ready</button></div></div></div>`;
    return `<div class="restbox" id="restbox"><svg viewBox="0 0 108 108" aria-hidden="true"><circle cx="54" cy="54" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="9"/><circle cx="54" cy="54" r="${R}" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 54 54)"/><text x="54" y="61" text-anchor="middle" font-size="21" font-weight="800" fill="currentColor" font-family="inherit">${mmss(left)}</text></svg>
      <div style="flex:1"><div class="rt" style="font-size:22px">Rest</div><div class="rl">Breathe, sip water.<br>${esc(rest.label)}</div><div class="btn-row"><button class="btn sm" data-act="rest-add" data-s="30">+30s</button><button class="btn sm soft" data-act="rest-skip">Skip</button></div></div></div>`;
  }
  function tickRest() {
    if (!rest) return;
    const left = Math.ceil((rest.end - Date.now()) / 1000);
    if (left <= 0 && !rest.fired) { rest.fired = true; beep(); vibrate([220, 120, 220]); if (ui.workoutOpen && draft) return renderWorkout(); }
    if (left < -30) return stopRest();
    const el = $("#restbox");
    if (el && ui.workoutOpen) el.outerHTML = restBox();
  }

  /* ---------- workout events */
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
    else if (act === "wk-go") { unlockAudio(); goTo(+a.dataset.i); }
    else if (act === "wk-list") exerciseList();
    else if (act === "wk-done") {
      unlockAudio();
      const e2 = draft.ex[k], i = e2.sets.findIndex((x) => !x);
      if (i < 0) return;
      if (EX[k].type === "amrap") setEditor(k, i); else logSet(k, i, e2.t.reps[i], true);
    }
    else if (act === "wk-edit") { unlockAudio(); setEditor(k, +a.dataset.i); }
    else if (act === "wk-w") { const e2 = draft.ex[k]; e2.w = Math.max(0, Math.round((e2.w + +a.dataset.d) * 100) / 100); persist(); renderWorkout(); }
    else if (act === "wk-wu") { const e2 = draft.ex[k]; e2.warm[+a.dataset.i] = !e2.warm[+a.dataset.i]; persist(); renderWorkout(); }
    else if (act === "rest-skip") stopRest();
    else if (act === "rest-add") { if (rest) { rest.end += 30000; rest.total += 30; rest.fired = false; tickRest(); } }
  });

  /* ====================================================================
     TAB ACTIONS
     ==================================================================== */
  function chooseWorkout() {
    const nx = E.nextWorkout();
    sheet(`<h3>Pick a workout</h3><div class="muted">${esc(nx.label)} is next in your rotation, but any of them works — the order just carries on from what you pick.</div><ul class="list" style="margin-top:10px">${P.days.map((d) => `<li><button class="row" data-act="go" data-day="${d.key}"><span class="l"><b>${esc(d.label)}${d.key === nx.key ? ' <span class="tiny t-new">next</span>' : ""}</b><span>${esc(d.focus)} · ${d.ex.length} exercises</span></span><span class="r">~${estMinutes(d)}<small>min</small></span></button></li>`).join("")}</ul>`,
      { go: (b, c) => { c(); startWorkout(b.dataset.day); } });
  }
  function startWorkout(dayKey) {
    unlockAudio();
    draft = E.newDraft(dayKey);
    draft.cur = 0; persist();
    wk.scrollTop = 0;
    openWorkout();
  }
  function sessionSheet(id) {
    const s = E.state.sessions[id]; if (!s) return;
    const day = E.dayByKey(s.day);
    const rows = Object.entries(s.ex).map(([k, e]) => `<li><div class="row"><span class="l"><b>${esc(EX[k] ? EX[k].name : k)}</b><span>${esc(EX[k] ? wl(k, e.w) : e.w)}</span></span><span class="r">${e.sets.map((x) => (x ? x.r : "–")).join(" · ")}</span></div></li>`).join("");
    sheet(`<h3>${esc(day ? day.label : "Workout")}</h3><div class="muted">${esc(E.fmtDate(s.date, { weekday: "long", day: "numeric", month: "long" }))} · ${Math.round((s.end - s.start) / 60000)} min${s.deload ? " · light week" : ""}</div><ul class="list" style="margin-top:10px">${rows}</ul>
      <div class="actions"><button class="btn danger" data-act="del">Delete</button><button class="btn primary" data-act="ok">Close</button></div>`,
      { ok: (_, c) => c(), del: async (_, c) => { c(); if (await confirmSheet({ title: "Delete this session?", text: "Your targets will recalculate from the rest of your history.", ok: "Delete", danger: true })) { E.deleteSession(id); toast("Session deleted"); } } });
  }
  function setWeightSheet(key) {
    const ex = EX[key]; if (ex.kind === "none") return;
    let w = E.target(key, { deload: false }).w; const st = weightStep(key);
    const body = () => `<h3>${esc(ex.name)}</h3><div class="muted">Set your working weight — the app progresses from here.</div>
      <div class="bigstep"><button class="rb" data-act="dn">−</button><div class="v">${fw(w)}</div><button class="rb" data-act="upw">+</button></div>
      <div class="muted small" style="text-align:center">${esc(ex.kind === "db" ? "kg per dumbbell" : ex.kind === "bw" ? "kg added to bodyweight" : "kg")}${ex.kind === "barbell" ? " · " + esc(loadText(key, w)) : ""}</div>
      <div class="actions"><button class="btn" data-act="cancel">Cancel</button><button class="btn primary" data-act="save">Save</button></div>`;
    const s = sheet(body(), {
      dn: () => { w = Math.max(0, Math.round((w - st) * 100) / 100); s.redraw(body()); },
      upw: () => { w = Math.round((w + st) * 100) / 100; s.redraw(body()); },
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
      if (a === "start-deload") { if (await confirmSheet({ title: "Start your light week?", text: "For 7 days: 1–2 fewer sets per exercise at about 65% of the weight, same reps. Your progress pauses, then carries on.", ok: "Start light week" })) { E.startDeload(); toast("Light week started 🌿"); } }
      else if (a === "end-deload") { E.endDeload(); toast("Back to full targets"); }
      else if (a === "focus-bw") { const i = $("#bw-in"); i && (i.scrollIntoView({ behavior: "smooth", block: "center" }), setTimeout(() => i.focus(), 300)); }
      else if (a.startsWith("chore:")) { E.doChore(a.slice(6)); toast("Logged"); }
      else if (a.startsWith("reset:")) { const k = a.slice(6), t = E.baseTarget(k), w = E.roundFor(EX[k].kind, (t.last ? t.last.w : t.w) * 0.9); E.resetLift(k, w); toast(`${EX[k].name} reset to ${fw(w)} kg`); }
    },
    lift: (b) => { ui.lift = b.dataset.k; render(); },
    hist: () => { ui.allHistory = !ui.allHistory; render(); },
    kcal: (b) => { const s = E.state.settings; s.kcal = Math.max(1200, s.kcal + +b.dataset.d); E.touch(s); E.save(); },
    "kcal-apply": (b) => { const s = E.state.settings; s.kcal += +b.dataset.d; E.touch(s); E.save(); toast(`Calorie target: ${s.kcal} kcal a day`); },
    setw: (b) => setWeightSheet(b.dataset.k),
    chore: (b) => { E.doChore(b.dataset.id); toast("Logged — reminder reset"); },
    opt: (b) => { const s = E.state.settings; s.optional = { ...s.optional, [b.dataset.id]: !s.optional[b.dataset.id] }; E.touch(s); E.save(); },
    pday: (b) => { const d = +b.dataset.d, pd = E.planDays(); const days = pd.includes(d) ? pd.filter((x) => x !== d) : [...pd, d]; if (!days.length) return toast("Keep at least one day"); E.updateProfile({ days: days.sort() }); },
    restart: async () => { if (await confirmSheet({ title: "Restart from week 1?", text: "You'll go through setup again. Your logged workouts and weights are kept — only the week count and schedule start fresh.", ok: "Restart" })) { E.restartProgramme(); ui.setup = null; location.hash = "#today"; render(); } },
    setting: (b) => {
      const s = E.state.settings, k = b.dataset.k, lim = { bar: [5, 25], dbStep: [0.5, 5], restLong: [60, 300], restShort: [30, 180], deloadWeek: [4, 8] }[k];
      s[k] = Math.min(lim[1], Math.max(lim[0], Math.round((s[k] + +b.dataset.d) * 100) / 100)); E.touch(s); E.save();
    },
    sound: () => { const s = E.state.settings; s.sound = !s.sound; E.touch(s); E.save(); },
    theme: (b) => { try { localStorage.setItem("rof-theme", b.dataset.t); } catch (e) {} applyTheme(); render(); },
    sync: () => manualSync(),
    unsync: async () => { if (await confirmSheet({ title: "Disconnect sync?", text: "Your data stays on this device and in your gist. You can reconnect any time.", ok: "Disconnect" })) { E.setSyncCfg({}); render(); } },
    export: () => download(`reign-of-fire-backup-${E.today()}.json`, E.exportJSON(), "application/json"),
    csv: () => download(`reign-of-fire-log-${E.today()}.csv`, E.exportCSV(), "text/csv"),
    import: () => $("#import-file").click(),
    reset: async () => { if (await confirmSheet({ title: "Erase everything?", text: "All workouts, weigh-ins and habits on this device will be deleted. Back up first if unsure.", ok: "Erase", danger: true })) { E.resetAll(); draft = null; ui.setup = null; toast("All data erased"); } },
  };

  app.addEventListener("click", (e) => {
    const s = e.target.closest("[data-sact]");
    if (s) return setupAction(s);
    const a = e.target.closest("[data-act]");
    if (a && actions[a.dataset.act]) actions[a.dataset.act](a);
  });
  app.addEventListener("input", (e) => {
    const k = e.target.dataset.su;
    if (k && ui.setup) ui.setup[k] = e.target.value;
  });
  app.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset.su) { e.preventDefault(); e.target.blur(); const n = $('[data-sact="next"]'); n && n.click(); }
  });
  app.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.change === "lift" && t.value) { ui.lift = t.value; render(); }
    if (t.dataset.pf === "name") { E.updateProfile({ name: t.value.trim() }); toast("Name saved"); }
    if (t.dataset.pf === "startKg") {
      const kg = parseFloat(String(t.value).replace(",", "."));
      if (t.value === "" || (kg > 30 && kg < 250)) { E.updateProfile({ startKg: t.value === "" ? null : Math.round(kg * 10) / 10 }); toast("Starting weight saved"); }
      else toast("Enter a weight in kg");
    }
    if (t.id === "import-file" && t.files[0]) {
      try { E.importJSON(await t.files[0].text()); draft = E.getDraft(); toast("Backup merged in"); } catch (err) { toast("That file couldn't be read"); }
      t.value = "";
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
    // keep typing focus inside profile inputs from being wiped by a re-render
    const ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.pf && ae.closest("#app")) return;
    const setup = !E.started();
    document.body.classList.toggle("no-nav", setup);
    const tab = (location.hash || "#today").slice(1);
    ui.tab = views[tab] ? tab : "today";
    const key = setup ? "setup" : ui.tab;
    const y = window.scrollY;
    app.innerHTML = `<div class="view">${setup ? viewSetup() : views[ui.tab]()}</div>`;
    if (render.last === key) { window.scrollTo(0, y); app.firstElementChild.style.animation = "none"; }
    render.last = key;
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.dataset.tab === ui.tab));
  }
  E.onChange((o) => {
    if (!ui.workoutOpen) render();
    if (!o.synced) autoSync(o.important);
  });
  window.addEventListener("hashchange", () => { render.last = null; render(); window.scrollTo(0, 0); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { if (ui.workoutOpen) { keepAwake(); if (rest) tickRest(); } else render(); }
  });
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => theme() === "auto" && applyTheme());

  render();
  if (draft && E.started() && Date.now() - draft.start < 4 * 3600 * 1000) openWorkout();
  setInterval(() => {
    if (!ui.workoutOpen || !draft) return;
    const c = $("#wk-clock"); if (c) c.textContent = mmss(Math.floor((Date.now() - draft.start) / 1000));
  }, 1000);
  if (E.syncCfg().token) E.sync().catch(() => {});
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
