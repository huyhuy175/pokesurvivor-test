const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function modes(coop) {
  const sent = [];
  const G = { Coop: Object.assign({ active: true, isHost: false, broadcast(ev) { sent.push(ev); } }, coop || {}) };
  new Function('G', source('js/systems/modes.js'))(G);
  return { G, M: G.Modes, sent };
}
function withNet(kind, extra) {
  const w = modes(extra);
  const got = [];
  w.M.register('wave', Object.assign({ id: 'wave', name: 'Wave', classic: false, netKind: kind,
    onNet(n) { got.push(n); } }, {}));
  return Object.assign(w, { got });
}

test('onNet ignores malformed events without throwing', () => {
  const { M, got } = withNet(1);
  M.begin({ type: 'wave' }, []);
  for (const ev of [null, undefined, 'md', [], ['md'], ['md', 'x'], ['xx', 1, 1, 1, 1, 1, 1], ['md', 9, -5, 99, NaN, 1e12, -1],
    ['md', 1, 'a', 1, 1, 1, 1], ['md', 1, 1, 1, 1, Infinity, 1], ['md', 1, 1, 1, 1, 1, {}]]) M.onNet(ev);
  assert.equal(got.length, 0);
});

test('a valid md event is clamped and reaches the current mode', () => {
  const { M, got } = withNet(1);
  M.begin({ type: 'wave' }, []);
  M.onNet(['md', 1, -5, 99, 5, 1e12, -1]);
  assert.deepEqual(got[0], { kind: 1, n: 0, phase: 3, obj: 5, prog: 1e6, mask: 0, cx: null, cy: null });
  M.onNet(['md', 1, 12, 1, 3, 5, 9]);
  assert.deepEqual(M.net, { kind: 1, n: 12, phase: 1, obj: 3, prog: 5, mask: 9, cx: null, cy: null });
  M.onNet(['md', 2, 1, 1, 1, 1, 1]);
  assert.equal(got.length, 2, 'another mode kind is ignored');
});

test('the host broadcasts state when it changes and resends progress at a gentle pace', () => {
  const { M, sent } = modes({ isHost: true });
  let s = ['md', 1, 1, 0, 3, 0, 0];
  M.register('wave', { id: 'wave', name: 'Wave', classic: false, netKind: 1, onNet() {}, netState: () => s });
  M.begin({ type: 'wave' }, []);
  M.tick(0.016, [], 0);
  assert.equal(sent.length, 1);
  M.tick(0.016, [], 0);
  assert.equal(sent.length, 1, 'unchanged: nothing');
  s = ['md', 1, 1, 0, 3, 4, 0];                     // only progress moved
  M.tick(0.016, [], 0);
  assert.equal(sent.length, 1, 'progress is throttled');
  M.tick(0.6, [], 0);
  assert.equal(sent.length, 2);
  s = ['md', 1, 1, 1, 3, 4, 0];                     // phase changed: at once
  M.tick(0.016, [], 0);
  assert.equal(sent.length, 3);
});

test('a guest never broadcasts', () => {
  const { M, sent } = modes({ isHost: false });
  M.register('wave', { id: 'wave', name: 'Wave', classic: false, netKind: 1, onNet() {}, netState: () => ['md', 1, 1, 0, 0, 0, 0] });
  M.begin({ type: 'wave' }, []);
  M.tick(5, [], 0);
  assert.equal(sent.length, 0);
});

test('start carries the mode and unknown modes fall back to normal', () => {
  const { M } = modes();
  M.register('wave', { id: 'wave', name: 'Wave', classic: false });
  assert.deepEqual(M.normalize({ type: 'bossrush-typo', hc: true }), { type: 'normal', hc: false });
  assert.match(source('js/ui/social-ui.js'), /mode: G\.Modes\.normalize\(/);
  assert.match(source('js/game.js'), /G\.Modes\.begin\(coop \? coop\.mode : mode/);
});

test('coop.js routes md events; lobby has a host-only mode row; protocol documents it', () => {
  assert.match(source('js/net/coop.js'), /case 'md': G\.Modes\.onNet\(ev\); break;/);
  assert.match(source('dev.html'), /id="lobby-mode"/);
  assert.match(source('js/ui/social-ui.js'), /The host picks the mode/);
  assert.match(source('docs/MULTIPLAYER_PROTOCOL.md'), /\['md'/);
  assert.match(source('docs/MULTIPLAYER_PROTOCOL.md'), /rush/);
});

test('wave and boss rush declare their net kind and state', () => {
  assert.match(source('js/systems/modes-wave.js'), /netKind: 1/);
  assert.match(source('js/systems/modes-bossrush.js'), /netKind: 2/);
  for (const f of ['js/systems/modes-wave.js', 'js/systems/modes-bossrush.js']) {
    const s = source(f);
    assert.match(s, /netState/); assert.match(s, /onNet/);
  }
});
