# 🔥 Reign of Fire — personal training tracker

A phone-first web app built from the *Reign of Fire Gym Plan*: the 4-day upper/lower split, nutrition targets, and skincare and grooming routine. It runs entirely in the browser with no server, no account and no build step. It also works offline.

## Put it on GitHub Pages (about 3 minutes)

1. Create a new repository on GitHub, for example `gym`. Public is fine because your data is never stored in the repo.
2. Click **Add file → Upload files**, drag in **every file in this folder**, then click **Commit changes**.
3. Go to **Settings → Pages**. Under **Source**, pick **Deploy from a branch**, choose **main** and **/ (root)**, then click **Save**.
4. After a minute, your app is live at `https://<your-username>.github.io/gym/`.
5. On your phone, open that link, then use **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android). It now opens full-screen like a normal app.

## How to use it

- **Today** tells you what to do: today's session (or a missed one to catch up), anything that needs your attention, your daily habits and a weigh-in box.
- **Start workout** shows every weight already filled in. Tap a circle when you finish a set. Tap the same circle again to log one rep fewer. Press and hold a circle to type an exact number. The rest timer starts by itself.
- **Finish** saves the session and shows you what changes next time.
- **Progress** shows your strength trends, how fast you're gaining weight against the 0.25–0.5 kg/week target, a consistency calendar and your workout history.
- **Plan** holds the full programme, the rules, your routine, reminders, settings and your data.

## What it handles behind the scenes

| Area | What the engine does |
|---|---|
| Progression | Applies each exercise's rule from the plan. Fixed-rep lifts gain weight once every set is hit. Rep-range lifts add reps up to the top of the range, then add weight and drop back to the bottom. Pull-ups add load once you average 12+ reps a set. The plank adds seconds, then a plate. |
| Misses | If you miss reps, the weight stays the same. After 2 misses in a row it tells you to focus on form. After 3 it offers a one-tap 10% reset. |
| Warm-ups | Works out the ramp sets (bar, then 50/70/85%, or 40/60/80% for deadlift) from today's working weight. |
| Plates | Shows the plates to load on each side of a 20 kg bar. You can change the bar weight and plate set. |
| Rest | 2:30 for heavy compound lifts and 1:15 for accessories, both adjustable. The timer beeps and vibrates, and the screen stays awake. |
| Deloads | Counts your training weeks. In week 6 it suggests a deload: 1–2 fewer sets at about 65%, same reps. Deload sessions never affect progression. |
| Bodyweight | Smooths your weigh-ins into a 7-day average, measures your weekly rate of gain and suggests a calorie change, for example "+200 kcal/day". |
| Reminders | Pillowcase, haircut, nails, eyebrows and restocking your skincare products, each based on when you last did it. |
| Sync | Optional. Paste a GitHub token with only the `gist` scope to sync between phone and laptop through a private gist. Each entry is merged separately and the newest change wins, including deletions. |

## Your data

- Your data is stored in your browser's local storage on each device.
- **Plan → Back up** downloads a `.json` file. **Restore / merge** brings a backup back in without overwriting newer entries.
- **Export log (.csv)** gives you every set you've logged, ready to open in Excel or Google Sheets.

## Changing the plan

Everything about the programme is in **`plan.js`**: exercises, sets, rep ranges, weight increases, warm-ups, habits and reminders. Edit it and commit the change. Your history is kept, and the next targets are recalculated from it.

If you change files after installing the app, open `sw.js` and bump `VERSION` (for example `rof-v2`) so installed copies pick up the update.

## Files

```
index.html            app shell
styles.css            design (dark/light, mobile-first)
plan.js               the programme, all the data from the spreadsheet
engine.js             progression, deloads, trends, reminders, storage, sync
app.js                the interface
sw.js                 offline support
manifest.webmanifest  install-to-home-screen metadata
icon.svg / icon-*.png app icons
```
