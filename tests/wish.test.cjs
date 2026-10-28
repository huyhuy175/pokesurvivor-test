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
function world(files, extra = {}) {
  const G = Object.assign({ U: U(), Types: { mult: () => 1 }, Weather: { current: null } }, extra);
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const DATA = ['js/data/pokedex.js', 'js/data/passives.js', 'js/data/evolutions.js', 'js/data/mega.js'];
const MATS = ['js/data/mega-mats.js', 'js/data/shop.js'];

function gachaWorld() {
  const G = world([...DATA, 'js/systems/mons.js', 'js/systems/rank.js', ...MATS]);
  G.SPRITE_META = Object.fromEntries(G.DEX.map(p => [p.dex, 1]));
  G.Sprites = { hasShiny: () => false };
  G.U.pick = list => list[Math.floor(Math.random() * list.length)];
  G.DB = { save: null, commit() {} };
  new Function('G', source('js/systems/gacha.js'))(G);
  return G;
}
const newSave = extra => Object.assign({ dupes: {}, owned: {}, shiny: {}, coins: 0, bag: {}, pity: {},
  tickets: { t1: 0, t10: 0 }, stats: {} }, extra);
function withSave(G, extra) { const s = newSave(extra); G.DB.save = s; return s; }
/** Todos los de la generación (base, en banner) menos `keep`. */
function ownAllBut(G, s, gen, keep) {
  for (const p of G.DEX) if (p.gen === gen && G.Mons.isBase(p.dex) && p.dex !== keep) s.owned[p.dex] = { at: 1 };
}
function ownAll(G, s) {
  for (const p of G.DEX) if (G.Mons.isBase(p.dex)) s.owned[p.dex] = { at: 1 };
}

test('wish items exist, are capped to base data and are not in the shop order', () => {
  const G = gachaWorld();
  assert.equal(G.Shop.ITEMS.wishsure.name, 'Guarantee Ticket');
  assert.equal(G.Shop.ITEMS.wishtype.name, 'Type Pick Ticket');
  assert.equal(G.Shop.ITEMS.wishany.name, 'Free Pick Ticket');
  for (const id of ['wishsure', 'wishtype', 'wishany']) {
    assert.ok(!G.Shop.ORDER.includes(id));
    assert.equal(G.Shop.ITEMS[id].price, 0);
    assert.match('b:' + id, /^b:[a-z0-9]{1,12}$/);
  }
  const s = withSave(G);
  assert.equal(G.Shop.give('wishany', 2000), 999);
  assert.equal(G.Shop.buy('wishany').ok, false);
});

test('rollWish boundaries', () => {
  const R = gachaWorld().Gacha.rollWish;
  assert.deepEqual([0, 0.79, 0.80, 0.949, 0.95, 0.999].map(x => R(() => x)),
    ['wishsure', 'wishsure', 'wishtype', 'wishtype', 'wishany', 'wishany']);
});

test('rollWish distribution is about 80/15/5', () => {
  const R = gachaWorld().Gacha.rollWish;
  const c = { wishsure: 0, wishtype: 0, wishany: 0 }, N = 100000;
  for (let i = 0; i < N; i++) c[R()]++;
  assert.ok(Math.abs(c.wishsure / N - 0.80) < 0.01);
  assert.ok(Math.abs(c.wishtype / N - 0.15) < 0.01);
  assert.ok(Math.abs(c.wishany / N - 0.05) < 0.01);
});

test('missing lists base forms not owned, optionally by type', () => {
  const G = gachaWorld(), s = withSave(G);
  const all = G.Gacha.missing(s);
  assert.ok(all.length > 0 && all.every(d => G.Mons.isBase(d)));
  const fire = G.Gacha.missing(s, 'fire');
  assert.ok(fire.length > 0 && fire.length < all.length);
  assert.ok(fire.every(d => G.DEX_BY[d].types.includes('fire')));
  s.owned[fire[0]] = { at: 1 };
  assert.equal(G.Gacha.missing(s, 'fire').length, fire.length - 1);
  assert.ok(!G.Gacha.missing(s).includes(fire[0]));
});

test('wishsure pull on a complete banner returns null and spends nothing', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishsure: 2 }, tickets: { t1: 10, t10: 0 } });
  ownAllBut(G, s, 1, -1);
  assert.equal(G.Gacha.pull(s, 10, 1, 't1', { sure: true }), null);
  assert.deepEqual(s.bag, { wishsure: 2 });
  assert.equal(s.tickets.t1, 10);
});

test('wishsure pull without the item returns null and spends nothing', () => {
  const G = gachaWorld(), s = withSave(G, { tickets: { t1: 10, t10: 0 } });
  assert.equal(G.Gacha.pull(s, 10, 1, 't1', { sure: true }), null);
  assert.equal(s.tickets.t1, 10);
});

test('wishsure: last result is a not-owned mon and one ticket is spent', () => {
  for (let k = 0; k < 20; k++) {
    const G = gachaWorld(), s = withSave(G, { bag: { wishsure: 2 }, tickets: { t1: 10, t10: 0 } });
    // Quedan >10 sin tener: las 9 primeras tiradas no pueden agotarlos
    const base = G.DEX.filter(p => p.gen === 1 && G.Mons.isBase(p.dex));
    for (const p of base.slice(12)) s.owned[p.dex] = { at: 1 };
    const before = new Set(G.Gacha.missing(s));
    const out = G.Gacha.pull(s, 10, 1, 't1', { sure: true });
    assert.equal(out.length, 10);
    assert.equal(out[9].isNew, true);
    assert.ok(before.has(out[9].dex));
    assert.equal(s.bag.wishsure, 1);
  }
});

