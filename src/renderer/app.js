const $ = (id) => document.getElementById(id);
if (new URLSearchParams(location.search).get('acrylic')) document.documentElement.classList.add('acrylic');
const hubEl = $('hub');
let S = null;            // full state, mirrored to main
let collapseTimer = null;
let hovering = false;

const KINDS = [
  ['water', '\u{1F4A7}', 'Water', 'var(--acc2)'],
  ['walk', '\u{1F6B6}', 'Walk', 'var(--acc)'],
  ['stretch', '\u{1F9D8}', 'Stretch', 'var(--acc3)'],
];

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v);
  }
  kids.forEach((c) => e.append(c));
  return e;
}
const uid = () => Math.random().toString(36).slice(2, 10);
const save = () => window.hub.setState({ tasks: S.tasks, links: S.links, focus: S.focus, settings: S.settings, habits: S.habits });
const pad = (n) => String(n).padStart(2, '0');
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

// ---------- focus timer ----------
function remaining() {
  const f = S.focus;
  if (f.endsAt) return f.endsAt - Date.now();
  if (f.pausedLeft != null) return f.pausedLeft;
  return f.minutes * 60000;
}
function startPause() {
  const f = S.focus;
  if (f.endsAt) { f.pausedLeft = f.endsAt - Date.now(); f.endsAt = null; }
  else {
    if (!f.goal && f.taskId) { const t = S.tasks.find((x) => x.id === f.taskId); if (t) f.goal = t.text; }
    f.endsAt = Date.now() + (f.pausedLeft != null ? f.pausedLeft : f.minutes * 60000);
    f.pausedLeft = null;
  }
  save(); render();
}
function resetTimer() { S.focus.endsAt = null; S.focus.pausedLeft = null; save(); render(); }
function tickTimer() {
  if (!S) return;
  const f = S.focus;
  if (f.endsAt && f.endsAt - Date.now() <= 0) {
    f.endsAt = null; f.pausedLeft = null;
    S.habits.focus = (S.habits.focus || 0) + 1;
    window.hub.notify({ icon: '✅', title: 'Focus block done', body: f.goal || 'Nice work. Take a short break.' });
    save();
  }
  renderTimer();
}
function renderTimer() {
  const f = S.focus, rem = remaining(), total = f.minutes * 60000;
  const running = !!f.endsAt;
  $('time').textContent = fmt(rem);
  const C = 364.4, started = f.endsAt || f.pausedLeft != null;
  $('tArc').style.strokeDashoffset = started ? C * (1 - Math.max(0, Math.min(1, rem / total))) : C;
  $('focusState').textContent = running ? 'running' : f.pausedLeft != null ? 'paused' : '';
  $('bStart').textContent = running ? 'Pause' : (f.pausedLeft != null ? 'Resume' : 'Start');
  $('sTimer').textContent = running || f.pausedLeft != null ? fmt(rem) : '';
}

