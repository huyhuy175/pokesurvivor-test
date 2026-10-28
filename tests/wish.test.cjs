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
  assert.equal(s.typeDraw, 1);
  assert.equal(G.Gacha.pendingType(s), a.type);
  assert.equal(s.bag.wishtype, 1);
  const b = G.Gacha.startTypePick(s);
  assert.deepEqual(b, { ok: true, type: a.type });
  assert.equal(s.bag.wishtype, 1);
  assert.equal(s.typeDraw, 1);
});

test('a pendingType at or below the claimed mark is not pending (no free pick)', () => {
  const G = gachaWorld(), s = withSave(G, { pendingType: 'fire', typeDraw: 1, typeClaim: 1 });
  assert.equal(G.Gacha.pendingType(s), null);
  assert.deepEqual(G.Gacha.claim(s, 'type', G.Gacha.missing(s, 'fire')[0]), { ok: false, reason: 'type' });
  assert.deepEqual(G.Gacha.startTypePick(s), { ok: false, reason: 'item' });
  assert.ok(!('pendingType' in s));
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
  assert.equal(s.typeClaim, s.typeDraw);
  assert.equal(s.typeClaim, 1);
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

/** Math.random fijo a 0 durante fn: 1ª rareza, 1er candidato, sin shiny. */
function withZeroRandom(fn) {
  const orig = Math.random; Math.random = () => 0;
  try { return fn(); } finally { Math.random = orig; }
}
function gen1Setup(missingFilter) {
  const G = gachaWorld(), s = withSave(G, { bag: { wishsure: 1 }, tickets: { t1: 10, t10: 0 } });
  for (const p of G.DEX) if (p.gen === 1 && G.Mons.isBase(p.dex) && !missingFilter(p, G)) s.owned[p.dex] = { at: 1 };
  return { G, s };
}

test('wishsure keeps the x10 4-star guarantee when the first 9 had none', () => {
  const { G, s } = gen1Setup(p => p.rarity === 1 || p.rarity >= 4);
  assert.ok(G.Gacha.missing(s).some(d => G.DEX_BY[d].rarity >= 4 && G.DEX_BY[d].gen === 1));
  const out = withZeroRandom(() => G.Gacha.pull(s, 10, 1, 't1', { sure: true }));
  assert.ok(out.slice(0, 9).every(r => r.rarity < 4));
  assert.ok(out[9].rarity >= 4);
  assert.equal(out[9].isNew, true);
  assert.equal(s.bag.wishsure, undefined);
});

test('wishsure falls back to any missing mon when no 4-star is missing', () => {
  const { G, s } = gen1Setup(p => p.rarity <= 2);
  const out = withZeroRandom(() => G.Gacha.pull(s, 10, 1, 't1', { sure: true }));
  assert.equal(out[9].isNew, true);
  assert.ok(out[9].rarity <= 2);
  assert.equal(s.bag.wishsure, undefined);
});

test('wishsure is not spent when the first 9 pulls complete the banner', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishsure: 1 }, tickets: { t1: 10, t10: 0 } });
  const only = G.Gacha.pool(1, 1)[0].dex;
  ownAllBut(G, s, 1, only);
  const out = withZeroRandom(() => G.Gacha.pull(s, 10, 1, 't1', { sure: true }));
  assert.equal(out.length, 10);
  assert.equal(out[0].dex, only);
  assert.equal(s.bag.wishsure, 1);
  assert.equal(s.tickets.t1, 0);
});