test('pull without opts is unchanged and does not touch wishsure', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishsure: 1 }, tickets: { t1: 10, t10: 0 } });
  assert.equal(G.Gacha.pull(s, 10, 1).length, 10);
  assert.equal(s.bag.wishsure, 1);
});

test('startTypePick stores pendingType, is idempotent and spends once', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishtype: 2 } });
  const a = G.Gacha.startTypePick(s);
  assert.equal(a.ok, true);
  assert.ok(TYPES.includes(a.type));
  assert.equal(s.pendingType, a.type);
  assert.equal(s.bag.wishtype, 1);
  const b = G.Gacha.startTypePick(s);
  assert.deepEqual(b, { ok: true, type: a.type });
  assert.equal(s.bag.wishtype, 1);
});

test('startTypePick without ticket fails with item', () => {
  const G = gachaWorld(), s = withSave(G);
  assert.deepEqual(G.Gacha.startTypePick(s), { ok: false, reason: 'item' });
  assert.equal(s.pendingType, undefined);
});

test('startTypePick with nothing left returns none and spends nothing', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishtype: 1 } });
  ownAll(G, s);
  assert.deepEqual(G.Gacha.startTypePick(s), { ok: false, reason: 'none' });
  assert.equal(s.bag.wishtype, 1);
  assert.equal(s.pendingType, undefined);
});

test('startTypePick only picks types that still have a missing mon', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishtype: 1 } });
  ownAll(G, s);
  const left = G.Gacha.missing(newSave(), 'fire')[0];
  delete s.owned[left];
  const types = G.DEX_BY[left].types;
  const r = G.Gacha.startTypePick(s);
  assert.equal(r.ok, true);
  assert.ok(types.includes(r.type));
});

test('claim type: wrong type, owned, ok', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishtype: 1 }, pity: { 1: 5 } });
  const r = G.Gacha.startTypePick(s);
  const inType = G.Gacha.missing(s, r.type), other = G.Gacha.missing(s).find(d => !G.DEX_BY[d].types.includes(r.type));
  assert.deepEqual(G.Gacha.claim(s, 'type', other), { ok: false, reason: 'type' });
  s.owned[inType[0]] = { at: 1 };
  assert.deepEqual(G.Gacha.claim(s, 'type', inType[0]), { ok: false, reason: 'owned' });
  assert.equal(s.pendingType, r.type);
  assert.equal(G.Gacha.claim(s, 'type', inType[1]).ok, true);
  assert.equal(s.owned[inType[1]].from, 'wish');
  assert.equal(s.pendingType, undefined);
  assert.deepEqual(s.pity, { 1: 5 });
});

test('claim type without pendingType fails with type', () => {
  const G = gachaWorld(), s = withSave(G);
  assert.deepEqual(G.Gacha.claim(s, 'type', G.Gacha.missing(s)[0]), { ok: false, reason: 'type' });
});

test('claim any grants the mon, spends wishany and keeps pity', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishany: 1 }, pity: { 2: 33 } });
  const dex = G.Gacha.missing(s)[0];
  assert.equal(G.Gacha.claim(s, 'any', dex).ok, true);
  assert.equal(s.owned[dex].from, 'wish');
  assert.ok(s.owned[dex].at > 0);
  assert.equal(s.bag.wishany, undefined);
  assert.deepEqual(s.pity, { 2: 33 });
  assert.deepEqual(G.Gacha.claim(s, 'any', G.Gacha.missing(s)[0]), { ok: false, reason: 'item' });
});

test('claim any on an owned mon does not spend the item', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishany: 1 } });
  const dex = G.Gacha.missing(s)[0];
  s.owned[dex] = { at: 1 };
  assert.deepEqual(G.Gacha.claim(s, 'any', dex), { ok: false, reason: 'owned' });
  assert.equal(s.bag.wishany, 1);
});

function dbWorld() {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world([...DATA, ...MATS]);
  new Function('G', source('js/core/db.js'))(G);
  return G;
}
const baseSave = extra => Object.assign({
  v: 3, name: 'x', created: 1, updated: 1, coins: 0, tickets: { t1: 0, t10: 0 }, shards: 0,
  owned: {}, shiny: {}, bag: {}, tms: {}, upgrades: {}, pupg: {}, stats: {}, missions: {},
  led: { base: { c: [0, 0], t1: [0, 0], t10: [0, 0], sh: [0, 0] } }
}, extra);

test('sanitize keeps wish ids in the bag and valid pendingType, drops invalid', () => {
  const G = dbWorld();
  const a = baseSave({ bag: { wishsure: 3, wishtype: 1500, wishany: 1, bogus: 2 }, pendingType: 'fire' });
  G.DB.sanitize(a);
  assert.deepEqual(a.bag, { wishsure: 3, wishtype: 999, wishany: 1 });
  assert.equal(a.pendingType, 'fire');
  for (const bad of ['laser', 5, null, {}, '']) {
    const b = baseSave({ pendingType: bad }); G.DB.sanitize(b);
    assert.equal(b.pendingType, undefined);
  }
  const c = baseSave({}); G.DB.sanitize(c);
  assert.ok(!('pendingType' in c));
});

test('wish ids follow the ledger rule for bag keys', () => {
  const G = dbWorld();
  const a = baseSave({ updated: 2, bag: { wishsure: 2 } });
  const b = baseSave({ updated: 1, bag: { wishsure: 2 } });
  const r = G.DB.merge(a, b);
  assert.equal(r.bag.wishsure, 2);
});
