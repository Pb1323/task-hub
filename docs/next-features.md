# Next features: design notes (NOT built, NOT approved)

Written 2026-10-15 while v0 was being hardened. Nothing here is in scope until the owner uses v0 and says which to build first. Ordered by value for effort.

## 1. GOALS.md view (small, safe)
Read-only list of the open `- [ ]` lines from `Downloads\GOALS.md`, grouped by heading, with a tick that does NOT write back (or writes back only after an explicit "sync" click). Parsing a local markdown file needs no network and no credentials. Risk: GOALS.md is long and stale in places, so show only the "Today" and "Hard deadlines" sections by default.

## 2. Timetable (small)
A day strip of time blocks (start, length, label) stored in `data.json`. Focus blocks started from the sidebar get logged onto it automatically. Open question for the owner: fixed weekly school timetable, or a free-form daily plan? Reminders at block start use the existing banner window.

## 3. Daily feed (medium, needs the owner's source list)
Allowed sources only: RSS/Atom feeds, official APIs, or saved links. NOT scraping LinkedIn, Instagram, TikTok or Facebook (terms of service). Fetch in the main process, at most a few times a day, with a short timeout and a size cap, and render as plain text (never inject feed HTML into the panel). Needs from the owner: the list of feed URLs. "Daily inspiration" can start as a local file of quotes with no network at all.

## 4. Triage Board view (needs a decision)
The Triage Board is a claude.ai artifact with its own database. Showing it in the sidebar means either opening it in the browser (a quick-launch link, zero work) or reading its data through an authenticated route, which needs credentials. Recommend the plain link.

## 5. Instinct (WhatsApp agent) (large, risky)
A bridge would feed WhatsApp messages into an agent. Treat every message as untrusted input (prompt injection): the agent must not be able to run actions, open links or change tasks without an on-screen confirm. Start as a quick-launch link to WhatsApp Web (already seeded). Revisit only after the confirm-gate pattern exists.

## 6. Right-click "Export to task-hub" from any browser (far future)
A browser extension (Edge/Chrome) adds a context-menu item. It sends the selected text, page title and URL to the app over a native-messaging host (no open port, so nothing is reachable from the network). Page text is untrusted: store it as a plain task note, never auto-run anything on it. The later "Claude reads the page and writes tasks" step needs an API key with a spend cap and must show the proposed tasks for the owner to accept.

## 7. Packaging (medium, before relying on it daily)
Today autostart points at a dev-mode `electron.exe` on D: plus the source folder. A proper installer (electron-builder, built on D: because C: is nearly full) would give an `.exe` in Program Files, a Start-menu entry and a clean uninstall. Do this once the look and features settle.

## 8. Look: toward real glass
Electron cannot blur the desktop behind a transparent window, so the panel is a 95% tint. Options: Windows 11 acrylic via `backgroundMaterial` (gives a rectangular window with small system corners, loses the 36 px curve), or leave as is. Owner's call after living with it.

## 9. Daily digest in the sidebar (owner request, 2026-10-16)
Owner wants a daily digest shown inside the sidebar. Contents not yet specified. Candidate sections: today's tasks and deadlines (from GOALS.md), reminders/habits status, the daily feed and inspiration (item 3), and a one-line summary of what changed overnight. Build order: a local-only digest (tasks, deadlines, habits, quote) first; add feed items once sources are chosen. Any text from feeds or messages is rendered as plain text, never as HTML or instructions.
