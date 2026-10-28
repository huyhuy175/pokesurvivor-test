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

// ---------------- datos: passives.js (unique por línea evolutiva) ----------------
const DATA = ['js/data/pokedex.js', 'js/data/evolutions.js', 'js/data/mega.js', 'js/data/passive-fx.js',
  'js/data/passive-unique-fx.js', 'js/data/passives-common.js', 'js/data/passives.js'];
function data() {
  const G = world(...DATA);
  new Function('G', source('js/systems/mons.js'))(G);
  return G;
}
/** Forma base de cada línea → sus miembros (como G.Rank.root). */
function lines(G) {
  const out = new Map();
  for (const p of G.DEX) {
    const l = G.Mons.lineage(p.dex), r = l.length ? l[0] : p.dex;
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(p.dex);
  }
  return out;
}
const TIER_OF = p => (p.leg || p.rarity >= 5 ? 'supreme' : p.rarity === 4 ? 'adv' : 'basic');
const tierBudget = (G, tier) => {
  const ids = G.UniqueFX.TIERS[tier], T = G.UniqueFX.TEMPLATES;
  return ids.reduce((s, id) => s + T[id].cost * T[id].max, 0) / ids.length;
};
const tplOf = (G, id) => G.PassiveFX.TEMPLATES[id] || G.UniqueFX.TEMPLATES[id];

test('every evolution line root has a unique passive, nothing else does, and G.PASSIVES is gone', () => {
  const G = data(), roots = [...lines(G).keys()].sort((a, b) => a - b);
  assert.equal(G.DEX.length, 966);
  assert.equal(G.PASSIVES, undefined);
  assert.deepEqual(Object.keys(G.PASSIVES_UNIQUE).map(Number).sort((a, b) => a - b), roots);
  for (const r of roots) {
    const e = G.PASSIVES_UNIQUE[r];
    assert.ok(e && typeof e.n === 'string' && e.n.length > 2, 'root ' + r);
    assert.ok(['basic', 'adv', 'supreme'].includes(e.tier), 'root ' + r);
    assert.ok(e.fx.length >= 1 && e.fx.length <= 3, 'root ' + r);
  }
  assert.ok(roots.length > 400 && roots.length < 600, roots.length + ' lines');
});

test('unique names are English and unique across unique and common passives', () => {
  const G = data(), seen = new Map();
  for (const [t, p] of Object.entries(G.PASSIVES_COMMON)) seen.set(p.n.toLowerCase(), 'common ' + t);
  for (const [r, e] of Object.entries(G.PASSIVES_UNIQUE)) {
    assert.match(e.n, /^[A-Z][A-Za-z'-]*( [A-Za-z'-]+)*$/, `root ${r}: ${e.n}`);
    const n = e.n.toLowerCase();
    assert.ok(!seen.has(n), `${e.n}: ${seen.get(n)} and root ${r}`);
    seen.set(n, 'root ' + r);
  }
});

test('tier follows the root rarity: 1-3 basic, 4 adv, 5 / legendary / mythical supreme', () => {
  const G = data();
  for (const [r, e] of Object.entries(G.PASSIVES_UNIQUE)) assert.equal(e.tier, TIER_OF(G.DEX_BY[r]), 'root ' + r);
  const leg = G.DEX.filter(p => p.leg && !G.Mons.lineage(p.dex).length);
  assert.ok(leg.length >= 70);
  for (const p of leg) assert.equal(G.PASSIVES_UNIQUE[p.dex].tier, 'supreme', p.name);
  for (const p of G.DEX.filter(p => p.leg)) {           // Solgaleo, Melmetal…: la de su línea, también supreme
    const l = G.Mons.lineage(p.dex);
    assert.equal(G.PASSIVES_UNIQUE[l.length ? l[0] : p.dex].tier, 'supreme', p.name);
  }
});

test('unique signatures are unique within each tier', () => {
  const G = data(), seen = { basic: new Map(), adv: new Map(), supreme: new Map() };
  for (const [r, e] of Object.entries(G.PASSIVES_UNIQUE)) {
    const s = G.PassiveFX.signature(e.fx);
    assert.ok(!seen[e.tier].has(s), `${e.tier} ${s}: root ${seen[e.tier].get(s)} and ${r}`);
    seen[e.tier].set(s, r);
  }
});

