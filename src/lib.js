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
  if (Array.isArray(s.session)) out.session = s.session.filter((t) => t && typeof t === 'object').slice(0, 100).map((t) => ({ id: str(t.id, 24), text: str(t.text, 140), done: !!t.done }));
  if (s.remind && typeof s.remind === 'object') { out.remind = {}; for (const k of ['water', 'walk', 'stretch', 'eyes']) { const r = s.remind[k] || {}; out.remind[k] = { last: num(r.last, 0, 8.64e15, 0), done: num(r.done, 0, 8.64e15, 0) }; } }
  if (s.timetable && typeof s.timetable === 'object') {
    const tt = s.timetable, items = (a) => (Array.isArray(a) ? a : []).filter((t) => t && typeof t === 'object' && str(t.text, 120).trim()).slice(0, 60).map((t) => ({ id: str(t.id, 24), text: str(t.text, 120).trim() }));
    out.timetable = { daily: items(tt.daily), days: {}, done: {} };
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) out.timetable.days[d] = items((tt.days || {})[d]);
    Object.keys(tt.done || {}).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-30).forEach((k) => { out.timetable.done[k] = (Array.isArray(tt.done[k]) ? tt.done[k] : []).slice(0, 120).map((x) => str(x, 24)); });
  }
  if (s.triageDone && typeof s.triageDone === 'object') { out.triageDone = {}; Object.entries(s.triageDone).slice(0, 500).forEach(([k, v]) => { out.triageDone[str(k, 80)] = !!v; }); }
  if (s.habits && typeof s.habits === 'object') {
    out.habits = { date: str(s.habits.date, 10), water: num(s.habits.water, 0, 999, 0), walk: num(s.habits.walk, 0, 999, 0), stretch: num(s.habits.stretch, 0, 999, 0), focus: num(s.habits.focus, 0, 999, 0) };
  }
  if (s.settings && typeof s.settings === 'object') {
    const t = s.settings, n = t.nudges || {}, g = t.goals || {};
    out.settings = { ...currentSettings, name: str(t.name, 24).trim() || currentSettings.name, pinned: !!t.pinned, nudgesOn: !!t.nudgesOn,
      nudges: { water: num(n.water, 5, 240, 30), walk: num(n.walk, 5, 240, 50), stretch: num(n.stretch, 5, 240, 75) },
      goals: { water: num(g.water, 1, 99, 8), walk: num(g.walk, 1, 99, 6), stretch: num(g.stretch, 1, 99, 4) },
      eyesOn: t.eyesOn !== false, digestAuto: t.digestAuto !== false, eyesEvery: num(t.eyesEvery, 5, 120, 10), chromeProfile: str(t.chromeProfile, 40).replace(/[^A-Za-z0-9 _-]/g, ''), mode: ['tab', 'side', 'big'].includes(t.mode) ? t.mode : 'tab' };
  }
  return out;
}

const URL_OK = new Set(['https:', 'http:', 'mailto:']);
function safeUrl(url) {
  try { const u = new URL(url); return URL_OK.has(u.protocol) ? u.toString() : null; } catch { return null; }
}

// Fresh habit counters when the local date has changed. Returns the same object if it is still today.
function rollHabits(habits, now = today()) {
  return habits.date === now ? habits : { date: now, water: 0, walk: 0, stretch: 0, focus: 0 };
}

// Which reminder should fire now: the one that has been due longest, or null.
function pickDue(next, now) {
  const due = Object.keys(next).filter((k) => now >= next[k]).sort((a, b) => next[a] - next[b]);
  return due.length ? due[0] : null;
}

