# task-hub

Local-only app (runs on my PC) to track tasks and link out to Gmail, Claude and other apps.

## Status
Just created 2026-10-14. Nothing built yet.

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

## v0 proposal (NOT yet agreed, needs owner's yes)
Frameless always-on-top sidebar: tasks + checklist + quick-launch links + a button opening claude.ai, saved locally. Success: launch at boot, tick a task or open a link in under 5 seconds. Stop point: no timetable, health timer, feed, Instinct or Triage/GOALS views until v0 works. Open: whether the goal/time-box + health timer belongs in v0, since the owner described it as core.

## Far-future idea (owner, 2026-10-15). NOT in v0, do not design around it yet
Right-click on any page in any browser, choose "Export to task-hub", and the page's information/context lands in the to-do list. The longer-term version is a local Claude integration for the browser (more advanced) that reads the page and turns it into proper tasks. Parked until the core app works. When revisited, treat page content as untrusted input (prompt injection) and keep it local-only.

## Security stance (from the 2026-09-28 research session)
Localhost only, never exposed to the internet; per-integration least-privilege tokens; no agent should combine private data + untrusted content + outbound actions without confirmation.
