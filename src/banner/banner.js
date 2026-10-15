const p = JSON.parse(new URLSearchParams(location.search).get('d') || '{}');
document.getElementById('i').textContent = p.icon || '';
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
if (p.actions) { btn('Snooze', 'g', 'snooze'); btn('Done', '', 'done'); } else btn('OK', '', 'close');
