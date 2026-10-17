// Builds src/renderer/index.html from index.src.html by inlining the icon sprite (external <use> refs don't work from file://).
// Run: node tools/build.js   (after editing index.src.html)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'renderer');
let sprite = fs.readFileSync(path.join(dir, 'sprite.svg.txt'), 'utf8');
const extra = [
  '<symbol id="g-expand" viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>',
  '<symbol id="g-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor"/></symbol>',
  '<symbol id="g-eye" viewBox="0 0 24 24"><path d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5Zm0 11.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4Z" fill="currentColor" fill-rule="evenodd"/></symbol>',
  '<symbol id="g-news" viewBox="0 0 24 24"><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Zm13 4h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2h-1ZM8 8h7v2H8Zm0 4h7v2H8Zm0 4h5v2H8Z" fill="currentColor" fill-rule="evenodd"/></symbol>',
  '<symbol id="g-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z" fill="currentColor"/></symbol>',
].join('');
sprite = sprite.replace('</defs></svg>', extra + '</defs></svg>');
const html = fs.readFileSync(path.join(dir, 'index.src.html'), 'utf8').replace('<!--SPRITE-->', sprite);
fs.writeFileSync(path.join(dir, 'index.html'), html);
// the pill page and the notification banner each carry only the few icons they use
const pick = (ids) => ids.map((id) => { const a = sprite.indexOf('<symbol id="' + id + '"'); if (a < 0) throw new Error('missing ' + id); return sprite.slice(a, sprite.indexOf('</symbol>', a) + 9); }).join('');
const wrap = (inner) => '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + inner + '</defs></svg>';
fs.writeFileSync(path.join(dir, 'tab.html'), fs.readFileSync(path.join(dir, 'tab.src.html'), 'utf8').replace('<!--ICONS-->', wrap(pick(['g-check-circle', 'g-clock', 'g-sparkle']))));
const bd = path.join(__dirname, '..', 'src', 'banner');
fs.writeFileSync(path.join(bd, 'banner.html'), fs.readFileSync(path.join(bd, 'banner.src.html'), 'utf8').replace('<!--ICONS-->', wrap(pick(['g-water-drop', 'g-walking-figure', 'g-stretching-figure', 'g-eye', 'g-check']))));
console.log('index.html written', html.length, 'bytes; extra symbols:', sprite.includes('g-expand'));
