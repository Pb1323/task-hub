# Handoff for a fresh Claude session in this repo (updated 2026-10-16, after v1 functionality)

Read `README.md` first (decisions, build notes, test switches), then `docs/next-features.md`.

## State
**v1 is built and running** (Electron, Windows 11, local). `npm.cmd start` in this folder, or `Open task-hub.cmd`, or the Start-menu entry "task-hub". Tests: `npm.cmd test` (14 tests, no Electron needed).
The UI is the Instinct "liquid glass v8" design (`hub-glass-v8.html` in Downloads, reviewed: pure CSS/JS mockup, no network). `src/renderer/glass.css` + `fonts/` + `sprite.svg.txt` are extracted from it; `src/renderer/index.src.html` -> `node tools/build.js` -> `index.html` (inlines the icon sprite). Our own styles: `hub.css`.

**Windows (rebuilt 2026-10-17 to stop glitching):** three fixed-size transparent windows, created once at startup and only ever shown or hidden, never resized: `tab` (90 px pill at the right edge), `side` (340 px sidebar) and `big` (workspace, sits left of the sidebar). All three load the same page (`index.html?role=tab|side|big`; `role.js` sets `html[data-role]` and CSS shows the right part). The main process owns the layout (`uiMode`, `curView`, `setUiMode()`, `gotoView()` in `src/main.js`) and broadcasts `ui:ctx`; state changes are forwarded to the other windows (`push(sender)`); focus-block completion runs in main so it fires once. Nothing animates except hovers. Click a pill icon = open that view; double-click the pill = sidebar; double-click empty sidebar = full view; click the active nav icon again = close the full view; Esc steps back; X = tab. Ctrl+Alt+H hides/shows, Ctrl+Alt+M moves to the next screen. There is no sidebar-collapse (rail) any more.