// Antes: «power is inside the band of its rarity» (BANDS por rareza de cada dex). Ahora el
// presupuesto es casi plano: el medio de su bandeja (cost × max de sus plantillas) ±15 %.
test('unique power stays within ±15% of its tier mean budget', () => {
  const G = data();
  for (const [r, e] of Object.entries(G.PASSIVES_UNIQUE)) {
    const B = tierBudget(G, e.tier), w = G.PassiveFX.power(e.fx);
    assert.ok(w >= B * 0.85 - 1e-9 && w <= B * 1.15 + 1e-9, `root ${r} ${e.tier}: power ${w} not in ${B * 0.85}-${B * 1.15}`);
  }
});

// Antes: «higher rarity never has a weaker passive» (bandas sin solaparse). Ahora la rareza
// cambia la clase de mecánica, no el número: cada bandeja tiene más presupuesto medio que la
// anterior, y dentro de una bandeja las líneas más flojas (BST final más bajo) reciben más.
test('higher tiers have a larger mean budget and weaker lines get more within a tier', () => {
  const G = data(), L = lines(G), by = { basic: [], adv: [], supreme: [] };
  for (const [r, e] of Object.entries(G.PASSIVES_UNIQUE)) {
    by[e.tier].push({ bst: Math.max(...L.get(+r).map(d => G.DEX_BY[d].bst)), w: G.PassiveFX.power(e.fx) });
  }
  const mean = a => a.reduce((s, x) => s + x.w, 0) / a.length;
  assert.ok(mean(by.basic) < mean(by.adv) && mean(by.adv) < mean(by.supreme),
    `means ${mean(by.basic)} / ${mean(by.adv)} / ${mean(by.supreme)}`);
  for (const [tier, a] of Object.entries(by)) {
    a.sort((x, y) => x.bst - y.bst);
    const weak = a.slice(0, Math.floor(a.length / 3)), strong = a.slice(-Math.floor(a.length / 3));
    assert.ok(mean(weak) > mean(strong), `${tier}: weak ${mean(weak)} vs strong ${mean(strong)}`);
  }
});

// Antes: «rarity 1-3 use no conditional templates; rarity 5 may». Ahora la regla es de bandeja.
test('every effect exists with an integer value in range, from its own tier or a lower one', () => {
  const G = data(), RANK = { basic: 0, adv: 1, supreme: 2 };
  for (const [r, e] of Object.entries(G.PASSIVES_UNIQUE)) {
    const ids = e.fx.map(f => f[0]);
    assert.equal(new Set(ids).size, ids.length, `root ${r}: repeated effect`);
    for (const [id, v] of e.fx) {
      const t = tplOf(G, id);
      assert.ok(t, `root ${r}: ${id}`);
      assert.ok(Number.isInteger(v) && v >= t.min && v <= t.max, `root ${r}: ${id}=${v}`);
      if (t.tier) assert.ok(RANK[t.tier] <= RANK[e.tier], `root ${r} (${e.tier}): ${id} is ${t.tier}`);
    }
    assert.ok(ids.some(id => tplOf(G, id).tier === e.tier), `root ${r}: no ${e.tier} effect`);
  }
});

test('critDmg is never alone: every common or unique that has it also has critChance', () => {
  const G = data();
  for (const [k, p] of [...Object.entries(G.PASSIVES_COMMON), ...Object.entries(G.PASSIVES_UNIQUE)]) {
    const ids = p.fx.map(f => f[0]);
    if (ids.includes('critDmg')) assert.ok(ids.includes('critChance'), `${k}: ${ids}`);
  }
});

test('hand designs cover every starter, legendary and mythical line', () => {
  const G = data(), design = JSON.parse(source('tools/passive_design.json'));
  const root = d => { const l = G.Mons.lineage(d); return l.length ? l[0] : d; };
  for (const p of G.DEX.filter(p => p.leg || p.starter)) {
    const r = root(p.dex), d = design[r];
    assert.ok(d, `${p.name}: line ${r} has no hand design`);
    assert.equal(G.PASSIVES_UNIQUE[r].n, d[0], p.name);
    assert.deepEqual(G.PASSIVES_UNIQUE[r].fx.map(f => f[0]), d.slice(1), p.name);
  }
  for (const k of Object.keys(design)) assert.ok(G.PASSIVES_UNIQUE[k], 'design for a non-root dex ' + k);
});

