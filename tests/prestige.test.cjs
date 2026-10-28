const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

/** Un G de pega con lo que los módulos usan al cargarse; `extra` lo amplía. */
function world(files, extra = {}) {
  const G = Object.assign({ U: { TYPE_NAME: {} }, Types: { mult: () => 1 }, Weather: { current: null } }, extra);
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const DATA = ['js/data/pokedex.js', 'js/data/passives.js', 'js/data/evolutions.js', 'js/data/mega.js'];

function dbWorld() {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world(DATA);
  new Function('G', source('js/core/db.js'))(G);
  return G;
}
/** Una partida mínima con libreta: `base` es el saldo común de partida. */
const saveWith = (gems, base = 10) => ({
  v: 3, name: 'x', created: 1, updated: 1, coins: 0, tickets: { t1: 0, t10: 0 }, shards: 0, gems,
  owned: {}, shiny: {}, bag: {}, tms: {}, upgrades: {}, pupg: {}, stats: {}, missions: {},
  led: { base: { c: [0, 0], t1: [0, 0], t10: [0, 0], sh: [0, 0], g: [base, 0] } }
});

// ---------------- Task 1: gemas ----------------

test('gems: spending on one device and earning on another both survive a merge', () => {
  const G = dbWorld();
  const a = Object.assign(saveWith(6), { updated: 5 });     // gastó 4
  const b = Object.assign(saveWith(15), { updated: 9 });    // ganó 5
  const m = G.DB.merge(a, b);
  assert.equal(m.gems, 11);
  assert.equal(G.DB.merge(m, b).gems, 11);                  // idempotente
  assert.equal(G.DB.merge(b, a).gems, 11);                  // el orden no importa
});

test('gems: a save without the field merges as zero', () => {
  const G = dbWorld();
  const old = saveWith(0, 0); delete old.gems; delete old.led.base.g;
  assert.equal(G.DB.merge(old, saveWith(0, 0)).gems, 0);
});

test('sanitize clamps gems', () => {
  const G = dbWorld();
  for (const [raw, want] of [[-5, 0], [1e12, 1e9], ['x', 0], [42, 42]]) {
    const s = saveWith(0);
    s.gems = raw;
    G.DB.sanitize(s);
    assert.equal(s.gems, want, String(raw));
  }
});

test('Progress.grant adds gems and caps at 1e9', () => {
  const G = world(DATA, { Moves: { EVO: {} }, SPRITE_META: new Proxy({}, { get: () => true }) });
  global.document = { getElementById: () => ({ classList: { contains: () => true } }) };
  for (const f of ['js/data/missions.js', 'js/data/achievements.js', 'js/systems/progress.js']) new Function('G', source(f))(G);
  G.DB = { save: { coins: 0, tickets: { t1: 0, t10: 0 }, gems: 5 }, commit() {} };
  G.Progress.grant({ gems: 3 });
  assert.equal(G.DB.save.gems, 8);
  G.Progress.grant({ gems: 2e9 });
  assert.equal(G.DB.save.gems, 1e9);
  G.DB.save.gems = undefined;
  G.Progress.grant({ gems: 1 });
  assert.equal(G.DB.save.gems, 1);
});

// ---------------- Task 2: módulo Prestige ----------------

const PFILES = [...DATA, 'js/systems/mons.js', 'js/systems/prestige.js'];
/** Mundo con Prestige y una partida mínima; `plv` y `gems` se pasan en `over`. */
function pWorld(over = {}) {
  const G = world(PFILES);
  const commits = [];
  G.DB = { save: Object.assign({ gems: 0, plv: {} }, over), commit: (...a) => commits.push(a) };
  return { G, save: G.DB.save, commits, P: G.Prestige };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);
const MEGA_OF_6 = G => G.MEGA[6][0];

test('xpTo is 0 at level 1 and grows', () => {
  const { P } = pWorld();
  assert.equal(P.xpTo(1), 0);
  assert.equal(P.xpTo(30), 5220);
});

test('limit grows 10 per star from 30', () => {
  const { P, save } = pWorld();
  assert.equal(P.limitOf(4), 30);
  save.plv[4] = { xp: 0, star: 1 };
  assert.equal(P.limitOf(4), 40);
});

test('levelOf follows xp and never exceeds the limit', () => {
  const { P, save } = pWorld();
  assert.equal(P.levelOf(4), 1);
  save.plv[4] = { xp: P.xpTo(10), star: 0 };
  assert.equal(P.levelOf(4), 10);
  save.plv[4] = { xp: P.xpTo(10) - 1, star: 0 };
  assert.equal(P.levelOf(4), 9);
  save.plv[4] = { xp: 1e9, star: 0 };
  assert.equal(P.levelOf(4), 30);
});

test('a Mega or an evolved form resolves to the base form', () => {
  const { G, P, save } = pWorld();
  save.plv[4] = { xp: P.xpTo(10), star: 0 };
  assert.equal(P.levelOf(6), 10);
  assert.equal(P.levelOf(MEGA_OF_6(G)), 10);
});

test('unknown dex: level 1, neutral bonus, no throw', () => {
  const { P } = pWorld();
  assert.equal(P.levelOf(99999), 1);
  assert.deepEqual(P.bonus(99999), { dmgMul: 1, hpMul: 1 });
  assert.deepEqual(P.grantXp(99999, { time: 600, level: 5, kills: 5, bosses: 0 }), { gained: 0, level: 1, capped: false });
  assert.deepEqual(P.prestige(99999), { ok: false, reason: 'unknown' });
});

test('bonus: a fresh Pokémon is x1; otherwise 0.5% per level gained and 10% per star', () => {
  const { P, save } = pWorld();
  assert.deepEqual(P.bonus(4), { dmgMul: 1, hpMul: 1 });
  save.plv[4] = { xp: P.xpTo(10), star: 2 };
  const b = P.bonus(4);
  near(b.dmgMul, 1 + 0.005 * 9 + 0.2);
  near(b.hpMul, 1 + 0.005 * 9 + 0.2);
});

test('runXp: time/10 + kills/20 + bosses*15 + level, rounded down', () => {
  const { P } = pWorld();
  assert.equal(P.runXp({ time: 600, level: 15, kills: 500, bosses: 2 }), 130);
  assert.equal(P.runXp({ time: 0, level: 1, kills: 0, bosses: 0 }), 1);
});

test('grantXp adds xp, clamps at the limit and then stops', () => {
  const { P, save, commits } = pWorld();
  const small = P.grantXp(4, { time: 600, level: 15, kills: 500, bosses: 2 });
  assert.deepEqual(small, { gained: 130, level: 5, capped: false });     // xpTo(5) = 120 ≤ 130 < xpTo(6) = 180
  assert.equal(save.plv[4].xp, 130);
  assert.ok(commits.length > 0);
  const big = P.grantXp(4, { time: 1e6, level: 99, kills: 1e6, bosses: 99 });
  assert.equal(big.capped, true);
  assert.equal(save.plv[4].xp, P.xpTo(30));
  assert.equal(big.level, 30);
  assert.deepEqual(P.grantXp(4, { time: 600, level: 15, kills: 500, bosses: 2 }), { gained: 0, level: 30, capped: true });
  assert.equal(save.plv[4].xp, P.xpTo(30));
});

test('prestige: one gem short changes nothing; exact gems works', () => {
  const { P, save, commits } = pWorld({ gems: 49 });
  save.plv[4] = { xp: P.xpTo(30), star: 0 };
  assert.equal(P.cost(4), 50);
  assert.deepEqual(P.prestige(4), { ok: false, reason: 'gems' });
  assert.deepEqual(save.plv[4], { xp: P.xpTo(30), star: 0 });
  assert.equal(save.gems, 49);
  save.gems = 50;
  assert.deepEqual(P.prestige(4), { ok: true });
  assert.equal(save.gems, 0);
  assert.deepEqual(save.plv[4], { xp: 0, star: 1 });
  assert.equal(P.limitOf(4), 40);
  assert.equal(P.cost(4), 100);
  assert.ok(commits.some(c => c[0] === true));
});

test('prestige: below the limit → level; at MAX_STAR → maxed', () => {
  const { P, save } = pWorld({ gems: 1e6 });
  save.plv[4] = { xp: P.xpTo(29), star: 0 };
  assert.deepEqual(P.prestige(4), { ok: false, reason: 'level' });
  assert.equal(P.canPrestige(4), false);
  save.plv[4] = { xp: P.xpTo(30 + 10 * P.MAX_STAR), star: P.MAX_STAR };
  assert.deepEqual(P.prestige(4), { ok: false, reason: 'maxed' });
  assert.equal(P.canPrestige(4), false);
});

test('rollGems: boss 1-2, enemy 0.03%', () => {
  const { P } = pWorld();
  assert.equal(P.rollGems('boss', () => 0), 1);
  assert.equal(P.rollGems('boss', () => 0.99), 2);
  assert.equal(P.rollGems('enemy', () => 0), 1);
  assert.equal(P.rollGems('enemy', () => 0.5), 0);
});

test('onKill: gems are saved at once; judge enemies give nothing', () => {
  const { G, P, save, commits } = pWorld();
  const fx = [];
  G.FX = { dmgText: (...a) => fx.push(a) };
  G.T = s => s;
  G.Progress = { grant: r => { save.gems += r.gems; } };
  const pl = { x: 0, y: 0, bodyH: 10 };
  P.onKill(pl, { boss: true, judge: true }, () => 0);
  assert.equal(save.gems, 0);
  P.onKill(pl, { boss: true }, () => 0.99);
  assert.equal(save.gems, 2);
  assert.equal(pl.gemsFound, 2);
  assert.ok(commits.some(c => c[0] === 'run'));
  P.onKill(pl, {}, () => 0.9);
  assert.equal(save.gems, 2);
});

// ---- guardado: plv ----

function dbWithPrestige() {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world([...DATA, 'js/systems/mons.js', 'js/systems/prestige.js']);
  new Function('G', source('js/core/db.js'))(G);
  return G;
}

test('plv sanitize: caps star, trims xp, drops unknown Pokémon', () => {
  const G = dbWithPrestige(), P = G.Prestige;
  const s = saveWith(0);
  s.plv = { 4: { xp: 1e12, star: 99 }, 99999: { xp: 5, star: 1 }, 7: { xp: -5, star: -2 }, 1: 'x' };
  G.DB.sanitize(s);
  assert.deepEqual(s.plv[4], { xp: P.xpTo(30 + 10 * P.MAX_STAR), star: P.MAX_STAR });
  assert.equal(s.plv[99999], undefined);
  assert.deepEqual(s.plv[7], { xp: 0, star: 0 });
  assert.equal(s.plv[1], undefined);
});

test('plv merge: higher star wins, then higher xp; idempotent', () => {
  const G = dbWithPrestige();
  const a = Object.assign(saveWith(0), { updated: 9, plv: { 4: { xp: 500, star: 1 } } });
  const b = Object.assign(saveWith(0), { updated: 5, plv: { 4: { xp: 900, star: 0 }, 1: { xp: 7, star: 0 } } });
  const m = G.DB.merge(a, b);
  assert.deepEqual(m.plv[4], { xp: 500, star: 1 });
  assert.deepEqual(m.plv[1], { xp: 7, star: 0 });
  assert.deepEqual(G.DB.merge(m, b).plv, m.plv);
  assert.deepEqual(G.DB.merge(b, a).plv, m.plv);
  const c = Object.assign(saveWith(0), { updated: 1, plv: { 4: { xp: 800, star: 1 } } });
  assert.deepEqual(G.DB.merge(a, c).plv[4], { xp: 800, star: 1 });
});

test('a save without plv merges and sanitizes to an empty object', () => {
  const G = dbWithPrestige();
  const s = saveWith(0);
  G.DB.sanitize(s);
  assert.deepEqual(s.plv, {});
  assert.deepEqual(G.DB.merge(saveWith(0), saveWith(0)).plv, {});
});

// ---------------- Task 3: integración y recompensas ----------------

test('apply: multiplies atkMul and scales total hp', () => {
  const { P, save } = pWorld();
  save.plv[4] = { xp: 0, star: 1 };                          // ×1,1
  const perks = P.apply({ atkMul: 1.4, hp: 16 }, { dex: 4, hp: 100 });
  near(perks.atkMul, 1.54);
  assert.equal(perks.hp, 28);                                 // round((100 + 16) × 1,1) − 100
});

test('apply: empty perks and an unknown dex do not throw', () => {
  const { P } = pWorld();
  const perks = P.apply({}, { dex: 99999, hp: 100 });
  assert.equal(perks.atkMul, 1);
  assert.equal(perks.hp, 0);
  assert.deepEqual(P.bonus(4), { dmgMul: 1, hpMul: 1 });     // un Pokémon recién conseguido
});

function rewardWorld() {
  const G = world(DATA, { Moves: { EVO: {} }, SPRITE_META: new Proxy({}, { get: () => true }) });
  G.U.TYPE_NAME = { fire: 'Fuego' };
  for (const f of ['js/data/missions.js', 'js/data/achievements.js']) new Function('G', source(f))(G);
  return G;
}

test('rewards: boss, survive and level missions and every weekly mission give gems', () => {
  const G = rewardWorld();
  for (const id of ['boss', 'survive', 'level']) assert.ok(G.MissionDefs.BY[id].reward.gems > 0, id);
  for (const m of G.MissionDefs.weekly) assert.ok(m.reward.gems > 0, m.id);
});

test('rewards: achievements of tier 2+ give gems (legendary ones excepted); tier 1 does not', () => {
  const G = rewardWorld();
  for (const a of G.AchDefs.LIST) {
    if (a.id.startsWith('leg_')) continue;
    if (a.tier === 1) assert.ok(!a.reward.gems, a.id);
    else assert.ok(a.reward.gems > 0, a.id);
  }
});

// ---------------- lo que quedó pendiente de la revisión ----------------

test('plv: entries of evolved forms and Megas fold into the base form (higher star, then xp)', () => {
  const G = dbWithPrestige(), P = G.Prestige;
  const s = saveWith(0);
  s.plv = { 4: { xp: 50, star: 1 }, 5: { xp: 100, star: 0 }, 6: { xp: 70, star: 1 }, [G.MEGA[6][0]]: { xp: 5, star: 0 }, 1: { xp: 9, star: 0 } };
  G.DB.sanitize(s);
  assert.deepEqual(s.plv[4], { xp: 70, star: 1 });
  assert.equal(s.plv[5], undefined);
  assert.equal(s.plv[6], undefined);
  assert.equal(s.plv[G.MEGA[6][0]], undefined);
  assert.deepEqual(s.plv[1], { xp: 9, star: 0 });
  assert.ok(s.plv[4].xp <= P.xpTo(P.LV_BASE + P.LV_STEP * s.plv[4].star));
});
