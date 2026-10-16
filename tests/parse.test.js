const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/lib');

test('parseGoals + toggleGoalLine', () => {
  const md = '## Today\n- [ ] **Proj A** — do thing [link](http://x)\n## This month\n- [x] done one\r\n- [ ] plain\n';
  const g = L.parseGoals(md);
  assert.equal(g.length, 3);
  assert.equal(g[0].term, 'short'); assert.equal(g[0].project, 'Proj A'); assert.equal(g[0].text, 'Proj A — do thing link');
  assert.equal(g[1].term, 'long'); assert.equal(g[1].done, true);
  const out = L.toggleGoalLine(md, g[0].line, g[0].raw, true);
  assert.ok(out.includes('- [x] **Proj A**'));
  assert.equal(L.toggleGoalLine(md, g[0].line, 'changed text', true), null);
  assert.equal(L.toggleGoalLine(md, 99, 'x', true), null);
  assert.ok(L.toggleGoalLine(md, g[1].line, g[1].raw, false).includes('- [ ] done one\r\n'));
});

test('parseStatusBoard + folderFor', () => {
  const md = '## Status board\n\n| Project | Stage | Last touched | Next action |\n|---|---|---|---|\n| **task-hub** | v0 | 2026-10-15 | Use it |\n| odd | a | b | c | 2026-10-01 | do **x** |\n## Next\n| z | z | z | z |';
  const r = L.parseStatusBoard(md);
  assert.equal(r.length, 2); assert.equal(r[0].name, 'task-hub'); assert.equal(r[0].next, 'Use it');
  assert.equal(r[1].next, 'do x'); assert.equal(r[1].last, '2026-10-01');
  assert.equal(L.folderFor('Task-Hub', ['a', 'task-hub']), 'task-hub');
  assert.equal(L.folderFor('aqa-gcse-biology-papers', ['aqa-gcse-biology-papers', 'x']), 'aqa-gcse-biology-papers');
  assert.equal(L.folderFor('ab', ['ab']), null);
});

test('extractDoc', () => {
  const d = L.extractDoc('# Title\n\nFirst para **bold**.\n\n## Next steps\n- do a\n- [x] done\n- [ ] do b\n## Other\n- not a todo\n');
  assert.equal(d.title, 'Title'); assert.equal(d.summary, 'First para bold.'); assert.deepEqual(d.todos, ['do a', 'do b']);
});

test('parseRss is plain text and url-safe', () => {
  const xml = '<rss><item><title><![CDATA[A &amp; B]]></title><link>https://x.test/a</link><description>&lt;b&gt;hi&lt;/b&gt; there</description></item><item><title>bad</title><link>javascript:alert(1)</link></item></rss>';
  const r = L.parseRss(xml);
  assert.equal(r.length, 1); assert.equal(r[0].title, 'A & B'); assert.equal(r[0].text, 'hi there');
});

test('clean keeps new settings bounded', () => {
  const c = L.clean({ settings: { eyesEvery: 9999, chromeProfile: 'Profile 1;rm', mode: 'x' } }, { name: 'S', nudges: {}, goals: {} });
  assert.equal(c.settings.eyesEvery, 120); assert.equal(c.settings.chromeProfile, 'Profile 1rm'); assert.equal(c.settings.mode, 'tab');
});