// ---------------- motor: AbilityFX.of(mon), Mons.abilityOf ----------------
function engine(db) {
  const G = world(...DATA, 'js/data/ability-fx.js');
  G.DB = { save: db || {} };
  new Function('G', source('js/systems/mons.js'))(G);
  new Function('G', source('js/systems/rank.js'))(G);
  return G;
}
const dText = (G, p, mon) => G.PassiveFX.build(p, mon).d;
const COMMON = (G, mon, k) => ({ n: 'X', fx: G.PassiveFX.scale(G.PASSIVES_COMMON[mon.types[0]].fx, k) });

test('AbilityFX.of at 0 stars has only the common passive of its primary type', () => {
  const G = engine(), mon = G.DEX_BY[4], u = G.PASSIVES_UNIQUE[4];
  const fx = G.AbilityFX.of(mon);
  assert.equal(fx.d, dText(G, COMMON(G, mon, 1), mon));
  assert.equal(fx.name, G.PASSIVES_COMMON.fire.n);
  assert.ok(!fx.d.includes(dText(G, u, mon)));
  assert.ok(!fx.generic);
});

test('AbilityFX.of at 3 stars adds the unique: both texts and the unique name', () => {
  const G = engine({ dupes: { 4: 3 } }), mon = G.DEX_BY[4], u = G.PASSIVES_UNIQUE[4];
  const fx = G.AbilityFX.of(mon);
  assert.equal(fx.name, u.n);
  assert.equal(fx.d, dText(G, COMMON(G, mon, 1), mon) + ' ' + dText(G, u, mon));
});

test('AbilityFX.of at 6 stars scales the common x1.2; at 10 stars both x1.5', () => {
  const G0 = engine(), G6 = engine({ dupes: { 4: 7 } }), G10 = engine({ dupes: { 4: 15 } }), mon = G0.DEX_BY[4];
  const u = G0.PASSIVES_UNIQUE[4];
  const c0 = dText(G0, COMMON(G0, mon, 1), mon), c6 = dText(G6, COMMON(G6, mon, 1.2), mon);
  assert.notEqual(c6, c0);
  assert.equal(G6.AbilityFX.of(mon).d, c6 + ' ' + dText(G6, u, mon));
  const u10 = { n: u.n, fx: G10.PassiveFX.scale(u.fx, 1.5) };
  assert.equal(G10.AbilityFX.of(mon).d, dText(G10, COMMON(G10, mon, 1.5), mon) + ' ' + dText(G10, u10, mon));
});

test('evolving keeps the unique name while the common grows by stage (x1.0 / x1.3 / x1.6)', () => {
  const G = engine({ dupes: { 4: 3 } }), u = G.PASSIVES_UNIQUE[4];
  const texts = [4, 5, 6].map((dex, i) => {
    const mon = G.DEX_BY[dex], fx = G.AbilityFX.of(mon);
    assert.equal(fx.name, u.n, 'dex ' + dex);
    assert.equal(fx.d, dText(G, COMMON(G, mon, [1, 1.3, 1.6][i]), mon) + ' ' + dText(G, u, mon), 'dex ' + dex);
    return fx.d;
  });
  assert.equal(new Set(texts).size, 3);
  assert.deepEqual(G.AbilityFX.STAGE_MUL, [1, 1.3, 1.6]);
});

test('AbilityFX.of options override the Rank and stage defaults', () => {
  const G = engine(), mon = G.DEX_BY[4], u = G.PASSIVES_UNIQUE[4];
  const fx = G.AbilityFX.of(mon, { stage: 3, uniqueOn: true, uniqueMul: 1.25, commonMul: 1.2 });
  const uu = { n: u.n, fx: G.PassiveFX.scale(u.fx, 1.25) };
  assert.equal(fx.d, dText(G, COMMON(G, mon, 1.6 * 1.2), mon) + ' ' + dText(G, uu, mon));
  assert.equal(fx.name, u.n);
});

test('the merged effect runs the hooks of both passives', () => {
  const G = engine(), mon = { dex: 4, types: ['fire'] };
  const fx = G.AbilityFX.of(mon, { uniqueOn: true });
  const c = G.PassiveFX.build(G.PASSIVES_COMMON.fire, mon), u = G.PassiveFX.build(G.PASSIVES_UNIQUE[4], mon);
  const pl = fresh(), m = { type: 'fire', kind: 'projectile' }, e = { hp: 100, maxHp: 100 };
  const want = (c.out ? c.out(fresh(), m, e) : 1) * (u.out ? u.out(fresh(), m, e) : 1);
  assert.ok(Math.abs((fx.out ? fx.out(pl, m, e) : 1) - want) < 1e-9);
});

