const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

const BOSSES = [0, 1, 2, 3, 4].map(i => ({ dex: 100 + i, name: 'B' + i, at: 180 * (i + 1) }));
const LEGENDS = Array.from({ length: 8 }, (_, i) => ({ dex: 200 + i, name: 'L' + i, leg: true, types: ['fire'] }));

function world() {
  const calls = { spawned: [], bosses: [], granted: [], commit: 0, say: [], heal: 0, pull: 0 };
  const mgr = { count: 0, alive: [] };
  const G = {
    DB: { save: { stats: { bestWave: 0, bestWaveHc: 0 }, coins: 0 }, commit() { calls.commit++; } },
    Spawner: {
      CAP: 64, say(t) { calls.say.push(t); }, anchor: () => ({ x: 0, y: 0 }),
      spawnOne(pl, t, angle, o = {}) { const e = { id: calls.spawned.length + 1, types: ['fire'], elite: !!o.elite, o, t }; calls.spawned.push(e); mgr.alive.push(e); mgr.count++; return e; },
      spawnBoss(pl, t, b, o = {}) { const e = { id: 1000 + calls.bosses.length, boss: true, types: ['fire'], b, o, t }; calls.bosses.push(e); mgr.alive.push(e); mgr.count++; return e; }
    },
    EnemyMgr: mgr,
    Enemies: { BOSSES, bagAt: () => [{ types: ['fire'] }, { types: ['water'] }], bossScale: () => ({ hp: 1, dmg: 1, spd: 1 }) },
    Coop: { active: false, isHost: false, scaleRate: n => 1 + 0.75 * Math.max(0, n - 1), scaleHp: () => 1 },
    Game: { player: { heal() { calls.heal++; }, maxHp: 100, x: 0, y: 0 }, everyone: () => [{ x: 0, y: 0 }] },
    Pickups: { pullAll() { calls.pull++; } }, Progress: { grant(r) { calls.granted.push(r); } },
    Rift: { legendDef: (m, t) => ({ dex: m.dex, hp: 100 + t }), apexDef: d => d, apexPower: () => 1 },
    World: { isFree: () => true },
    Events: { startEscort: () => true, escortState: () => 'follow', cancelEscort() {} },
    DEX: LEGENDS, SPRITE_META: new Proxy({}, { get: () => true }),
    U: { TYPE_NAME: { fire: 1, water: 1, grass: 1 } },
  };
  new Function('G', source('js/systems/modes.js'))(G);
  new Function('G', source('js/systems/modes-wave-obj.js'))(G);
  new Function('G', source('js/systems/modes-wave.js'))(G);
  return { G, calls, mgr, M: G.Modes, W: G.Wave };
}
const kill = (M, mgr, e) => { mgr.alive.splice(mgr.alive.indexOf(e), 1); mgr.count--; M.onKill(e); };
const sp = (M, dt) => M.TYPES.wave.spawn(dt, [{ x: 0, y: 0 }], 0);

test('quota grows with the wave and is capped', () => {
  const { W } = world();
  assert.equal(W.quota(1), 14);
  assert.equal(W.quota(20), 118);
  assert.equal(W.quota(60), 160);
  for (let n = 2; n < 100; n++) assert.ok(W.quota(n) >= W.quota(n - 1), 'monotonic ' + n);
});

test('virtual time is 90 s per wave', () => { assert.equal(world().W.virtualT(20), 1800); });

test('late scaling starts after wave 27 and elite share ramps to 50%', () => {
  const { W } = world();
  assert.deepEqual(W.lateK(27), { hp: 1, dmg: 1 });
  near(W.lateK(28).hp, 1.06); near(W.lateK(28).dmg, 1.04);
  assert.equal(W.eliteShare(27), 0);
  near(W.eliteShare(28), 0.025);
  assert.equal(W.eliteShare(60), 0.5);
  assert.equal(W.eliteShare(500), 0.5);
});

test('bossFor follows the 5-wave cycle with an apex every 25', () => {
  const { W } = world();
  assert.equal(W.bossFor(4), null);
  assert.deepEqual(W.bossFor(5), { kind: 'regular', index: 0 });
  assert.deepEqual(W.bossFor(10), { kind: 'regular', index: 1 });
  assert.deepEqual(W.bossFor(15), { kind: 'regular', index: 2 });
  assert.deepEqual(W.bossFor(20), { kind: 'regular', index: 3 });
  assert.deepEqual(W.bossFor(25), { kind: 'apex', index: 1 });
  assert.deepEqual(W.bossFor(30), { kind: 'regular', index: 0 });
  assert.deepEqual(W.bossFor(50), { kind: 'apex', index: 2 });
});

test('objectiveFor is deterministic, valid, and never asks for a boss that is not there', () => {
  const { W } = world();
  const ok = new Set(['killType', 'speed', 'elites', 'holdBelow', 'bossTime', 'rescue', 'escort', 'light']);
  for (let n = 1; n <= 200; n++) {
    for (const hasBoss of [false, true]) {
      const a = W.objectiveFor(12345, n, hasBoss), b = W.objectiveFor(12345, n, hasBoss);
      assert.deepEqual(a, b);
      assert.ok(ok.has(a.id), a.id);
      assert.ok(a.goal > 0);
      if (!hasBoss) assert.notEqual(a.id, 'bossTime');
    }
  }
  const seen = new Set();
  for (let s = 0; s < 400; s++) seen.add(W.objectiveFor(s, 2, true).id);
  assert.equal(seen.size, 5, 'every objective can come up');
});

