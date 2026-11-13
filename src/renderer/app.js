// task-hub renderer. All text from files, feeds or the web is inserted with textContent only (never innerHTML).
const $ = (id) => document.getElementById(id);
const hubEl = $('hub');
const Q = new URLSearchParams(location.search);
let S = null;                 // full state, mirrored to main
const ROLE = Q.get('role') || 'side';   // which window this is: tab | side | big
let ctx = { mode: 'tab', view: 'tasks' }; // set by the main process
let ctxAt = 0;
let view = 'tasks';
let G = null, TR = null, PR = null, DG = null, PL = null;   // goals, triage, projects, digest caches
let gTab = 'short', dLane = 'all', pFilter = '', pView = 'all';
const open = new Set();       // expanded details (keys)

const SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c); });
  return e;
}
function icon(n, cls = '') {
  const gi = el('span', { class: 'gi ' + cls, 'data-n': n });
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVGNS, 'use'); use.setAttribute('href', '#g-' + n);
  svg.append(use); gi.append(svg, el('i', { class: 'sp' }));
  return gi;
}
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const save = () => window.hub.setState({ tasks: S.tasks, session: S.session, links: S.links, focus: S.focus, settings: S.settings, habits: S.habits, triageDone: S.triageDone, timetable: S.timetable, plan: S.plan });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const link = (url, label, cls = 'lnk') => el('button', { class: cls, onclick: () => window.hub.openLink(url), title: url }, label);
const btn = (label, fn, cls = '') => el('button', { class: 'btn ' + cls, onclick: fn }, label);
const hasUrl = (u) => u && /^https?:/.test(u);

// ---------- modes ----------
const setMode = (m) => window.hub.setMode(m);   // the main process shows/hides the right windows; nothing here ever resizes
let lastView = null;
function busy() { const a = document.activeElement; return a && a.tagName === 'INPUT' && a.type !== 'checkbox' && a.value.trim() !== ''; }

// ---------- focus timer ----------
function remaining() { const f = S.focus; if (f.endsAt) return f.endsAt - Date.now(); if (f.pausedLeft != null) return f.pausedLeft; return f.minutes * 60000; }
function startPause() {
  const f = S.focus;
  if (f.endsAt) { f.pausedLeft = f.endsAt - Date.now(); f.endsAt = null; }
  else {
    if (!f.goal && f.taskId) { const t = S.tasks.find((x) => x.id === f.taskId); if (t) f.goal = t.text; }
    f.endsAt = Date.now() + (f.pausedLeft != null ? f.pausedLeft : f.minutes * 60000); f.pausedLeft = null;
  }
  save(); render();
}
function resetTimer() { S.focus.endsAt = null; S.focus.pausedLeft = null; save(); render(); }
function tickTimer() {
  if (!S) return;
  const f = S.focus;
  const running = !!f.endsAt, started = running || f.pausedLeft != null, rem = remaining();
  const txt = started ? fmt(rem) : '--:--';
  $('sumT').textContent = txt; $('tTime').textContent = started ? txt : '';
  const arc = $('tArc'); if (arc) { arc.style.strokeDashoffset = started ? 364.4 * (1 - Math.max(0, Math.min(1, rem / (f.minutes * 60000)))) : 364.4; $('time').textContent = fmt(rem); }
}

// ---------- sidebar ----------
const NAV = [['tasks', 'Tasks', 'check-circle'], ['focus', 'Focus', 'clock'], ['goals', 'Goals', 'target'], ['timetable', 'Timetable', 'calendar'], ['projects', 'Projects', 'code-branch'], ['digest', 'Digest', 'sparkle'], ['habits', 'Habits', 'water-drop'], ['launch', 'Launch', 'link']];
function navCount(k) {
  switch (k) {
    case 'tasks': return S.tasks.filter((t) => !t.done).length || '';
    case 'focus': return S.habits.focus ? `${S.habits.focus}` : '';
    case 'goals': return G ? G.items.filter((i) => !i.done && i.term === 'short').length : '';
    case 'timetable': return ttRemaining() || '';
    case 'projects': return TR ? (TR.backlog.filter((x) => !isTicked('backlog/' + x.id, x.done)).length + TR.projects.filter((x) => x.needsYou && !isTicked('projects/' + x.id, x.category === 'done')).length) || '' : '';
    case 'digest': return DG && DG.inspo && DG.inspo.date === todayStr() ? 'new' : '';
    case 'habits': return ['water', 'walk', 'stretch'].filter((x) => S.habits[x] >= S.settings.goals[x]).length + '/3';
    default: return '';
  }
}
function renderNav() {
  const nav = $('nav'); nav.replaceChildren();
  NAV.forEach(([k, label, ic]) => nav.append(el('button', { class: 'nv' + (ctx.mode === 'big' && ctx.view === k ? ' active' : ''), 'data-tip': label, onclick: () => go(k) }, icon(ic), el('span', { class: 'lb' }, label), el('em', { class: 'lb' }, String(navCount(k))))));
  $('nvSettings').classList.toggle('active', ctx.mode === 'big' && ctx.view === 'settings');
}
function go(k) { window.hub.goto(k); } // main process opens the full view on k, or closes it if k is already showing

