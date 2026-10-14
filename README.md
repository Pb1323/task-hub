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
- Visuals: "once computer is launched, s..." (sentence cut off; still deciding visuals/layout).

### Not yet decided
Single v0 success criterion and stop point (goal-gate rule). Tech stack.

### Flags
- Scraping LinkedIn/Instagram/TikTok/Facebook violates their terms; prefer RSS, official APIs or saved links.
- Linking a Claude *subscription* into third-party software may breach Anthropic's terms; an API key with a spend cap is safer.
- A WhatsApp bridge feeds untrusted messages to an agent (prompt injection); keep actions confirm-gated.

## Security stance (from the 2026-09-28 research session)
Localhost only, never exposed to the internet; per-integration least-privilege tokens; no agent should combine private data + untrusted content + outbound actions without confirmation.
