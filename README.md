# task-hub

Local-only app (runs on my PC) to track tasks and link out to Gmail, Claude and other apps.

## Status
**v1 BUILT 2026-10-16** (owner asked for comprehensive functionality): Instinct "liquid glass" UI ported; tab / sidebar / full-view modes; tasks; focus timer + session to-do checklist; GOALS.md view with tick-to-write-back (short/long term, linked to each project's latest update and to-dos); Triage Board local copy with tickable items; Projects view from the status board + project docs; daily digest (inspiration + UGC people, the Cowork email digest, live BBC news); water/walk/stretch + eye rest (every 10 min, 10 s); all links in Chrome; Claude opens in Windows Terminal; reopen with Ctrl+Alt+H, tray, Start-menu "task-hub" or `Open task-hub.cmd`. The Instinct WhatsApp button was dropped. Details, data locations and what is NOT automatic: see `HANDOFF.md`. The sections below are the earlier v0 record.

**v0 BUILT + HARDENED 2026-10-15** (Electron). Verified live on Windows 11: collapsed strip, hover-expand, tasks (persist), focus timer ring, scheduled water/walk/stretch reminders (sped-up test) with Done/Snooze, focus-done banner, Claude Code button (opens its own terminal), link tiles (opened GitHub in Edge), light + dark theme, startup entry. Still NOT verified: real 30/50/75-minute waits, reboot auto-launch, multi-monitor, behaviour over full-screen apps. Design notes for later features: `docs/next-features.md`.

## MVP (owner's words, 2026-10-14, paraphrased closely; message was cut off)
A floating tab/bar over the screen (not a true OS overlay). Features wanted:
- Links directly to my Claude account.
- Connect my "Instinct" AI WhatsApp agent (would be cool).
- Side panel: tasks, timetable, to-dos and things to remember (checklist).
- Reminders when I open my computer: health habits / how to improve.
- Auto-research bar: collated achievements/news/info from specific LinkedIn, Instagram, TikTok, Facebook sources; daily inspiration.
- Easy-click launcher for the links I use often.
- Maybe later: link to my storage; show GOALS.md and Triage Board tasks.
- Visuals: see "Visuals + flow (2026-10-15)" below.

### Not yet decided
Single v0 success criterion and stop point (goal-gate rule). Tech stack.

### Flags
- Scraping LinkedIn/Instagram/TikTok/Facebook violates their terms; prefer RSS, official APIs or saved links.
- Linking a Claude *subscription* into third-party software may breach Anthropic's terms; an API key with a spend cap is safer.
- A WhatsApp bridge feeds untrusted messages to an agent (prompt injection); keep actions confirm-gated.

## Visuals + flow (owner, 2026-10-15)
- Auto-launches when the computer starts, as a sidebar.
- Reminds you of the day's tasks; you choose what to start with and set goals within an allocated time.
- Auto timer that nudges health habits: get up and walk, drink water, stretch.
- Plus every feature listed above. Personalised, multifunctional.
- Owner left the look open: brainstorm options, owner picks. first mockup was rejected (styles looked identical). Owner wants an Apple look, iPhone 17 Pro Max / iOS 26 Liquid Glass. `design/apple-design-system.html` shows one layout in 5 colour schemes (Light, Dark, Sunset, Mint, Aurora) plus tokens (type, radii, materials). Open question: always-open sidebar or collapse to a thin strip on hover?

## v0 (AGREED 2026-10-15, owner's answers to 10 questions)
**Success criterion:** at Windows login the sidebar appears on its own (right side, collapsed to a thin icon strip, expands on hover/click). In under 5 seconds you can tick a task or open a link; you can pick a task, set a time-boxed goal and start a focus timer; and you get water (25 min), walk (50), stretch (20) reminders. Tasks persist across restarts.
**Stop point:** nothing beyond this. No timetable, news/inspiration feed, Instinct, Triage/GOALS views, or browser right-click export until v0 is used for real.
**Decisions:** Electron on Windows (node_modules on D: because C: is full); Mint (light) + Dark following the Windows theme, Apple/iOS 26 glass look from `design/apple-design-system.html`; tasks in a local JSON file in the app's userData folder; auto-launch with an on/off switch in the app; Claude buttons open claude.ai in the browser and Claude Code in a PowerShell window; seeded links: Claude, Gmail, GitHub, WhatsApp Web (plain link only).
**Run:** `npm start` from this folder (`npm.cmd` in PowerShell).

## Build notes (v0)
- `src/lib.js` pure helpers (local date, state validation, safe-URL check) with unit tests: `npm.cmd test` (6 tests, no Electron needed). `src/main.js` window, tray, nudge scheduler, banners, storage, IPC. `src/preload.js` is the only bridge. `src/renderer/` panel UI. `src/banner/` notification banner.
- Data: `%APPDATA%\task-hub\data.json`. Nothing leaves the PC; the only outbound action is opening a link in your default browser (http/https/mailto only).
- C: is nearly full, so `node_modules` is a junction to `D:\task-hub-deps\nm2`. Don't re-run `npm install` blindly: it replaced the junction with a real folder once, and Electron's binary was extracted by hand (`dist` + `path.txt`). If it breaks, re-create the junction and the Electron `dist`.
- Auto-launch is a Run-key entry pointing at `D:\task-hub-deps\nm2\electron\dist\electron.exe C:\Users\email\Downloads\task-hub` (dev mode, no installer). Moving either folder breaks it. Toggle in the app's settings or the tray menu.
- Tray icon: show/hide, expand, startup toggle, quit. Ctrl+Alt+H shows/hides.
- Reminders only count while you're active (paused after 5 min idle); a banner auto-snoozes 5 min after 25 s.
- Test switches (env vars, never needed day to day): `TASKHUB_DATA_DIR=<folder>` throwaway profile (no single-instance lock, no autostart); `TASKHUB_FAST=1` one reminder 'minute' = 1 s; `TASKHUB_THEME=light|dark`; `TASKHUB_TEST_BANNER=1` water banner after 3 s.
- Saved data is validated on write; an unreadable `data.json` is copied to `data.json.bad-<time>` instead of being overwritten. Reminders reset after sleep/resume. Esc collapses; auto-collapse waits while you have unsent task text or settings open.
- Look: `design/apple-design-system.html`. The window is one fixed transparent full-height window; the panel inside animates between pill and full with CSS, and the empty area is click-through (`setIgnoreMouseEvents` + forwarded mouse moves). A transparent window can't blur the desktop, so the panel is a ~97% opaque tint. `TASKHUB_ACRYLIC=1` tries real Windows 11 acrylic blur: it works but looks muddy grey and forces near-square corners, so it stays off.

## Next (after you've used v0)
Polish the look (more Apple, more sophisticated), proper packaging/installer, then timetable, daily feed, Instinct, GOALS.md/Triage views.

## Far-future idea (owner, 2026-10-15). NOT in v0, do not design around it yet
Right-click on any page in any browser, choose "Export to task-hub", and the page's information/context lands in the to-do list. The longer-term version is a local Claude integration for the browser (more advanced) that reads the page and turns it into proper tasks. Parked until the core app works. When revisited, treat page content as untrusted input (prompt injection) and keep it local-only.

## Security stance (from the 2026-09-28 research session)
Localhost only, never exposed to the internet; per-integration least-privilege tokens; no agent should combine private data + untrusted content + outbound actions without confirmation.
