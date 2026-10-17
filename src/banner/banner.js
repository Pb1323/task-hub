const p = JSON.parse(new URLSearchParams(location.search).get('d') || '{}');
const ICONS = { water: ['g-water-drop', '#2E9BD6'], walk: ['g-walking-figure', '#00A878'], stretch: ['g-stretching-figure', '#E0932B'], eyes: ['g-eye', '#7C6CE0'], check: ['g-check', '#00A878'], clock: ['g-clock', '#2E9BD6'] };
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
if (p.alarm) { btn(`Repeat ${p.repeatMin} min`, 'g', 'repeat'); btn('Stop', '', 'stop'); }
else if (p.actions) { btn('Snooze 5 min', 'g', 'snooze'); btn('Done', '', 'done'); }
else if (p.icon === 'eyes') { const c = document.createElement('div'); c.className = 'cd'; c.id = 'cd'; a.appendChild(c); }
else btn('OK', '', 'close');

// focus-end alarm: a short chime pattern, repeated until you press Stop/Repeat or 30 s pass (main closes this window then)
if (p.alarm) {
  try {
    const ctx = new AudioContext(); window.__alarm = ctx;
    const master = ctx.createGain(); master.gain.value = 0.28; master.connect(ctx.destination);
    const notes = [784, 988, 1175, 988];                       // G5 B5 D6 B5
    const ring = () => {
      const base = ctx.currentTime + 0.05;
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = base + i * 0.18;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(1, s + 0.02); g.gain.exponentialRampToValueAtTime(0.001, s + 0.55);
        o.connect(g); g.connect(master); o.start(s); o.stop(s + 0.6);
      });
    };
    ctx.resume().then(ring);
    const iv = setInterval(ring, 1600);
    addEventListener('beforeunload', () => { clearInterval(iv); ctx.close(); });
  } catch (e) { /* no audio available: the banner still shows */ }
}

// time left before it goes away by itself
const total = (p.countdown || 10) * 1000, t0 = Date.now(), bar = document.getElementById('bar'), cd = document.getElementById('cd');
const tickBar = () => {
  const left = Math.max(0, total - (Date.now() - t0));
  bar.style.width = (left / total * 100) + '%';
  if (cd) cd.textContent = Math.ceil(left / 1000) + 's';
  if (left <= 0) clearInterval(iv2);
};
const iv2 = setInterval(tickBar, 250); tickBar();
