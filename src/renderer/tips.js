// Hover labels: a single overlay element at the top of the page (so it is never behind anything), centred under the icon.
(() => {
  const tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip);
  let timer = null, cur = null;
  const hide = () => { clearTimeout(timer); tip.style.display = 'none'; cur = null; };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el === cur) return;
    hide();
    if (!el) return;
    cur = el;
    timer = setTimeout(() => {
      tip.textContent = el.dataset.tip; tip.style.display = 'block';
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      const x = Math.max(4, Math.min(innerWidth - w - 4, r.left + r.width / 2 - w / 2));
      const below = r.bottom + 2 + h <= innerHeight;
      tip.style.left = x + 'px'; tip.style.top = (below ? r.bottom + 2 : r.top - 2 - h) + 'px';
    }, 250);
  });
  document.addEventListener('mouseout', (e) => { const t = e.relatedTarget; if (!t || !t.closest || !t.closest('[data-tip]')) hide(); });
  document.addEventListener('mousedown', hide, true);
})();