**Views (sidebar nav):** Tasks, Focus (timer + session to-do checklist), Goals (live `Downloads\GOALS.md`, tick writes back to the file; short/long term tabs; project chip expands the project's latest update + to-dos), Triage (local copy of the Triage Board artifact, tickable), Projects (status-board rows from `Downloads\CLAUDE.md` + newest status/updates/HANDOFF/CLAUDE.md in each project folder; Open folder / Claude here), Digest (inspiration + UGC people, the daily email digest, live BBC RSS news), Habits (water/walk/stretch rings, eye rest every 10 min for 10 s), Launch (links open in Chrome, storage folders), Settings.
Claude buttons open Windows Terminal (`wt.exe`) running `claude` (in a project folder from the Projects view). Links open in Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`; optional `--profile-directory` setting).

## Data (all local, `%APPDATA%\task-hub\`)
`data.json` state (tasks, session, links, focus, habits, hist, triageDone, settings) | `digest\YYYY-MM-DD.json` (converted from the Cowork "Daily Digest" Gmail draft) | `digest\inspo-YYYY-MM-DD.json` + `seen.json` (people, never repeated) | `triage\projects|backlog\*.json` (export of the Triage Board DB) | `news.json` (RSS cache) | `prompts\*.md` (written by the app at start; handed to Claude Code).

## Not automatic (honest limits)
- The app cannot read Gmail or write to the claude.ai Triage Board by itself. "Update digest in Claude..." and "Sync ticks to board..." open Claude Code in a visible terminal with a prompt file the app wrote; every tool call still goes through Claude Code's permission prompts. Triage ticks are stored locally in `triageDone` until synced.
- Today's digest + inspiration files were created by hand on 2026-10-16. Tomorrow's need that button (or add a step to the Cowork routine to write the JSON).
- Not verified live: real 30/50/75-min waits, eye-rest banner timing (only run sped up, no crash), reboot launch, multi-monitor, full-screen apps, Windows Terminal launch from the buttons (wt syntax is standard but unclicked), GOALS.md tick against the real file (unit-tested, not clicked).

## Rules that still apply
- Local only. Never read `Documents\Private`, keys, bank or ID files. No scraping of LinkedIn/Instagram/TikTok/Facebook (inspiration comes from public sources via Claude). Do not wire the Claude subscription through third-party OAuth. Text from feeds, files, email or the web is untrusted: rendered with textContent only, never executed.
- Instinct WhatsApp button was removed at the owner's request (WhatsApp Web stays as a normal link/tool).
- Ask before creating any new repo or publishing anything.

## Gotchas
- C: is nearly full. `node_modules` is a junction to `D:\task-hub-deps\nm2`; Electron's binary was extracted by hand. Don't run `npm install` blindly (see README).
- Autostart = Run-key entry to the dev-mode `electron.exe` on D: plus this folder. Moving either breaks it.
- Test without touching real data: `TASKHUB_DATA_DIR=<folder>` (copy `digest/` and `triage/` into it), `TASKHUB_MODE=big|side|tab`, `TASKHUB_VIEW=<view>`, `TASKHUB_SHOT=<png>` (screenshot then quit; `TASKHUB_SHOT_WIN=tab|side|big` picks the window, `TASKHUB_EVAL=<js>` runs in it, `TASKHUB_CHECK=<js>` reads the big window afterwards; prints STATE/EVAL/CHECK lines), `TASKHUB_THEME`, `TASKHUB_FAST=1`, `TASKHUB_ROOT=<folder>` (stand-in for Downloads, e.g. to test GOALS ticks safely).

## Likely next steps
1. Owner uses it for a day and lists what feels off (look, wording, sizes).
2. Make the digest fully automatic (Cowork routine writes the JSON, or a scheduled local task).
3. Proper installer (electron-builder on D:), then the far-future browser right-click export (`docs/next-features.md`).

## Efficiency + reminders (2026-10-17)
- Resting cost: ~310 MB, 3 processes (was ~735 MB, 6). The GPU process is off (`disableHardwareAcceleration` + `in-process-gpu`; set `TASKHUB_GPU=1` to bring it back if rendering ever looks wrong). The pill is its own tiny page (`tab.src.html` -> `tab.html`); the sidebar and the workspace windows are created on demand (the pill warms the sidebar on hover) and closed after 90 s hidden. `tools/build.js` also builds `tab.html` and `src/banner/banner.html` (inlines only the icons they use). Test switches: `TASKHUB_FLAGS="a;b=c"` adds Chromium switches; `powershell` memory test lived in the session scratchpad only.
- Reminders: water 30 / walk 50 / stretch 75 min and eye rest every 10 min for 10 s are unchanged in `src/main.js`. Each reminder now records when it last fired and when it was answered (`state.remind`), and the Habits page shows Last / Next / Today for all four (`nudge:status`).
- Notifications use a new glass card (`src/banner/`): drawn icon, Snooze 5 min / Done, a time-left bar, a countdown for eye rest.

## Automatic daily digest (2026-10-17)
- Each day after 07:00 (checked at start + every 30 min; max 3 tries a day, 2 h apart) the app runs two headless Claude Code runs (`claude -p`, your logged-in account, hidden, in the digest folder): (1) email only (Gmail `list_drafts` tool only) converts the Cowork "Daily Digest" draft to JSON; (2) web only (WebSearch + WebFetch only) finds 8-10 verified people, never repeating `seen.json`. Neither run can write files or run commands; they only print JSON and `runDigestUpdate()` in `src/main.js` validates it and writes `digest/<date>.json`, `digest/inspo-<date>.json`, `seen.json`. Result of the last run is in `digest/auto.json` and shown on the Digest page; "Update now" runs it on demand, "Open in Claude..." is the old interactive route. Switch off in Settings (`digestAuto`). First real end-to-end run worked 2026-10-17 (~3 min, email 10 sections, people 6).
- The Digest page also shows "Coming up": the 5 most relevant events in the next 14 days from `Downloads\event-radar\data\events.json` (read-only; score minus 0.25 per day away; skips skip/applied/attended and age-blocked for both).
- Reminders stay on screen 10 s (then count as snoozed 5 min). Hover labels are one overlay element per window (`tips.js`), centred, no background block.
- Env `TASKHUB_DIGEST_NOW=1` runs the digest update 5 s after launch (used for testing).

## Timetable + merged Projects page (2026-10-17)
- Sidebar nav is now: Tasks, Focus, Goals, **Timetable** (replaces Triage), **Projects & Triage**, Digest, Habits, Launch. The Triage page is gone: its backlog + tickable projects live on the Projects page, matched to each project's card by name (`projects()` in `src/renderer/app.js`; ticks still go to `state.triageDone`, synced to the board only through the Claude prompt).
- Timetable (`state.timetable = { daily: [...non-negotiables], days: { mon..sun: [...] }, done: { 'YYYY-MM-DD': [ids] } }`, validated in `lib.clean`): every-day non-negotiables + per-weekday items; ticks apply to today only and reset by date; add to "this day / every day / weekdays / weekends"; double-click an item to edit. Two seed non-negotiables ("Plan the day", "Evening review") are there to delete or keep.
