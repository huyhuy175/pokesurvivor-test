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

function rankWorld() {
  const G = world([...DATA, 'js/systems/mons.js', 'js/systems/rank.js']);
  G.DB = { save: { dupes: {} }, commit() {} };
  return G;
}
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

test('starsFor follows the thresholds', () => {
  const R = rankWorld().Rank;
  assert.deepEqual([0, 1, 5, 6, 7, 15, 16].map(R.starsFor), [0, 1, 5, 5, 6, 10, 10]);
  assert.equal(R.starsFor(8), 6); assert.equal(R.starsFor(9), 7);
});

test('root maps Mega and evolutions to the base form', () => {
  const G = rankWorld(), R = G.Rank;
  const mega = G.MEGA_DEX[0], baseOfMega = G.MEGA_FROM[mega.dex];
  assert.equal(R.root(mega.dex), G.Mons.lineage(mega.dex)[0]);
  assert.equal(R.root(baseOfMega), G.Mons.lineage(baseOfMega)[0] || baseOfMega);
  assert.equal(R.root(6), 4);
  assert.equal(R.root(4), 4);
  assert.equal(R.root(99999), null);
});

test('add accumulates, reports new stars and caps at 15', () => {
  const R = rankWorld().Rank;
  const stars = [];
  for (let i = 1; i <= 15; i++) { const r = R.add(6); assert.equal(r.over, false); stars.push(r.star); }
  assert.deepEqual(stars, [1, 2, 3, 4, 5, 0, 6, 0, 7, 0, 8, 0, 9, 0, 10]);
  assert.equal(R.dupesOf(4), 15);
  assert.equal(R.starsOf(6), 10);
  const r = R.add(6);
  assert.deepEqual({ star: r.star, over: r.over }, { star: 0, over: true });
  assert.equal(R.dupesOf(4), 15);
});

test('add on unknown dex does nothing harmful', () => {
  const R = rankWorld().Rank;
  assert.equal(R.add(99999).over, false);
  assert.equal(R.dupesOf(99999), 0);
});

test('bonus matches the table', () => {
  const G = rankWorld(), R = G.Rank;
  const at = n => { G.DB.save.dupes = { 4: n }; return R.bonus(4); };
  let b = at(0);
  assert.deepEqual(b, { dmgMul: 1, hpMul: 1, commonMul: 1, uniqueMul: 1, uniqueOn: false });
  b = at(3);  // 3 stars
  assert.ok(Math.abs(b.hpMul - 1.04) < 1e-9); assert.equal(b.uniqueOn, true); assert.equal(b.commonMul, 1); assert.equal(b.uniqueMul, 1);
  b = at(7);  // 6 stars
  assert.equal(b.commonMul, 1.2); assert.equal(b.uniqueMul, 1);
  assert.ok(Math.abs(b.dmgMul - 1.09) < 1e-9);
  b = at(11); // 8 stars
  assert.equal(b.commonMul, 1.2); assert.equal(b.uniqueMul, 1.25);
  b = at(15); // 10 stars
  assert.equal(b.commonMul, 1.5); assert.equal(b.uniqueMul, 1.5);
  assert.ok(Math.abs(b.hpMul - 1.15) < 0.001); assert.ok(Math.abs(b.dmgMul - 1.15) < 0.001);
});

test('apply leaves perks alone at 0 stars and scales at higher ones', () => {
  const G = rankWorld(), R = G.Rank;
  const mon = { dex: 4, hp: 100 };
  assert.deepEqual(R.apply({ atkMul: 1, hp: 0 }, mon), { atkMul: 1, hp: 0 });
  G.DB.save.dupes = { 4: 15 };
  const p = R.apply({ atkMul: 2, hp: 10 }, mon);
  assert.ok(Math.abs(p.atkMul - 2.3) < 0.002);
  assert.equal(p.hp, Math.round(110 * 1.15 - 100));
});

test('old save without dupes counts as 0 stars', () => {
  const G = rankWorld();
  G.DB.save = {};
  assert.equal(G.Rank.starsOf(4), 0);
  assert.equal(G.Rank.bonus(4).hpMul, 1);
});

test('sanitize drops unknown dex and clamps dupes', () => {
  const G = dbWorld();
  const s = baseSave({ dupes: { 4: 99, 6: -3, 7: 'x', 99999: 5, 1: 2.7 } });
  G.DB.sanitize(s);
  assert.equal(s.dupes[4], 15);
  assert.equal(s.dupes[6], undefined);
  assert.equal(s.dupes[7], undefined);
  assert.equal(s.dupes[99999], undefined);
  assert.equal(s.dupes[1], 2);
  const t = baseSave({}); G.DB.sanitize(t);
  assert.deepEqual(t.dupes, {});
});

