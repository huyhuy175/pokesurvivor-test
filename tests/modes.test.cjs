const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function load() { const G = {}; new Function('G', source('js/systems/modes.js'))(G); return G.Modes; }

test('normalize rejects garbage', () => {
  const M = load();
  M.register('wave', { id: 'wave', name: 'Wave', classic: false });
  const normal = { type: 'normal', hc: false };
  for (const raw of [null, undefined, 'wave', 5, { type: 'nope' }, { type: {} }])
    assert.deepEqual(M.normalize(raw), normal);
  assert.deepEqual(M.normalize({ type: 'wave', hc: 'yes' }), { type: 'wave', hc: false });
  assert.deepEqual(M.normalize({ type: 'wave', hc: true }), { type: 'wave', hc: true });
  assert.deepEqual(M.normalize({ type: '__proto__' }), normal);
  assert.deepEqual(M.normalize({ type: 'constructor' }), normal);
});

test('normal has empty hooks', () => {
  const M = load(), n = M.TYPES.normal;
  assert.equal(n.classic, true);
  for (const h of ['spawn', 'onKill', 'onTick', 'result', 'hud']) assert.equal(n[h], undefined, h);
  assert.equal(M.rewardMul(), 1);
  assert.equal(M.hudLine(), '');
  assert.equal(M.result(), null);
});

test('begin/end resets', () => {
  const M = load(); let b = 0, e = 0;
  M.register('wave', { id: 'wave', name: 'Wave', classic: false, begin() { b++; }, end() { e++; } });
  M.begin({ type: 'wave', hc: true }, []);
  assert.deepEqual(M.cfg, { type: 'wave', hc: true });
  assert.equal(b, 1);
  M.end();
  assert.equal(e, 1);
  assert.deepEqual(M.cfg, { type: 'normal', hc: false });
  M.begin(null, []);
  assert.deepEqual(M.cfg, { type: 'normal', hc: false });
  assert.equal(b, 1);
});

test('classic false for registered non-classic mode, arenaRun follows the flag', () => {
  const M = load();
  M.register('wave', { id: 'wave', name: 'Wave', classic: false });
  M.register('bossrush', { id: 'bossrush', name: 'Boss Rush', classic: false, arena: true });
  assert.equal(M.classic(), true);
  assert.equal(M.arenaRun(), false);
  M.begin({ type: 'wave' }, []);
  assert.equal(M.classic(), false);
  assert.equal(M.arenaRun(), false);
  M.end();
  M.begin({ type: 'bossrush' }, []);
  assert.equal(M.arenaRun(), true);
  M.end();
  assert.equal(M.classic(), true);
});

test('tick, onKill and hud delegate to the current mode', () => {
  const M = load(); const log = [];
  M.register('wave', { id: 'wave', name: 'Wave', classic: false,
    onTick(dt, p, t) { log.push(['tick', dt, t]); }, onKill(e) { log.push(['kill', e]); },
    hud() { return 'Wave 1'; }, result() { return { won: false, label: 'Wave 1' }; } });
  M.begin({ type: 'wave' }, []);
  M.tick(0.5, [], 9); M.onKill('x');
  assert.deepEqual(log, [['tick', 0.5, 9], ['kill', 'x']]);
  assert.equal(M.hudLine(), 'Wave 1');
  assert.deepEqual(M.result(), { won: false, label: 'Wave 1' });
});

test('game wiring: modes script is loaded, required and hooked', () => {
  assert.match(source('dev.html'), /js\/systems\/modes\.js/);
  assert.match(source('js/main.js'), /'Modes'/);
  assert.match(source('js/game.js'), /G\.Modes\.begin\(/);
  assert.match(source('js/game.js'), /G\.Modes\.end\(\)/);
  assert.match(source('js/game.js'), /G\.Modes\.tick\(/);
  assert.match(source('js/systems/spawner.js'), /G\.Modes\.current\.spawn/);
  assert.match(source('js/entities/enemy.js'), /G\.Modes\.onKill\(e\)/);
  assert.match(source('js/systems/events.js'), /G\.Modes\.classic\(\)/);
  assert.match(source('js/systems/judgment.js'), /G\.Modes\.classic\(\)/);
});

test('debug commands exist, work only with ?dev, and start the right mode', () => {
  const played = [];
  const G = { Flow: { play(m) { played.push(m); } }, Wave: { debugWave(n) { played.push(['wave', n]); } } };
  new Function('G', source('js/systems/modes.js'))(G);
  G.Modes.register('wave', { id: 'wave', name: 'Wave', classic: false });
  global.location = { search: '' };
  assert.equal(G.Modes.debug('wave', true), false);
  assert.equal(G.Modes.debugWave(5), false);
  global.location = { search: '?dev' };
  assert.equal(G.Modes.debug('wave', true), true);
  assert.deepEqual(played[0], { type: 'wave', hc: true });
  assert.equal(G.Modes.debugWave(25), true);
  assert.deepEqual(played[1], ['wave', 25]);
  delete global.location;
});
