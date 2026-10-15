const test = require('node:test');
const assert = require('node:assert');
const { today, clean, safeUrl } = require('../src/lib');

const SETTINGS = { name: 'Srinivas', pinned: false, nudgesOn: true, nudges: { water: 30, walk: 50, stretch: 75 }, goals: { water: 8, walk: 6, stretch: 4 }, autoLaunchInit: true };

test('today() is a local YYYY-MM-DD date', () => {
  const t = today();
  assert.match(t, /^\d{4}-\d{2}-\d{2}$/);
  const d = new Date();
  assert.strictEqual(t, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
});

test('safeUrl only allows http, https and mailto', () => {
  assert.strictEqual(safeUrl('https://claude.ai'), 'https://claude.ai/');
  assert.strictEqual(safeUrl('http://example.com/a?b=1'), 'http://example.com/a?b=1');
  assert.strictEqual(safeUrl('mailto:a@b.com'), 'mailto:a@b.com');
  for (const bad of ['file:///C:/Windows/System32/cmd.exe', 'javascript:alert(1)', 'data:text/html,hi', 'ms-settings:', 'not a url', '', null, undefined]) {
    assert.strictEqual(safeUrl(bad), null, String(bad));
  }
});

test('clean() keeps only known keys and bounds sizes', () => {
  const out = clean({ evil: 1, tasks: [{ id: 'a', text: 'x'.repeat(500), done: 1, extra: 'no' }, null, 'str'] }, SETTINGS);
  assert.deepStrictEqual(Object.keys(out), ['tasks']);
  assert.strictEqual(out.tasks.length, 1);
  assert.strictEqual(out.tasks[0].text.length, 140);
  assert.strictEqual(out.tasks[0].done, true);
  assert.strictEqual('extra' in out.tasks[0], false);
});

test('clean() caps list lengths', () => {
  const tasks = Array.from({ length: 900 }, (_, i) => ({ id: String(i), text: 't', done: false }));
  const links = Array.from({ length: 60 }, (_, i) => ({ name: 'n' + i, url: 'https://x.com', color: '#fff', glyph: 'x' }));
  const out = clean({ tasks, links }, SETTINGS);
  assert.strictEqual(out.tasks.length, 500);
  assert.strictEqual(out.links.length, 24);
});

test('clean() clamps focus and reminder numbers', () => {
  const out = clean({
    focus: { goal: 'g', minutes: 99999, taskId: null, endsAt: 'junk', pausedLeft: -5 },
    settings: { pinned: 1, nudgesOn: 0, nudges: { water: 1, walk: 9999, stretch: 'x' }, goals: { water: 0 } },
    habits: { date: '2026-10-15', water: -3, walk: 5, stretch: 'a', focus: 2 },
  }, SETTINGS);
  assert.strictEqual(out.focus.minutes, 240);
  assert.strictEqual(out.focus.endsAt, null);
  assert.strictEqual(out.focus.pausedLeft, 0);
  assert.deepStrictEqual(out.settings.nudges, { water: 5, walk: 240, stretch: 75 });
  assert.strictEqual(out.settings.goals.water, 1);
  assert.strictEqual(out.settings.pinned, true);
  assert.strictEqual(out.settings.nudgesOn, false);
  assert.strictEqual(out.settings.autoLaunchInit, true); // carried from current settings, not from the renderer
  assert.deepStrictEqual(out.habits, { date: '2026-10-15', water: 0, walk: 5, stretch: 0, focus: 2 });
});

test('clean() ignores non-object sections', () => {
  assert.deepStrictEqual(clean({ focus: 'x', habits: 5, settings: null, tasks: 'no', links: {} }, SETTINGS), {});
});

test('clean() keeps the saved name when the new one is blank, and trims/limits it', () => {
  assert.strictEqual(clean({ settings: { name: '   ' } }, SETTINGS).settings.name, 'Srinivas');
  assert.strictEqual(clean({ settings: { name: '  Ana  ' } }, SETTINGS).settings.name, 'Ana');
  assert.strictEqual(clean({ settings: { name: 'x'.repeat(80) } }, SETTINGS).settings.name.length, 24);
});