test('a Mega gets the unique of its line root and the top stage factor', () => {
  const G = engine({ dupes: { 4: 3 } }), mega = G.DEX_BY[10001];
  assert.equal(G.MEGA_FROM[10001], 6);
  assert.equal(G.PASSIVES_UNIQUE[10001], undefined);
  const fx = G.AbilityFX.of(mega);
  assert.equal(fx.name, G.PASSIVES_UNIQUE[4].n);
  assert.ok(fx.d.startsWith(dText(G, COMMON(G, mega, 1.6), mega)));
});

test('AbilityFX.of falls back to the generic passive when the dex has no entry', () => {
  const G = engine();
  assert.equal(G.AbilityFX.of({ dex: 99999, types: ['fire'] }).generic, true);    // dex desconocido
  const bare = world('js/data/passive-fx.js', 'js/data/ability-fx.js');
  assert.equal(bare.AbilityFX.of({ dex: 99999, types: ['fire'] }).generic, true);
});

test('AbilityFX.of without Rank or Mons loaded counts as 0 stars and the first stage', () => {
  const G = world(...DATA, 'js/data/ability-fx.js'), mon = G.DEX_BY[6];
  const fx = G.AbilityFX.of(mon);
  assert.equal(fx.name, G.PASSIVES_COMMON.fire.n);
  assert.equal(fx.d, dText(G, COMMON(G, mon, 1), mon));
});

test('old save with pabil and capsule counts is ignored', () => {
  const G = engine({ pabil: { 1: [2, 0] }, shop: { cap: 3, caph: 1 } });
  const a = G.Mons.abilityOf(1);
  assert.equal(a.name, G.PASSIVES_COMMON.grass.n);
  assert.equal(a.slot, 0);
  assert.equal(G.Mons.abilityChoices, undefined);
  assert.equal(G.Mons.setAbility, undefined);
});

test('abilityOf shows the unique, locked below 3 stars', () => {
  const G = engine({ dupes: { 1: 2 } }), u = G.PASSIVES_UNIQUE[1];
  const a = G.Mons.abilityOf(2);
  assert.deepEqual(Object.keys(a).sort(), ['desc', 'id', 'name', 'slot', 'unique']);
  assert.equal(a.id, '2');
  assert.equal(a.unique.name, u.n);
  assert.equal(a.unique.desc, dText(G, u, G.DEX_BY[2]));
  assert.equal(a.unique.locked, true);
  assert.ok(!a.desc.includes(a.unique.desc));
  G.DB.save.dupes[1] = 3;
  const b = G.Mons.abilityOf(2);
  assert.equal(b.unique.locked, false);
  assert.equal(b.name, u.n);
  assert.ok(b.desc.endsWith(b.unique.desc));
});