test('startTypePick discards a stale pendingType and draws again', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishtype: 1 } });
  ownAll(G, s);
  const left = G.Gacha.missing(newSave(), 'fire')[0];
  delete s.owned[left];
  s.pendingType = 'dragon'; s.typeDraw = 1;   // ya no queda ningún dragón por conseguir
  assert.equal(G.Gacha.missing(s, 'dragon').length, 0);
  const r = G.Gacha.startTypePick(s);
  assert.equal(r.ok, true);
  assert.ok(G.DEX_BY[left].types.includes(r.type));
  assert.equal(s.bag.wishtype, undefined);
  assert.equal(s.typeClaim, 1);       // el sorteo viejo cuenta como gastado
  assert.equal(s.typeDraw, 2);
  // sin vale: se descarta igualmente y avisa
  const t = withSave(G, {}); ownAll(G, t); t.pendingType = 'dragon'; t.typeDraw = 4; t.typeClaim = 3;
  assert.deepEqual(G.Gacha.startTypePick(t), { ok: false, reason: 'item' });
  assert.equal(t.pendingType, undefined);
  assert.equal(t.typeClaim, 4);
});

test('claim returns invalid for unknown dex, non-base dex and unknown kind', () => {
  const G = gachaWorld(), s = withSave(G, { bag: { wishany: 1 } });
  const evo = G.DEX.find(p => !G.Mons.isBase(p.dex)).dex;
  assert.deepEqual(G.Gacha.claim(s, 'any', 99999), { ok: false, reason: 'invalid' });
  assert.deepEqual(G.Gacha.claim(s, 'any', evo), { ok: false, reason: 'invalid' });
  assert.deepEqual(G.Gacha.claim(s, 'bogus', G.Gacha.missing(s)[0]), { ok: false, reason: 'invalid' });
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
  const a = baseSave({ bag: { wishsure: 3, wishtype: 1500, wishany: 1, bogus: 2 }, pendingType: 'fire', typeDraw: 1 });
  G.DB.sanitize(a);
  assert.deepEqual(a.bag, { wishsure: 3, wishtype: 999, wishany: 1 });
  assert.equal(a.pendingType, 'fire');
  for (const bad of ['laser', 5, null, {}, '']) {
    const b = baseSave({ pendingType: bad, typeDraw: 1 }); G.DB.sanitize(b);
    assert.equal(b.pendingType, undefined);
  }
  const c = baseSave({}); G.DB.sanitize(c);
  assert.ok(!('pendingType' in c));
});

test('merge: the draw with the highest id wins; on a tie, the newer side', () => {
  const G = dbWorld();
  let r = G.DB.merge(baseSave({ updated: 2, pendingType: 'fire', typeDraw: 1 }), baseSave({ updated: 1, pendingType: 'water', typeDraw: 1 }));
  assert.equal(r.pendingType, 'fire');
  r = G.DB.merge(baseSave({ updated: 2, pendingType: 'fire', typeDraw: 1 }), baseSave({ updated: 1, pendingType: 'water', typeDraw: 3, typeClaim: 2 }));
  assert.equal(r.pendingType, 'water');
  assert.equal(r.typeDraw, 3);
  assert.equal(r.typeClaim, 2);
  r = G.DB.merge(baseSave({ updated: 2 }), baseSave({ updated: 1 }));
  assert.ok(!('pendingType' in r));
});

test('merge: older side has an unclaimed draw, newer has none and nothing claimed => draw survives', () => {
  const G = dbWorld();
  let r = G.DB.merge(baseSave({ updated: 2 }), baseSave({ updated: 1, pendingType: 'water', typeDraw: 1 }));
  assert.equal(r.pendingType, 'water');
  assert.equal(r.typeDraw, 1);
  r = G.DB.merge(baseSave({ updated: 1, pendingType: 'ice', typeDraw: 1 }), baseSave({ updated: 2 }));
  assert.equal(r.pendingType, 'ice');
});

test('merge: newer side already claimed, older side still has the draw => no pending draw after merge', () => {
  const G = dbWorld();
  const cloud = baseSave({ updated: 1, pendingType: 'fire', typeDraw: 1, typeClaim: 0 });
  const local = baseSave({ updated: 2, typeDraw: 1, typeClaim: 1 });
  for (const r of [G.DB.merge(local, cloud), G.DB.merge(cloud, local), G.DB.merge(G.DB.merge(local, cloud), cloud)]) {
    assert.ok(!('pendingType' in r));
    assert.equal(r.typeClaim, 1);
  }
  // también si el que reclamó es el más viejo (la nube) y el local reciente aún lo tiene
  const r = G.DB.merge(baseSave({ updated: 5, pendingType: 'fire', typeDraw: 1 }), baseSave({ updated: 1, typeDraw: 1, typeClaim: 1 }));
  assert.ok(!('pendingType' in r));
});