test('merge takes the max of dupes per dex', () => {
  const G = dbWorld();
  const a = baseSave({ updated: 2, dupes: { 4: 3, 6: 9 } });
  const b = baseSave({ updated: 1, dupes: { 4: 7, 1: 2 } });
  const r = G.DB.merge(a, b);
  assert.deepEqual(r.dupes, { 4: 7, 6: 9, 1: 2 });
});

function gachaWorld() {
  const G = rankWorld();
  G.SPRITE_META = Object.fromEntries(G.DEX.map(p => [p.dex, 1]));
  G.Sprites = { hasShiny: () => true };
  G.U.pick = list => list[0];
  G.DB.save = { dupes: {}, owned: {}, shiny: {}, coins: 0, tickets: { t1: 0, t10: 0 }, stats: {} };
  new Function('G', source('js/systems/gacha.js'))(G);
  // Un único candidato por tirada: fijamos el pool a un Pokémon
  return G;
}
function pullOne(G, dex, shiny) {
  const mon = G.DEX.find(p => p.dex === dex);
  G.DEX.splice(0, G.DEX.length, mon);
  G.Sprites.hasShiny = () => !!shiny;
  if (shiny) G.Gacha.debugForceShiny(1);
  G.DB.save.tickets.t1 = 10;
  const gen = mon.gen, save = G.DB.save;
  // pull(10) hace 10 tiradas; usamos las 10 como 10 repetidos
  return { out: G.Gacha.pull(save, 10, gen), mon };
}

test('gacha: new mon has star 0 and no dupes; duplicates raise Rank without coins', () => {
  const G = gachaWorld();
  const { out, mon } = pullOne(G, 4, false);
  assert.equal(out[0].isNew, true); assert.equal(out[0].star, 0); assert.equal(out[0].refund, 0);
  assert.equal(G.Rank.dupesOf(4), 9);
  assert.deepEqual(out.slice(1).map(r => r.star), [1, 2, 3, 4, 5, 0, 6, 0, 7]);
  assert.ok(out.every(r => r.refund === 0));
  assert.equal(G.DB.save.coins, 0);
});

test('gacha: the 16th duplicate refunds coins and keeps dupes at 15', () => {
  const G = gachaWorld();
  G.DB.save.dupes = { 4: 14 };
  const { out, mon } = pullOne(G, 4, false);
  assert.equal(G.Rank.dupesOf(4), 15);
  const refunds = out.filter(r => r.refund > 0);
  assert.ok(refunds.length >= 1);
  assert.ok(refunds.every(r => r.refund === G.Gacha.REFUND[r.rarity] && r.star === 0));
  assert.equal(G.DB.save.coins, refunds.length * G.Gacha.REFUND[mon.rarity]);
});

test('gacha: with the shiny already owned the pull falls back to a normal duplicate', () => {
  const G = gachaWorld();
  G.DB.save.owned[4] = { at: 1 }; G.DB.save.shiny[4] = { at: 1 };
  const mon = G.DEX.find(p => p.dex === 4);
  G.DEX.splice(0, G.DEX.length, mon);
  G.Gacha.debugForceShiny(1);
  G.DB.save.tickets.t1 = 10;
  const out = G.Gacha.pull(G.DB.save, 10, mon.gen);
  assert.equal(out[0].shiny, false); assert.equal(out[0].star, 1); assert.equal(out[0].refund, 0);
  assert.equal(G.Rank.dupesOf(4), 10);
});

