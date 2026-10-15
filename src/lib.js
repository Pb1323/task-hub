// Pure helpers (no Electron), so they can be unit-tested with `node --test`.
function today() { // local calendar date, so the habit rings reset at local midnight (not UTC)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Only known keys, only sane shapes, bounded sizes: the renderer is ours but data on disk should stay clean.
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
function clean(s, currentSettings) {
  const out = {};
  if (Array.isArray(s.tasks)) out.tasks = s.tasks.filter((t) => t && typeof t === 'object').slice(0, 500).map((t) => ({ id: str(t.id, 24), text: str(t.text, 140), done: !!t.done }));
  if (Array.isArray(s.links)) out.links = s.links.filter((l) => l && typeof l === 'object').slice(0, 24).map((l) => ({ name: str(l.name, 24), url: str(l.url, 300), color: str(l.color, 9), glyph: str(l.glyph, 4) }));
  if (s.focus && typeof s.focus === 'object') {
    const f = s.focus;
    out.focus = { goal: str(f.goal, 120), minutes: num(f.minutes, 1, 240, 25), taskId: f.taskId ? str(f.taskId, 24) : null,
      endsAt: f.endsAt == null ? null : num(f.endsAt, 0, 8.64e15, null), pausedLeft: f.pausedLeft == null ? null : num(f.pausedLeft, 0, 2.4e7, null) };
  }
  if (s.habits && typeof s.habits === 'object') {
    out.habits = { date: str(s.habits.date, 10), water: num(s.habits.water, 0, 999, 0), walk: num(s.habits.walk, 0, 999, 0), stretch: num(s.habits.stretch, 0, 999, 0), focus: num(s.habits.focus, 0, 999, 0) };
  }
  if (s.settings && typeof s.settings === 'object') {
    const t = s.settings, n = t.nudges || {}, g = t.goals || {};
    out.settings = { ...currentSettings, pinned: !!t.pinned, nudgesOn: !!t.nudgesOn,
      nudges: { water: num(n.water, 5, 240, 30), walk: num(n.walk, 5, 240, 50), stretch: num(n.stretch, 5, 240, 75) },
      goals: { water: num(g.water, 1, 99, 8), walk: num(g.walk, 1, 99, 6), stretch: num(g.stretch, 1, 99, 4) } };
  }
  return out;
}

const URL_OK = new Set(['https:', 'http:', 'mailto:']);
function safeUrl(url) {
  try { const u = new URL(url); return URL_OK.has(u.protocol) ? u.toString() : null; } catch { return null; }
}

module.exports = { today, clean, safeUrl };
