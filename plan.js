/* =====================================================================
   Reign of Fire — training plan data
   ---------------------------------------------------------------------
   This file is the single source of truth for the programme. Everything
   else (targets, warm-ups, deloads, reminders) is calculated from it.
   Edit here to change the plan; your logged history is never touched.

   Exercise fields
     name      Display name
     sets      Working sets
     lo, hi    Rep range (lo === hi for fixed-rep lifts). For type "time"
               these are seconds.
     type      "linear"  fixed reps  → add weight when every set hits reps
               "double"  rep range   → add reps to the top, then add weight
                                       and drop back to the bottom
               "amrap"   max reps    → add weight once avg ≥ amrapGoal
               "time"    hold time   → add seconds to the top, then weight
     inc       Weight added when you earn it (kg; per dumbbell for "db")
     step      Reps (or seconds) added per session for double/time
     kind      "barbell" | "db" (per hand) | "machine" | "bw" (added load,
               0 = bodyweight) | "none" (no load tracked)
     compound  true → long rest (heavy), false → short rest (accessory)
     warmup    ramp scheme key from WARMUPS (first heavy lift only)
     start     Suggested first-session weight (you'll adjust it once)
     rule      The progression rule, word for word from the plan
   ===================================================================== */

window.PLAN = {
  name: "Reign of Fire",

  warmups: {
    std: [[0, 10], [0.5, 5], [0.7, 3], [0.85, 2]],   // 0 = empty bar
    dead: [[0, 10], [0.4, 5], [0.6, 3], [0.8, 1]],
  },

  exercises: {
    // ---------- Monday · Upper A
    bench:      { name: "Barbell Bench Press", sets: 5, lo: 5, hi: 5, type: "linear", inc: 2.5, kind: "barbell", compound: true, warmup: "std", start: 40,
                  rule: "+2.5kg once all 5 sets hit 5 reps with good form" },
    pullup_w:   { name: "Weighted Pull-ups / Lat Pulldown", sets: 4, lo: 6, hi: 8, type: "double", inc: 2.5, step: 1, kind: "bw", compound: true, start: 0,
                  rule: "+1 rep/set until 8 reps across all sets, then add weight" },
    ohp:        { name: "Standing Overhead Press", sets: 4, lo: 6, hi: 6, type: "linear", inc: 2.5, kind: "barbell", compound: true, start: 30,
                  rule: "+2.5kg once all sets hit 6 reps with good form" },
    row:        { name: "Barbell Row", sets: 4, lo: 6, hi: 8, type: "double", inc: 2.5, step: 1, kind: "barbell", compound: true, start: 40,
                  rule: "+1 rep/set until 8 reps across all sets, then +2.5kg" },
    incline_db: { name: "Incline Dumbbell Press", sets: 3, lo: 8, hi: 10, type: "double", inc: 2, step: 1, kind: "db", compound: false, start: 16,
                  rule: "+1 rep/set until 10 reps on all sets, then +2–2.5kg per dumbbell" },
    face_pull:  { name: "Face Pulls", sets: 3, lo: 15, hi: 18, type: "double", inc: 2.5, step: 1, kind: "machine", compound: false, start: 15,
                  rule: "+1–2 reps/set until 18, then increase resistance" },
    hlr:        { name: "Hanging Leg Raises", sets: 3, lo: 12, hi: 15, type: "double", inc: 1, step: 1, kind: "bw", compound: false, start: 0,
                  rule: "Add reps until 15/set, then add ankle weight" },

    // ---------- Tuesday · Lower A
    squat:      { name: "Back Squat", sets: 5, lo: 5, hi: 5, type: "linear", inc: 2.5, kind: "barbell", compound: true, warmup: "std", start: 50,
                  rule: "+2.5kg once all 5 sets hit 5 reps with good form" },
    rdl:        { name: "Romanian Deadlift", sets: 4, lo: 6, hi: 8, type: "double", inc: 2.5, step: 1, kind: "barbell", compound: true, start: 50,
                  rule: "+1 rep/set until 8 reps across all sets, then +2.5–5kg" },
    bss:        { name: "Bulgarian Split Squat", sets: 3, lo: 10, hi: 12, type: "double", inc: 2, step: 1, kind: "db", compound: false, start: 10, perSide: true,
                  rule: "+1 rep/set/leg until 12, then increase DB weight" },
    calf:       { name: "Standing Calf Raise", sets: 4, lo: 15, hi: 20, type: "double", inc: 5, step: 1, kind: "machine", compound: false, start: 40,
                  rule: "+1–2 reps until 20/set, then add weight" },
    ab_wheel:   { name: "Ab Wheel", sets: 3, lo: 10, hi: 15, type: "double", inc: 0, step: 1, kind: "none", compound: false, start: 0,
                  rule: "Add reps or roll-out distance as control improves" },

    // ---------- Thursday · Upper B
    incline_bb: { name: "Incline Bench Press", sets: 4, lo: 6, hi: 8, type: "double", inc: 2.5, step: 1, kind: "barbell", compound: true, warmup: "std", start: 35,
                  rule: "+1 rep/set until 8 reps on all sets, then +2.5kg" },
    cs_row:     { name: "Chest Supported Row", sets: 4, lo: 8, hi: 10, type: "double", inc: 2.5, step: 1, kind: "machine", compound: false, start: 30,
                  rule: "+1 rep/set until 10 reps hit, then add weight" },
    db_press:   { name: "Seated DB Shoulder Press", sets: 3, lo: 8, hi: 10, type: "double", inc: 2, step: 1, kind: "db", compound: false, start: 14,
                  rule: "+1 rep/set until 10 reps hit, then +2–2.5kg per dumbbell" },
    pullup:     { name: "Pull-ups", sets: 3, lo: 0, hi: 0, type: "amrap", amrapGoal: 12, inc: 2.5, kind: "bw", compound: false, start: 0,
                  rule: "Track total reps; add weighted vest/belt once averaging 12+/set" },
    lateral:    { name: "Lateral Raises", sets: 4, lo: 15, hi: 20, type: "double", inc: 1, step: 1, kind: "db", compound: false, start: 6,
                  rule: "+1–2 reps until 18–20, then increase weight slightly" },
    ez_curl:    { name: "EZ Bar Curl", sets: 3, lo: 12, hi: 15, type: "double", inc: 2.5, step: 1, kind: "machine", compound: false, start: 20,
                  rule: "+1 rep/set until 12–15, then +2.5kg" },
    pushdown:   { name: "Triceps Pushdown", sets: 3, lo: 12, hi: 15, type: "double", inc: 2.5, step: 1, kind: "machine", compound: false, start: 20,
                  rule: "+1 rep/set until 12–15, then increase weight" },

    // ---------- Friday · Lower B
    deadlift:   { name: "Deadlift", sets: 3, lo: 5, hi: 5, type: "linear", inc: 5, kind: "barbell", compound: true, warmup: "dead", start: 60,
                  rule: "+2.5–5kg once all sets hit 5 reps with good form" },
    front_squat:{ name: "Front Squat", sets: 4, lo: 6, hi: 8, type: "double", inc: 2.5, step: 1, kind: "barbell", compound: true, start: 40,
                  rule: "+1 rep/set until 8 reps hit, then +2.5kg" },
    leg_press:  { name: "Leg Press", sets: 3, lo: 12, hi: 15, type: "double", inc: 5, step: 1, kind: "machine", compound: false, start: 80,
                  rule: "+1–2 reps until 15, then add weight" },
    ham_curl:   { name: "Hamstring Curl", sets: 3, lo: 12, hi: 15, type: "double", inc: 2.5, step: 1, kind: "machine", compound: false, start: 25,
                  rule: "+1 rep/set until 12–15, then increase weight" },
    lunges:     { name: "Walking Lunges", sets: 3, lo: 20, hi: 24, type: "double", inc: 2, step: 2, kind: "db", compound: false, start: 0, unit: "steps",
                  rule: "Add steps or hold heavier dumbbells" },
    plank:      { name: "Plank", sets: 3, lo: 60, hi: 90, type: "time", inc: 5, step: 10, kind: "bw", compound: false, start: 0,
                  rule: "+10–15 sec until 90 sec, then add weight plate on back" },
  },

  // Weekday numbers: 1 = Monday … 7 = Sunday
  days: [
    { key: "upperA", dow: 1, label: "Upper A", day: "Monday",   ex: ["bench", "pullup_w", "ohp", "row", "incline_db", "face_pull", "hlr"] },
    { key: "lowerA", dow: 2, label: "Lower A", day: "Tuesday",  ex: ["squat", "rdl", "bss", "calf", "ab_wheel"] },
    { key: "upperB", dow: 4, label: "Upper B", day: "Thursday", ex: ["incline_bb", "cs_row", "db_press", "pullup", "lateral", "ez_curl", "pushdown"] },
    { key: "lowerB", dow: 5, label: "Lower B", day: "Friday",   ex: ["deadlift", "front_squat", "leg_press", "ham_curl", "lunges", "plank"] },
  ],

  nutrition: {
    calories: [2800, 3100],
    protein: [130, 150],
    fat: [65, 80],
    carbs: "Remainder (~350–450 g)",
    gainPerWeek: [0.25, 0.5],
    creatine: "5 g/day",
    sleep: "8–9 h/night",
  },

  // Daily tick-offs on the Today screen
  habits: [
    { id: "am",       label: "AM skin",      detail: "Cleanse → moisturise → SPF 30+", icon: "☀" },
    { id: "pm",       label: "PM skin",      detail: "Cleanse (always after training) → moisturise", icon: "☾" },
    { id: "creatine", label: "Creatine",     detail: "5 g, any time of day", icon: "◆" },
    { id: "protein",  label: "Protein 130g+",detail: "Target 130–150 g", icon: "▲" },
    { id: "water",    label: "Water 2–3 L",  detail: "Supports skin and training", icon: "≈" },
    { id: "sleep",    label: "Slept 8h+",    detail: "Last night — 8–9 h target", icon: "✦" },
    { id: "floss",    label: "Teeth + floss",detail: "Brush 2×/day, floss nightly", icon: "✓" },
    { id: "adapalene",label: "Adapalene",    detail: "Night, 2–3×/week — only if you use it", icon: "●", optional: true },
  ],

  // Recurring chores → shown as "Heads up" on Today when due
  chores: [
    { id: "pillow",    label: "Change pillowcase",  every: 7,  group: "Habits" },
    { id: "haircut",   label: "Haircut",            every: 24, group: "Grooming" },
    { id: "nails",     label: "Trim nails",         every: 7,  group: "Grooming" },
    { id: "brows",     label: "Tidy eyebrows",      every: 21, group: "Grooming" },
    { id: "cleanser",  label: "Restock gentle cleanser",      every: 70, group: "Kit", note: "Lasts ~2–3 months" },
    { id: "moist",     label: "Restock oil-free moisturiser", every: 56, group: "Kit", note: "Lasts ~2 months" },
    { id: "spf",       label: "Restock SPF 30+",              every: 35, group: "Kit", note: "Lasts ~1–2 months daily" },
    { id: "bodywash",  label: "Restock body wash",            every: 70, group: "Kit", note: "Lasts ~2–3 months" },
    { id: "lotion",    label: "Restock body lotion",          every: 70, group: "Kit", note: "Optional · dry patches only", optional: true },
    { id: "adapgel",   label: "Restock adapalene gel",        every: 70, group: "Kit", note: "Optional · acne/texture only", optional: true },
  ],

  notes: [
    ["Warm-up", "Do 5–10 min light cardio + dynamic mobility before every session. Before each day's first heavy compound lift (bench, squat, incline bench, deadlift), run the ramp-up sets before starting your working sets."],
    ["Progressive overload", "When you complete every prescribed set and rep with good form, add weight next session: about +2.5kg for upper body lifts, +2.5–5kg for lower body/deadlift. Where a rep range is given, add reps first until you hit the top of the range on all sets, then add weight and drop back to the bottom of the range."],
    ["Deload weeks", "Every 5–6 weeks, take a lighter week: drop 1–2 sets per exercise and reduce load to about 60–70% of that week's working weight, keeping the same reps. Resume normal weights (or slightly higher) the following week."],
    ["Rest between sets", "2–3 min between heavy compound sets (bench, squat, deadlift, OHP, rows). 60–90 sec between accessory/isolation sets."],
    ["Tracking", "Log weight × reps for every set. That log is what tells you when you're ready to progress — don't guess."],
    ["Form check", "If you miss reps on the same exercise two sessions running, don't add weight. Repeat the same load until you hit the target across all sets, then progress as normal."],
  ],

  skincare: [
    ["Face · AM", "Cleanse", "Gentle, fragrance-free cleanser (e.g. CeraVe Hydrating Cleanser)", "30 sec, lukewarm water, pat dry — don't scrub"],
    ["Face · AM", "Moisturise", "Lightweight, oil-free moisturiser (e.g. CeraVe AM lotion)", "Apply to slightly damp skin to lock in hydration"],
    ["Face · AM", "Protect", "Broad-spectrum SPF 30+", "Every single day, rain or shine"],
    ["Face · PM", "Cleanse", "Same cleanser as AM", "Always cleanse after training or sweating"],
    ["Face · PM", "Moisturise", "Same moisturiser (or slightly richer)", "No SPF needed at night"],
    ["Face · Optional", "Treat", "Adapalene 0.1% gel (e.g. Differin)", "2–3×/week at night, only if acne/texture bothers you. Daily SPF becomes non-negotiable"],
    ["Body", "Wash", "Fragrance-free bar soap or body wash", "Don't over-scrub — it dries out skin"],
    ["Body", "Moisturise", "Basic body lotion", "Only on dry patches (elbows, shins)"],
    ["Body", "Prevent body acne", "Shower promptly after training", "Avoid sitting around in sweaty clothes"],
    ["Body", "Protect", "SPF on face/neck/ears/forearms", "Any time you'll be outside 20+ min"],
    ["Grooming", "Hair", "Haircut every 3–4 weeks", "Biggest 'put together' lever besides skin"],
    ["Grooming", "Facial hair", "Keep stubble or shave line deliberate", ""],
    ["Grooming", "Eyebrows", "Trim stray hairs occasionally", "Don't overdo it"],
    ["Grooming", "Teeth", "Brush 2×/day, floss nightly", "People clock teeth as much as skin"],
    ["Grooming", "Nails", "Keep trimmed and clean", "2 min a week"],
    ["Habits", "Hands off face", "Don't pick at skin", "The #1 cause of scarring and dark marks"],
    ["Habits", "Pillowcase", "Change weekly", "Cuts breakouts from oil build-up"],
    ["Habits", "Hydration", "2–3 L water/day", ""],
    ["Habits", "Sleep", "8–9 h/night", "The free skincare step"],
    ["Habits", "Posture", "Stand tall, shoulders back", "Trained via rows/deadlifts"],
  ],
};
