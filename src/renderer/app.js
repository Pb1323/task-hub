// task-hub renderer. All text from files, feeds or the web is inserted with textContent only (never innerHTML).
const $ = (id) => document.getElementById(id);
const hubEl = $('hub');
const Q = new URLSearchParams(location.search);
let S = null;                 // full state, mirrored to main
const ROLE = Q.get('role') || 'side';   // which window this is: tab | side | big
let ctx = { mode: 'tab', view: 'tasks' }; // set by the main process
let ctxAt = 0;
let view = 'tasks';
let G = null, TR = null, PR = null, DG = null;   // goals, triage, projects, digest caches
let gTab = 'short', dLane = 'all', pFilter = '';
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
const save = () => window.hub.setState({ tasks: S.tasks, session: S.session, links: S.links, focus: S.focus, settings: S.settings, habits: S.habits, triageDone: S.triageDone });
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
const NAV = [['tasks', 'Tasks', 'check-circle'], ['focus', 'Focus', 'clock'], ['goals', 'Goals', 'target'], ['triage', 'Triage', 'pin'], ['projects', 'Projects', 'code-branch'], ['digest', 'Digest', 'sparkle'], ['habits', 'Habits', 'water-drop'], ['launch', 'Launch', 'link']];
function navCount(k) {
  switch (k) {
    case 'tasks': return S.tasks.filter((t) => !t.done).length || '';
    case 'focus': return S.habits.focus ? `${S.habits.focus}` : '';
    case 'goals': return G ? G.items.filter((i) => !i.done && i.term === 'short').length : '';
    case 'triage': return TR ? TR.backlog.filter((b) => !isTicked('backlog/' + b.id, b.done)).length || '' : '';
    case 'projects': return PR ? PR.length : '';
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
  // mini checklist
  let mini = $('mini');
  if (!mini) { mini = el('div', { class: 'mini', id: 'mini' }); $('areaL').closest('svg').after(mini); }
  mini.replaceChildren(...open_.slice(0, 4).map((t) => el('div', { class: 'row' }, el('button', { class: 'chk', 'aria-label': 'Done', onclick: () => { t.done = true; save(); render(); } }, '✓'), el('div', { class: 't' }, t.text))));
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
      opts.toSession && !t.done ? el('button', { title: 'Add to focus session', onclick: () => { if (!S.session.some((x) => x.text === t.text && !x.done)) S.session.push({ id: uid(), text: t.text, done: false }); save(); render(); } }, '＋') : '',
      opts.focusable && !t.done ? el('button', { title: 'Focus on this', onclick: () => { S.focus.taskId = focused ? null : t.id; if (!focused) S.focus.goal = t.text; save(); render(); } }, focused ? '◉' : '◎') : '',
      el('button', { title: 'Delete', onclick: () => { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); if (focused) S.focus.taskId = null; save(); render(); } }, '✕')));
  return row;
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

