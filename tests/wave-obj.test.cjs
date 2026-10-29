const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function world(opts = {}) {
  const calls = { spawned: [], escort: [], cancel: 0, say: [] };
  const G = {
    Coop: { active: !!opts.coop, isHost: !opts.guest, scaleRate: () => 1, scaleHp: () => 1 },
    World: { isFree: () => true },
    Spawner: { CAP: 64, say(t) { calls.say.push(t); }, anchor: () => ({ x: 0, y: 0 }), spawnOne(pl, t, a) { calls.spawned.push(a); return { id: calls.spawned.length }; }, spawnBoss() {} },
    Enemies: { BOSSES: [], bagAt: () => [{ types: ['fire'] }], bossScale: () => ({ hp: 1, dmg: 1, spd: 1 }) },
    EnemyMgr: { count: 0 },
    Game: { player: { x: 0, y: 0, heal() {}, maxHp: 100 }, everyone: () => [{ x: 0, y: 0 }] },
    Events: { escort: 'none', startEscort(players, o) { calls.escort.push(o); G.Events.escort = 'follow'; return true; }, escortState() { return G.Events.escort; }, cancelEscort() { calls.cancel++; G.Events.escort = 'none'; } },
    DEX: [{ dex: 1, rarity: 1, types: ['fire'] }, { dex: 2, rarity: 2, types: ['water'] }], SPRITE_META: new Proxy({}, { get: () => true }),
    Pickups: { pullAll() {} }, Progress: { grant() {} }, DB: { save: { stats: { bestWave: 0, bestWaveHc: 0 } }, commit() {} },
    Rift: { legendDef: () => ({}), apexDef: d => d, apexPower: () => 1 },
    U: { TYPE_NAME: { fire: 1, water: 1, grass: 1 } },
    Sprites: { hovers: () => false },
  };
  new Function('G', source('js/systems/modes.js'))(G);
  new Function('G', source('js/systems/modes-wave-obj.js'))(G);
  new Function('G', source('js/systems/modes-wave.js'))(G);
  return { G, calls, O: G.WaveObj, W: G.Wave, M: G.Modes };
}
const P = (x, y) => ({ x, y, r: 10, dead: false });

test('rescue progresses only while a player is in range and decays outside', () => {
  const { O } = world();
  O.spawn('rescue', { x: 0, y: 0 }, 1, 3);
  const t = O.target();
  assert.ok(Math.hypot(t.x, t.y) >= 500 && Math.hypot(t.x, t.y) <= 700, 'placed 500-700 px away');
  O.update(1, [P(0, 0)]);
  assert.equal(O.progress(), 0, 'far away: nothing');
  O.update(1.5, [P(t.x + 10, t.y)]);
  const half = O.progress();
  assert.ok(half > 0 && half < 100);
  O.update(1, [P(0, 0)]);
  assert.ok(O.progress() < half, 'decays when the player steps out');
  assert.ok(!O.done());
  O.update(10, [P(t.x, t.y)]);
  assert.ok(O.done());
  assert.equal(O.progress(), 100);
  assert.equal(O.mask(), 1);
});

test('a dead player does not rescue', () => {
  const { O } = world();
  O.spawn('rescue', { x: 0, y: 0 }, 1, 3);
  const t = O.target();
  O.update(10, [Object.assign(P(t.x, t.y), { dead: true })]);
  assert.ok(!O.done());
});

test('light needs every lamp lit before the wave ends, and the mask counts the lit ones', () => {
  const { O } = world();
  O.spawn('light', { x: 0, y: 0 }, 1, 4);              // n = 4 → 3 + 4 % 3 = 4 lamps
  const lamps = O.lamps();
  assert.equal(lamps.length, 4);
  for (const l of lamps) assert.ok(Math.hypot(l.x, l.y) >= 290 && Math.hypot(l.x, l.y) <= 510);
  for (let i = 0; i < 3; i++) O.update(3, [P(lamps[i].x, lamps[i].y)]);
  assert.ok(!O.done());
  assert.equal(O.progress(), 3);
  assert.equal(O.mask().toString(2).split('1').length - 1, 3);
  O.update(3, [P(lamps[3].x, lamps[3].y)]);
  assert.ok(O.done());
  assert.equal(O.mask().toString(2).split('1').length - 1, 4);
});

test('applyNet mirrors the host on a guest', () => {
  const host = world().O, guest = world({ coop: true, guest: true }).O;
  host.spawn('light', { x: 100, y: 50 }, 1, 5);
  guest.spawn('light', { x: 100, y: 50 }, 1, 5);
  assert.deepEqual(host.lamps().map(l => [l.x, l.y]), guest.lamps().map(l => [l.x, l.y]), 'same positions on both machines');
  const l = host.lamps();
  host.update(3, [P(l[1].x, l[1].y)]);
  guest.applyNet(host.progress(), host.mask());
  assert.equal(guest.progress(), 1);
  assert.equal(guest.mask(), host.mask());
});