function renderPanel() {
  const open_ = S.tasks.filter((t) => !t.done), done = S.tasks.filter((t) => t.done).length;
  $('tBadge').textContent = open_.length || '';
  $('sumN').textContent = String(done);
  $('sumArc').style.setProperty('--p', S.tasks.length ? (done / S.tasks.length).toFixed(2) : '0');
  $('pname').textContent = S.settings.name || 'You'; $('av').textContent = (S.settings.name || 'U')[0].toUpperCase();
  // weekly focus chart
  const days = []; const base = new Date();
  for (let i = 6; i >= 0; i--) { const d = new Date(base); d.setDate(d.getDate() - i); const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; days.push(k === todayStr() ? S.habits.focus || 0 : ((S.hist || {})[k] || {}).focus || 0); }
  const mx = Math.max(3, ...days); const pts = days.map((v, i) => [i * (220 / 6), 62 - (v / mx) * 50]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  $('areaL').setAttribute('d', line); $('areaF').setAttribute('d', line + ' V70 H0 Z');
  // daily pick from today's inspiration digest, shown in the sidebar (one different person per day)
  let pick = $('pick');
  if (!pick) { pick = el('button', { class: 'pick', id: 'pick', onclick: () => { dLane = 'all'; go('digest'); } }); $('areaL').closest('svg').after(pick); }
  const its = DG && DG.inspo ? DG.inspo.items : [];
  if (its.length) {
    const day = Math.floor(Date.now() / 86400000), it = its[day % its.length];
    pick.replaceChildren(el('span', { class: 'gl' }, 'Daily pick'), el('b', {}, it.person), el('span', {}, it.headline));
    pick.hidden = false;
  } else pick.hidden = true;
  // tools
  const tools = $('tools'); tools.replaceChildren();
  const L = (name) => (S.links.find((l) => l.name.toLowerCase() === name) || {}).url;
  [['Terminal', 'terminal', () => window.hub.openTerminal()], ['Mail', 'mail', () => window.hub.openLink(L('gmail') || 'https://mail.google.com')],
    ['GitHub', 'code-branch', () => window.hub.openLink(L('github') || 'https://github.com')], ['WhatsApp', 'chat-bubble', () => window.hub.openLink(L('whatsapp') || 'https://web.whatsapp.com')]]
    .forEach(([n, ic, fn]) => tools.append(el('button', { class: 'gb tl', 'aria-label': n, onclick: fn }, icon(ic), el('span', { class: 'lb' }, n))));
  renderNav();
}

// ---------- shared pieces ----------
function taskRow(t, list, opts = {}) {
  const focused = S.focus.taskId === t.id;
  const row = el('div', { class: 'row' + (t.done ? ' done' : '') + (focused ? ' focus' : '') });
  row.append(el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: () => { t.done = !t.done; if (t.done && focused) S.focus.taskId = null; save(); render(); } }, '✓'),
    el('div', { class: 't', title: 'Double-click to edit', ondblclick: (ev) => editText(ev.currentTarget, t) }, t.text),
    el('div', { class: 'a' },
      opts.when && !t.done ? [['▲', 'Move up', -1], ['▼', 'Move down', 1]].map(([g, ti, d]) => el('button', { title: ti, onclick: () => moveTask(t, d) }, g)) : '',
      opts.when && !t.done ? WHEN.filter(([k]) => k !== (t.when || 'week')).map(([k, l]) => el('button', { title: 'Move to ' + l, style: 'width:auto;padding:0 6px;font-size:11px', onclick: () => { t.when = k; save(); render(); } }, l)) : '',
      opts.toSession && !t.done ? el('button', { title: 'Add to focus session', onclick: () => { if (!S.session.some((x) => x.text === t.text && !x.done)) S.session.push({ id: uid(), text: t.text, done: false }); save(); render(); } }, '＋') : '',
      opts.focusable && !t.done ? el('button', { title: 'Focus on this', onclick: () => { S.focus.taskId = focused ? null : t.id; if (!focused) S.focus.goal = t.text; save(); render(); } }, focused ? '◉' : '◎') : '',
      el('button', { title: 'Delete', onclick: () => { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); if (focused) S.focus.taskId = null; save(); render(); } }, '✕')));
  return row;
}
const WHEN = [['today', 'Today'], ['week', 'This week'], ['later', 'Later']];
function moveTask(t, d) {   // swap with the nearest open task in the same section
  const w = t.when || 'week', i = S.tasks.indexOf(t);
  for (let j = i + d; j >= 0 && j < S.tasks.length; j += d) { const o = S.tasks[j]; if (!o.done && (o.when || 'week') === w) { S.tasks[i] = o; S.tasks[j] = t; break; } }
  save(); render();
}
function editText(node, t) {
  const inp = el('input', { class: 'field', maxlength: '140', 'aria-label': 'Edit' }); inp.value = t.text;
  let done = false;
  const finish = (ok) => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v) { t.text = v; save(); } render(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') { e.stopPropagation(); finish(false); } };
  inp.onblur = () => finish(true);
  node.replaceChildren(inp); inp.focus(); inp.select();
}
function addForm(placeholder, fn) {
  const inp = el('input', { class: 'field', placeholder, maxlength: '140', autocomplete: 'off', 'aria-label': placeholder });
  const f = el('form', { class: 'add', onsubmit: (e) => { e.preventDefault(); const v = inp.value.trim(); if (v) { fn(v); inp.value = ''; } } }, inp, el('button', { class: 'btn pri', type: 'submit' }, 'Add'));
  return f;
}
const cutT = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
// Every open item from GOALS.md, plus the next step of active projects the goals don't mention, plus open Triage backlog.
// Finished / parked / wound-down / stale projects are left out.
const FINISHED = /^(done|wrapped|parked|superseded|being wound down|live.*nothing|retired)/i, NO_NEXT = /^(none|nothing|n\/a|leave|revisit if)/i;
function collated() {
  const out = { goals: [], projects: [], backlog: [] };
  if (!G || !G.ok || !PR || !TR) return out;
  const seen = new Set(), covered = new Set();
  G.items.filter((i) => !i.done).forEach((it) => {
    const key = norm(it.text).slice(0, 60); if (seen.has(key)) return; seen.add(key);   // same line listed under Today and This month
    const p = projFor(it.project); if (p) covered.add(p.name);
    out.goals.push({ ...it, proj: it.project });
  });
  out.goals.sort((a, b) => (!a.proj - !b.proj) || a.proj.localeCompare(b.proj) || a.line - b.line);   // named projects first, loose items last
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  PR.forEach((p) => {
    if (covered.has(p.name) || out.goals.some((g) => norm(g.text).includes(norm(p.name.replace(/^↳\s*/, ''))) && norm(p.name).length > 5)) return;
    if (FINISHED.test(p.stage) || /superseded by|stale/i.test(p.stage) || NO_NEXT.test(p.next) || /wrapped up|nothing further/i.test(p.next)) return;
    if (!/^\d{4}-\d{2}-\d{2}/.test(p.last) || p.last.slice(0, 10) < cutoff) return;    // untouched for a month: not a live task
    out.projects.push(p);
  });
  out.backlog = TR.backlog.filter((x) => !isTicked('backlog/' + x.id, x.done));
  return out;
}
const projFor = (name) => { if (!PR || !name) return null; const n = norm(name); return PR.find((p) => norm(p.name) === n) || PR.find((p) => n.length >= 4 && (norm(p.name).startsWith(n) || n.startsWith(norm(p.name)))) || null; };
function projectDetail(p) {
  const d = el('div', { class: 'det' });
  d.append(el('div', { class: 'sub' }, `Last touched ${p.last || '?'}${p.doc ? ' · ' + p.doc.file + ' updated ' + new Date(p.doc.mtime).toLocaleDateString('en-GB') : ''}`));
  if (p.next) d.append(el('div', {}, el('b', {}, 'Next: '), p.next));
  if (p.doc && p.doc.summary) d.append(el('div', { class: 'sub' }, p.doc.summary));
  if (p.doc && p.doc.todos.length) d.append(el('div', {}, el('b', {}, 'To do'), el('ul', {}, p.doc.todos.map((x) => el('li', {}, x)))));
  const bar = el('div', { class: 'add' });
  if (p.folder) bar.append(btn('Open folder', () => window.hub.openFolder({ project: p.folder }), 'sm'), btn('Claude here', () => window.hub.openClaude({ project: p.folder }), 'sm'));
  d.append(bar);
  return d;
}

// ---------- timetable ----------
const DAYS = [['mon', 'Mon', 'Monday'], ['tue', 'Tue', 'Tuesday'], ['wed', 'Wed', 'Wednesday'], ['thu', 'Thu', 'Thursday'], ['fri', 'Fri', 'Friday'], ['sat', 'Sat', 'Saturday'], ['sun', 'Sun', 'Sunday']];
const dayKey = (d = new Date()) => DAYS[(d.getDay() + 6) % 7][0];
let ttDay = null, ttTab = 'plan', plWeek = null, plDay = null;
const ttItems = (key) => [...S.timetable.daily.map((i) => ({ ...i, scope: 'daily' })), ...(S.timetable.days[key] || []).map((i) => ({ ...i, scope: key }))];
const ttDoneToday = () => S.timetable.done[todayStr()] || [];
function ttRemaining() { if (!S || !S.timetable) return 0; const d = ttDoneToday(); return ttItems(dayKey()).filter((i) => !d.includes(i.id)).length + planLeft(); }


