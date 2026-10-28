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
const DATA = ['js/data/pokedex.js', 'js/data/evolutions.js'];
/** Todos los Pokémon tienen sprite (como en el juego). */
const withSprites = G => { G.SPRITE_META = new Proxy({}, { get: () => true }); return G; };
function gachaWorld() {
  const G = world(DATA);
  withSprites(G);
  G.Sprites = { hasShiny: () => false };
  G.U.pick = a => a[Math.floor(Math.random() * a.length)];
  G.Moves = { BY_ID: {}, poolFor: () => [] };
  G.DB = { save: { dupes: {} }, commit() {} };
  for (const f of ['js/systems/mons.js', 'js/systems/rank.js', 'js/systems/gacha.js']) new Function('G', source(f))(G);
  return G;
}

// ---------------- Task 1: formas base y gacha ----------------

test('isBase: only Pokémon without a pre-evolution', () => {
  const G = gachaWorld();
  assert.equal(G.Mons.isBase(4), true);     // Charmander
  assert.equal(G.Mons.isBase(5), false);    // Charmeleon
  assert.equal(G.Mons.isBase(6), false);    // Charizard
});
test('gacha pools and pulls never contain an evolved form', () => {
  const G = gachaWorld();
  for (let gen = 1; gen <= 9; gen++) {
    for (let r = 1; r <= 5; r++) for (const p of G.Gacha.pool(r, gen)) assert.ok(!G.EVO_FROM[p.dex], `gen ${gen} r${r}: ${p.name}`);
    // Rarezas que quedan vacías en un banner caen a la más cercana: nunca una tirada sin resultado.
    const save = { tickets: { t1: 100000, t10: 0 }, owned: {}, shiny: {}, pity: {}, stats: { pulls: 0, shinies: 0 }, coins: 0 };
    for (let k = 0; k < 20; k++) {
      const out = G.Gacha.pull(save, 100, gen);
      assert.equal(out.length, 100);
      for (const r of out) assert.ok(r.dex && !G.EVO_FROM[r.dex], `gen ${gen} pulled ${r.dex}`);
    }
  }
});
test('banner posters only feature base forms', () => {
  const G = gachaWorld();
  for (let gen = 1; gen <= 9; gen++) for (const d of G.Gacha.featured(gen)) assert.ok(!G.EVO_FROM[d], 'featured ' + d);
});

// ---------------- Task 2: fragmentos (guardado, libreta, recompensas) ----------------

function dbWorld() {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world(DATA);
  new Function('G', source('js/core/db.js'))(G);
  return G;
}
/** Una partida mínima con libreta: `base` es el saldo común de partida. */
const saveWith = (shards, base = 10) => ({
  v: 3, name: 'x', created: 1, updated: 1, coins: 0, tickets: { t1: 0, t10: 0 }, shards,
  owned: {}, shiny: {}, bag: {}, tms: {}, upgrades: {}, pupg: {}, stats: {}, missions: {},
  led: { base: { c: [0, 0], t1: [0, 0], t10: [0, 0], sh: [base, 0] } }
});

test('shards: spending on one device and earning on another both survive a merge', () => {
  const G = dbWorld();
  const a = Object.assign(saveWith(6), { updated: 5 });     // gastó 4
  const b = Object.assign(saveWith(15), { updated: 9 });    // ganó 5
  const m = G.DB.merge(a, b);
  assert.equal(m.shards, 11);
  assert.equal(G.DB.merge(m, b).shards, 11);                // idempotente
  assert.equal(G.DB.merge(b, a).shards, 11);                // el orden no importa
});
test('shards: a save without the field merges as zero', () => {
  const G = dbWorld();
  const old = saveWith(0, 0); delete old.shards; delete old.led.base.sh;
  const m = G.DB.merge(old, saveWith(0, 0));
  assert.equal(m.shards, 0);
});
test('shards: sanitize leaves a whole, non-negative number', () => {
  const G = dbWorld();
  for (const [bad, want] of [[-3, 0], ['x', 0], [NaN, 0], [undefined, 0], [7.9, 7], [1e30, 1e9]]) {
    const s = saveWith(bad); G.DB.sanitize(s);
    assert.equal(s.shards, want, String(bad));
  }
});

