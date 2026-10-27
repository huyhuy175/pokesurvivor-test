const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function world(...files) {
  const G = {
    U: { TYPE_NAME: { fire: 'Fire', water: 'Water', grass: 'Grass', flying: 'Flying', poison: 'Poison', normal: 'Normal' } },
    Types: { mult: () => 1 },
    Weather: { current: null }
  };
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const fresh = () => ({ hp: 100, maxHp: 100, critChance: 0.1, magnet: 1, xpMul: 1, regenFlat: 0, coinMul: 1, level: 5 });
const MONS = [{ dex: 1, types: ['fire'] }, { dex: 2, types: ['fire', 'flying'] }];

test('power sums cost × value', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  assert.equal(P.power([['critChance', 4]]), P.TEMPLATES.critChance.cost * 4);
  assert.equal(P.power([['critChance', 4], ['dodge', 5]]), P.TEMPLATES.critChance.cost * 4 + P.TEMPLATES.dodge.cost * 5);
});

test('every template builds a non-empty English description for 1-type and 2-type mons', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  for (const [id, t] of Object.entries(P.TEMPLATES)) {
    for (const v of [t.min, Math.round((t.min + t.max) / 2), t.max]) {
      for (const mon of MONS) {
        const d = P.build({ n: 'X', fx: [[id, v]] }, mon).d;
        assert.ok(typeof d === 'string' && d.length > 5, id);
        assert.ok(!/[áéíóúñ¿¡]/.test(d) && !/NaN|undefined/.test(d), id + ': ' + d);
      }
    }
  }
});

test('typeDmg multiplies only matching moves', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  const a = P.build({ n: 'X', fx: [['typeDmg', 20]] }, MONS[0]);
  assert.ok(Math.abs(a.out(fresh(), { type: 'fire' }) - 1.2) < 1e-9);
  assert.equal(a.out(fresh(), { type: 'water' }), 1);
});

test('several effects combine: damage multiplies, start hooks all run', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  const a = P.build({ n: 'X', fx: [['typeDmg', 20], ['lowHpDmg', 50], ['critChance', 5], ['maxHp', 10]] }, MONS[0]);
  const pl = fresh(); pl.hp = 10;
  pl.addMaxHp = n => { pl.maxHp += n; pl.hp += n; };
  a.start(pl);
  assert.ok(Math.abs(pl.critChance - 0.15) < 1e-9);
  assert.equal(pl.maxHp, 110);
  assert.ok(Math.abs(a.out(pl, { type: 'fire' }) - 1.2 * 1.5) < 1e-9);
});

test('conditional state lives on the player object', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  const a = P.build({ n: 'X', fx: [['streakDmg', 30]] }, MONS[0]);
  const p1 = fresh(), p2 = fresh();
  for (let i = 0; i < 5; i++) a.kill(p1, {});
  assert.ok(a.out(p1, { type: 'fire' }) > 1);
  assert.equal(a.out(p2, { type: 'fire' }), 1);
  a.tick(p1, 10);                       // la racha caduca
  assert.equal(a.out(p1, { type: 'fire' }), 1);
});

// ---------------- datos: passives.js ----------------
function data() { return world('js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passives.js'); }

test('all Pokémon have a passive', () => {
  const G = data();
  assert.equal(G.DEX.length, 966);
  for (const p of G.DEX) {
    const e = G.PASSIVES[p.dex];
    assert.ok(e && e.n && e.fx.length >= 1 && e.fx.length <= 3, 'dex ' + p.dex);
  }
});
test('names are unique', () => {
  const G = data(), seen = new Map();
  for (const p of G.DEX) {
    const n = G.PASSIVES[p.dex].n.toLowerCase();
    assert.ok(!seen.has(n), `${n}: dex ${seen.get(n)} and ${p.dex}`);
    seen.set(n, p.dex);
  }
});
test('rarity 4-5 signatures are unique', () => {
  const G = data(), seen = new Map();
  for (const p of G.DEX.filter(p => p.rarity >= 4)) {
    const s = G.PassiveFX.signature(G.PASSIVES[p.dex].fx);
    assert.ok(!seen.has(s), `${s}: dex ${seen.get(s)} and ${p.dex}`);
    seen.set(s, p.dex);
  }
});
test('power is inside the band of its rarity (including unevolved rarity 5)', () => {
  const G = data();
  for (const p of G.DEX) {
    const [lo, hi] = G.PassiveFX.BANDS[p.rarity], w = G.PassiveFX.power(G.PASSIVES[p.dex].fx);
    assert.ok(w >= lo && w <= hi, `dex ${p.dex} rarity ${p.rarity} power ${w} not in ${lo}-${hi}`);
  }
  assert.equal(G.DEX_BY[789].rarity, 5);          // Cosmog: rareza 5 en primera etapa
});
test('every effect id exists and its value is in range', () => {
  const G = data();
  for (const p of G.DEX) for (const [id, v] of G.PASSIVES[p.dex].fx) {
    const t = G.PassiveFX.TEMPLATES[id];
    assert.ok(t, `dex ${p.dex}: ${id}`);
    assert.ok(Number.isInteger(v) && v >= t.min && v <= t.max, `dex ${p.dex}: ${id}=${v}`);
  }
});
test('rarity 1-3 use no conditional templates; rarity 5 may', () => {
  const G = data();
  for (const p of G.DEX.filter(p => p.rarity <= 3)) {
    for (const [id] of G.PASSIVES[p.dex].fx) assert.ok(!G.PassiveFX.TEMPLATES[id].cond, `dex ${p.dex}: ${id}`);
  }
  assert.ok(G.DEX.some(p => p.rarity === 5 && G.PASSIVES[p.dex].fx.some(([id]) => G.PassiveFX.TEMPLATES[id].cond)));
});
test('higher rarity never has a weaker passive', () => {
  const G = data(), top = {};
  for (const p of G.DEX) {
    const w = G.PassiveFX.power(G.PASSIVES[p.dex].fx);
    top[p.rarity] = top[p.rarity] ? { lo: Math.min(top[p.rarity].lo, w), hi: Math.max(top[p.rarity].hi, w) } : { lo: w, hi: w };
  }
  for (let r = 2; r <= 5; r++) assert.ok(top[r].lo > top[r - 1].hi, `rarity ${r} min ${top[r].lo} vs ${r - 1} max ${top[r - 1].hi}`);
});