test('passive description is English text for every Pokémon, locked or not', () => {
  for (const db of [{}, { dupes: Object.fromEntries([...Array(1100).keys()].map(d => [d, 15])) }]) {
    const G = engine(db);
    for (const p of G.DEX) {
      const a = G.Mons.abilityOf(p.dex);
      for (const s of [a.desc, a.name, a.unique.name, a.unique.desc]) {
        assert.ok(s.length > 3 && !/[áéíóúñ¿¡]/.test(s) && !/NaN|undefined/.test(s), `dex ${p.dex}: ${s}`);
      }
    }
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
test('no game file reads the removed G.PASSIVES table', () => {
  const walk = d => fs.readdirSync(path.join(__dirname, '..', d), { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));
  for (const f of [...walk('js').filter(f => f !== 'js/app.min.js'), 'tools/fetch_mega.js', 'tools/export_data.js']) {
    assert.doesNotMatch(source(f), /G\.PASSIVES\b(?!_)/, f);
  }
});

test('critDmg text states the real multiplier', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  assert.match(P.build({ n: 'X', fx: [['critDmg', 30]] }, MONS[0]).d, /x1\.8/);
});

// ---------------- common por tipo, scale y catálogo unique (tarea 6) ----------------
const TYPES18 = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
const uworld = () => world('js/data/passive-fx.js', 'js/data/passive-unique-fx.js', 'js/data/passives-common.js');
const BAD_TEXT = /[áéíóúñ¿¡]|NaN|undefined/;

test('PASSIVES_COMMON has a themed passive for each of the 18 types', () => {
  const G = uworld(), names = new Set();
  assert.deepEqual(Object.keys(G.PASSIVES_COMMON).sort(), [...TYPES18].sort());
  for (const t of TYPES18) {
    const p = G.PASSIVES_COMMON[t];
    assert.ok(typeof p.n === 'string' && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(p.n), t + ': ' + p.n);
    assert.ok(!names.has(p.n.toLowerCase()), 'duplicate name ' + p.n);
    names.add(p.n.toLowerCase());
    assert.ok(p.fx.length >= 2 && p.fx.length <= 3, t);
    for (const [id, v] of p.fx) {
      const tp = G.PassiveFX.TEMPLATES[id];
      assert.ok(tp, `${t}: ${id}`);
      assert.ok(!tp.cond, `${t}: ${id} is conditional`);
      assert.ok(Number.isInteger(v) && v >= tp.min && v <= tp.max, `${t}: ${id}=${v}`);
    }
    const d = G.PassiveFX.build(G.PASSIVES_COMMON[t], { types: [t] }).d;
    assert.ok(d.length > 5 && !BAD_TEXT.test(d), t + ': ' + d);
  }
});

test('scale multiplies, rounds, clamps to max x1.6 and never mutates its input', () => {
  const G = uworld(), P = G.PassiveFX;
  for (const t of TYPES18) {
    const fx = G.PASSIVES_COMMON[t].fx, copy = JSON.stringify(fx);
    assert.deepEqual(P.scale(fx, 1), fx);
    assert.notEqual(P.scale(fx, 1), fx);
    for (const k of [1.3, 1.6, 1.6 * 1.5]) {
      const out = P.scale(fx, k);
      out.forEach(([id, v], i) => {
        const tp = P.TEMPLATES[id];
        assert.equal(id, fx[i][0]);
        assert.ok(Number.isInteger(v), `${id}=${v}`);
        assert.ok(v >= tp.min && v <= tp.max * 1.6 + 1e-9, `${t}: ${id}=${v} over ${tp.max * 1.6}`);
        assert.equal(v, Math.min(Math.floor(tp.max * 1.6), Math.max(tp.min, Math.round(fx[i][1] * k))));
      });
    }
    assert.equal(JSON.stringify(fx), copy);
  }
  assert.deepEqual(P.scale([['typeDmg', 15]], 1.3), [['typeDmg', 20]]);      // 19,5 → 20
  assert.deepEqual(P.scale([['dodge', 15]], 2.4), [['dodge', 24]]);          // tope 15 × 1,6
  assert.deepEqual(P.scale([['reviveOnce', 50]], 2), [['reviveOnce', 96]]);  // también los unique
});

test('UniqueFX has >= 30 templates in three tiers of 12/10/8, consistent both ways', () => {
  const { UniqueFX: U } = uworld();
  const ids = Object.keys(U.TEMPLATES);
  assert.ok(ids.length >= 30);
  assert.deepEqual(U.TIERS.basic, ['deathBurst', 'lifeSteal', 'thornAura', 'speedOnKill', 'startShield', 'coinBonus',
    'xpBurst', 'slowAura', 'critStreak', 'burnTouch', 'rangedBonus', 'comebackHeal']);
  assert.deepEqual(U.TIERS.adv, ['reviveOnce', 'killNova', 'hurtNova', 'orbitGuard', 'chainSpark', 'dashOnHurt',
    'executeLow', 'comboCharge', 'killHealPulse', 'barrier']);
  assert.deepEqual(U.TIERS.supreme, ['moveStorm', 'slowDomain', 'timeWarp', 'mirrorHit', 'lastStand', 'apexAura',
    'spectralClone', 'rageEngine']);
  const listed = [...U.TIERS.basic, ...U.TIERS.adv, ...U.TIERS.supreme];
  for (const id of listed) assert.equal(U.TEMPLATES[id].tier, Object.keys(U.TIERS).find(t => U.TIERS[t].includes(id)), id);
  assert.deepEqual([...ids].sort(), [...listed].sort());
  for (const [id, t] of Object.entries(U.TEMPLATES)) {
    assert.ok(t.cost > 0 && t.min > 0 && t.max >= t.min, id);
    assert.equal(typeof t.text, 'function', id); assert.equal(typeof t.hooks, 'function', id);
  }
  const budget = tier => U.TIERS[tier].reduce((s, id) => s + U.TEMPLATES[id].cost * U.TEMPLATES[id].max, 0) / U.TIERS[tier].length;
  const r = budget('supreme') / budget('basic');
  assert.ok(r >= 1.4 && r <= 1.6, 'supreme/basic budget ' + r);
});

test('every unique template builds an English description for 1-type and 2-type mons', () => {
  const G = uworld();
  for (const [id, t] of Object.entries(G.UniqueFX.TEMPLATES)) {
    for (const v of [t.min, Math.round((t.min + t.max) / 2), t.max, Math.floor(t.max * 1.6)]) {
      for (const mon of MONS) {
        const d = G.PassiveFX.build({ n: 'X', fx: [[id, v]] }, mon).d;
        assert.ok(typeof d === 'string' && d.length > 5, id);
        assert.ok(!BAD_TEXT.test(d), id + ': ' + d);
      }
    }
  }
});

test('PassiveFX.build and power accept a unique id next to a common one', () => {
  const G = uworld(), P = G.PassiveFX;
  const a = P.build({ n: 'X', fx: [['typeDmg', 10], ['executeLow', 40]] }, MONS[0]);
  assert.match(a.d, /Fire moves/); assert.match(a.d, /40%/);
  assert.ok(Math.abs(a.out(fresh(), { type: 'fire' }, { hp: 10, maxHp: 100 }) - 1.1 * 1.4) < 1e-9);
  assert.equal(a.out(fresh(), { type: 'water' }, { hp: 90, maxHp: 100 }), 1);
  assert.equal(P.power([['executeLow', 40]]), G.UniqueFX.TEMPLATES.executeLow.cost * 40);
  // sin el catálogo unique, build sigue funcionando con las plantillas comunes
  const bare = world('js/data/passive-fx.js');
  assert.match(bare.PassiveFX.build({ n: 'X', fx: [['typeDmg', 10]] }, MONS[0]).d, /\+10%/);
});

test('unique hooks keep their state on the player object', () => {
  const G = uworld(), P = G.PassiveFX;
  const foes = [];
  G.EnemyMgr = { queryCircle: () => foes };
  G.FX = { ring() {}, dmgText() {} };
  const foe = () => { const e = { x: 0, y: 0, hp: 100, maxHp: 100, dead: false, slow: 0, slowT: 0, burn: 0 };
    e.hurt = d => { e.hp -= d; }; e.applySlow = (f, t) => { e.slow = f; e.slowT = t; }; e.applyBurn = () => { e.burn++; }; return e; };
  foes.push(foe(), foe());
  const add = pl => Object.assign(pl, { x: 0, y: 0, bodyH: 20, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); } });
  // combo: sube con cada golpe y se pierde al recibir uno
  const c = P.build({ n: 'X', fx: [['comboCharge', 20]] }, MONS[0]), p1 = add(fresh()), p2 = add(fresh());
  for (let i = 0; i < 5; i++) c.hit(p1, foes[0], {});
  assert.ok(c.out(p1, {}) > 1); assert.equal(c.out(p2, {}), 1);
  c.hurt(p1); assert.equal(c.out(p1, {}), 1);
  // aura de frenado: frena a los cercanos cada medio segundo
  const s = P.build({ n: 'X', fx: [['slowAura', 30]] }, MONS[0]), p3 = add(fresh());
  s.tick(p3, 1);
  assert.ok(foes.every(e => Math.abs(e.slow - 0.3) < 1e-9));
  // nova al matar: cada 10 derrotas daña a los de alrededor
  const n = P.build({ n: 'X', fx: [['killNova', 100]] }, MONS[0]), p4 = add(fresh());
  for (let i = 0; i < 9; i++) n.kill(p4, foes[0]);
  assert.equal(foes[1].hp, 100);
  n.kill(p4, foes[0]);
  assert.ok(foes[1].hp < 100);
  // escudo inicial: bloquea los primeros v golpes
  const b = P.build({ n: 'X', fx: [['startShield', 2]] }, MONS[0]), p5 = add(fresh());
  b.start(p5);
  assert.equal(b.dodge(p5), 1); assert.equal(b.dodge(p5), 1); assert.equal(b.dodge(p5), 0);
});