function progressWorld() {
  const G = world(DATA);
  G.Moves = { EVO: {} };
  G.SPRITE_META = new Proxy({}, { get: () => true });
  G.DEX = Object.values(G.DEX_BY);
  for (const f of ['js/data/missions.js', 'js/data/achievements.js', 'js/systems/progress.js']) new Function('G', source(f))(G);
  return G;
}
test('progress.grant adds shards without touching coins or tickets', () => {
  const G = progressWorld();
  G.DB = { save: { coins: 10, tickets: { t1: 1, t10: 2 }, shards: 3 } };
  G.Progress.grant({ shards: 5 });
  assert.deepEqual([G.DB.save.coins, G.DB.save.tickets.t1, G.DB.save.tickets.t10, G.DB.save.shards], [10, 1, 2, 8]);
  G.DB.save.shards = undefined;
  G.Progress.grant({ shards: 5 });
  assert.equal(G.DB.save.shards, 5);
});
test('rewardText mentions shards', () => {
  const G = progressWorld();
  G.Icons = { html: n => `[${n}]` };
  assert.match(G.Progress.rewardText({ shards: 5 }), /\[shard\][^0-9]*5/);
});
test('missions and achievements pay shards by the agreed scale', () => {
  const G = progressWorld();
  for (const m of G.MissionDefs.daily) assert.equal(m.reward.shards, 2, m.id);
  for (const m of G.MissionDefs.weekly) assert.equal(m.reward.shards, 8, m.id);
  for (const a of G.AchDefs.LIST) {
    const want = a.id.startsWith('leg_') ? 3 : { 1: 5, 2: 15, 3: 40 }[a.tier];
    assert.equal(a.reward.shards, want, a.id);
  }
});

// ---------------- Task 4: lógica de la Forja ----------------

function forgeWorld(owned = [], shards = 0) {
  const G = world(DATA);
  const save = { shards, owned: {}, shiny: {} };
  for (const d of owned) save.owned[d] = { at: 1, from: 'gacha' };
  G.DB = {
    save, commits: 0,
    owns: d => !!save.owned[d],
    grant: (d, from) => { if (!save.owned[d]) save.owned[d] = { at: 1, from }; },
    commit() { G.DB.commits++; }
  };
  new Function('G', source('js/systems/forge.js'))(G);
  return G;
}

test('forge price follows the rarity of the target form', () => {
  const G = forgeWorld();
  assert.deepEqual(G.Forge.PRICE, { 1: 20, 2: 40, 3: 80, 4: 160, 5: 300 });
  for (const d of [5, 6, 134]) assert.equal(G.Forge.price(d), G.Forge.PRICE[G.DEX_BY[d].rarity]);
});
test('offers: nothing without Pokémon, evolved forms of the ones you own otherwise', () => {
  assert.deepEqual(forgeWorld().Forge.offers(), []);
  const G = forgeWorld([4]);
  const o = G.Forge.offers();
  assert.deepEqual(o.map(x => [x.from, x.to]), [[4, 5]]);              // Charmeleon sí, Charizard aún no
  assert.equal(o[0].price, G.Forge.price(5));
});
test('offers: a form you already own is not offered; branches (Eevee) appear once each', () => {
  const G = forgeWorld([4, 5]);
  assert.deepEqual(G.Forge.offers().map(x => x.to), [6]);
  const E = forgeWorld([133]);
  const to = E.Forge.offers().map(x => x.to);
  assert.deepEqual([...to].sort((a, b) => a - b), [...E.EVO[133]].sort((a, b) => a - b));
  assert.equal(new Set(to).size, to.length);
});
test('offers: a target with two owned origins shows once', () => {
  const G = forgeWorld();
  G.EVO = { 1: [3], 2: [3] };                                          // (en los datos reales no hay, pero la regla vale)
  G.DB.save.owned[1] = { at: 1 }; G.DB.save.owned[2] = { at: 1 };
  const o = G.Forge.offers().filter(x => x.to === 3);
  assert.deepEqual(o.map(x => x.from), [1]);
});
test('buy: exact price leaves zero, grants the form (not shiny) and saves', () => {
  const G = forgeWorld([4], 0);
  G.DB.save.shards = G.Forge.price(5);
  assert.deepEqual(G.Forge.buy(5), { ok: true });
  assert.equal(G.DB.save.shards, 0);
  assert.ok(G.DB.save.owned[5]);
  assert.deepEqual(G.DB.save.shiny, {});
  assert.ok(G.DB.commits >= 1);
});
test('buy: twice charges once; refusals change nothing', () => {
  const G = forgeWorld([4], 1000);
  G.Forge.buy(5);
  const after = G.DB.save.shards;
  assert.deepEqual(G.Forge.buy(5), { ok: false, reason: 'owned' });
  assert.equal(G.DB.save.shards, after);
  const P = forgeWorld([4], 0);
  assert.deepEqual(P.Forge.buy(5), { ok: false, reason: 'shards' });
  assert.equal(P.DB.save.owned[5], undefined);
  assert.deepEqual(forgeWorld([], 1000).Forge.buy(5), { ok: false, reason: 'locked' });
  assert.deepEqual(forgeWorld([4], 1000).Forge.buy(999999), { ok: false, reason: 'unknown' });
  assert.deepEqual(forgeWorld([4], 1000).Forge.buy(4), { ok: false, reason: 'owned' });
});