// ---------------- motor: AbilityFX.of(mon), Mons.abilityOf ----------------
function engine(db) {
  const G = world('js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passives.js', 'js/data/ability-fx.js');
  G.DB = { save: db || {} };
  new Function('G', source('js/systems/mons.js'))(G);
  return G;
}
test('AbilityFX.of(mon) returns the passive built from PASSIVES', () => {
  const G = engine(), mon = G.DEX_BY[6];
  const fx = G.AbilityFX.of(mon);
  assert.equal(fx.d, G.PassiveFX.build(G.PASSIVES[6], mon).d);
  assert.equal(fx.name, G.PASSIVES[6].n);
  assert.ok(!fx.generic);
});
test('AbilityFX.of falls back to the generic passive when the dex has no entry', () => {
  const G = engine();
  assert.equal(G.AbilityFX.of({ dex: 99999, types: ['fire'] }).generic, true);
});
test('old save with pabil and capsule counts is ignored', () => {
  const G = engine({ pabil: { 1: [2, 0] }, shop: { cap: 3, caph: 1 } });
  const a = G.Mons.abilityOf(1);
  assert.equal(a.name, G.PASSIVES[1].n);
  assert.equal(a.slot, 0);
  assert.equal(G.Mons.abilityChoices, undefined);
  assert.equal(G.Mons.setAbility, undefined);
});
test('passive description is English text for every Pokémon', () => {
  const G = engine();
  for (const p of G.DEX) {
    const a = G.Mons.abilityOf(p.dex);
    assert.ok(a.desc.length > 5 && !/[áéíóúñ¿¡]/.test(a.desc) && !/NaN|undefined/.test(a.desc), `dex ${p.dex}: ${a.desc}`);
  }
});
test('new scripts load before ability-fx.js and PassiveFX is required at boot', () => {
  const html = source('dev.html'), at = f => html.indexOf(`src="js/data/${f}"`);
  assert.ok(at('passive-fx.js') > 0 && at('passives.js') > at('passive-fx.js') && at('ability-fx.js') > at('passives.js'));
  assert.match(source('js/main.js'), /const NEED = \[[^\]]*'PassiveFX'/);
});

// ---------------- interfaz y tienda ----------------
test('shop no longer sells capsules and old bag counts are not items', () => {
  const G = { DB: { save: { bag: { mint: 1, cap: 4, caph: 2 } } }, TM_PRICE: { a: 100 }, Mons: { canLearn: () => true, learnable: () => [] } };
  new Function('G', source('js/data/shop.js'))(G);
  assert.deepEqual(G.Shop.ORDER, ['mint']);
  assert.equal(G.Shop.ITEMS.cap, undefined);
  assert.equal(G.Shop.ITEMS.caph, undefined);
  assert.deepEqual(G.Shop.buy('cap'), { ok: false });
});
test('no UI or system file references the removed ability APIs', () => {
  const removed = /abilityChoices\(|Mons\.setAbility|abilityName\(|Mons\.slots\(|AbilityFX\.of\([^)]*,/;
  for (const dir of ['js/ui', 'js/systems', 'js/entities']) {
    for (const f of fs.readdirSync(path.join(__dirname, '..', dir)).filter(f => f.endsWith('.js'))) {
      assert.doesNotMatch(source(`${dir}/${f}`), removed, `${dir}/${f}`);
    }
  }
  assert.doesNotMatch(source('js/game.js'), removed);
});

test('critDmg is never alone: every passive that has it also has critChance', () => {
  const G = data();
  for (const p of G.DEX) {
    const ids = G.PASSIVES[p.dex].fx.map(f => f[0]);
    if (ids.includes('critDmg')) assert.ok(ids.includes('critChance'), `dex ${p.dex} (${p.name}): ${ids}`);
  }
});
test('critDmg text states the real multiplier', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  assert.match(P.build({ n: 'X', fx: [['critDmg', 30]] }, MONS[0]).d, /x1\.8/);
});