// ---------- revision plan (8 weeks, Monday start) ----------
const SUBJ = [['German', '#E0932B'], ['English', '#7C6CE0'], ['Biology', '#00A878'], ['Chemistry', '#2E9BD6'], ['Physics', '#4C7BE0'], ['Maths', '#E05C7C'], ['Geography', '#2FA39B'], ['Economics', '#B8860B'], ['D&T', '#C8603F']];
const subjColor = (n) => (SUBJ.find(([k]) => n.startsWith(k)) || [0, '#6B7C85'])[1];
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const nextMonday = () => { const d = midnight(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; };
const fmtDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
function planPos() { // where today sits in the plan: { diff, week (0-7), day (0-6) } or null if not started
  if (!S || !S.plan || !S.plan.start) return null;
  const diff = Math.round((midnight() - parseYmd(S.plan.start)) / 86400000);
  return { diff, week: Math.floor(diff / 7), day: ((diff % 7) + 7) % 7 };
}
function planBlocks(week, day) { return PL && PL.weeks[week] && PL.weeks[week].days[day] ? PL.weeks[week].days[day].blocks : []; }
function planLeft() { const p = planPos(); if (!PL || !p || p.diff < 0 || p.week > PL.weeks.length - 1) return 0; const done = S.plan.done[todayStr()] || []; return planBlocks(p.week, p.day).filter((_b, i) => !done.includes(i)).length; }

function ttPlan(b) {
  if (!PL) { b.append(el('div', { class: 'empty' }, 'Loading the plan…')); return ''; }
  const pos = planPos();
  const setStart = (d) => { S.plan.start = ymd(d); S.plan.done = S.plan.done || {}; plWeek = null; plDay = null; save(); render(); };
  if (!pos) {
    const nm = nextMonday(), dow = midnight().getDay();
    const inp = el('input', { type: 'date', class: 'field', style: 'max-width:180px' });
    b.append(el('div', { class: 'card' }, el('h3', {}, PL.title), el('div', { class: 'sub' }, PL.note),
      el('div', { class: 'sub', style: 'margin-top:8px' }, 'The plan runs Monday to Sunday for 4 weeks (the sprint is days 12 Nov to 2 Dec; use Mon 9 Nov as the start). Pick the Monday that Week 1 starts on (you can shift it later if the mock date moves).'),
      el('div', { class: 'add', style: 'margin-top:10px;flex-wrap:wrap' }, dow === 1 ? btn('Start today', () => setStart(midnight()), 'pri') : '', btn(`Start next Monday (${fmtDay(nm)})`, () => setStart(nm), dow === 1 ? '' : 'pri'), inp, btn('Use this date', () => { if (!inp.value) return; const d = parseYmd(inp.value); const back = (d.getDay() + 6) % 7; d.setDate(d.getDate() - back); setStart(d); }, 'sm'))));
    return '';
  }
  const startD = parseYmd(S.plan.start), todayWeek = pos.week, todayDay = pos.day;
  if (pos.diff < 0) b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, `The plan starts on ${fmtDay(startD)} (in ${-pos.diff} day${pos.diff === -1 ? '' : 's'}). You can look ahead below.`)));
  else if (pos.week > PL.weeks.length - 1) b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, `The plan ended on ${fmtDay(new Date(startD.getTime() + (PL.weeks.length * 7 - 1) * 86400000))}. Restart or shift the start below if the mocks have moved.`)));
  const wk = plWeek != null ? plWeek : Math.min(PL.weeks.length - 1, Math.max(0, todayWeek)), dy = plDay != null ? plDay : (todayWeek === wk && pos.diff >= 0 ? todayDay : 0);
  b.append(el('div', { class: 'ttday' }, PL.weeks.map((w, i) => el('button', { class: 'chip' + (i === wk ? ' on' : '') + (i === todayWeek && pos.diff >= 0 ? ' today' : ''), title: w.title, onclick: () => { plWeek = i; plDay = null; renderView(); } }, 'Week ' + w.n))));
  b.append(el('div', { class: 'ttday' }, PL.weeks[wk].days.map((d, i) => { const date = new Date(startD.getTime() + (wk * 7 + i) * 86400000); return el('button', { class: 'chip' + (i === dy ? ' on' : '') + (ymd(date) === todayStr() ? ' today' : ''), onclick: () => { plWeek = wk; plDay = i; renderView(); } }, d.name.slice(0, 3)); })));
  const date = new Date(startD.getTime() + (wk * 7 + dy) * 86400000), isToday = ymd(date) === todayStr();
  // dates are built from whole days; re-snap to local midnight so DST changes can't shift the day
  date.setHours(0, 0, 0, 0);
  const dayObj = PL.weeks[wk].days[dy], blocks = dayObj.blocks, done = S.plan.done[ymd(date)] || [];
  const total = blocks.reduce((n, x) => n + x.mins, 0), doneN = isToday ? blocks.filter((_x, i) => done.includes(i)).length : 0;
  b.append(el('div', { class: 'sub' }, `Week ${PL.weeks[wk].n}: ${PL.weeks[wk].title}`));
  b.append(el('div', { class: 'gh' }, `${dayObj.label} · ${fmtDay(date)}${isToday ? ' · today' : ''}`));
  b.append(el('div', { class: 'sub' }, `${blocks.length} blocks, about ${total} min${isToday ? ` · ${doneN} done` : ''}${isToday ? '' : ' · you can tick things off on the day itself'}`));
  blocks.forEach((x, i) => {
    const ticked = isToday && done.includes(i), nea = x.subject.includes('NEA');
    b.append(el('div', { class: 'row' + (ticked ? ' done' : '') },
      isToday ? el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: () => { const k = ymd(date); const arr = S.plan.done[k] || (S.plan.done[k] = []); const j = arr.indexOf(i); if (j >= 0) arr.splice(j, 1); else arr.push(i); save(); render(); } }, '✓') : el('div', { style: 'width:24px;flex:none' }),
      el('div', { class: 't' },
        el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:2px' }, el('span', { class: 'pchip', style: `background:${subjColor(x.subject)};color:#fff` }, x.subject), el('span', { class: 'sub' }, x.mins + ' min')),
        x.text,
        nea ? el('div', { class: 'add', style: 'margin-top:6px' }, btn('Open NEA folder', () => window.hub.openFolder({ project: 'product-dev-coursework' }), 'sm'), btn('Claude in NEA folder', () => window.hub.openClaude({ project: 'product-dev-coursework' }), 'sm'), btn('Mechanisms research', () => window.hub.openFolder({ project: 'backseat-buddy-mechanisms' }), 'sm')) : '')));
  });
  // targets, method, links, start date
  const fold = (key, title, body) => el('div', { class: 'card' }, el('div', { style: 'display:flex;justify-content:space-between;cursor:pointer', onclick: () => { open.has(key) ? open.delete(key) : open.add(key); renderView(); } }, el('h3', {}, title), el('span', { class: 'sub' }, open.has(key) ? '▾' : '▸')), open.has(key) ? body : '');
  b.append(el('div', { class: 'gh' }, 'Plan notes'));
  b.append(fold('pl-targets', 'Daily targets (non-negotiables)', el('ul', {}, PL.targets.map((t) => el('li', {}, t)))));
  b.append(fold('pl-method', 'How to log and mark', el('ul', {}, PL.method.map((t) => el('li', {}, t)))));
  b.append(fold('pl-links', 'Official specifications', el('div', { class: 'ins' }, PL.links.map(([n, u]) => link(u, n)))));
  const inp2 = el('input', { type: 'date', class: 'field', style: 'max-width:180px' });
  b.append(fold('pl-start', `Start date: Week 1 begins ${fmtDay(startD)}`, el('div', { class: 'add', style: 'flex-wrap:wrap' }, inp2, btn('Move start (snaps to a Monday)', () => { if (!inp2.value) return; const d = parseYmd(inp2.value); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); S.plan.start = ymd(d); plWeek = plDay = null; save(); render(); }, 'sm'), btn('Reset plan', () => { S.plan.start = ''; S.plan.done = {}; plWeek = plDay = null; save(); render(); }, 'sm'))));
  return isToday ? `${blocks.length - doneN} left today` : '';
}