// ---------------- Task 5: el compañero sólo puede ser una forma base ----------------

const withPartner = (partner, owned = [], extra = {}) => {
  const s = saveWith(0);
  s.partner = partner; s.partnerShiny = false;
  for (const d of owned) s.owned[d] = { at: 1, from: 'gacha' };
  return Object.assign(s, extra);
};
test('an evolved partner goes back to its owned base form', () => {
  const G = dbWorld();
  const s = withPartner(5, [4, 5]);
  G.DB.sanitize(s);
  assert.equal(s.partner, 4);
  const t = withPartner(6, [4, 5, 6]);                                  // dos escalones
  G.DB.sanitize(t);
  assert.equal(t.partner, 4);
});
test('an evolved partner whose base you never owned still lands on the base, which you now own', () => {
  const G = dbWorld();
  const s = withPartner(6, [6]);
  G.DB.sanitize(s);
  assert.equal(s.partner, 4);
  assert.ok(s.owned[4], 'la base queda en la colección');
  assert.ok(s.owned[6], 'lo que tenías no se quita');
});
test('a base partner and its shiny flag are left alone; a moved partner keeps shiny only if the base has one', () => {
  const G = dbWorld();
  const a = withPartner(4, [4], { partnerShiny: true, shiny: { 4: { at: 1 } } });
  G.DB.sanitize(a);
  assert.deepEqual([a.partner, a.partnerShiny], [4, true]);
  const b = withPartner(5, [4, 5], { partnerShiny: true, shiny: { 5: { at: 1 } } });
  G.DB.sanitize(b);
  assert.deepEqual([b.partner, b.partnerShiny], [4, false]);
  const c = withPartner(5, [4, 5], { partnerShiny: true, shiny: { 5: { at: 1 }, 4: { at: 1 } } });
  G.DB.sanitize(c);
  assert.deepEqual([c.partner, c.partnerShiny], [4, true]);
});
test('starter is fixed too (and the old partner’s upgrades move to the base)', () => {
  const G = dbWorld();
  const s = withPartner(5, [4, 5], { starter: 6, pupg: { 5: { hp: 2 } } });
  G.DB.sanitize(s);
  assert.equal(s.starter, 4);
  assert.deepEqual(s.pupg, { 4: { hp: 2 } });
});
test('merge never brings back an evolved partner', () => {
  const G = dbWorld();
  const a = Object.assign(withPartner(5, [4, 5]), { updated: 9 });
  const b = Object.assign(withPartner(4, [4]), { updated: 1 });
  const m = G.DB.merge(a, b);
  assert.equal(m.partner, 4);
  assert.equal(G.DB.merge(m, a).partner, 4);
});
test('with no evolution data loaded, nothing is touched', () => {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world(['js/data/pokedex.js']);
  new Function('G', source('js/core/db.js'))(G);
  const s = withPartner(5, [5]);
  G.DB.sanitize(s);
  assert.equal(s.partner, 5);
});
test('every starter is a base form, and the collection card gates the pick button on isBase', () => {
  const G = world([...DATA, 'js/data/starters.js']);
  assert.deepEqual(G.STARTERS.filter(s => G.EVO_FROM[s.dex]).map(s => s.dex), []);
  const menu = source('js/ui/menu.js');
  assert.match(menu, /!G\.Mons\.isBase\(dex\)\s*\? '<p class="sub center"[^']*Forma evolucionada/);
});