test('a guest never measures progress itself', () => {
  const { O } = world({ coop: true, guest: true });
  O.spawn('rescue', { x: 0, y: 0 }, 1, 3);
  const t = O.target();
  O.update(10, [P(t.x, t.y)]);
  assert.ok(!O.done());
});

test('objectiveFor never returns map objectives before wave 3 and can return all three after', () => {
  const { W } = world();
  const map = new Set(['rescue', 'escort', 'light']);
  for (let s = 0; s < 300; s++) for (const n of [1, 2]) assert.ok(!map.has(W.objectiveFor(s, n, true).id), 'wave ' + n);
  const seen = new Set();
  for (let s = 0; s < 600; s++) seen.add(W.objectiveFor(s, 6, false).id);
  for (const id of map) assert.ok(seen.has(id), id);
  for (let s = 0; s < 100; s++) { const o = W.objectiveFor(s, 7, true); assert.deepEqual(W.fromCode(o.code, 7), o); }
});

test('escort objective: started through Events, fails when the escort fails', () => {
  const { G, M, W, O, calls } = world();
  M.begin({ type: 'wave' }, [{}]);
  let n = 3;
  let seed = 0;
  for (; seed < 500; seed++) if (W.objectiveFor(seed, n, false).id === 'escort') break;
  W.debugObjective(seed, n);                              // fuerza la oleada n con ese objetivo
  assert.equal(W.state().obj.id, 'escort');
  M.TYPES.wave.spawn(2.1, [{}], 0);                       // intro → fight
  assert.equal(calls.escort.length, 1);
  assert.equal(calls.escort[0].ttl, 90);
  G.Events.escort = 'failed';
  M.TYPES.wave.onTick(0.1, [{}], 0);
  assert.equal(M.TYPES.wave.netState()[6] & 2, 2);
});

test('wave end and Modes.end clear the map objects and any escort', () => {
  const { G, M, W, O, calls } = world();
  M.begin({ type: 'wave' }, [{}]);
  let seed = 0;
  for (; seed < 500; seed++) if (W.objectiveFor(seed, 4, false).id === 'light') break;
  W.debugObjective(seed, 4);
  M.TYPES.wave.spawn(2.1, [{}], 0);
  assert.ok(O.drawable(), 'lamps exist during the fight');
  M.end();
  assert.equal(O.drawable(), null);
  assert.ok(calls.cancel >= 1);
});

test('wiring: script order, Events escort API, drawable registered', () => {
  const html = source('dev.html');
  assert.ok(html.indexOf('js/systems/modes-wave-obj.js') > html.indexOf('js/systems/modes-wave.js') || html.indexOf('js/systems/modes-wave-obj.js') > 0);
  const ev = source('js/systems/events.js');
  for (const f of ['startEscort', 'escortState', 'cancelEscort']) assert.match(ev, new RegExp(f));
  assert.match(source('js/game.js'), /G\.WaveObj\.drawable\(\)/);
});

test('a guest builds the same lamps from the md centre and mirrors the lit ones', () => {
  const host = world().O;
  host.spawn('light', { x: 100, y: 50 }, 0, 4);
  const { M, W, O } = world({ coop: true, guest: true });
  M.begin({ type: 'wave' }, [{}]);
  let light = null;
  for (let s = 0; s < 500 && !light; s++) { const o = W.objectiveFor(s, 4, false); if (o.id === 'light') light = o; }
  M.onNet(['md', 1, 4, 1, light.code, 0, 0, 100, 50]);
  assert.deepEqual(O.lamps().map(l => [l.x, l.y]), host.lamps().map(l => [l.x, l.y]));
  M.onNet(['md', 1, 4, 1, light.code, 2, (1 << 8) | (1 << 10), 100, 50]);
  assert.equal(O.progress(), 2);
  assert.equal(O.mask(), (1 << 0) | (1 << 2));
  M.onNet(['md', 1, 4, 2, light.code, 2, 0, 100, 50]);
  assert.equal(O.drawable(), null, 'cleared when the wave rests');
});

test('the host sends the centre and the lamp mask in md while fighting a map objective', () => {
  const { M, W } = world();
  M.begin({ type: 'wave' }, [{}]);
  let seed = 0;
  for (; seed < 500; seed++) if (W.objectiveFor(seed, 4, false).id === 'light') break;
  W.debugObjective(seed, 4);
  M.TYPES.wave.spawn(2.1, [{}], 0);
  const ev = M.TYPES.wave.netState();
  assert.equal(ev.length, 9);
  assert.deepEqual(ev.slice(7), [0, 0]);
});