// ---------- markdown / feed parsing (pure, unit-tested). Everything returned is plain text. ----------
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
function stripMd(s) {
  return String(s == null ? '' : s)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[*`~]+/g, "")
    .replace(/�/g, '–').replace(/\s+/g, ' ').trim();
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const SHORT_RE = /today|this week|deadline|needs you|now|urgent|daily/i;
function parseGoals(md) {
  const items = []; let section = 'Goals';
  String(md).split('\n').forEach((raw, line) => {
    const l = raw.replace(/\r$/, '');
    const h = /^#{2,4}\s+(.*)$/.exec(l);
    if (h) { section = stripMd(h[1]).replace(/\s*[—–(].*$/, '').trim() || section; return; }
    const m = /^\s*- \[( |x|X)\]\s+(.*)$/.exec(l);
    if (!m) return;
    const pm = /^\*\*(.+?)\*\*/.exec(m[2]);
    items.push({ line, done: m[1] !== ' ', raw: m[2], text: cut(stripMd(m[2]), 400), section, term: SHORT_RE.test(section) ? 'short' : 'long', project: pm ? stripMd(pm[1]).replace(/\s+[—–-].*$/, '') : '' });
  });
  return items;
}
// Flip one checkbox, but only if that line still holds the same text (the file may have been edited since it was read).
function toggleGoalLine(md, line, rawText, done) {
  const lines = String(md).split('\n');
  const l = lines[line];
  if (l == null) return null;
  const m = /^(\s*- \[)( |x|X)(\]\s+)(.*?)(\r?)$/.exec(l);
  if (!m || m[4] !== rawText) return null;
  lines[line] = m[1] + (done ? 'x' : ' ') + m[3] + m[4] + m[5];
  return lines.join('\n');
}

function parseStatusBoard(md) {
  const rows = []; let on = false;
  String(md).split('\n').forEach((l) => {
    if (/^##\s+Status board/i.test(l)) { on = true; return; }
    if (on && /^##\s/.test(l)) on = false;
    if (!on || !l.startsWith('|') || /^\|\s*-/.test(l) || /^\|\s*Project\s*\|/.test(l)) return;
    const c = l.replace(/^\||\|\s*$/g, '').split('|').map((x) => x.trim());
    if (c.length < 4) return;
    const name = stripMd(c[0]);
    if (!name) return;
    rows.push({ name, stage: cut(stripMd(c.slice(1, -2).join(' ')), 600), last: stripMd(c[c.length - 2]), next: cut(stripMd(c[c.length - 1]), 700) });
  });
  return rows;
}

function folderFor(name, folders) {
  const n = norm(name.replace(/^↳\s*/, ''));
  if (n.length < 3) return null;
  return folders.find((f) => norm(f) === n) || folders.find((f) => norm(f).startsWith(n) || n.startsWith(norm(f))) || folders.find((f) => norm(f).length > 5 && (norm(f).includes(n) || n.includes(norm(f)))) || null;
}

function extractDoc(text) {
  const lines = String(text).split('\n').map((l) => l.replace(/\r$/, ''));
  let title = '', summary = '';
  const todos = [];
  let inTodo = false;
  for (const l of lines) {
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      if (!title && h[1] === '#') title = stripMd(h[2]);
      inTodo = /next|to-?do|open|remaining|left|still/i.test(h[2]);
      continue;
    }
    const b = /^\s*(?:[-*]|\d+\.)\s+(?:\[( |x|X)\]\s+)?(.*)$/.exec(l);
    if (b) {
      const done = b[1] && b[1] !== ' ';
      if (!done && todos.length < 8 && (b[1] === ' ' || inTodo)) { const t = cut(stripMd(b[2]), 160); if (t && !todos.includes(t)) todos.push(t); }
      continue;
    }
    if (!summary && l.trim() && !l.startsWith('|') && !l.startsWith('>') && !l.startsWith('```') && title) summary = cut(stripMd(l), 420);
  }
  return { title, summary, todos };
}

function decodeXml(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); // feeds often escape their HTML, so strip tags again after decoding
}
function parseRss(xml, max = 8) {
  const out = [];
  const blocks = String(xml).match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const tag = (t) => { const m = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i').exec(b); return m ? decodeXml(m[1]) : ''; };
    const href = /<link[^>]*href="([^"]+)"/i.exec(b);
    const url = safeUrl(tag('link') || (href ? href[1] : ''));
    const title = cut(tag('title'), 200);
    if (!title || !url) continue;
    out.push({ title, text: cut(tag('description') || tag('summary'), 320), url });
    if (out.length >= max) break;
  }
  return out;
}

module.exports = { today, clean, safeUrl, rollHabits, pickDue, stripMd, norm, parseGoals, toggleGoalLine, parseStatusBoard, folderFor, extractDoc, parseRss, cut };