// ---- Task 3: Rank en la partida y en la pantalla ----
test('game.js applies Rank right after Prestige', () => {
  assert.match(source('js/game.js'), /G\.Rank\.apply\(\s*G\.Prestige\.apply\(/);
});

test('Prestige.apply then Rank.apply at 10 stars multiplies atkMul by about 1.15', () => {
  const G = world([...DATA, 'js/systems/mons.js', 'js/systems/rank.js']);
  G.DB = { save: { dupes: { 1: 15 } } };
  const mon = G.DEX_BY[1];
  const perks = G.Rank.apply({ atkMul: 1.2, hp: 0 }, mon);
  assert.ok(Math.abs(perks.atkMul / 1.2 - 1.15) < 0.001);
});

test('prestige-ui uses the diamond glyph, not the star', () => {
  const src = source('js/ui/prestige-ui.js');
  assert.ok(!src.includes('★'));
  assert.ok(src.includes('♦'));
  assert.match(src, /\+1 diamond/);
});

test('UI.rankStars: 0 stars all off, 10 stars five red', () => {
  const m = source('js/ui/ui.js').match(/function rankStars[\s\S]*?\r?\n  }\r?\n/);
  assert.ok(m, 'rankStars missing');
  const rankStars = new Function(m[0] + '; return rankStars;')();
  const count = (h, c) => (h.match(new RegExp(c, 'g')) || []).length;
  const h0 = rankStars(0);
  assert.equal(count(h0, '#555'), 5); assert.equal(count(h0, '#ffd23f'), 0);
  const h7 = rankStars(7);
  assert.equal(count(h7, '#ff4d4d'), 2); assert.equal(count(h7, '#ffd23f'), 3);
  const h10 = rankStars(10);
  assert.equal(count(h10, '#ff4d4d'), 5); assert.equal(count(h10, '#ffd23f'), 0); assert.equal(count(h10, '#555'), 0);
  assert.match(source('js/ui/ui.js'), /return \{[^}]*rankStars/);
});

test('gacha card does not show coins for a duplicate without refund', () => {
  assert.match(source('js/ui/gacha-ui.js'), /r\.refund > 0/);
});

test('Rank.progress: stars, dupes, next threshold and how many are missing', () => {
  const G = rankWorld(), R = G.Rank;
  assert.deepEqual(R.progress(4), { stars: 0, dupes: 0, next: 1, missing: 1 });
  G.DB.save.dupes[4] = 2;
  assert.deepEqual(R.progress(6), { stars: 2, dupes: 2, next: 3, missing: 1 });   // evolución: cuenta la base
  G.DB.save.dupes[4] = 5;
  assert.deepEqual(R.progress(4), { stars: 5, dupes: 5, next: 7, missing: 2 });
  G.DB.save.dupes[4] = 14;
  assert.deepEqual(R.progress(4), { stars: 9, dupes: 14, next: 15, missing: 1 });
  G.DB.save.dupes[4] = 15;
  assert.deepEqual(R.progress(4), { stars: 10, dupes: 15, next: null, missing: 0 });
  assert.deepEqual(R.progress(99999), { stars: 0, dupes: 0, next: 1, missing: 1 });
});

/** La ficha de la Pokédex (menu.js) con lo mínimo de la interfaz. */
function dexWorld(dupes) {
  const G = world(['js/data/pokedex.js', 'js/data/evolutions.js', 'js/data/mega.js', 'js/data/passive-fx.js',
    'js/data/passive-unique-fx.js', 'js/data/passives-common.js', 'js/data/passives.js', 'js/data/ability-fx.js']);
  G.DB = { save: { dupes: dupes || {} }, commit() {} };
  new Function('G', source('js/systems/mons.js'))(G);
  new Function('G', source('js/systems/rank.js'))(G);
  const m = source('js/ui/ui.js').match(/function rankStars[\s\S]*?\r?\n  }\r?\n/);
  G.UI = { $: () => null, rankStars: new Function(m[0] + '; return rankStars;')() };
  new Function('G', source('js/ui/menu.js'))(G);
  return G;
}

test('Pokédex detail: Rank stars with the next-star progress', () => {
  let G = dexWorld({ 4: 2 });
  let h = G.MenuUI.rankHtml(5);
  assert.match(h, /1 more duplicate to the next star/);
  assert.equal((h.match(/#ffd23f/g) || []).length, 2);
  G = dexWorld({ 4: 5 });
  assert.match(G.MenuUI.rankHtml(4), /2 more duplicates to the next star/);
  G = dexWorld({ 4: 15 });
  h = G.MenuUI.rankHtml(4);
  assert.match(h, /Max Rank/);
  assert.doesNotMatch(h, /to the next star/);
});

test('Pokédex detail: the unique passive is shown greyed with "Unlocks at 3★" below 3 stars', () => {
  let G = dexWorld({ 4: 2 });
  const u = G.Mons.abilityOf(4).unique;
  let h = G.MenuUI.rankHtml(4);
  assert.ok(h.includes(u.name) && h.includes(u.desc));
  assert.match(h, /mx-locked/);
  assert.match(h, /Unlocks at 3★/);
  G = dexWorld({ 4: 3 });
  h = G.MenuUI.rankHtml(4);
  assert.ok(h.includes(u.name) && h.includes(G.Mons.abilityOf(4).unique.desc));
  assert.doesNotMatch(h, /mx-locked|Unlocks at 3★/);
});

test('Pokédex detail uses rankHtml and the locked style exists', () => {
  assert.match(source('js/ui/menu.js'), /\$\{rankHtml\(dex\)\}/);
  assert.match(source('css/style.css'), /\.mx-locked\s*\{[^}]*opacity/);
});
