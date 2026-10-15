# task-hub

Local-only app (runs on my PC) to track tasks and link out to Gmail, Claude and other apps.

## Status
**v0 BUILT 2026-10-15** (Electron). Tested live on Windows 11: collapsed strip, hover-expand, add task (persists), focus timer start/pause, habit ring +1, health-nudge banner, startup entry registered. NOT tested: the actual 30/50/75-minute reminders firing on their own, the focus-block-finished banner, the Claude Code button, link buttons, reboot auto-launch, light (mint) theme, multi-monitor.

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
**Success criterion:** at Windows login the sidebar appears on its own (right side, collapsed to a thin icon strip, expands on hover/click). In under 5 seconds you can tick a task or open a link; you can pick a task, set a time-boxed goal and start a focus timer; and you get water (30 min), walk (50), stretch (75) reminders. Tasks persist across restarts.
**Stop point:** nothing beyond this. No timetable, news/inspiration feed, Instinct, Triage/GOALS views, or browser right-click export until v0 is used for real.
**Decisions:** Electron on Windows (node_modules on D: because C: is full); Mint (light) + Dark following the Windows theme, Apple/iOS 26 glass look from `design/apple-design-system.html`; tasks in a local JSON file in the app's userData folder; auto-launch with an on/off switch in the app; Claude buttons open claude.ai in the browser and Claude Code in a PowerShell window; seeded links: Claude, Gmail, GitHub, WhatsApp Web (plain link only).
**Run:** `npm start` from this folder (`npm.cmd` in PowerShell).

## Build notes (v0)
- `src/main.js` window, tray, nudge scheduler, banners, storage, IPC. `src/preload.js` is the only bridge. `src/renderer/` panel UI. `src/banner/` notification banner.
- Data: `%APPDATA%\task-hub\data.json`. Nothing leaves the PC; the only outbound action is opening a link in your default browser (http/https/mailto only).
- C: is nearly full, so `node_modules` is a junction to `D:\task-hub-deps\nm2`. Don't re-run `npm install` blindly: it replaced the junction with a real folder once, and Electron's binary was extracted by hand (`dist` + `path.txt`). If it breaks, re-create the junction and the Electron `dist`.
- Auto-launch is a Run-key entry pointing at `D:\task-hub-deps\nm2\electron\dist\electron.exe C:\Users\email\Downloads\task-hub` (dev mode, no installer). Moving either folder breaks it. Toggle in the app's settings or the tray menu.
- Tray icon: show/hide, expand, startup toggle, quit. Ctrl+Alt+H shows/hides.
- Reminders only count while you're active (paused after 5 min idle); a banner auto-snoozes 5 min after 25 s.
- Test hook: `TASKHUB_TEST_BANNER=1 npm start` pops a water banner after 3 s.
- Look: `design/apple-design-system.html`. The real window can't blur the desktop behind it (Electron limitation with transparent windows), so the panel is a 92% opaque tint.

## Next (after you've used v0)
Polish the look (more Apple, more sophisticated), proper packaging/installer, then timetable, daily feed, Instinct, GOALS.md/Triage views.

## Far-future idea (owner, 2026-10-15). NOT in v0, do not design around it yet
Right-click on any page in any browser, choose "Export to task-hub", and the page's information/context lands in the to-do list. The longer-term version is a local Claude integration for the browser (more advanced) that reads the page and turns it into proper tasks. Parked until the core app works. When revisited, treat page content as untrusted input (prompt injection) and keep it local-only.

## Security stance (from the 2026-09-28 research session)
Localhost only, never exposed to the internet; per-integration least-privilege tokens; no agent should combine private data + untrusted content + outbound actions without confirmation.