// ---------- render ----------
function render() {
  const d = new Date();
  $('date').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = d.getHours();
  const openN = S.tasks.filter((t) => !t.done).length, fb = S.habits.focus || 0;
  $('subline').textContent = `${openN ? openN + (openN === 1 ? ' task' : ' tasks') + ' to do' : 'Nothing left to do'} · ${fb} focus ${fb === 1 ? 'block' : 'blocks'} today`;
  $('greet').textContent = (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', Srinivas';

  // focus inputs
  if (document.activeElement !== $('goal')) $('goal').value = S.focus.goal;
  document.querySelectorAll('#mins button').forEach((b) => b.classList.toggle('on', +b.dataset.m === S.focus.minutes));
  renderTimer();

  // tasks (open first)
  const open = S.tasks.filter((t) => !t.done);
  $('left').textContent = open.length ? `${open.length} left` : S.tasks.length ? 'all done' : '';
  $('sBadge').textContent = open.length || '';
  const box = $('tasks'); box.replaceChildren();
  if (!S.tasks.length) box.append(el('div', { class: 'empty' }, 'Nothing yet. Add your first task above.'));
  [...open, ...S.tasks.filter((t) => t.done)].forEach((t) => {
    const focused = S.focus.taskId === t.id;
    box.append(el('div', { class: 'row' + (t.done ? ' done' : '') + (focused ? ' focus' : '') },
      el('button', { class: 'chk', title: 'Done', onclick: () => { t.done = !t.done; if (t.done && focused) S.focus.taskId = null; save(); render(); } }, '✓'),
      el('div', { class: 't', title: 'Double-click to edit', ondblclick: (ev) => editTask(ev.currentTarget, t) }, t.text),
      el('div', { class: 'a' },
        t.done ? '' : el('button', { title: 'Focus on this', onclick: () => { S.focus.taskId = focused ? null : t.id; if (!focused) S.focus.goal = t.text; save(); render(); } }, focused ? '◉' : '◎'),
        el('button', { title: 'Delete', onclick: () => { S.tasks = S.tasks.filter((x) => x.id !== t.id); if (focused) S.focus.taskId = null; save(); render(); } }, '✕'))));
  });

  // rings
  const rg = $('rings'); rg.replaceChildren();
  $('sRings').replaceChildren();
  KINDS.forEach(([k, icon, label, col]) => {
    const goal = S.settings.goals[k], n = S.habits[k], frac = Math.min(1, n / goal), c = 2 * Math.PI * 26;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', 64); svg.setAttribute('height', 64); svg.setAttribute('viewBox', '0 0 64 64');
    svg.innerHTML = `<circle cx="32" cy="32" r="26" fill="none" stroke="var(--ring)" stroke-width="8"/><circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 32 32)"/>`;
    rg.append(el('div', { class: 'ring', title: `Log one ${label.toLowerCase()}`, onclick: () => { S.habits[k] += 1; save(); render(); } },
      svg, el('div', { class: 'n' }, icon), `${label} ${n}/${goal}`));
    const dot = el('div', { class: 'dot', title: `${label} ${n}/${goal}` }, el('i', { style: `width:${frac * 100}%;background:${col}` }));
    $('sRings').append(dot);
  });

  // links
  const ap = $('apps'); ap.replaceChildren();
  S.links.forEach((l) => ap.append(el('button', { onclick: () => window.hub.openLink(l.url), title: l.url },
    el('div', { class: 'a', style: `background:${/^#[0-9a-f]{3,8}$/i.test(l.color) ? l.color : '#555'}` }, l.glyph || '↗'), l.name)));

  renderLinkList();
  // settings + pin
  $('oAuto').checked = !!S.autoLaunch;
  $('oNudge').checked = S.settings.nudgesOn;
  $('nWater').value = S.settings.nudges.water; $('nWalk').value = S.settings.nudges.walk; $('nStretch').value = S.settings.nudges.stretch;
  $('bPin').classList.toggle('on', S.settings.pinned);
}

async function refreshNudge() {
  if (!S) return;
  const st = await window.hub.nudgeStatus();
  const mins = Math.max(0, Math.round((st.at - Date.now()) / 60000));
  const name = { water: 'water', walk: 'a walk', stretch: 'a stretch' }[st.kind];
  $('nextNudge').textContent = S.settings.nudgesOn ? `Next reminder: ${name} in ${mins} min` : 'Health reminders are off';
}

function editTask(node, t) {
  const inp = el('input', { class: 'edit', maxlength: '140', 'aria-label': 'Edit task' });
  inp.value = t.text;
  let done = false;
  const finish = (ok) => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v) { t.text = v; save(); } render(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') { e.stopPropagation(); finish(false); } };
  inp.onblur = () => finish(true);
  node.replaceChildren(inp); inp.focus(); inp.select();
}

const PALETTE = ['#5856d6', '#ff9500', '#0a84ff', '#30b0c7', '#af52de', '#ff2d55'];
function normUrl(u) {
  u = u.trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  try { const p = new URL(u); return ['https:', 'http:', 'mailto:'].includes(p.protocol) ? p.toString() : null; } catch { return null; }
}
function renderLinkList() {
  const box = $('linkList'); box.replaceChildren();
  S.links.forEach((l) => box.append(el('div', { class: 'lrow' }, el('b', {}, l.name), el('i', {}, l.url),
    el('button', { title: 'Remove', 'aria-label': 'Remove ' + l.name, onclick: () => { S.links = S.links.filter((x) => x !== l); save(); render(); } }, '✕'))));
}

// ---------- events ----------
function expand() { clearTimeout(collapseTimer); if (hubEl.classList.contains('collapsed')) window.hub.setCollapsed(false); }
// Only unsent task text or open settings block the auto-collapse.
function busy() {
  const a = document.activeElement;
  return (a && a.id === 'addText' && a.value.trim() !== '') || !$('settings').hidden;
}
function maybeCollapse() {
  clearTimeout(collapseTimer);
  if (!S || S.settings.pinned) return;
  collapseTimer = setTimeout(() => { if (hovering) return; if (busy()) maybeCollapse(); else window.hub.setCollapsed(true); }, 700); // never collapse mid-typing
}

window.hub.onCollapsed((c) => hubEl.classList.toggle('collapsed', c));
window.hub.onPush((s) => { S = s; render(); });
hubEl.addEventListener('mouseenter', () => { hovering = true; window.hub.setIgnore(false); if (hubEl.classList.contains('collapsed')) expand(); else clearTimeout(collapseTimer); });
hubEl.addEventListener('mouseleave', () => { hovering = false; maybeCollapse(); });
// The window is transparent and click-through; it only takes the mouse while the pointer is over the panel.
// With forwarding on, mousemove still arrives over the empty area, so we can hand the mouse back as soon as the pointer enters the panel.
document.addEventListener('mousemove', (e) => { window.hub.setIgnore(!e.target.closest('#hub')); });
$('sExpand').onclick = () => { S.settings.pinned = true; save(); window.hub.setCollapsed(false); render(); };
document.querySelectorAll('[data-link]').forEach((b) => (b.onclick = () => window.hub.openLink(b.dataset.link)));

$('bCollapse').onclick = () => { S.settings.pinned = false; save(); window.hub.setCollapsed(true); render(); };
$('bPin').onclick = () => { S.settings.pinned = !S.settings.pinned; save(); render(); };
$('bGear').onclick = () => { $('settings').hidden = !$('settings').hidden; };
$('bQuit').onclick = () => window.hub.quit();
$('bStart').onclick = startPause;
$('bReset').onclick = resetTimer;
$('bCode').onclick = () => window.hub.openClaudeCode();
$('goal').oninput = (e) => { S.focus.goal = e.target.value; save(); };
document.querySelectorAll('#mins button').forEach((b) => (b.onclick = () => { S.focus.minutes = +b.dataset.m; S.focus.pausedLeft = null; if (S.focus.endsAt) S.focus.endsAt = Date.now() + S.focus.minutes * 60000; save(); render(); }));
$('addForm').onsubmit = (e) => {
  e.preventDefault();
  const v = $('addText').value.trim();
  if (!v) return;
  S.tasks.unshift({ id: uid(), text: v, done: false });
  $('addText').value = ''; save(); render();
};
$('linkForm').onsubmit = (e) => {
  e.preventDefault();
  const url = normUrl($('lUrl').value), name = $('lName').value.trim() || (url && new URL(url).hostname.replace(/^www\./, ''));
  if (!url || !name || S.links.length >= 12) { $('lUrl').focus(); return; }
  S.links.push({ name: name.slice(0, 24), url, color: PALETTE[S.links.length % PALETTE.length], glyph: name[0].toUpperCase() });
  $('lName').value = ''; $('lUrl').value = ''; save(); render();
};
$('oAuto').onchange = (e) => { window.hub.setAutoLaunch(e.target.checked); };
$('oNudge').onchange = (e) => { S.settings.nudgesOn = e.target.checked; save(); render(); refreshNudge(); };
[['nWater', 'water'], ['nWalk', 'walk'], ['nStretch', 'stretch']].forEach(([id, k]) => {
  $(id).onchange = (e) => { const v = Math.min(240, Math.max(5, +e.target.value || 30)); S.settings.nudges[k] = v; save(); render(); setTimeout(refreshNudge, 100); };
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (!$('settings').hidden) { $('settings').hidden = true; return; }
  S.settings.pinned = false; save(); window.hub.setCollapsed(true); render();
});
$('goal').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

(async () => {
  S = await window.hub.getState();
  render(); refreshNudge();
  // At login, show the day's tasks for a few seconds, then tuck away (unless pinned).
  if (S.tasks.length || !S.settings.pinned) { window.hub.setCollapsed(false); setTimeout(maybeCollapse, 9000); }
  setInterval(tickTimer, 1000);
  setInterval(refreshNudge, 15000);
})();