// ---------- views ----------
const VIEWS = {
  tasks() {
    const open_ = S.tasks.filter((t) => !t.done);
    const b = $('wBody'); b.append(addForm('Add a task', (v) => { S.tasks.unshift({ id: uid(), text: v, done: false }); save(); render(); }));
    if (!S.tasks.length) b.append(el('div', { class: 'empty' }, 'Nothing yet. Add your first task above.'));
    [...open_, ...S.tasks.filter((t) => t.done)].forEach((t) => b.append(taskRow(t, S.tasks, { focusable: true, toSession: true })));
    return `${open_.length} to do`;
  },
  focus() {
    const b = $('wBody'), f = S.focus;
    const ring = el('div', { class: 'tring' });
    ring.innerHTML = '<svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="58" fill="none" stroke="var(--track)" stroke-width="9"/><circle id="tArc" cx="66" cy="66" r="58" fill="none" stroke="var(--acc)" stroke-width="9" stroke-linecap="round" stroke-dasharray="364.4 364.4" stroke-dashoffset="364.4" transform="rotate(-90 66 66)"/></svg>'; // static, authored here
    ring.append(el('div', { class: 'big', id: 'time' }, fmt(remaining())));
    const goal = el('input', { class: 'field', placeholder: 'Goal for this block, e.g. finish the Biology pack', maxlength: '120', 'aria-label': 'Goal' }); goal.value = f.goal;
    goal.oninput = (e) => { f.goal = e.target.value; save(); };
    const seg = el('div', { class: 'seg' }, [15, 25, 45, 60, 90].map((m) => el('button', { class: 'chip' + (f.minutes === m ? ' on' : ''), onclick: () => { f.minutes = m; f.pausedLeft = null; if (f.endsAt) f.endsAt = Date.now() + m * 60000; save(); render(); } }, m + ' min')));
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
  triage() {
    const b = $('wBody');
    if (!TR) { b.append(el('div', { class: 'empty' }, 'Loading…')); return ''; }
    const pend = pendingTicks();
    b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, `Local copy of the Triage Board, saved ${TR.snapshot ? new Date(TR.snapshot).toLocaleString('en-GB') : 'never'}. Ticks are saved here straight away; the board itself only changes when you run the sync in Claude (it shows you the changes first).`),
      el('div', { class: 'add', style: 'margin-top:8px' }, btn(`Sync ${pend} tick${pend === 1 ? '' : 's'} to board…`, () => window.hub.openClaude({ prompt: 'triage' }), pend ? 'pri sm' : 'sm'), btn('Refresh copy…', () => window.hub.openClaude({ prompt: 'triage' }), 'sm'))));
    const row = (key, text, sub, done) => el('div', { class: 'row' + (isTicked(key, done) ? ' done' : '') },
      el('button', { class: 'chk', 'aria-label': 'Toggle done', onclick: () => { S.triageDone[key] = !isTicked(key, done); save(); render(); } }, '✓'),
      el('div', { class: 't' }, text, sub ? el('div', { class: 'sub' }, sub) : ''));
    b.append(el('div', { class: 'gh' }, 'Backlog'));
    TR.backlog.forEach((x) => b.append(row('backlog/' + x.id, x.text, '', x.done)));
    const act = TR.projects.filter((p) => p.category !== 'done');
    b.append(el('div', { class: 'gh' }, `Needs you (${act.filter((p) => p.needsYou).length})`));
    act.filter((p) => p.needsYou).forEach((p) => b.append(row('projects/' + p.id, `${p.name}: ${p.next || p.summary}`, p.tag, p.category === 'done')));
    b.append(el('div', { class: 'gh' }, 'Other projects'));
    act.filter((p) => !p.needsYou).forEach((p) => b.append(row('projects/' + p.id, `${p.name}: ${p.next || p.summary}`, p.tag, p.category === 'done')));
    return `${TR.projects.length} projects`;
  },
  projects() {
    const b = $('wBody');
    if (!PR) { b.append(el('div', { class: 'empty' }, 'Reading project folders…')); return ''; }
    const f = el('input', { class: 'field', placeholder: 'Filter projects', 'aria-label': 'Filter projects' }); f.value = pFilter;
    f.oninput = () => { pFilter = f.value; const pos = f.selectionStart; renderView(); const nf = $('wBody').querySelector('input'); if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); } };
    b.append(f);
    PR.filter((p) => norm(p.name + p.next).includes(norm(pFilter))).forEach((p) => {
      const key = 'p' + p.name;
      b.append(el('div', { class: 'card' },
        el('div', { class: 'who', style: 'display:flex;justify-content:space-between;gap:8px' }, el('h3', {}, p.name), el('span', { class: 'sub' }, p.last)),
        el('div', { class: 'sub clamp' }, p.next),
        el('div', { class: 'add', style: 'margin-top:6px' }, btn(open.has(key) ? 'Hide update' : 'Latest update & to-do', () => { open.has(key) ? open.delete(key) : open.add(key); renderView(); }, 'sm')),
        open.has(key) ? projectDetail(p) : ''));
    });
    return `${PR.length} projects`;
  },
  digest() {
    const b = $('wBody');
    if (!DG) { b.append(el('div', { class: 'empty' }, 'Loading digest…')); return ''; }
    const stale = !DG.inspo || DG.inspo.date !== DG.today || !DG.digest || DG.digest.date !== DG.today;
    if (stale) b.append(el('div', { class: 'card' }, el('div', { class: 'sub' }, `Today's digest isn't loaded yet (digest: ${DG.digest ? DG.digest.date : 'none'}, inspiration: ${DG.inspo ? DG.inspo.date : 'none'}). Run the update: it opens Claude in a terminal, reads your latest Daily Digest email draft and finds today's new people. Live news below is always current.`), el('div', { class: 'add', style: 'margin-top:8px' }, btn('Update digest in Claude…', () => window.hub.openClaude({ prompt: 'digest' }), 'pri sm'))));
    if (DG.inspo) {
      b.append(el('div', { class: 'gh' }, `Inspiration · ${DG.inspo.date}`));
      b.append(el('div', { class: 'add' }, [['all', 'All'], ['inspiration', 'People'], ['niche', 'My niche'], ['ugc', 'UGC']].map(([k, l]) => el('button', { class: 'chip' + (dLane === k ? ' on' : ''), onclick: () => { dLane = k; renderView(); } }, l))));
      const cards = DG.inspo.items.filter((x) => dLane === 'all' || x.lane === dLane);
      b.append(el('div', { class: 'cols' }, cards.map((x) => el('div', { class: 'card ins' },
        el('div', { class: 'who' }, el('b', {}, x.person), el('i', {}, x.date)), el('div', { class: 'sub' }, x.role), el('div', { style: 'font-weight:600' }, x.headline), el('div', { class: 'sub' }, x.detail),
        x.takeaway ? el('div', { class: 'take' }, '→ ' + x.takeaway) : '', hasUrl(x.url) ? link(x.url, 'Source: ' + (x.source || 'link')) : ''))));
    }
    if (DG.digest) {
      b.append(el('div', { class: 'gh' }, `Daily digest · ${DG.digest.date}`));
      DG.digest.sections.forEach((s) => {
        const key = 'd' + s.title, shown = open.has(key) || s === DG.digest.sections[0];
        b.append(el('div', { class: 'card' }, el('div', { style: 'display:flex;justify-content:space-between;cursor:pointer', onclick: () => { open.has(key) ? open.delete(key) : open.add(key); renderView(); } }, el('h3', {}, s.title), el('span', { class: 'sub' }, shown ? '▾' : `▸ ${s.items.length}`)),
          shown ? el('div', { class: 'ins' }, s.items.map((x) => el('div', { style: 'padding:6px 0;border-top:1px solid var(--track)' },
            x.title ? el('div', { style: 'font-weight:600' }, x.title) : '', el('div', {}, x.text), x.idea ? el('div', { class: 'take' }, 'Idea: ' + x.idea) : '', hasUrl(x.url) ? link(x.url, x.source || 'Source') : ''))) : ''));
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
const TITLES = { tasks: 'Tasks', focus: 'Focus session', goals: 'Goals', triage: 'Triage Board', projects: 'Projects', digest: 'Daily digest', habits: 'Habits', launch: 'Launch', settings: 'Settings' };
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

async function loadGoals() { G = await window.hub.goals(); render(); }
async function loadTriage() { TR = await window.hub.triage(); render(); }
async function loadProjects() { PR = await window.hub.projects(); render(); }
async function loadDigest() { DG = await window.hub.digest(); render(); }
function loadAll() { loadGoals(); loadTriage(); loadProjects(); loadDigest(); }

// ---------- events ----------
window.hub.onPush((s) => { const hold = ROLE === 'big' && busy(); S = s; if (!hold) render(); }); // never re-render under someone who is typing
window.hub.onCtx((c) => { ctx = c; ctxAt = Date.now(); view = c.view; render(); });
window.hub.onShow(() => { loadGoals(); loadTriage(); loadProjects(); loadDigest(); });
window.hub.onDataChanged(() => loadGoals());
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
