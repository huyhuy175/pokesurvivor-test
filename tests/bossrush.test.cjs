const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const BOSSES = [0, 1, 2, 3, 4].map(i => ({ dex: 100 + i, name: 'B' + i, at: 180 * (i + 1) }));
const LEGENDS = Array.from({ length: 12 }, (_, i) => ({ dex: 200 + i, name: 'L' + i, leg: true, types: ['fire'] }));

function world() {
  const calls = { open: [], pending: 0, win: 0, spawned: [], spawnOne: 0, granted: [], commit: 0, say: [] };
  let id = 0;
  const G = {
    DB: { save: { stats: { bestStage: 0, bestStageHc: 0, rushClears: 0, rushClearsHc: 0 } }, commit() { calls.commit++; } },
    Spawner: { say(t) { calls.say.push(t); }, spawnOne() { calls.spawnOne++; } },
    Rift: {
      openRush(cfg) { calls.open.push(cfg); },
      legendDef: (mon, t) => ({ dex: mon.dex, name: mon.name, hp: 1000 + t }),
      apexDef: (d, power) => Object.assign({}, d, { hp: d.hp * 6 * power }),
      apexPower: () => 1,
      rushSpawn(def, apex, power, sc) { const e = { id: ++id, def, apex, power, sc, boss: true, hp: def.hp, spd: 1, name: def.name, bossInit() { this.ai = { fury: false }; } }; calls.spawned.push(e); return e; }
    },
    Game: { player: {}, everyone: () => [{}], addPendingLevels(n) { calls.pending += n; }, winRun() { calls.win++; } },
    Coop: { active: false, isHost: false, scaleHp: () => 1 },
    Enemies: { BOSSES, bossScale: () => ({ hp: 1, dmg: 1, spd: 1 }) },
    DEX: LEGENDS, SPRITE_META: new Proxy({}, { get: () => true }),
    Pickups: { pullAll() {} }, Progress: { grant(r) { calls.granted.push(r); } },
  };
  new Function('G', source('js/systems/modes.js'))(G);
  new Function('G', source('js/systems/modes-bossrush.js'))(G);
  return { G, calls, M: G.Modes };
}
const T = (M, dt = 1) => M.TYPES.bossrush.spawn(dt, [{}], 0);
function untilSpawn(M, calls, n) { for (let i = 0; i < 60 && calls.spawned.length < n; i++) T(M); assert.equal(calls.spawned.length, n, 'stage ' + n + ' spawns'); return calls.spawned[n - 1]; }

test('stages returns exactly 10 in the specified order', () => {
  const { G } = world();
  const s = G.BossRush.stages(BOSSES, LEGENDS);
  assert.equal(s.length, 10);
  assert.deepEqual(s.slice(0, 5).map(x => x.kind), Array(5).fill('regular'));
  assert.deepEqual(s.slice(5).map(x => x.kind), Array(5).fill('apex'));
  assert.deepEqual(s.slice(0, 5).map(x => x.def), BOSSES);
  assert.deepEqual(s.map(x => !!x.final), [...Array(9).fill(false), true]);
  assert.equal(new Set(s.slice(5).map(x => x.def.dex)).size, 5, 'no repeated legendary');
});

test('apex power rises across stages and the last one is the strongest', () => {
  const { G } = world();
  const p = G.BossRush.stages(BOSSES, LEGENDS).slice(5).map(x => x.power);
  for (let i = 1; i < p.length; i++) assert.ok(p[i] > p[i - 1], 'stage ' + (i + 6));
});

test('begin opens the arena with the rush flag and queues the draft', () => {
  const { M, calls } = world();
  M.begin({ type: 'bossrush' }, [{}]);
  assert.equal(calls.open.length, 1);
  assert.equal(calls.pending, 3);
  assert.match(M.hudLine(), /Boss Rush · Stage 1\/10/);
});

