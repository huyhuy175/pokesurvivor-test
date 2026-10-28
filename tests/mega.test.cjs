const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

/** Un G de pega con lo que los módulos usan al cargarse. */
function world(files, extra = {}) {
  const G = Object.assign({ U: { TYPE_NAME: {} }, Types: { mult: () => 1 }, Weather: { current: null } }, extra);
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const DATA = ['js/data/pokedex.js', 'js/data/passives.js', 'js/data/evolutions.js', 'js/data/mega.js'];

// ---------------- Task 1: datos ----------------

test('mega data: every Mega has a valid base, is listed, and stays out of G.DEX', () => {
  const G = world(DATA);
  assert.ok(G.MEGA_DEX.length >= 40, 'about 48 Megas expected, got ' + G.MEGA_DEX.length);
  for (const m of G.MEGA_DEX) {
    assert.ok(m.dex >= 10000, 'dex ' + m.dex);
    assert.ok(G.DEX_BY[m.mega] && !G.MEGA_FROM[m.mega], 'base ' + m.mega);
    assert.ok(G.MEGA[m.mega].includes(m.dex));
    assert.equal(G.MEGA_FROM[m.dex], m.mega);
    assert.equal(G.DEX_BY[m.dex], m);
    assert.ok(!G.DEX.includes(m));
  }
});

test('mega data: a Mega is stronger than its base and inherits its passive', () => {
  const G = world(DATA);
  for (const m of G.MEGA_DEX) {
    const b = G.DEX_BY[m.mega];
    assert.ok(m.bst > b.bst, m.name);
    assert.ok(m.hp >= b.hp && m.spd >= b.spd && m.atk >= b.atk, m.name);
    assert.equal(G.PASSIVES[m.dex], G.PASSIVES[m.mega]);
  }
});

test('mega data: only final or standalone forms have a Mega', () => {
  const G = world(DATA);
  for (const m of G.MEGA_DEX) assert.ok(!(G.EVO[m.mega] || []).length, m.name + ' base evolves further');
});

test('G.isMega tells Mega dexes apart', () => {
  const G = world(DATA);
  assert.equal(G.isMega(G.MEGA_DEX[0].dex), true);
  assert.equal(G.isMega(6), false);
  assert.equal(G.isMega(99999), false);
});

// ---------------- Task 2: fuera de la colección y del compañero ----------------

test('isBase is false for a Mega; lineage of a Mega ends with its base', () => {
  const G = world([...DATA, 'js/systems/mons.js']);
  const m = G.MEGA_FROM && Object.keys(G.MEGA_FROM).map(Number).find(d => G.MEGA_FROM[d] === 6);
  assert.equal(G.Mons.isBase(6), false);       // Charizard evoluciona de Charmeleon
  assert.equal(G.Mons.isBase(m), false);
  assert.deepEqual(G.Mons.lineage(m), [4, 5, 6]);
  const solo = G.MEGA_DEX.find(x => !(G.EVO_FROM[x.mega] || []).length);
  assert.deepEqual(G.Mons.lineage(solo.dex), [solo.mega]);
});

test('owning a Mega does not count towards the Pokédex achievements', () => {
  const G = world(DATA, { Moves: { EVO: {} }, SPRITE_META: new Proxy({}, { get: () => true }) });
  new Function('G', source('js/data/achievements.js'))(G);
  const own = G.AchDefs.LIST.find(a => a.id === 'ownAll');
  const m = G.MEGA_DEX[0].dex;
  assert.equal(own.value({ owned: { 6: {}, [m]: {} } }), 1);
});

function dbWorld() {
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const G = world(DATA);
  new Function('G', source('js/core/db.js'))(G);
  return G;
}

test('a Mega as partner or starter falls back to its base form', () => {
  const G = dbWorld();
  const m = G.MEGA_DEX.find(x => x.mega === 6).dex;
  const s = { coins: 0, tickets: { t1: 0, t10: 0 }, shards: 0, owned: { [m]: {} }, shiny: {}, pupg: {}, partner: m, starter: m };
  G.DB.sanitize(s);
  // Como una forma evolucionada: vuelve a la raíz de la cadena (Charmander) y se le da si no la tenía.
  assert.equal(s.partner, 4);
  assert.equal(s.starter, 4);
  assert.ok(s.owned[4], 'the base form is granted');
});

// ---------------- Task 3: cristales en la libreta ----------------

const crySave = (cry, base = {}) => ({
  v: 3, name: 'x', created: 1, updated: 1, coins: 0, tickets: { t1: 0, t10: 0 }, shards: 0, cry,
  owned: {}, shiny: {}, bag: {}, tms: {}, upgrades: {}, pupg: {}, stats: {}, missions: {},
  led: { base: Object.assign({ c: [0, 0], t1: [0, 0], t10: [0, 0], sh: [0, 0] }, base) }
});

test('crystals: DB.crystals reads save.cry and a missing field is zero', () => {
  const G = dbWorld();
  const s = { cry: { fire: 3 } };
  assert.equal(G.DB.crystals('fire', s), 3);
  assert.equal(G.DB.crystals('water', s), 0);
  assert.equal(G.DB.crystals('fire', {}), 0);
});

test('crystals: spending on one device and earning on another both survive a merge', () => {
  const G = dbWorld();
  const a = Object.assign(crySave({ fire: 6 }, { 'x:fire': [10, 0] }), { updated: 5 });    // gastó 4
  const b = Object.assign(crySave({ fire: 15 }, { 'x:fire': [10, 0] }), { updated: 9 });   // ganó 5
  const m = G.DB.merge(a, b);
  assert.equal(m.cry.fire, 11);
  assert.equal(G.DB.merge(m, b).cry.fire, 11);                                              // idempotente
  assert.equal(G.DB.merge(b, a).cry.fire, 11);                                              // el orden no importa
});

test('crystals: a save without the field merges as empty', () => {
  const G = dbWorld();
  const old = crySave({}); delete old.cry;
  const m = G.DB.merge(old, crySave({}));
  assert.deepEqual(m.cry || {}, {});
});

test('crystals: sanitize drops unknown names, negatives and junk, and clamps', () => {
  const G = dbWorld();
  const s = crySave({ fire: 5, 'bad name!': 3, water: -2, grass: 'x', dragon: 5e12 });
  G.DB.sanitize(s);
  assert.deepEqual(s.cry, { fire: 5, dragon: 1e9 });
});

test('crystals: Progress.grant adds them', () => {
  const G = world(DATA, { Moves: { EVO: {} }, SPRITE_META: new Proxy({}, { get: () => true }) });
  global.document = { getElementById: () => ({ classList: { contains: () => true } }) };
  for (const f of ['js/data/missions.js', 'js/data/achievements.js', 'js/systems/progress.js']) new Function('G', source(f))(G);
  G.DB = { save: crySave({ fire: 1 }) };
  G.Progress.grant({ crystals: { fire: 2, water: 1 } });
  assert.equal(G.DB.save.cry.fire, 3);
  assert.equal(G.DB.save.cry.water, 1);
});

// ---------------- Task 4: la Forja desbloquea Megas ----------------

function megaForge(owned = [], shards = 0, cry = {}) {
  const G = world(DATA);
  const save = { shards, cry: Object.assign({}, cry), owned: {}, shiny: {} };
  for (const d of owned) save.owned[d] = { at: 1, from: 'gacha' };
  G.DB = {
    save, commits: 0,
    owns: d => !!save.owned[d],
    crystals: t => save.cry[t] || 0,
    grant: (d, from) => { if (!save.owned[d]) save.owned[d] = { at: 1, from }; },
    commit() { G.DB.commits++; }
  };
  new Function('G', source('js/systems/forge.js'))(G);
  return G;
}
const megaOf = (G, base, form) => G.MEGA_DEX.find(m => m.mega === base && (!form || m.form === form)).dex;

test('mega cost: one type needs 8 crystals, two types 6 of each; X/Y cost more shards', () => {
  const G = megaForge();
  const single = G.MEGA_DEX.find(m => m.types.length === 1 && m.form === 'mega');
  assert.deepEqual(G.Forge.megaCost(single.dex), { shards: 400, crystals: { [single.types[0]]: 8 } });
  const x = megaOf(G, 6, 'x');                                       // Charizard X: fuego + dragón
  assert.deepEqual(G.Forge.megaCost(x), { shards: 450, crystals: { fire: 6, dragon: 6 } });
});
test('offersMega: needs the base form; owned Megas are not offered; sorted by shards then dex', () => {
  assert.deepEqual(megaForge().Forge.offersMega(), []);
  assert.deepEqual(megaForge([4, 5]).Forge.offersMega(), []);        // Charmander/Charmeleon no tienen Mega
  const G = megaForge([6]);
  const o = G.Forge.offersMega();
  assert.deepEqual(o.map(x => x.to), [megaOf(G, 6, 'x'), megaOf(G, 6, 'y')].sort((a, b) => a - b));
  assert.ok(o.every(x => x.from === 6));
  const H = megaForge([6, megaOf(G, 6, 'x')]);
  assert.deepEqual(H.Forge.offersMega().map(x => x.to), [megaOf(G, 6, 'y')]);
});
test('buyMega: reasons for failure leave the save untouched', () => {
  const G = megaForge([], 9999, { fire: 99, dragon: 99 });
  const x = megaOf(G, 6, 'x');
  assert.deepEqual(G.Forge.buyMega(x), { ok: false, reason: 'locked' });
  assert.deepEqual(G.Forge.buyMega(123456), { ok: false, reason: 'unknown' });
  const S = megaForge([6], 449, { fire: 6, dragon: 6 });
  assert.deepEqual(S.Forge.buyMega(x), { ok: false, reason: 'shards' });
  const C = megaForge([6], 450, { fire: 6, dragon: 5 });
  assert.deepEqual(C.Forge.buyMega(x), { ok: false, reason: 'crystals' });
  assert.deepEqual([C.DB.save.shards, C.DB.save.cry.fire, C.DB.save.cry.dragon, C.DB.commits], [450, 6, 5, 0]);
});
test('buyMega: exact cost spends both currencies, grants the Mega once and keeps the base', () => {
  const G = megaForge([6], 450, { fire: 6, dragon: 6 });
  const x = megaOf(G, 6, 'x');
  assert.deepEqual(G.Forge.buyMega(x), { ok: true });
  assert.equal(G.DB.owns(x), true);
  assert.equal(G.DB.owns(6), true);
  assert.deepEqual([G.DB.save.shards, G.DB.save.cry.fire, G.DB.save.cry.dragon], [0, 0, 0]);
  assert.equal(G.DB.commits, 1);
  assert.deepEqual(G.Forge.buyMega(x), { ok: false, reason: 'owned' });
});

// ---------------- Task 5: Megaevolución en la partida ----------------

function runWorld(owned = []) {
  const G = world([...DATA, 'js/data/passive-fx.js', 'js/data/ability-fx.js']);
  G.Sprites = {
    hasShiny: () => false, playerScale: () => 1, playerRadius: () => 10, bodyHeight: () => 30,
    preload: () => Promise.resolve(), Animator: class { constructor(dex) { this.dex = dex; } play() {} }
  };
  G.Mons = { monFor: dex => G.DEX_BY[dex] };
  G.Coop = { active: false };
  G.DB = { owns: d => owned.includes(d), commit() {} };
  G.T = s => s;
  G.I18n = { f: (s, ...v) => { let i = 0; return s.replace(/\{(?:x|name)\}/g, () => v[i++]); } };
  G.Progress = { grants: [], grant(r) { this.grants.push(r); } };
  G.FX = { dmgText() {}, ring() {}, burst() {} };
  G.Audio = { sfx() {} };
  G.Spawner = { say() {} };
  for (const f of ['js/entities/player.js', 'js/systems/mega.js']) new Function('G', source(f))(G);
  return G;
}
const lvl36 = (G, dex = 6) => { const pl = new G.Player(G.DEX_BY[dex]); pl.setAbility(); pl.level = 36; return pl; };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test('Mega.options needs level 36, an owned Mega of the base form, and not being Mega already', () => {
  const G = runWorld();
  const x = megaOf(G, 6, 'x'), y = megaOf(G, 6, 'y');
  const W = runWorld([x, y]);
  const mk = (dex, level) => ({ dex, level });
  assert.deepEqual(W.Mega.options(mk(6, 35)), []);
  assert.deepEqual(W.Mega.options(mk(6, 36)), [x, y]);
  assert.deepEqual(W.Mega.options(mk(x, 40)), []);                // ya es Mega
  assert.deepEqual(W.Mega.options(mk(9, 40)), []);                // Blastoise: su Mega no es tuya
  assert.deepEqual(G.Mega.options(mk(6, 40)), []);                // sin Mega desbloqueada
});

test('Mega.lootFor: only with an owned Mega to go to, one stone at a time', () => {
  const G = runWorld(), W = runWorld([megaOf(G, 6, 'x')]);
  const pl = lvl36(W);
  assert.equal(G.Mega.lootFor(lvl36(G), 'boss'), false);
  assert.equal(W.Mega.lootFor(pl, 'boss'), true);
  assert.equal(W.Mega.lootFor(pl, 'chest'), true);
  assert.equal(W.Mega.lootFor(pl, 'enemy', () => 0.0004), true);
  assert.equal(W.Mega.lootFor(pl, 'enemy', () => 0.001), false);
  pl.megaStone = 1;
  assert.equal(W.Mega.lootFor(pl, 'boss'), false);
});

test('megaUp: a Mega gets the form stats plus the fixed Mega bonus', () => {
  const G = runWorld(), x = megaOf(G, 6, 'x');
  const pl = lvl36(G); pl.level = 36; pl.moves = [{ id: 'a' }]; pl.hp = pl.maxHp;
  pl.megaUp(x);
  const fresh = new G.Player(G.DEX_BY[x]); fresh.setAbility();
  const B = G.Mega.BONUS;
  assert.equal(pl.dex, x); assert.equal(pl.level, 36); assert.equal(pl.moves.length, 1);
  near(pl.maxHp, fresh.maxHp * (1 + B.hp), 'maxHp');
  near(pl.atkMul, fresh.atkMul * (1 + B.dmg), 'atkMul');
  near(pl.spdMul, fresh.spdMul * (1 + B.spd), 'spdMul');
  near(pl.critChance, fresh.critChance + B.crit, 'critChance');
  assert.equal(pl.hp, pl.maxHp);                                   // lleno sigue lleno
  assert.ok(pl.atk > fresh.atk && pl.maxHp > G.DEX_BY[6].hp);
});
test('megaUp heals 25% of max HP and never exceeds it', () => {
  const G = runWorld(), x = megaOf(G, 6, 'x');
  const pl = lvl36(G); pl.hp = 1;
  pl.megaUp(x);
  assert.ok(pl.hp >= pl.maxHp * G.Mega.BONUS.heal && pl.hp <= pl.maxHp);
});
test('megaUp twice does not stack the bonus; clearMega restores the plain Mega', () => {
  const G = runWorld(), x = megaOf(G, 6, 'x');
  const pl = lvl36(G);
  pl.megaUp(x);
  const once = ['maxHp', 'atkMul', 'spdMul', 'critChance'].map(k => pl[k]);
  pl.megaUp(x);
  ['maxHp', 'atkMul', 'spdMul', 'critChance'].forEach((k, i) => near(pl[k], once[i], k));
  const fresh = new G.Player(G.DEX_BY[x]); fresh.setAbility();
  pl.clearMega();
  for (const k of ['maxHp', 'atkMul', 'spdMul', 'critChance']) near(pl[k], fresh[k], k);
  assert.ok(pl.hp <= pl.maxHp);
});

test('megaNow does nothing to a dead player or without a stone, and consumes the stone', async () => {
  const G = runWorld(), x = megaOf(G, 6, 'x');
  const dead = lvl36(G); dead.dead = true; dead.megaStone = 1;
  await G.Mega.megaNow(dead, x);
  assert.equal(dead.dex, 6);
  const none = lvl36(G);
  await G.Mega.megaNow(none, x);
  assert.equal(none.dex, 6);
  const ok = lvl36(G); ok.megaStone = 1;
  await G.Mega.megaNow(ok, x);
  assert.equal(ok.dex, x); assert.equal(ok.megaStone, 0); assert.equal(ok.evolving, false);
});

test('cards: one per owned Mega, as evolution-style cards that apply megaUp and consume the stone', () => {
  const G = runWorld(), W = runWorld([megaOf(G, 6, 'x'), megaOf(G, 6, 'y')]);
  const pl = lvl36(W); pl.megaStone = 1;
  const cards = W.Mega.cards(pl);
  assert.equal(cards.length, 2);
  assert.ok(cards.every(c => c.type === 'mevo' && c.tag === 'MEGA'));
  cards[0].apply(pl);
  assert.equal(pl.dex, megaOf(W, 6, 'x')); assert.equal(pl.megaStone, 0);
});

test('crystals: a boss drops one of its first type, a chest one of the player\'s types, both saved at once', () => {
  const G = runWorld();
  const pl = lvl36(G);
  G.Mega.onKill(pl, { boss: true, types: ['water', 'ice'] });
  assert.deepEqual(G.Progress.grants.pop(), { crystals: { water: 1 } });
  G.Mega.onKill(pl, { boss: false, types: ['water'] });
  G.Mega.onKill(pl, { boss: true, judge: true, types: ['water'] });
  assert.equal(G.Progress.grants.length, 0);
  G.Mega.onChest(pl);
  const g = G.Progress.grants.pop();
  assert.ok(pl.mon.types.includes(Object.keys(g.crystals)[0]) && Object.values(g.crystals)[0] === 1);
  assert.equal(pl.crystalsFound, 2);
});

test('claiming a weekly mission also pays 2 crystals of the partner\'s first type; a daily one does not', () => {
  const G = world(DATA, { Moves: { EVO: {} }, SPRITE_META: new Proxy({}, { get: () => true }) });
  global.document = { getElementById: () => ({ classList: { contains: () => true } }) };
  for (const f of ['js/data/missions.js', 'js/data/achievements.js', 'js/systems/progress.js']) new Function('G', source(f))(G);
  const el = { classList: { contains: () => true, remove() {}, add() {} }, style: {}, querySelector: () => el, addEventListener() {} };
  global.document = { getElementById: () => el };
  const save = { coins: 0, tickets: { t1: 0, t10: 0 }, shards: 0, cry: {}, partner: 6, stats: {}, missions: {}, ach: {}, owned: {}, shiny: {}, legends: {} };
  G.DB = { save, commit() {} };
  G.Ranking = { periodIds: () => ({ d: 'd1', w: 'w1' }) };
  G.Icons = { html: () => '' };
  G.Audio = { sfx() {} };
  const wk = G.MissionDefs.weekly[0], dl = G.MissionDefs.daily[0];
  assert.equal(G.Progress.claim({ id: wk.id, prog: 99999, goal: 1 }, true), true);
  assert.deepEqual(save.cry, { fire: 2 });
  assert.equal(G.Progress.claim({ id: dl.id, prog: 99999, goal: 1 }, false), true);
  assert.deepEqual(save.cry, { fire: 2 });
});

// ---------------- Task 6: sprites (misma hoja que la forma base + aura) ----------------

function spriteWorld(meta) {
  global.Image = class { };
  const G = world(DATA);
  G.SPRITE_META = meta;
  new Function('G', source('js/core/sprites.js'))(G);
  return G;
}
const IDLE = { w: 8, h: 8, n: 1, r: 8, ax: 4, ay: 8, d: [1] };

test('a Mega without sheets of its own borrows the base form: same folder, same geometry, flagged as fallback', () => {
  const G = spriteWorld({ 6: { a: { Idle: IDLE }, sh: 1 } });
  const x = megaOf(G, 6, 'x');
  assert.equal(G.Sprites.sheetDex(x), 6);
  assert.deepEqual(G.Sprites.meta(x), G.SPRITE_META[6]);
  assert.equal(G.Sprites.isFallback(x), true);
  assert.equal(G.Sprites.sheet(x, 'Idle').src, 'assets/pokemon/6/Idle.png');
  assert.equal(G.Sprites.hasShiny(x), true);
});
test('a Mega with sheets of its own uses them and is not a fallback', () => {
  const x = megaOf(world(DATA), 6, 'x');
  const G = spriteWorld({ 6: { a: { Idle: IDLE } }, [x]: { a: { Idle: IDLE } } });
  assert.equal(G.Sprites.sheetDex(x), x);
  assert.equal(G.Sprites.isFallback(x), false);
  assert.equal(G.Sprites.sheet(x, 'Idle').src, `assets/pokemon/${x}/Idle.png`);
});
test('normal Pokémon and unknown dexes are untouched by the Mega aliasing', () => {
  const G = spriteWorld({ 6: { a: { Idle: IDLE } } });
  assert.equal(G.Sprites.sheetDex(6), 6);
  assert.equal(G.Sprites.isFallback(6), false);
  assert.equal(G.Sprites.meta(7), null);
  assert.equal(G.Sprites.sheetDex(99999), 99999);
  assert.equal(G.Sprites.isFallback(99999), false);
});

// ---------------- Task 7: pantalla de la Forja (modelo de datos) ----------------

test('ForgeUI.megaRows flags what you can afford and lists have/need per crystal type', () => {
  const G = megaForge([6], 450, { fire: 6, dragon: 5 });
  G.UI = { $: () => null };
  new Function('G', source('js/ui/forge-ui.js'))(G);
  const x = megaOf(G, 6, 'x'), y = megaOf(G, 6, 'y');
  const rows = G.ForgeUI.megaRows();
  assert.deepEqual(rows.map(r => r.to), [x, y]);
  const rx = rows[0];
  assert.deepEqual(rx.crystals, [{ type: 'fire', need: 6, have: 6 }, { type: 'dragon', need: 6, have: 5 }]);
  assert.equal(rx.affordable, false);                      // le falta 1 cristal de dragón
  G.DB.save.cry.dragon = 6;
  assert.equal(G.ForgeUI.megaRows()[0].affordable, true);
  G.DB.save.shards = 449;
  assert.equal(G.ForgeUI.megaRows()[0].affordable, false); // y con 449 fragmentos tampoco
  assert.equal(G.ForgeUI.PAGE, 30);
});

test('the changelog announces Megas for today in Spanish and English', () => {
  const G = {}; new Function('G', source('js/data/changelog.js'))(G);
  const today = G.CHANGELOG.find(e => e.d === '2026-10-28');
  const line = today.new.find(l => /Mega/.test(l[0]) && /Mega/.test(l[1]));
  assert.ok(line, 'a Mega line in new');
});

// ---------------- Minor fixes after the final review ----------------

test('loading a save whose crystals are stale re-applies the ledger (old tab overwrote cry)', () => {
  const G = dbWorld();
  const stale = crySave({}, { 'x:fire': [10, 0], 'x:water': [10, 4] });
  stale.cry = { water: 99 };                                    // un cliente viejo dejó el saldo mal
  const s = G.DB.migrate(stale);
  assert.equal(s.cry.fire, 10);
  assert.equal(s.cry.water, 6);
  const none = G.DB.migrate(crySave({ fire: 3 }));              // sin apuntes de cristales: no se toca
  assert.equal(none.cry.fire, 3);
});

test('a weekly mission reward text mentions the Mega Crystals it pays; a daily one does not', () => {
  const G = world(DATA, { Moves: { EVO: {} }, SPRITE_META: new Proxy({}, { get: () => true }) });
  for (const f of ['js/data/missions.js', 'js/data/achievements.js', 'js/systems/progress.js']) new Function('G', source(f))(G);
  G.Icons = { html: n => `[${n}]` };
  for (const m of G.MissionDefs.weekly) assert.match(G.Progress.rewardText(m.reward), /\+2 Mega Crystals/);
  for (const m of G.MissionDefs.daily) assert.doesNotMatch(G.Progress.rewardText(m.reward), /Mega/);
});

test('a boss whose Pokémon is unknown (type fallback) drops a random type, not always Normal', () => {
  const G = runWorld();
  G.U.TYPE_NAME = { fire: 1, water: 2, grass: 3 };
  const pl = lvl36(G);
  G.Mega.onKill(pl, { boss: true, mon: null, types: ['normal'] }, () => 0.99);
  assert.deepEqual(G.Progress.grants.pop(), { crystals: { grass: 1 } });
  G.Mega.onKill(pl, { boss: true, mon: G.DEX_BY[6], types: ['fire', 'flying'] }, () => 0.99);   // con Pokémon: su tipo
  assert.deepEqual(G.Progress.grants.pop(), { crystals: { fire: 1 } });
});
