# 🔥 Reign of Fire — personal training tracker

A light, phone-first web app for the *Reign of Fire Gym Plan*. It covers the four-workout upper/lower programme, nutrition targets, and the skincare and grooming routine. There's no server, no account and no build step, and it works offline.

## Put it on GitHub Pages (about 3 minutes)

1. Create a GitHub repository (e.g. `gym`). Public is fine, because your data is never stored in the repo.
2. **Add file → Upload files**, drag in **every file in this folder** (including the hidden `.nojekyll`), then **Commit**.
3. Go to **Settings → Pages**, set **Source** to **Deploy from a branch**, pick **main** and **/ (root)**, then **Save**.
4. A minute later your app is live at `https://<your-username>.github.io/gym/`.
5. On your phone, open that link, then **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android).

**Updating from an older version?** Upload the new files over the old ones. Your logged workouts are kept. You'll go through the short setup once, and your weights carry over.

## How it works

**1. Setup (once).** Enter your name and starting weight, tap the days you can usually train, and say whether you're new to lifting. Then press **Start my programme**. Week 1 begins then, not before.

**2. Today.** Shows the next workout, a preview of the weights, and a **Start workout** button. The four workouts always go in order: Upper A → Lower A → Upper B → Lower B → repeat.
- **Train on any day.** If you swap Thursday for Friday, you just do the next workout.
- **Miss a day** and nothing gets skipped. The plan waits for you, and the app tells you so.
- **Away for 2+ weeks?** Any lift you haven't done in that time comes back 10% lighter so you ease back in.

**3. The workout shows one exercise at a time.**
- A short form tip, plus a **Watch how** link to video demos.
- Big **weight** and **reps** numbers. Use − / + if you want to change the weight.
- For barbell lifts, a picture of **which plates go on each side**.
- Warm-up sets listed for you on the first heavy lift of the day.
- One big **✓ Done set** button. The rest timer starts by itself, then beeps and buzzes when it's time to go again.
- If you did fewer reps, tap **Did fewer or more?** You can also tap a set circle (one less rep per tap) or hold it to type a number.
- **Next →** moves you on. **Finish** saves the workout and shows your next targets.

**4. Me & plan** is where you change your name, starting weight and training days, or restart from week 1.

## What it handles for you (same rules as the spreadsheet)

| Area | What the engine does |
|---|---|
| Progression | Fixed-rep lifts: add weight once every set hits its reps. Rep-range lifts: add reps up to the top of the range, then add weight and drop back to the bottom. Pull-ups: add weight once you average 12+ reps a set. Plank: add seconds, then a plate. |
| Misses | Keeps the same weight after a miss. Two misses in a row: focus on form. Three: offers a one-tap 10% reset. |
| Warm-ups | Ramp sets worked out from today's weight (bar, 50%, 70%, 85%; for deadlift: bar, 40%, 60%, 80%). |
| Plates | Shows which plates go on each side of the bar. You can change the bar weight. |
| Rest | 2:30 for big lifts, 1:15 for smaller ones (adjustable). The screen stays awake. |
| Light weeks | Counts your training weeks from when you pressed Start. Suggests a light week (a deload: fewer sets at ~65%) in week 6. Light-week sessions don't affect your progress. |
| Bodyweight | Works out a 7-day average, your weekly gain against the 0.25–0.5 kg/week target, your total change since you started, and a suggested calorie adjustment. |
| Reminders | Pillowcase, haircut, nails, eyebrows and restocking skincare, each based on when you last did it. |
| Sync | Optional. Add a GitHub token with only the `gist` scope to sync between phone and laptop through a private gist. |

## Your data

- Your data is stored in your browser on each device.
- **Back up** downloads a `.json` file. **Restore / merge** brings one back without overwriting newer entries.
- **Export log (.csv)** gives you every set you've logged, ready for Excel or Google Sheets.

## Changing the plan

Everything about the programme lives in **`plan.js`**: exercises, sets, reps, increments, warm-ups, form tips, beginner starting weights, habits and reminders. Your history is never touched by changing it.

After changing any file, bump `VERSION` in `sw.js` (e.g. `rof-v3`) so installed copies pick up the update.

## Files

```
index.html            app shell
styles.css            light & airy design (dark mode optional)
plan.js               the programme: all the data from the spreadsheet
engine.js             progression, schedule, light weeks, trends, reminders, storage, sync
app.js                the interface
sw.js                 offline support
manifest.webmanifest  install-to-home-screen metadata
icon.svg / icon-*.png app icons
```