// ---------- views ----------
const VIEWS = {
  tasks() {
    const open_ = S.tasks.filter((t) => !t.done);
    const b = $('wBody'); b.append(addForm('Add a task (goes into Today)', (v) => { S.tasks.unshift({ id: uid(), text: v, done: false, when: 'today' }); save(); render(); }));
    if (!S.tasks.length) b.append(el('div', { class: 'empty' }, 'Nothing yet. Add your first task above.'));
    WHEN.forEach(([k, l]) => {
      const list = open_.filter((t) => (t.when || 'week') === k);
      b.append(el('div', { class: 'gh' }, `${l} · ${list.length}`));
      if (!list.length) b.append(el('div', { class: 'empty' }, 'Nothing here.'));
      list.forEach((t) => b.append(taskRow(t, S.tasks, { focusable: true, toSession: true, when: true })));
    });
    const doneT = S.tasks.filter((t) => t.done);
    if (doneT.length) { b.append(el('div', { class: 'gh' }, `Done · ${doneT.length}`)); doneT.forEach((t) => b.append(taskRow(t, S.tasks))); }
    const C = collated();
    const nC = C.goals.length + C.projects.length + C.backlog.length;
    b.append(el('div', { class: 'gh' }, `Collated from your goals, projects and board · ${nC} open`));
    if (!G || !PR || !TR) b.append(el('div', { class: 'empty' }, 'Reading GOALS.md, your projects and the Triage Board…'));
    else if (!nC) b.append(el('div', { class: 'empty' }, 'Nothing open in your goals or projects.'));
    const addMine = (text) => el('button', { title: 'Copy to my tasks', onclick: () => { if (!S.tasks.some((x) => x.text === text && !x.done)) S.tasks.unshift({ id: uid(), text, done: false, when: 'week' }); save(); render(); } }, '＋');
    let proj = null;
    C.goals.forEach((it) => {
      if (it.proj !== proj) { proj = it.proj; b.append(el('div', { class: 'sub', style: 'margin:8px 0 2px' }, proj || 'General')); }
      b.append(el('div', { class: 'row' },
        el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: async () => { G = await window.hub.toggleGoal(it.line, it.raw, true); render(); } }, '✓'),
        el('div', { class: 't' }, it.text), el('div', { class: 'a' }, addMine(it.text))));
    });
    if (C.backlog.length) {
      b.append(el('div', { class: 'sub', style: 'margin:8px 0 2px' }, 'Triage Board backlog'));
      C.backlog.forEach((x) => { const k = 'backlog/' + x.id; b.append(el('div', { class: 'row' }, el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: () => { S.triageDone[k] = true; save(); render(); } }, '✓'), el('div', { class: 't' }, x.text), el('div', { class: 'a' }, addMine(x.text)))); });
    }
    if (C.projects.length) {
      b.append(el('div', { class: 'sub', style: 'margin:8px 0 2px' }, 'Next step on other active projects (not in your goals list)'));
      C.projects.forEach((p) => b.append(el('div', { class: 'row' }, el('div', { style: 'width:24px;flex:none' }),
        el('div', { class: 't' }, el('b', {}, p.name + ': '), cutT(p.next, 220)), el('div', { class: 'a' }, addMine(`${p.name}: ${cutT(p.next, 100)}`), el('button', { title: 'Open in Projects', onclick: () => go('projects') }, '→')))));
    }
    return `${open_.length} to do · ${nC} collated`;
  },
  focus() {
    const b = $('wBody'), f = S.focus;
    const ring = el('div', { class: 'tring' });
    ring.innerHTML = '<svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="58" fill="none" stroke="var(--track)" stroke-width="9"/><circle id="tArc" cx="66" cy="66" r="58" fill="none" stroke="var(--acc)" stroke-width="9" stroke-linecap="round" stroke-dasharray="364.4 364.4" stroke-dashoffset="364.4" transform="rotate(-90 66 66)"/></svg>'; // static, authored here
    ring.append(el('div', { class: 'big', id: 'time' }, fmt(remaining())));
    const goal = el('input', { class: 'field', placeholder: 'Goal for this block, e.g. finish the Biology pack', maxlength: '120', 'aria-label': 'Goal' }); goal.value = f.goal;
    goal.oninput = (e) => { f.goal = e.target.value; save(); };
    const seg = el('div', { class: 'seg' }, [15, 25, 45, 60, 90].map((m) => el('button', { class: 'chip' + (f.minutes === m ? ' on' : ''), onclick: () => { f.minutes = m; f.pausedLeft = null; if (f.endsAt) f.endsAt = Date.now() + m * 60000; save(); render(); } }, m + ' min')));
    const setMin = (m) => { f.minutes = m; f.pausedLeft = null; if (f.endsAt) f.endsAt = Date.now() + m * 60000; save(); render(); };
    const mins = el('input', { class: 'field', type: 'number', min: '1', max: '240', step: '1', value: String(f.minutes), style: 'width:80px', 'aria-label': 'Minutes' });
    mins.onchange = () => { const m = Math.round(Number(mins.value)); if (m >= 1 && m <= 240) setMin(m); else mins.value = String(f.minutes); };
    mins.onkeydown = (e) => { if (e.key === 'Enter') mins.onchange(); };
    seg.append(mins, el('span', { class: 'sub' }, 'min (1-240)'));
    b.append(el('div', { class: 'card' }, el('div', { class: 'timeRow' }, ring, el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:10px' }, goal, seg,
      el('div', { class: 'add' }, btn(f.endsAt ? 'Pause' : f.pausedLeft != null ? 'Resume' : 'Start', startPause, 'pri'), btn('Reset', resetTimer)), el('div', { class: 'sub', id: 'nextNudge' })))));
    const sess = S.session, doneN = sess.filter((t) => t.done).length;
    b.append(el('div', { class: 'gh' }, `Session to-dos · ${doneN}/${sess.length} done`));
    b.append(addForm('Add a to-do for this focus session', (v) => { S.session.push({ id: uid(), text: v, done: false }); save(); render(); }));
    if (!sess.length) b.append(el('div', { class: 'empty' }, 'Set the list of things you will do in this session, then tick them off.'));
    sess.forEach((t) => b.append(taskRow(t, S.session)));
    if (doneN) b.append(el('div', { class: 'add' }, btn('Clear completed', () => { S.session = S.session.filter((t) => !t.done); save(); render(); }, 'sm')));
    refreshNudge();
    return `${S.habits.focus || 0} blocks today`;
  },
  goals() {
    const b = $('wBody');
    if (!G) { b.append(el('div', { class: 'empty' }, 'Loading GOALS.md…')); return ''; }
    if (!G.ok) { b.append(el('div', { class: 'empty' }, G.error || 'Could not read GOALS.md')); return ''; }
    b.append(el('div', { class: 'add' }, ['short', 'long'].map((t) => el('button', { class: 'chip' + (gTab === t ? ' on' : ''), onclick: () => { gTab = t; renderView(); } }, t === 'short' ? 'Short term' : 'Long term'))));
    const items = G.items.filter((i) => i.term === gTab);
    let sec = null;
    items.forEach((it) => {
      if (it.section !== sec) { sec = it.section; b.append(el('div', { class: 'gh' }, sec)); }
      const p = projFor(it.project), key = 'g' + it.line;
      b.append(el('div', { class: 'row' + (it.done ? ' done' : '') },
        el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: async () => { G = await window.hub.toggleGoal(it.line, it.raw, !it.done); render(); } }, '✓'),
        el('div', { class: 't' }, it.text),
        p ? el('button', { class: 'pchip', title: 'Project status', onclick: () => { open.has(key) ? open.delete(key) : open.add(key); renderView(); } }, (open.has(key) ? '▾ ' : '▸ ') + p.name) : ''));
      if (p && open.has(key)) b.append(projectDetail(p));
    });
    if (!items.length) b.append(el('div', { class: 'empty' }, 'No items here.'));
    return `${items.filter((i) => !i.done).length} open`;
  },
  timetable() {
    const b = $('wBody');
    b.append(el('div', { class: 'ttday' }, [['plan', 'Revision plan'], ['mine', 'My list']].map(([k, l]) => el('button', { class: 'chip' + (ttTab === k ? ' on' : ''), onclick: () => { ttTab = k; renderView(); } }, l))));
    if (ttTab === 'plan') return ttPlan(b);
    const today = dayKey(), key = ttDay || today, isToday = key === today, T = S.timetable;
    ttDay = key;
    b.append(el('div', { class: 'ttday' }, DAYS.map(([k, short]) => el('button', { class: 'chip' + (k === key ? ' on' : '') + (k === today ? ' today' : ''), onclick: () => { ttDay = k; renderView(); } }, short))));
    const dn = DAYS.find((d) => d[0] === key)[2];
    const done = ttDoneToday();
    const row = (it) => {
      const ticked = isToday && done.includes(it.id);
      return el('div', { class: 'row' + (ticked ? ' done' : '') },
        isToday ? el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: () => { const t = todayStr(); const arr = T.done[t] || (T.done[t] = []); const k2 = arr.indexOf(it.id); if (k2 >= 0) arr.splice(k2, 1); else arr.push(it.id); save(); render(); } }, '✓') : el('div', { style: 'width:24px' }),
        el('div', { class: 't', ondblclick: (ev) => editText(ev.currentTarget, (it.scope === 'daily' ? T.daily : T.days[it.scope]).find((x) => x.id === it.id)) }, it.text),
        el('div', { class: 'a' }, el('button', { title: 'Remove', onclick: () => { const arr = it.scope === 'daily' ? T.daily : T.days[it.scope]; const k2 = arr.findIndex((x) => x.id === it.id); if (k2 >= 0) arr.splice(k2, 1); save(); render(); } }, '✕')));
    };
    const all = ttItems(key), nDone = isToday ? all.filter((i) => done.includes(i.id)).length : 0;
    b.append(el('div', { class: 'sub' }, isToday ? `Today, ${dn}: ${nDone} of ${all.length} done. Ticks reset tomorrow.` : `Planning ${dn}. You can only tick things off on the day itself.`));
    b.append(el('div', { class: 'gh' }, 'Non-negotiables · every day'));
    if (!T.daily.length) b.append(el('div', { class: 'empty' }, 'Nothing here. Add the things you want to do every single day.'));
    T.daily.forEach((i) => b.append(row({ ...i, scope: 'daily' })));
    b.append(el('div', { class: 'gh' }, `${dn} only`));
    if (!(T.days[key] || []).length) b.append(el('div', { class: 'empty' }, `Nothing planned for ${dn} yet.`));
    (T.days[key] || []).forEach((i) => b.append(row({ ...i, scope: key })));
    // add form: choose where the new item goes
    let scope = 'day';
    const inp = el('input', { class: 'field', placeholder: 'Add something to finish', maxlength: '120', autocomplete: 'off', 'aria-label': 'Add to timetable' });
    const chips = el('div', { class: 'ttday' });
    const SC = [['day', `${dn} only`], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends']];
    const paint = () => chips.replaceChildren(...SC.map(([k, l]) => el('button', { type: 'button', class: 'chip' + (scope === k ? ' on' : ''), onclick: () => { scope = k; paint(); } }, l)));
    paint();
    b.append(el('div', { class: 'gh' }, 'Add'));
    b.append(el('form', { class: 'add', onsubmit: (e) => {
      e.preventDefault(); const v = inp.value.trim(); if (!v) return;
      if (scope === 'daily') T.daily.push({ id: uid(), text: v });
      else { const targets = scope === 'day' ? [key] : scope === 'weekdays' ? ['mon', 'tue', 'wed', 'thu', 'fri'] : ['sat', 'sun']; targets.forEach((d) => (T.days[d] || (T.days[d] = [])).push({ id: uid(), text: v })); }
      save(); render();
    } }, inp, el('button', { class: 'btn pri', type: 'submit' }, 'Add')), chips);
    return isToday ? `${all.length - nDone} left` : '';
  },
  projects() {
    const b = $('wBody');
    if (!PR || !TR) { b.append(el('div', { class: 'empty' }, 'Reading project folders and the Triage Board…')); return ''; }
    const trFor = (name) => { const n = norm(name); return TR.projects.find((t) => norm(t.name) === n) || TR.projects.find((t) => n.length >= 4 && (norm(t.name).startsWith(n) || n.startsWith(norm(t.name)))) || null; };
    const used = new Set(), pend = pendingTicks();
    b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, `Your projects (from the status board and each project's own notes) together with the Triage Board copy saved ${TR.snapshot ? new Date(TR.snapshot).toLocaleString('en-GB') : 'never'}. Ticks save here at once; the board itself only changes when you run the sync in Claude, which shows you the changes first.`),
      el('div', { class: 'add', style: 'margin-top:8px' }, btn(`Sync ${pend} tick${pend === 1 ? '' : 's'} to board…`, () => window.hub.openClaude({ prompt: 'triage' }), pend ? 'pri sm' : 'sm'), btn('Refresh board copy…', () => window.hub.openClaude({ prompt: 'triage' }), 'sm'))));
    const f = el('input', { class: 'field', placeholder: 'Filter projects', 'aria-label': 'Filter projects' }); f.value = pFilter;
    f.oninput = () => { pFilter = f.value; const pos = f.selectionStart; renderView(); const nf = $('wBody').querySelector('input'); if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); } };
    b.append(el('div', { class: 'add' }, [['all', 'All'], ['needs', 'Needs you']].map(([k, l]) => el('button', { class: 'chip' + (pView === k ? ' on' : ''), onclick: () => { pView = k; renderView(); } }, l)), f));
    const tick = (key, snap) => el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: () => { S.triageDone[key] = !isTicked(key, snap); save(); render(); } }, '✓');
    if (TR.backlog.length) {
      b.append(el('div', { class: 'gh' }, 'Backlog'));
      TR.backlog.filter((x) => norm(x.text).includes(norm(pFilter))).forEach((x) => { const k = 'backlog/' + x.id; b.append(el('div', { class: 'row' + (isTicked(k, x.done) ? ' done' : '') }, tick(k, x.done), el('div', { class: 't' }, x.text))); });
    }
    b.append(el('div', { class: 'gh' }, 'Projects'));
    const card = (name, last, next, tag, t, p) => {
      const key = 'p' + name, k = t ? 'projects/' + t.id : null, ticked = t && isTicked(k, t.category === 'done');
      return el('div', { class: 'card' + (ticked ? ' done' : '') },
        el('div', { style: 'display:flex;gap:10px;align-items:flex-start' }, t ? tick(k, t.category === 'done') : '',
          el('div', { style: 'flex:1;min-width:0' }, el('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, el('h3', {}, name), el('span', { class: 'sub' }, last || '')),
            tag || (t && t.needsYou) ? el('div', { class: 'add', style: 'margin-bottom:4px' }, tag ? el('span', { class: 'pchip' }, tag) : '', t && t.needsYou ? el('span', { class: 'pchip', style: 'color:var(--acc)' }, 'needs you') : '') : '',
            el('div', { class: 'sub clamp' }, next),
            p ? el('div', { class: 'add', style: 'margin-top:6px' }, btn(open.has(key) ? 'Hide update' : 'Latest update & to-do', () => { open.has(key) ? open.delete(key) : open.add(key); renderView(); }, 'sm')) : '',
            p && open.has(key) ? projectDetail(p) : '')));
    };
    PR.forEach((p) => {
      const t = trFor(p.name); if (t) used.add(t.id);
      if (pView === 'needs' && !(t && t.needsYou && !isTicked('projects/' + t.id, t.category === 'done'))) return;
      if (!norm(p.name + p.next + (t ? t.next : '')).includes(norm(pFilter))) return;
      b.append(card(p.name, p.last, (t && t.next) || p.next, t && t.tag, t, p));
    });
    const rest = TR.projects.filter((t) => !used.has(t.id) && (pView !== 'needs' || (t.needsYou && !isTicked('projects/' + t.id, t.category === 'done'))) && norm(t.name + t.next).includes(norm(pFilter)));
    if (rest.length) { b.append(el('div', { class: 'gh' }, 'Also on the Triage Board')); rest.forEach((t) => b.append(card(t.name, t.last, t.next || t.summary, t.tag, t, null))); }
    return `${PR.length} projects`;
  },
  digest() {
    const b = $('wBody');
    if (!DG) { b.append(el('div', { class: 'empty' }, 'Loading digest…')); return ''; }
    const stale = !DG.inspo || DG.inspo.date !== DG.today || !DG.digest || DG.digest.date !== DG.today || DG.digest.sections.length < 5;
    const au = DG.auto || {};
    const status = au.running ? `Updating in the background (${({ ai: 'researching AI news and startups', funding: 'researching funding and market moves', people: "finding today's people" })[au.running] || 'working'})…`
      : au.last ? `Last automatic update ${new Date(au.last.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}: ${au.last.ok ? 'worked' : au.last.msg}`
      : au.on === false ? 'Automatic update is off (Settings).' : 'Updates itself once a day, after 07:00.';
    b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, (stale ? `Today's digest isn't loaded yet (digest ${DG.digest ? DG.digest.date : 'none'}, inspiration ${DG.inspo ? DG.inspo.date : 'none'}). ` : '') + status),
      el('div', { class: 'add', style: 'margin-top:8px' }, btn(au.running ? 'Working…' : 'Update now', () => { if (!au.running) { window.hub.runDigest(); setTimeout(loadDigest, 800); } }, 'pri sm'), btn('Open in Claude…', () => window.hub.openClaude({ prompt: 'digest' }), 'sm'))));
    if (DG.events && DG.events.items.length) {
      const mark = (v) => (v === 'ok' ? '✓' : v === 'no' ? '✗' : '?');
      b.append(el('div', { class: 'gh' }, `Coming up · from event-radar (${DG.events.items.length} of ${DG.events.total} soon)`));
      b.append(el('div', { class: 'card' }, DG.events.items.map((x) => el('div', { class: 'row' },
        el('div', { class: 'pchip', style: 'min-width:64px;text-align:center' }, x.days === 0 ? 'today' : x.days === 1 ? 'tomorrow' : `in ${x.days} days`),
        el('div', { class: 't' }, hasUrl(x.url) ? link(x.url, x.title, 'lnk') : x.title, el('div', { class: 'sub' }, `${x.where} · ${x.type}${x.prize ? ' · ' + x.prize : ''} · can enter: Pranav ${mark(x.pranav)}, Srinivas ${mark(x.srinivas)}`))))));
    }
    if (DG.inspo) {
      b.append(el('div', { class: 'gh' }, `Inspiration · ${DG.inspo.date}`));
      b.append(el('div', { class: 'add' }, [['all', 'All'], ['inspiration', 'People'], ['niche', 'My niche'], ['ugc', 'UGC']].map(([k, l]) => el('button', { class: 'chip' + (dLane === k ? ' on' : ''), onclick: () => { dLane = k; renderView(); } }, l))));
      const cards = DG.inspo.items.filter((x) => dLane === 'all' || x.lane === dLane);
      b.append(el('div', { class: 'cols' }, cards.map((x) => el('div', { class: 'card ins' },
        el('div', { class: 'who' }, el('b', {}, x.person), el('i', {}, x.date)), el('div', { class: 'sub' }, x.role), el('div', { style: 'font-weight:600' }, x.headline), el('div', { class: 'sub' }, x.detail),
        x.takeaway ? el('div', { class: 'take' }, '→ ' + x.takeaway) : '', hasUrl(x.url) ? link(x.url, 'Source: ' + (x.source || 'link')) : ''))));
    }
    if (DG.digest) {
      b.append(el('div', { class: 'gh' }, `Daily briefing · ${DG.digest.date} · AI, startups, funding, outlook`));
      DG.digest.sections.forEach((s) => {
        const key = 'd' + s.title, shown = open.has(key) || DG.digest.sections.indexOf(s) < 2 || /^(Funding|Future)/.test(s.title);
        b.append(el('div', { class: 'card' }, el('div', { style: 'display:flex;justify-content:space-between;cursor:pointer', onclick: () => { open.has(key) ? open.delete(key) : open.add(key); renderView(); } }, el('h3', {}, s.title), el('span', { class: 'sub' }, shown ? '▾' : `▸ ${s.items.length}`)),
          shown ? el('div', { class: 'ins' }, s.items.map((x) => el('div', { style: 'padding:6px 0;border-top:1px solid var(--track)' },
            x.title ? el('div', { style: 'font-weight:600' }, x.title) : '', x.meta ? el('div', { class: 'sub' }, x.meta) : '', el('div', {}, x.text), x.idea ? el('div', { class: 'take' }, 'Idea: ' + x.idea) : '', hasUrl(x.url) ? link(x.url, x.source || 'Source') : ''))) : ''));
      });
    }
    b.append(el('div', { class: 'gh' }, `Live news${DG.news.at ? ' · updated ' + new Date(DG.news.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}`));
    if (!DG.news.feeds.length) b.append(el('div', { class: 'empty' }, 'No news yet (offline?). Try Reload news.'));
    DG.news.feeds.forEach((fd) => b.append(el('div', { class: 'card' }, el('h3', {}, fd.name), el('div', { class: 'ins' }, fd.items.slice(0, 6).map((x) => el('div', { style: 'padding:4px 0' }, link(x.url, x.title, 'lnk'), x.text ? el('div', { class: 'sub' }, x.text) : ''))))));
    return '';
  },
  habits() {
    const b = $('wBody'), rg = el('div', { class: 'rings' });
    [['water', '💧', 'Water', 'var(--c-b)'], ['walk', '🚶', 'Walk', 'var(--acc)'], ['stretch', '🧘', 'Stretch', 'var(--c-a)']].forEach(([k, ic, label, col]) => {
      const goal = S.settings.goals[k], n = S.habits[k], c = 2 * Math.PI * 26;
      const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', '0 0 64 64');
      svg.innerHTML = `<circle cx="32" cy="32" r="26" fill="none" stroke="var(--track)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(Math.min(1, n / goal) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>`; // numbers only
      rg.append(el('div', { class: 'hring', title: `Log one ${label.toLowerCase()}`, onclick: () => { S.habits[k] += 1; save(); render(); } }, el('div', { class: 'rg big' }, svg, el('b', {}, ic)), `${label} ${n}/${goal}`));
    });
    b.append(el('div', { class: 'card' }, rg, el('div', { class: 'sub', id: 'nextNudge', style: 'margin-top:10px' })));
    b.append(el('div', { class: 'card' }, el('h3', {}, 'Reminder schedule'), el('div', { id: 'remTable', class: 'rem' }, el('div', { class: 'sub' }, 'Loading…')),
      el('div', { class: 'sub', style: 'margin-top:8px' }, 'Time while you are away from the PC (5 min idle or locked) is not counted. Intervals and the eye-rest switch are in Settings.')));
    refreshNudge();
    return '';
  },
  launch() {
    const b = $('wBody'), ap = el('div', { class: 'apps' });
    S.links.forEach((l) => ap.append(el('button', { title: l.url, onclick: () => window.hub.openLink(l.url) }, el('div', { class: 'ic', style: `background:${/^#[0-9a-f]{3,8}$/i.test(l.color) ? l.color : '#555'}` }, l.glyph || '↗'), l.name)));
    ap.append(el('button', { onclick: () => window.hub.openTerminal() }, el('div', { class: 'ic', style: 'background:#3a3a3f' }, '>_'), 'Terminal'));
    ap.append(el('button', { onclick: () => window.hub.openClaude({}) }, el('div', { class: 'ic', style: 'background:#C8603F' }, '✦'), 'Claude (terminal)'));
    b.append(el('div', { class: 'gh' }, 'Links' + (S.chrome ? ' · open in Chrome' : '')), ap);
    const loc = el('div', { class: 'apps' }); b.append(el('div', { class: 'gh' }, 'Storage'), loc);
    window.hub.locations().then((names) => names.forEach((n, i) => loc.append(el('button', { onclick: () => window.hub.openFolder({ loc: i }) }, el('div', { class: 'ic', style: 'background:#57606a' }, '▤'), n))));
    return '';
  },
  settings() {
    const b = $('wBody'), c = el('div', { class: 'card' });
    const row = (label, ctl) => el('div', { class: 'set' }, el('span', {}, label), ctl);
    const chk = (v, fn) => { const i = el('input', { type: 'checkbox' }); i.checked = !!v; i.onchange = () => fn(i.checked); return i; };
    const num = (v, lo, hi, fn) => { const i = el('input', { type: 'number', class: 'field', min: lo, max: hi }); i.value = v; i.onchange = () => { fn(Math.min(hi, Math.max(lo, +i.value || lo))); save(); render(); }; return i; };
    const name = el('input', { class: 'field', maxlength: '24', style: 'max-width:160px' }); name.value = S.settings.name || ''; name.onchange = () => { S.settings.name = name.value.trim() || 'Srinivas'; save(); render(); };
    const prof = el('input', { class: 'field', maxlength: '40', placeholder: 'e.g. Profile 1 (blank = default)', style: 'max-width:200px' }); prof.value = S.settings.chromeProfile || ''; prof.onchange = () => { S.settings.chromeProfile = prof.value.trim(); save(); };
    c.append(row('Your name', name), row('Launch at Windows startup', chk(S.autoLaunch, (v) => window.hub.setAutoLaunch(v))), row('Keep sidebar open (don\'t auto-minimise)', chk(S.settings.pinned, (v) => { S.settings.pinned = v; save(); render(); })),
      row('Health reminders', chk(S.settings.nudgesOn, (v) => { S.settings.nudgesOn = v; save(); render(); })),
      row('Water / walk / stretch every (min)', el('span', { class: 'add' }, num(S.settings.nudges.water, 5, 240, (v) => { S.settings.nudges.water = v; }), num(S.settings.nudges.walk, 5, 240, (v) => { S.settings.nudges.walk = v; }), num(S.settings.nudges.stretch, 5, 240, (v) => { S.settings.nudges.stretch = v; }))),
      row('Eye rest (10 s)', el('span', { class: 'add' }, chk(S.settings.eyesOn, (v) => { S.settings.eyesOn = v; save(); render(); }), num(S.settings.eyesEvery, 5, 120, (v) => { S.settings.eyesEvery = v; }))),
      row('"Revise" reminder (every N min)', el('span', { class: 'add' }, chk(S.settings.reviseOn !== false, (v) => { S.settings.reviseOn = v; save(); render(); }), num(S.settings.reviseEvery || 5, 1, 60, (v) => { S.settings.reviseEvery = v; }))),
      row('Update the digest by itself each morning (a short background Claude run)', chk(S.settings.digestAuto !== false, (v) => { S.settings.digestAuto = v; save(); render(); })),
      row('Focus-end alarm (rings for 30 s until you stop it)', chk(S.settings.focusAlarm !== false, (v) => { S.settings.focusAlarm = v; save(); render(); })),
      row('Chrome profile folder (if you use several)', prof));
    b.append(c);
    const lc = el('div', { class: 'card' }, el('h3', {}, 'Quick-launch links'));
    S.links.forEach((l) => lc.append(el('div', { class: 'set' }, el('b', {}, l.name), el('span', { class: 'sub', style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, l.url), el('button', { class: 'xbtn', 'aria-label': 'Remove ' + l.name, onclick: () => { S.links = S.links.filter((x) => x !== l); save(); render(); } }, '✕'))));
    const ln = el('input', { class: 'field', placeholder: 'Name', maxlength: '24', style: 'max-width:120px' }), lu = el('input', { class: 'field', placeholder: 'example.com' });
    lc.append(el('form', { class: 'add', style: 'margin-top:8px', onsubmit: (e) => { e.preventDefault(); const u = normUrl(lu.value); const nm = ln.value.trim() || (u && new URL(u).hostname.replace(/^www\./, '')); if (!u || !nm || S.links.length >= 24) return; S.links.push({ name: nm.slice(0, 24), url: u, color: ['#5856d6', '#ff9500', '#0a84ff', '#30b0c7', '#af52de', '#ff2d55'][S.links.length % 6], glyph: nm[0].toUpperCase() }); save(); render(); } }, ln, lu, el('button', { class: 'btn pri', type: 'submit' }, 'Add')));
    b.append(lc);
    b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, 'Hide completely: the window goes away but task-hub keeps running; press Ctrl+Alt+H or use the tray icon to bring it back. Quit stops it; start it again from the Start menu entry "task-hub" or by running "Open task-hub.cmd" in the task-hub folder.'),
      el('div', { class: 'add', style: 'margin-top:8px' }, btn('Hide completely', () => window.hub.hideWindow()), btn('Quit task-hub', () => window.hub.quit()))));
    return '';
  },
};
const TITLES = { tasks: 'Tasks', focus: 'Focus session', goals: 'Goals', timetable: 'Timetable', projects: 'Projects & Triage', digest: 'Daily digest', habits: 'Habits', launch: 'Launch', settings: 'Settings' };
function normUrl(u) {
  u = u.trim(); if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try { const p = new URL(u); return ['https:', 'http:', 'mailto:'].includes(p.protocol) ? p.toString() : null; } catch { return null; }
}
const isTicked = (key, snap) => (Object.hasOwn(S.triageDone, key) ? !!S.triageDone[key] : !!snap);
function pendingTicks() {
  if (!TR) return 0;
  const snap = {}; TR.backlog.forEach((b) => { snap['backlog/' + b.id] = b.done; }); TR.projects.forEach((p) => { snap['projects/' + p.id] = p.category === 'done'; });
  return Object.entries(S.triageDone).filter(([k, v]) => Object.hasOwn(snap, k) && snap[k] !== v).length;
}