test('sanitize clamps typeDraw/typeClaim and drops a pendingType that is not above the claimed mark', () => {
  const G = dbWorld();
  const a = baseSave({ pendingType: 'fire', typeDraw: 2.7, typeClaim: -4 }); G.DB.sanitize(a);
  assert.equal(a.typeDraw, 2); assert.equal(a.typeClaim, 0); assert.equal(a.pendingType, 'fire');
  const b = baseSave({ pendingType: 'fire', typeDraw: 'x', typeClaim: 1e99 }); G.DB.sanitize(b);
  assert.ok(Number.isInteger(b.typeDraw) && Number.isInteger(b.typeClaim));
  assert.ok(b.typeDraw >= b.typeClaim);
  assert.ok(!('pendingType' in b));
  const c = baseSave({ pendingType: 'fire', typeDraw: 1, typeClaim: 1 }); G.DB.sanitize(c);
  assert.ok(!('pendingType' in c));
});

test('wish ids follow the ledger rule for bag keys', () => {
  const G = dbWorld();
  const a = baseSave({ updated: 2, bag: { wishsure: 2 } });
  const b = baseSave({ updated: 1, bag: { wishsure: 2 } });
  const r = G.DB.merge(a, b);
  assert.equal(r.bag.wishsure, 2);
});

// ---------------- interfaz (comprobaciones sobre el código fuente) ----------------

test('dev.html has the guarantee tick box and the #wish-pick panel (hidden by default)', () => {
  const html = source('dev.html');
  assert.match(html, /id="wish-sure"[^>]*type="checkbox"|type="checkbox"[^>]*id="wish-sure"/);
  assert.match(html, /Use Guarantee Ticket/);
  assert.match(html, /id="wish-pick"[^>]*class="[^"]*hidden/);
});

test('gacha-ui passes { sure } only for the x10 ticket buttons, never for x100', () => {
  const src = source('js/ui/gacha-ui.js');
  assert.match(src, /\$\('pull-10'\)\.onclick = \(\) => pull\(10, 't1'\)/);
  assert.match(src, /\$\('pull-10b'\)\.onclick = \(\) => pull\(10, 't10'\)/);
  assert.match(src, /\$\('pull-100'\)\.onclick = \(\) => pull\(100, 't1'\)/);
  assert.match(src, /\$\('pull-100b'\)\.onclick = \(\) => pull\(100, 't10'\)/);
  assert.match(src, /const sure = n === 10 && wantSure\(\)/);
  assert.match(src, /G\.Gacha\.pull\(G\.DB\.save, n, gen, use, \{ sure \}\)/);
});

test('gacha-ui commits right after startTypePick and after a successful claim', () => {
  const src = source('js/ui/gacha-ui.js');
  assert.match(src, /startTypePick\(s\)[\s\S]{0,300}G\.DB\.commit\(true\)/);
  assert.match(src, /G\.Gacha\.claim\([\s\S]{0,400}G\.DB\.commit\(true\)/);
  assert.match(src, /openPick/);
});

test('bag lists the three wish items with a Use button for wishtype and wishany', () => {
  const src = source('js/ui/shop-ui.js');
  assert.match(src, /WISH_IDS/);
  assert.match(src, /data-wish=/);
  assert.match(src, /G\.GachaUI\.openPick/);
  // "Resume" sólo con un sorteo de verdad pendiente (no con un pendingType ya reclamado)
  assert.doesNotMatch(src, /s\.pendingType/);
  assert.match(src, /G\.Gacha\.pendingType\(s\)/);
  assert.match(source('js/data/shop.js'), /const ORDER = \['mint'\];/);
});