test('deathBurst does not chain: burst victims never burst again, whatever the sweep order', () => {
  const G = uworld();
  const mk = (id, hp) => { const e = { id, x: 0, y: 0, hp, maxHp: 100, dead: false, hits: 0 };
    e.hurt = d => { e.hits++; e.hp -= d; if (e.hp <= 0) e.dead = true; }; return e; };
  // como EnemyMgr: la baja se procesa después, en un barrido de atrás hacia delante
  const run = order => {
    const list = [mk('a', 1), mk('killed', 0), mk('b', 1), mk('c', 1), mk('tough', 1000)];
    list[1].dead = true;
    let bursts = 0;
    G.EnemyMgr = { queryCircle: () => { bursts++; return list; } };
    G.FX = { ring() {} };
    const a = G.PassiveFX.build({ n: 'X', fx: [['deathBurst', 100]] }, MONS[0]), pl = fresh();
    const done = new Set();
    for (let frame = 0; frame < 3; frame++) {
      const idx = order === 'back' ? [...list.keys()].reverse() : [...list.keys()];
      for (const i of idx) if (list[i].dead && !done.has(i)) { done.add(i); a.kill(pl, list[i]); }
    }
    return { list, bursts };
  };
  for (const order of ['back', 'front']) {
    const { list, bursts } = run(order);
    assert.equal(bursts, 1, order);
    assert.ok(list.filter(e => e.id !== 'killed').every(e => e.hits === 1), order);
    assert.ok(list.filter(e => ['a', 'b', 'c'].includes(e.id)).every(e => e.dead && e.byBurst), order);
    assert.equal(list[4].byBurst, undefined);            // el que aguanta la explosión sí explotará al caer
  }
});