function renderView() {
  if (!S || ROLE !== 'big') return;
  view = ctx.view;
  const keep = $('wBody').scrollTop;
  const swapping = lastView !== view; lastView = view;
  $('wBody').replaceChildren();
  const sub = VIEWS[view]();
  $('wTitle').textContent = TITLES[view] || '';
  $('wDate').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (sub ? ' · ' + sub : '');
  const tools = $('wTools'); tools.replaceChildren();
  if (view === 'goals') tools.append(btn('Reload', loadGoals, 'sm'));
  if (view === 'projects') tools.append(btn('Reload', () => { PR = null; loadProjects(); renderView(); }, 'sm'));
  if (view === 'digest') tools.append(btn('Reload news', async () => { DG = { ...DG, news: await window.hub.refreshNews() }; renderView(); }, 'sm'));
  tools.append(btn('Back to sidebar', () => setMode('side'), 'sm'));
  $('wBody').scrollTop = keep;
  if (swapping) { const wb = $('wBody'); wb.classList.remove('swap'); void wb.offsetWidth; wb.classList.add('swap'); setTimeout(() => wb.classList.remove('swap'), 600); }
}
function render() {
  if (!S) return;
  if (ROLE === 'tab') $('tBadge').textContent = S.tasks.filter((t) => !t.done).length || '';
  else if (ROLE === 'side') renderPanel();
  else renderView();
  tickTimer();
}

