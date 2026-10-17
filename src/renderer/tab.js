// The pill. Deliberately tiny: a badge, the running focus time, and three buttons.
const $ = (id) => document.getElementById(id);
let S = null, tick = null;
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function render() {
  if (!S) return;
  $('tBadge').textContent = S.tasks.filter((t) => !t.done).length || '';
  const f = S.focus, running = !!f.endsAt, paused = f.pausedLeft != null;
  $('tTime').textContent = running ? fmt(f.endsAt - Date.now()) : paused ? fmt(f.pausedLeft) : '';
  // the clock only ticks while a focus block is actually running
  if (running && !tick) tick = setInterval(render, 1000);
  if (!running && tick) { clearInterval(tick); tick = null; }
}

window.hub.onPush((s) => { S = s; render(); });
$('tOpen').onclick = () => window.hub.goto('tasks');
$('tFocus').onclick = () => window.hub.goto('focus');
$('tClaude').onclick = () => window.hub.openClaude({});
$('pill').addEventListener('dblclick', () => window.hub.setMode('side'));       // double-click the pill itself to open the sidebar
$('pill').addEventListener('mouseenter', () => window.hub.warm('side'));        // get the sidebar window ready in the background (invisible)
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && document.activeElement === document.body) window.hub.setMode('side'); });
window.hub.getState().then((s) => { S = s; render(); });