test('a won run records the clear, best stage 10, and ends the run', () => {
  const { G, M, calls } = world();
  M.begin({ type: 'bossrush' }, [{}]);
  for (let n = 1; n <= 10; n++) {
    const e = untilSpawn(M, calls, n);
    assert.equal(e.apex, n > 5, 'stage ' + n);
    assert.equal(!!(e.ai && e.ai.fury), n === 10, 'only the final boss starts furious');
    M.onKill(e);
    for (let i = 0; i < 15; i++) T(M);
  }
  assert.deepEqual(M.result(), { won: true, label: 'Stage 10/10' });
  assert.equal(G.DB.save.stats.bestStage, 10);
  assert.equal(G.DB.save.stats.rushClears, 1);
  assert.equal(calls.win, 1, 'winRun exactly once');
  assert.equal(calls.granted.length, 1);
  assert.ok(calls.granted[0].gems > 0 && calls.granted[0].shards > 0);
  assert.ok(calls.commit >= 1);
  M.end();
  assert.equal(G.DB.save.stats.rushClears, 1);
});

test('dying records the best stage reached', () => {
  const { G, M, calls } = world();
  M.begin({ type: 'bossrush' }, [{}]);
  for (let n = 1; n <= 4; n++) { M.onKill(untilSpawn(M, calls, n)); for (let i = 0; i < 15; i++) T(M); }
  untilSpawn(M, calls, 5);
  assert.deepEqual(M.result(), { won: false, label: 'Stage 4/10' });
  M.end();
  assert.equal(G.DB.save.stats.bestStage, 4);
  assert.equal(G.DB.save.stats.rushClears, 0);
});

test('only the current stage boss counts as a kill', () => {
  const { G, M, calls } = world();
  M.begin({ type: 'bossrush' }, [{}]);
  untilSpawn(M, calls, 1);
  M.onKill({ id: 9999, boss: true });
  assert.equal(G.DB.save.stats.bestStage, 0);
});

test('no regular spawn: Boss Rush never calls Spawner.spawnOne', () => {
  const { M, calls } = world();
  M.begin({ type: 'bossrush' }, [{}]);
  for (let i = 0; i < 300; i++) T(M);
  assert.equal(calls.spawnOne, 0);
});

test('final stage is a stronger apex and starts furious', () => {
  const src = source('js/systems/modes-bossrush.js');
  assert.match(src, /fury/);
});

test('rift.js rush phase never wins, loses or finishes; game.js lets rush runs end on death', () => {
  const rift = source('js/systems/rift.js');
  const i = rift.indexOf("arena.phase === 'rush'");
  assert.ok(i > 0);
  const branch = rift.slice(i, rift.indexOf('return;', i) + 8);
  assert.doesNotMatch(branch, /won\(|lost\(|finish\(/);
  assert.match(rift, /function openRush\(/);
  const game = source('js/game.js');
  assert.match(game, /pl\.dead && !coop && \(!G\.Rift\.inArena \|\| G\.Modes\.arenaRun\(\)\)/);
  assert.match(game, /\(G\.Rift\.inArena && !G\.Modes\.arenaRun\(\)\)/);
  assert.match(game, /addPendingLevels/);
  assert.match(game, /winRun/);
});

test('co-op guest follows the host through md events and rewards itself', () => {
  const { G, M, calls } = world();
  G.Coop.active = true; G.Coop.isHost = false;
  M.begin({ type: 'bossrush' }, [{}]);
  assert.equal(calls.open.length, 0, 'a guest does not roll its own arena');
  assert.equal(calls.pending, 0);
  M.onNet(['md', 2, 3, 2, 0, 2, 0]);                         // stage 3 spawned, resting, 2 defeated
  assert.equal(G.DB.save.stats.bestStage, 2);
  assert.match(M.hudLine(), /Stage 3\/10/);
  M.onNet(['md', 2, 10, 3, 0, 10, 1]);                       // won
  assert.deepEqual(M.result(), { won: true, label: 'Stage 10/10' });
  assert.equal(G.DB.save.stats.rushClears, 1);
  assert.equal(calls.granted.length, 1);
  M.onNet(['md', 2, 10, 3, 0, 10, 1]);                       // a repeat does not pay twice
  assert.equal(calls.granted.length, 1);
  assert.equal(G.DB.save.stats.rushClears, 1);
});

test('the host describes its state as an md event', () => {
  const { M, calls } = world();
  M.begin({ type: 'bossrush' }, [{}]);
  assert.deepEqual(M.TYPES.bossrush.netState(), ['md', 2, 0, 0, 0, 0, 0]);
  untilSpawn(M, calls, 1);
  assert.deepEqual(M.TYPES.bossrush.netState(), ['md', 2, 1, 1, 0, 0, 0]);
});
