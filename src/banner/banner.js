const p = JSON.parse(new URLSearchParams(location.search).get('d') || '{}');
const ICONS = { water: ['g-water-drop', '#2E9BD6'], walk: ['g-walking-figure', '#00A878'], stretch: ['g-stretching-figure', '#E0932B'], eyes: ['g-eye', '#7C6CE0'], check: ['g-check', '#00A878'] };
const [sym, col] = ICONS[p.icon] || ICONS.check;
const ic = document.getElementById('ic');
ic.firstElementChild.firstElementChild.setAttribute('href', '#' + sym);
ic.style.setProperty('--c', col);
document.getElementById('t').textContent = p.title || '';
document.getElementById('d').textContent = p.body || '';
const a = document.getElementById('a');
function btn(label, cls, action) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = () => window.hub.bannerAction(p.kind || '', action);
  a.appendChild(b);
}
if (p.actions) { btn('Snooze 5 min', 'g', 'snooze'); btn('Done', '', 'done'); }
else if (p.icon === 'eyes') { const c = document.createElement('div'); c.className = 'cd'; c.id = 'cd'; a.appendChild(c); }
else btn('OK', '', 'close');

// time left before it goes away by itself
const total = (p.countdown || 25) * 1000, t0 = Date.now(), bar = document.getElementById('bar'), cd = document.getElementById('cd');
const tickBar = () => {
  const left = Math.max(0, total - (Date.now() - t0));
  bar.style.width = (left / total * 100) + '%';
  if (cd) cd.textContent = Math.ceil(left / 1000) + 's';
  if (left <= 0) clearInterval(iv);
};
const iv = setInterval(tickBar, 250); tickBar();