test('critStreak boosts exactly every 6th hit, also when that hit kills, and moveless hits do not count', () => {
  const G = uworld();
  const a = G.PassiveFX.build({ n: 'X', fx: [['critStreak', 50]] }, MONS[0]), pl = fresh(), m = { kind: 'projectile' };
  const seq = [];
  for (let i = 0; i < 18; i++) {
    seq.push(a.out(pl, m, {}));
    if (a.hit && i % 6 !== 5) a.hit(pl, {}, m);         // los golpes que rematan no llaman a hit (afterHit)
  }
  assert.deepEqual(seq.map((x, i) => (x > 1 ? i : -1)).filter(i => i >= 0), [5, 11, 17]);
  const before = pl.critStreakN;
  assert.equal(a.out(pl, undefined, {}), 1);
  assert.equal(pl.critStreakN, before);
});

test('rangedBonus only boosts moves that hit away from the player', () => {
  const G = uworld();
  const a = G.PassiveFX.build({ n: 'X', fx: [['rangedBonus', 20]] }, MONS[0]);
  for (const kind of ['projectile', 'homing', 'bounce', 'beam', 'boomerang', 'cone', 'meteor', 'chain', 'turret']) {
    assert.ok(Math.abs(a.out(fresh(), { kind }) - 1.2) < 1e-9, kind);
  }
  for (const kind of ['melee', 'dash', 'spin', 'shove', 'charge', 'aura', 'orbit', 'nova', 'trail', 'quake', 'buff']) {
    assert.equal(a.out(fresh(), { kind }), 1, kind);
  }
});

test('reviveOnce revives exactly once per player', () => {
  const G = uworld();
  const a = G.PassiveFX.build({ n: 'X', fx: [['reviveOnce', 40]] }, MONS[0]);
  const pl = Object.assign(fresh(), { x: 0, y: 0, bodyH: 20 }), other = Object.assign(fresh(), { x: 0, y: 0, bodyH: 20 });
  pl.hp = 0;
  assert.equal(a.revive(pl), true);
  assert.equal(pl.hp, 40);
  assert.equal(pl.reviveUsed, true);
  pl.hp = 0;
  assert.equal(a.revive(pl), false);
  assert.equal(pl.hp, 0);
  other.hp = 0;
  assert.equal(a.revive(other), true);                 // otro jugador (otra run) tiene la suya
});

