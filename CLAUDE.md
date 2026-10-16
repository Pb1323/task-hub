# task-hub
See README.md and HANDOFF.md (v1 built 2026-10-16; build notes, data locations, honest limits there). Electron app, local-only, private repo.
Gotchas: node_modules is a junction to D:\task-hub-deps\nm2 (C: nearly full), don't blindly re-run npm install. UI = Instinct glass design (`src/renderer/glass.css`); edit `index.src.html` then run `node tools/build.js`.
Scope: the owner asked (2026-10-16) for comprehensive functionality, so the v0 stop point no longer applies; the security rules (local only, untrusted text, no scraping, confirm-gated Claude actions) still do.