// ---------------- Task 6: pantalla de la Forja (cableado) ----------------

test('the Forge screen is wired: html, menu, screen list, escape key, load order', () => {
  const html = source('dev.html');
  assert.match(html, /id="scr-forge"/);
  assert.match(html, /data-go="forge"/);
  const order = f => html.indexOf(`src="js/${f}"`);
  assert.ok(order('systems/forge.js') > 0 && order('ui/forge-ui.js') > order('systems/forge.js'));
  assert.ok(order('ui/forge-ui.js') > order('ui/ui.js'));
  assert.match(source('js/ui/ui.js'), /'scr-forge'/);
  assert.match(source('js/ui/menu.js'), /go === 'forge'\) G\.ForgeUI\.open\(\)/);
  assert.match(source('js/game.js'), /'scr-forge'/);
  assert.match(source('js/main.js'), /'Forge'/);
});

// ---------------- línea evolutiva en la ficha ----------------

test('lineage lists the ancestors from the base form down to the direct pre-evolution', () => {
  const G = gachaWorld();
  assert.deepEqual(G.Mons.lineage(4), []);          // Charmander: es la base
  assert.deepEqual(G.Mons.lineage(5), [4]);
  assert.deepEqual(G.Mons.lineage(6), [4, 5]);      // Charizard
  for (const d of Object.keys(G.EVO_FROM)) {        // nunca incluye al propio Pokémon ni se repite
    const l = G.Mons.lineage(+d);
    assert.ok(l.length > 0 && !l.includes(+d) && new Set(l).size === l.length, 'dex ' + d);
    assert.ok(G.Mons.isBase(l[0]), 'la primera es base: ' + d);
  }
});
test('the collection card shows the pre-evolution chain and jumps to it', () => {
  const menu = source('js/ui/menu.js');
  assert.match(menu, /G\.Mons\.lineage\(dex\)/);
  assert.match(menu, /data-evo-from/);
});

// ---------------- mejoras compartidas por toda la línea evolutiva ----------------

test('upgrades bought for evolved forms are folded into the base form (highest level of each)', () => {
  const G = dbWorld();
  const s = withPartner(4, [4, 5, 6], { pupg: { 4: { hp: 1, spd: 3 }, 5: { hp: 3 }, 6: { atk: 2, spd: 1 } } });
  G.DB.sanitize(s);
  assert.deepEqual(s.pupg, { 4: { hp: 3, spd: 3, atk: 2 } });
  G.DB.sanitize(s);                                                    // idempotente
  assert.deepEqual(s.pupg, { 4: { hp: 3, spd: 3, atk: 2 } });
});
test('upgrades of an evolved form that was never the partner are folded too, even without the base owned', () => {
  const G = dbWorld();
  const s = withPartner(1, [1, 6], { pupg: { 6: { hp: 2 } } });
  G.DB.sanitize(s);
  assert.deepEqual(s.pupg, { 4: { hp: 2 } });
});
test('merge folds evolved-form upgrades that arrive from the other device', () => {
  const G = dbWorld();
  const a = Object.assign(withPartner(4, [4], { pupg: { 4: { hp: 1 } } }), { updated: 9 });
  const b = Object.assign(withPartner(4, [4, 5], { pupg: { 5: { hp: 3, spd: 1 } } }), { updated: 1 });
  const m = G.DB.merge(a, b);
  assert.deepEqual(m.pupg, { 4: { hp: 3, spd: 1 } });
});
test('the upgrades screen only lists base forms', () => {
  assert.match(source('js/ui/menu.js'), /filter\(d => G\.DEX_BY\[d\] && G\.Mons\.isBase\(d\)\)/);
});

// ---------------- avisos del gacha sin formas evolucionadas ----------------

test('the gacha banner counts base forms and warns when a banner has no Epics', () => {
  const ui = source('js/ui/gacha-ui.js');
  assert.match(ui, /Pokémon base de la generación/);
  assert.match(ui, /no tiene Épicas/);
  const G = gachaWorld();
  const noEpic = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(g => G.Gacha.pool(4, g).length === 0);
  assert.deepEqual(noEpic, [3, 4], 'los banners sin Épicas base (si cambia, revisa el aviso)');
});