const hhmm = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const rel = (ms) => { const m = Math.round(Math.abs(ms) / 60000); return m < 1 ? 'under a minute' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
async function refreshNudge() {
  if (!S || ROLE === 'tab') return;
  const st = await window.hub.nudgeStatus();
  const n = document.getElementById('nextNudge');
  if (n) {
    if (!S.settings.nudgesOn) n.textContent = 'Health reminders are off';
    else { const k = ['water', 'walk', 'stretch'].sort((x, y) => st.next[x] - st.next[y])[0]; n.textContent = `Next reminder: ${{ water: 'water', walk: 'a walk', stretch: 'a stretch' }[k]} in ${rel(st.next[k] - Date.now())}${S.settings.eyesOn ? ` · eye rest in ${rel(st.next.eyes - Date.now())}` : ''}`; }
  }
  const t = document.getElementById('remTable');
  if (!t) return;
  const rows = [['water', 'Water', S.settings.nudges.water, true], ['walk', 'Walk', S.settings.nudges.walk, true], ['stretch', 'Stretch', S.settings.nudges.stretch, true], ['eyes', 'Eye rest', S.settings.eyesEvery, false]];
  const grid = 'display:grid;grid-template-columns:1.1fr 1.4fr 1.4fr .8fr;gap:8px;align-items:center;padding:7px 2px;border-top:1px solid var(--track)';
  t.replaceChildren(el('div', { class: 'gh', style: grid.replace('border-top:1px solid var(--track)', '') + ';margin:0' }, el('span', {}, 'Reminder'), el('span', {}, 'Last'), el('span', {}, 'Next'), el('span', {}, 'Today')),
    ...rows.map(([k, label, every, counted]) => {
      const off = (k === 'eyes' ? !S.settings.eyesOn : !S.settings.nudgesOn), last = st.last[k], nx = st.next[k];
      const today = counted ? `${S.habits[k]}/${S.settings.goals[k]}` : '–';
      return el('div', { style: grid },
        el('span', {}, el('b', {}, label), el('div', { class: 'sub' }, `every ${every} min`)),
        el('span', {}, last ? `${hhmm(last)}` : 'not yet', last ? el('div', { class: 'sub' }, `${rel(Date.now() - last)} ago`) : ''),
        el('span', {}, off ? 'off' : hhmm(nx), off ? '' : el('div', { class: 'sub' }, st.pending === k ? 'waiting for you' : `in ${rel(nx - Date.now())}`)),
        el('span', {}, today));
    }));
}

async function loadPlan() { PL = await window.hub.plan(); render(); }
async function loadGoals() { G = await window.hub.goals(); render(); }
async function loadTriage() { TR = await window.hub.triage(); render(); }
async function loadProjects() { PR = await window.hub.projects(); render(); }
async function loadDigest() { DG = await window.hub.digest(); render(); }
function loadAll() { loadGoals(); loadTriage(); loadProjects(); loadDigest(); loadPlan(); }

// ---------- events ----------
window.hub.onPush((s) => { const hold = ROLE === 'big' && busy(); S = s; if (!hold) render(); }); // never re-render under someone who is typing
window.hub.onCtx((c) => { ctx = c; ctxAt = Date.now(); view = c.view; render(); });
window.hub.onShow(() => { loadGoals(); loadTriage(); loadProjects(); loadDigest(); });
window.hub.onDataChanged(() => { loadGoals(); loadDigest(); });
// a double-click on the pill opens the sidebar in the very spot you clicked: ignore clicks for a moment after a window appears
['click', 'dblclick', 'mousedown'].forEach((t) => document.addEventListener(t, (e) => { if (Date.now() - ctxAt < 350) { e.stopPropagation(); e.preventDefault(); } }, true));

$('tOpen').onclick = () => window.hub.goto('tasks');
$('tFocus').onclick = () => window.hub.goto('focus');
$('tClaude').onclick = () => window.hub.openClaude({});
$('bClaude').onclick = () => window.hub.openClaude({});
$('bBig').onclick = () => setMode(ctx.mode === 'big' ? 'side' : 'big');
$('bClose').onclick = () => setMode('tab');
$('nvSettings').onclick = () => go('settings');
// double-click: any part of the pill opens the sidebar; an empty part of the sidebar opens the full view; the full view's header goes back
$('tOpen').parentElement.addEventListener('dblclick', () => setMode('side'));
document.querySelector('.panel').addEventListener('dblclick', (e) => { if (!e.target.closest('button,input,textarea,a')) setMode('big'); });
$('work').addEventListener('dblclick', (e) => { if (e.target.closest('.wh') && !e.target.closest('button')) setMode('side'); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (ROLE === 'big') setMode('side'); else if (ROLE === 'side') setMode('tab');
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function applyTheme() { const dark = window.matchMedia('(prefers-color-scheme: dark)').matches; hubEl.classList.toggle('dark', dark); hubEl.classList.toggle('light', !dark); }

(async () => {
  applyTheme();
  S = await window.hub.getState();
  ctx = await window.hub.getCtx(); view = ctx.view;
  render();
  setInterval(tickTimer, 1000);
  if (ROLE !== 'tab') {
    loadAll();
    setInterval(refreshNudge, 30000);
    setInterval(() => { loadGoals(); loadTriage(); }, 60000);
    setInterval(loadDigest, 10 * 60000);
  }
})();
