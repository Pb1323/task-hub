# task-hub

Local-only app (runs on my PC) to track tasks and link out to Gmail, Claude and other apps.

## Status
Just created 2026-10-14. Nothing built yet.

## MVP (to be written down verbatim from the owner, not guessed)
TBD

## Design decisions still open
Visuals / layout.

## Security stance (from the 2026-09-28 research session)
Localhost only, never exposed to the internet; per-integration least-privilege tokens; no agent should combine private data + untrusted content + outbound actions without confirmation.