test('objective codes round-trip for the network', () => {
  const { W } = world();
  const types = ['fire', 'water', 'grass'];
  for (let s = 0; s < 100; s++) {
    const n = 9 + (s % 20), o = W.objectiveFor(s, n, s % 2 === 0, types);
    assert.deepEqual(W.fromCode(o.code, n), o);
  }
  assert.equal(W.fromCode(-5, 3), null);
  assert.equal(W.fromCode('x', 3), null);
  assert.equal(W.fromCode(99999, 3), null);
});

test('rewards scale with the wave and the difficulty', () => {
  const { W } = world();
  assert.ok(W.REWARDS(10, 1).coins > W.REWARDS(1, 1).coins);
  assert.ok(W.REWARDS(10, 3).shards > W.REWARDS(10, 1).shards);
  assert.equal(W.REWARDS(1, 1).coins, 48);
});

test('state machine: intro 2 s, fight until spawned and cleared, rest 8 s, next wave', () => {
  const { G, M, mgr, calls, W } = world();
  M.begin({ type: 'wave' }, [{}]);
  assert.match(M.hudLine(), /Wave 1/);
  assert.equal(W.state().phase, 'intro');
  sp(M, 1); assert.equal(W.state().phase, 'intro'); assert.equal(calls.spawned.length, 0);
  sp(M, 1.1); assert.equal(W.state().phase, 'fight');
  for (let i = 0; i < 80 && calls.spawned.length < W.quota(1); i++) sp(M, 0.5);
  assert.equal(calls.spawned.length, W.quota(1), 'spawns the whole quota');
  assert.ok(mgr.count > 0);
  sp(M, 0.5); assert.equal(W.state().phase, 'fight', 'enemies still alive');
  for (const e of mgr.alive.slice()) kill(M, mgr, e);
  sp(M, 0.1); assert.equal(W.state().phase, 'rest');
  assert.equal(G.DB.save.stats.bestWave, 1);
  sp(M, 7); assert.equal(W.state().phase, 'rest');
  sp(M, 1.1); assert.equal(W.state().n, 2); assert.equal(W.state().phase, 'intro');
  assert.ok(calls.pull >= 1);
});

test('a wave with a boss does not end before the boss falls', () => {
  const { M, mgr, calls, W } = world();
  M.begin({ type: 'wave' }, [{}]);
  W.debugWave(5);
  assert.equal(W.state().n, 5);
  sp(M, 2.1);
  for (let i = 0; i < 200 && W.state().spawned < W.state().quota; i++) sp(M, 0.5);
  assert.equal(calls.bosses.length, 1);
  for (const e of mgr.alive.filter(x => !x.boss)) kill(M, mgr, e);
  sp(M, 0.1); assert.equal(W.state().phase, 'fight');
  kill(M, mgr, calls.bosses[0]);
  sp(M, 0.1); assert.equal(W.state().phase, 'rest');
});

test('dying reports the wave reached', () => {
  const { M, W } = world();
  M.begin({ type: 'wave' }, [{}]);
  W.debugWave(7);
  assert.deepEqual(M.result(), { won: false, label: 'Wave 7' });
});

test('a guest never spawns: only the authority drives the waves', () => {
  const { G, M, calls } = world();
  G.Coop.active = true; G.Coop.isHost = false;
  M.begin({ type: 'wave' }, [{}]);
  sp(M, 5); sp(M, 5);
  assert.equal(calls.spawned.length, 0);
});

test('spawner accepts elite and multiplier options; wave script loads after boss rush', () => {
  const html = source('dev.html');
  assert.ok(html.indexOf('js/systems/modes-wave.js') > html.indexOf('js/systems/modes-bossrush.js'));
  const s = source('js/systems/spawner.js');
  assert.match(s, /opts\.elite/);
  assert.match(s, /opts\.mul/);
});

test('wave describes itself as an md event, and a guest rewards itself from the rest event', () => {
  const host = world();
  host.M.begin({ type: 'wave' }, [{}]);
  const s = host.M.TYPES.wave.netState();
  assert.equal(s[0], 'md'); assert.equal(s[1], 1); assert.equal(s[2], 1); assert.equal(s[3], 0);
  assert.equal(s[4], host.W.state().obj.code);

  const { G, M, calls, W } = world();
  G.Coop.active = true; G.Coop.isHost = false;
  M.begin({ type: 'wave' }, [{}]);
  const code = W.objectiveFor(1, 3, false).code;
  M.onNet(['md', 1, 3, 1, code, 2, 0]);
  assert.match(M.hudLine(), /Wave 3/);
  assert.equal(calls.granted.length, 0, 'nothing in the middle of the fight');
  M.onNet(['md', 1, 3, 2, code, 9, 1]);                      // rest, objective done
  assert.equal(G.DB.save.stats.bestWave, 3);
  assert.equal(calls.granted.length, 1);
  assert.equal(calls.heal, 1);
  M.onNet(['md', 1, 3, 2, code, 9, 1]);                      // a repeat does not pay twice
  assert.equal(calls.granted.length, 1);
  M.onNet(['md', 1, 4, 2, code, 9, 0]);                      // next wave, objective failed
  assert.equal(calls.granted.length, 1);
  assert.deepEqual(M.result(), { won: false, label: 'Wave 4' });
});
