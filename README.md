# Day (phone PWA)

Standalone Day tracker: plan items by category, run several timers at once, see the day as a list or a timeline. Data stays on the phone in `localStorage` (key `notes-tasks.day.v2`; the old `notes-tasks.day.v1` is migrated on first load and left untouched), behind `src/lib/dayStore.js` so sync can be added later. Sync with the website is by files (see below).

Categories (static): Work, Meetings, Personal, Learning (codes `work`, `meet`, `personal`, `learn`). Linking to Tasks is done on the web; a linked item shows its task title read-only.

## Commands (from this folder)
- `npm install` (once)
- `npm test -- --run` (vitest, `src/lib/dayStore.test.js`)
- `npm run build` writes `dist/` (relative base, own service worker `sw.js`, manifest "Day")
- Preview: `cd dist` then `py -m http.server 8012 --bind 127.0.0.1` (pick a free port; the user may already use 8011), open http://127.0.0.1:8012/ (stop with Ctrl+C). Never use port 8000.
- `npm run dev` serves on port 5175.

Deployed to GitHub Pages by `.github/workflows/pages.yml` (builds with `VITE_BASE=/day_tracker/`). For another sub-folder host set `VITE_BASE=/path/` at build time.

## Sync flow
The website is the master for the plan; the phone tracks and logs.
1. **Load plan** (Today header): pick `day-plan.json` (written by the website to `outbox/`). Unknown items are added; web-owned fields (`date`, `cat`, `title`, `plan`, `start`, `task_id`, `task_title`) are updated; `done`, phone entries and running timers are never overwritten; an item missing from the file is removed only if it has no entries and was not added on the phone. A toast shows added / updated / removed counts; the header shows "Plan loaded <date time>".
2. **Export log** (Today header): writes `day-log-YYYYMMDD-HHMMSS.json` (`nt-day-log` v1: items dated yesterday to today+2, their entries incl. running ones with `ts`, and `deleted_item_ids` / `deleted_entry_ids`). On a phone it opens the share sheet (save it into the website's `inbox` folder); on a desktop browser it downloads the file. The header shows "Last export <time>" and a warning when there are changes newer than the last export. Exporting never clears data; only the exported tombstones are cleared.
3. The website imports the file from `inbox/` (idempotent by id).