/** G con lo justo para crear un G.Player. */
function playerWorld() {
  const G = { U: { TYPE_NAME: {}, TYPE_COLOR: {} }, Types: { mult: () => 1, label: () => null }, Weather: { mult: () => 1, current: null } };
  for (const f of ['js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passive-unique-fx.js', 'js/data/passives.js', 'js/data/ability-fx.js']) new Function('G', source(f))(G);
  G.Sprites = { hasShiny: () => false, playerScale: () => 1, playerRadius: () => 10, bodyHeight: () => 30, Animator: class { play() {} } };
  G.Mons = { monFor: dex => G.DEX_BY[dex] }; G.Coop = { active: false }; G.Stats = { taken: () => 1 };
  G.Audio = { sfx() {} }; G.Camera = { kick() {} }; G.Pad = { rumble() {} };
  G.FX = { dmgText() {}, burst() {}, ring() {} }; G.Projectiles = { clearOrbs() {} };
  new Function('G', source('js/entities/player.js'))(G);
  return G;
}

test('Player death path asks abil.revive and cancels the death once', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[4]); pl.activeGroup = () => []; pl.x = 0; pl.y = 0;
  pl.abil = G.PassiveFX.build({ n: 'X', fx: [['reviveOnce', 50]] }, G.DEX_BY[4]);
  pl.hurt(99999);
  assert.equal(pl.dead, false);
  assert.ok(Math.abs(pl.hp - pl.maxHp * 0.5) < 1e-9);
  assert.ok(pl.invuln > 0);
  pl.invuln = 0;
  pl.hurt(99999);
  assert.equal(pl.dead, true);
  assert.equal(pl.hp, 0);
});

test('Player.PASSIVE_STATE clears every per-run unique counter on evolution, but not reviveUsed', () => {
  const G = playerWorld(), STATE = G.Player.PASSIVE_STATE;
  // Campos del jugador que no son estado de la pasiva (o que la pasiva ya deshace aparte).
  const NOT_STATE = new Set(['hp', 'maxHp', 'invuln', 'coinMul', 'reviveUsed']);
  const foe = () => { const e = { x: 0, y: 0, hp: 1e9, maxHp: 1e9, dead: false, boss: true, slowT: 1, types: [] };
    e.hurt = () => {}; e.applySlow = () => {}; e.applyBurn = () => {}; return e; };
  const foes = [foe(), foe()];
  G.EnemyMgr = { queryCircle: () => foes }; G.Pickups = { drop() {} };
  for (const [id, t] of Object.entries(G.UniqueFX.TEMPLATES)) {
    const written = new Set();
    const pl = new Proxy(Object.assign(fresh(), { x: 0, y: 0, bodyH: 20, heal() {} }),
      { set(o, k, v) { written.add(k); o[k] = v; return true; } });
    const h = t.hooks(t.max, MONS[0]), m = { kind: 'projectile', type: 'fire' };
    if (h.start) h.start(pl);
    for (let i = 0; i < 40; i++) {
      if (h.out) h.out(pl, m, foes[0]);
      if (h.hit) h.hit(pl, foes[0], m);
      if (h.kill) h.kill(pl, foes[0]);
      if (h.tick) h.tick(pl, 0.5);
      if (h.dodge) h.dodge(pl);
      if (h.inMul) h.inMul(pl);
      if (h.speed) h.speed(pl);
      if (h.contact) h.contact(pl, foes[0]);
      pl.hp = 10;
      if (h.hurt) h.hurt(pl);
      if (h.revive) h.revive(pl);
    }
    for (const k of written) if (!NOT_STATE.has(k)) assert.ok(STATE.includes(k), `${id} keeps ${k} on the player`);
  }
  assert.ok(!STATE.includes('reviveUsed'));
  for (const k of ['streakN', 'streakT', 'pulseT', 'hurtBoostT', 'moxie']) assert.ok(STATE.includes(k), k);
});

test('dev.html loads the common and unique catalogs before passives.js; NEED has UniqueFX and Rank', () => {
  const html = source('dev.html'), at = f => html.indexOf(`src="js/data/${f}"`);
  assert.ok(at('passive-fx.js') > 0);
  for (const f of ['passives-common.js', 'passive-unique-fx.js']) {
    assert.ok(at(f) > at('passive-fx.js') && at(f) < at('passives.js'), f);
  }
  const need = source('js/main.js').match(/const NEED = \[([^\]]*)\]/)[1];
  assert.match(need, /'UniqueFX'/);
  assert.match(need, /'Rank'/);
});
