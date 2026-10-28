const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying',
  'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
const U = () => ({
  TYPE_NAME: Object.fromEntries(TYPES.map(t => [t, t])),
  TYPE_COLOR: Object.fromEntries(TYPES.map(t => [t, '#123456']))
});

/** Un G de pega con lo que los módulos usan al cargarse. */
function world(files, extra = {}) {
  const G = Object.assign({ U: U(), Types: { mult: () => 1 }, Weather: { current: null } }, extra);
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const DATA = ['js/data/pokedex.js', 'js/data/passives.js', 'js/data/evolutions.js', 'js/data/mega.js'];
const MATS = ['js/data/mega-mats.js', 'js/data/shop.js'];

function dbWorld(files = [...DATA, ...MATS]) {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world(files);
  new Function('G', source('js/core/db.js'))(G);
  return G;
}
const saveWith = (matfire, base = 10) => ({
  v: 3, name: 'x', created: 1, updated: 1, coins: 0, tickets: { t1: 0, t10: 0 }, shards: 0,
  owned: {}, shiny: {}, bag: matfire ? { matfire } : {}, tms: {}, upgrades: {}, pupg: {}, stats: {}, missions: {},
  led: { base: { c: [0, 0], t1: [0, 0], t10: [0, 0], sh: [0, 0], 'b:matfire': [base, 0] } }
});

// ---------------- Task 1: datos y Mochila ----------------

test('MegaMats has one unique id per type, and every id fits the ledger pattern', () => {
  const G = world(['js/data/mega-mats.js']);
  assert.equal(G.MegaMats.TYPES.length, 18);
  const ids = G.MegaMats.TYPES.map(G.MegaMats.id);
  assert.equal(new Set(ids).size, 18);
  for (const t of G.MegaMats.TYPES) {
    assert.match('b:' + G.MegaMats.id(t), /^b:[a-z0-9]{1,12}$/);
    assert.equal(G.MegaMats.typeOf(G.MegaMats.id(t)), t);
  }
  assert.equal(G.MegaMats.typeOf('mint'), null);
});

test('Shop.ITEMS includes every material and ORDER stays as it was', () => {
  const G = world(MATS);
  for (const t of G.MegaMats.TYPES) assert.equal(G.Shop.ITEMS[G.MegaMats.id(t)].price, 600);
  assert.deepEqual(G.Shop.ORDER, ['mint']);
});

test('Shop.give caps the bag at 999', () => {
  const G = world(MATS, {});
  G.DB = { save: { bag: {} }, commit() {} };
  G.Shop.give('matfire', 1000);
  assert.equal(G.DB.save.bag.matfire, 999);
});

test('sanitize keeps materials and drops unknown ids', () => {
  const G = dbWorld();
  const s = saveWith(0);
  s.bag = { matfire: 5, matzzz: 3 };
  G.DB.sanitize(s);
  assert.equal(s.bag.matfire, 5);
  assert.equal(s.bag.matzzz, undefined);
});

test('materials: spending on one device and earning on another both survive a merge', () => {
  const G = dbWorld();
  const a = Object.assign(saveWith(6), { updated: 5 });     // gastó 4
  const b = Object.assign(saveWith(15), { updated: 9 });    // ganó 5
  const m = G.DB.merge(a, b);
  assert.equal(m.bag.matfire, 11);
  assert.equal(G.DB.merge(m, b).bag.matfire, 11);           // idempotente
  assert.equal(G.DB.merge(b, a).bag.matfire, 11);           // el orden no importa
});

// ---------------- Task 2: coste en la Forja ----------------

/** Forja con una partida mínima; `bag` y el resto de saldos se pasan en `over`. */
function forgeWorld(over = {}, withMats = true) {
  const G = world(withMats ? [...DATA, ...MATS] : DATA);
  const m1 = G.MEGA_DEX.find(m => m.types.length === 1), m2 = G.MEGA_DEX.find(m => m.types.length === 2);
  const save = Object.assign({ shards: 10000, cry: {}, bag: {}, owned: { [m1.mega]: {}, [m2.mega]: {} } }, over);
  const granted = [];
  G.DB = {
    save, commit() {}, owns: d => !!save.owned[d], crystals: t => save.cry[t] || 0,
    grant: (d, why) => { granted.push(d); save.owned[d] = { from: why }; }
  };
  new Function('G', source('js/systems/forge.js'))(G);
  return { G, save, granted, m1, m2 };
}
const fill = (save, cost) => {
  save.shards = cost.shards;
  save.cry = Object.assign({}, cost.crystals);
  save.bag = Object.fromEntries(Object.entries(cost.mats || {}).map(([t, n]) => ['mat' + t, n]));
};

test('megaCost: one type needs 5 materials, two types need 3 each', () => {
  const { G, m1, m2 } = forgeWorld();
  assert.deepEqual(G.Forge.megaCost(m1.dex).mats, { [m1.types[0]]: 5 });
  assert.deepEqual(G.Forge.megaCost(m2.dex).mats, { [m2.types[0]]: 3, [m2.types[1]]: 3 });
});

test('buyMega: missing materials takes nothing', () => {
  const { G, save, granted, m2 } = forgeWorld();
  const cost = G.Forge.megaCost(m2.dex);
  fill(save, cost);
  save.bag['mat' + m2.types[0]] -= 1;
  const before = JSON.stringify(save);
  assert.deepEqual(G.Forge.buyMega(m2.dex), { ok: false, reason: 'mats' });
  assert.equal(JSON.stringify(save), before);
  assert.equal(granted.length, 0);
});

test('buyMega: with everything, spends exactly the cost', () => {
  const { G, save, granted, m2 } = forgeWorld();
  const cost = G.Forge.megaCost(m2.dex);
  fill(save, cost);
  for (const t of m2.types) { save.cry[t] += 2; save.bag['mat' + t] += 2; }
  save.shards += 7;
  assert.deepEqual(G.Forge.buyMega(m2.dex), { ok: true });
  assert.equal(save.shards, 7);
  for (const t of m2.types) { assert.equal(save.cry[t], 2); assert.equal(save.bag['mat' + t], 2); }
  assert.deepEqual(granted, [m2.dex]);
});

test('buyMega: spending all of a material removes it from the bag', () => {
  const { G, save, m1 } = forgeWorld();
  fill(save, G.Forge.megaCost(m1.dex));
  assert.equal(G.Forge.buyMega(m1.dex).ok, true);
  assert.equal(save.bag['mat' + m1.types[0]], undefined);
});

test('buyMega: without G.MegaMats behaves as before', () => {
  const { G, save, m1 } = forgeWorld({}, false);
  const cost = G.Forge.megaCost(m1.dex);
  assert.deepEqual(cost.mats, {});
  fill(save, cost);
  assert.equal(G.Forge.buyMega(m1.dex).ok, true);
});

// ---------------- Task 3: botín en la partida ----------------

function lootWorld(bag = {}) {
  const G = world([...DATA, ...MATS]);
  const save = { bag, cry: {} };
  const fx = [];
  G.DB = { save, commit() {}, owns: () => false, crystals: () => 0 };
  G.Progress = { grant: r => { for (const t in (r.crystals || {})) save.cry[t] = (save.cry[t] || 0) + r.crystals[t]; } };
  G.FX = { dmgText: (...a) => fx.push(a), ring() {}, burst() {} };
  G.Audio = { sfx() {} };
  G.T = s => s;
  new Function('G', source('js/systems/mega.js'))(G);
  const pl = { x: 0, y: 0, bodyH: 10, level: 40, dex: 6, megaStone: 0, mon: { types: ['fire', 'dragon'] } };
  return { G, save, pl, fx };
}
const total = bag => Object.entries(bag).filter(([k]) => k.startsWith('mat')).reduce((a, [, n]) => a + n, 0);

test('onKill: a normal enemy drops one material of its first type when rand is low', () => {
  const { G, save, pl } = lootWorld();
  G.Mega.onKill(pl, { types: ['water'] }, () => 0.9);
  assert.equal(total(save.bag), 0);
  G.Mega.onKill(pl, { types: ['water'] }, () => 0);
  assert.equal(save.bag.matwater, 1);
});

test('onKill: an enemy without types drops nothing', () => {
  const { G, save, pl } = lootWorld();
  G.Mega.onKill(pl, {}, () => 0);
  G.Mega.onKill(pl, { types: [] }, () => 0);
  assert.equal(total(save.bag), 0);
});

test('onKill: a boss drops 2-3 materials of its first type', () => {
  const a = lootWorld(), b = lootWorld();
  a.G.Mega.onKill(a.pl, { boss: true, mon: 1, types: ['ghost'] }, () => 0);
  b.G.Mega.onKill(b.pl, { boss: true, mon: 1, types: ['ghost'] }, () => 0.99);
  assert.equal(a.save.bag.matghost, 2);
  assert.equal(b.save.bag.matghost, 3);
  assert.equal(a.pl.matsFound, 2);
});

test('onKill: a boss with mon === null uses a random valid type and does not throw', () => {
  const { G, save, pl } = lootWorld();
  G.Mega.onKill(pl, { boss: true, mon: null, types: ['normal'] }, () => 0.5);
  const keys = Object.keys(save.bag);
  assert.equal(keys.length, 1);
  assert.ok(G.MegaMats.typeOf(keys[0]));
  assert.equal(total(save.bag), 3);
});

test('onKill: judge enemies drop nothing', () => {
  const { G, save, pl } = lootWorld();
  G.Mega.onKill(pl, { boss: true, judge: true, types: ['dark'] }, () => 0);
  assert.equal(total(save.bag), 0);
});

test('onChest: drops 1-2 materials of one of the player types', () => {
  const a = lootWorld(), b = lootWorld();
  a.G.Mega.onChest(a.pl, () => 0);
  b.G.Mega.onChest(b.pl, () => 0.99);
  assert.equal(a.save.bag.matfire, 1);
  assert.equal(b.save.bag.matdragon, 2);
});

test('grantMats caps the bag at 999 and counts only what was really added', () => {
  const { G, save, pl } = lootWorld({ matfire: 998 });
  G.Mega.grantMats(pl, 'fire', 3);
  assert.equal(save.bag.matfire, 999);
  assert.equal(pl.matsFound, 1);
  G.Mega.grantMats(pl, 'fire', 2);                      // ya en 999: no cuenta ni avisa
  assert.equal(pl.matsFound, 1);
});

test('loot works without G.MegaMats (old worlds)', () => {
  const { G, save, pl } = lootWorld();
  delete G.MegaMats;
  G.Mega.onKill(pl, { boss: true, mon: 1, types: ['ghost'] }, () => 0);
  assert.equal(total(save.bag), 0);
});

// ---------------- Task 4: tienda ----------------

function shopWorld(save = {}) {
  const G = world([...DATA, ...MATS]);
  G.TM_PRICE = {};
  G.DB = { save: Object.assign({ coins: 5000, bag: {}, tms: {} }, save), commit() {} };
  return G;
}

test('dailyMats: five distinct valid types, stable within a day', () => {
  const G = shopWorld(), a = G.Shop.dailyMats();
  assert.equal(a.length, 5);
  assert.equal(new Set(a).size, 5);
  assert.ok(a.every(t => G.MegaMats.TYPES.includes(t)));
  assert.deepEqual(G.Shop.dailyMats(), a);
});

test("dailyMats: always includes the partner's main type", () => {
  const G = shopWorld();
  for (const t of G.MegaMats.TYPES) {
    const mon = G.DEX.find(m => m.types[0] === t);
    assert.ok(mon, 'a Pokémon of type ' + t);
    G.DB.save.partner = mon.dex;
    assert.ok(G.Shop.dailyMats().includes(t), t);
  }
});

test('dailyMats: works without a partner', () => {
  const G = shopWorld({ partner: undefined });
  assert.equal(G.Shop.dailyMats().length, 5);
});

test('buy mat: charges 600 and adds one', () => {
  const G = shopWorld({ coins: 1000 }), t = G.Shop.dailyMats()[0];
  assert.deepEqual(G.Shop.buy('mat:' + t), { ok: true });
  assert.equal(G.DB.save.coins, 400);
  assert.equal(G.DB.save.bag['mat' + t], 1);
});

test('buy mat: a type not on sale, an unknown type or too few coins does not charge', () => {
  const G = shopWorld({ coins: 1000 });
  const on = G.Shop.dailyMats(), off = G.MegaMats.TYPES.find(t => !on.includes(t));
  for (const key of ['mat:' + off, 'mat:foo', 'mat:', 'mat' + on[0], 'mat' + off]) {
    const r = G.Shop.buy(key);
    assert.equal(r.ok, false, key);
  }
  assert.equal(G.DB.save.coins, 1000);
  assert.deepEqual(G.DB.save.bag, {});
  G.DB.save.coins = 599;
  assert.equal(G.Shop.buy('mat:' + on[0]).ok, false);
  assert.equal(G.DB.save.coins, 599);
});

test('buy: regular items still work', () => {
  const G = shopWorld({ coins: 2000 });
  assert.deepEqual(G.Shop.buy('mint'), { ok: true });
  assert.equal(G.DB.save.bag.mint, 1);
});

// ---------------- lo que quedó pendiente de la revisión ----------------

test('Shop.give returns how many were really added', () => {
  const G = shopWorld({ bag: { matfire: 998 } });
  assert.equal(G.Shop.give('matfire', 5), 1);
  assert.equal(G.Shop.give('matfire', 5), 0);
  assert.equal(G.Shop.give('matwater', 3), 3);
});

test('buy: with 999 already in the bag nothing is charged (materials and Mint)', () => {
  const G = shopWorld({ coins: 5000, bag: { mint: 999 } });
  const t = G.Shop.dailyMats()[0];
  G.DB.save.bag['mat' + t] = 999;
  assert.equal(G.Shop.buy('mat:' + t).ok, false);
  assert.equal(G.Shop.buy('mint').ok, false);
  assert.equal(G.DB.save.coins, 5000);
});
