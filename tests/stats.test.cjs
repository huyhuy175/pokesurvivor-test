const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function world() {
  const G = { U: { TYPE_NAME: {}, TYPE_COLOR: {} }, Types: { mult: () => 1, label: () => null }, Weather: { mult: () => 1, current: null } };
  for (const f of ['js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passives.js', 'js/data/ability-fx.js']) new Function('G', source(f))(G);
  G.Sprites = {
    hasShiny: () => false, playerScale: () => 1, playerRadius: () => 10, bodyHeight: () => 30,
    preload: () => Promise.resolve(), Animator: class { play() {} }
  };
  G.Mons = { monFor: dex => G.DEX_BY[dex] };
  G.Coop = { active: false };
  G.Stats = { taken: () => 1 };
  G.T = s => s;                                   // (las traducciones no se cargan en los tests)
  G.Audio = { sfx() {} }; G.Camera = { kick() {} }; G.Pad = { rumble() {} };
  G.FX = { dmgText() {}, burst() {}, ring() {} }; G.Projectiles = { clearOrbs() {} };
  G.Modes = { rand: () => Math.random, healK: () => 1, noRevive: () => false };
  new Function('G', source('js/entities/player.js'))(G);
  new Function('G', source('js/systems/levelup.js'))(G);
  return G;
}
const mk = G => { const pl = new G.Player(G.DEX_BY[4]); pl.activeGroup = () => []; pl.x = 0; pl.y = 0; return pl; };
const card = (G, id) => G.LevelUp.STATS.find(s => s.id === id);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('the new stat cards exist with a cap on how often they can be taken', () => {
  const G = world();
  for (const id of ['crit', 'critdmg', 'boss', 'execute', 'dodge', 'healmore', 'coins']) {
    const c = card(G, id);
    assert.ok(c, id);
    assert.ok(c.title && c.desc && c.icon, id + ' has texts and icon');
    assert.ok(c.max > 0, id + ' has a cap');
  }
});
test('crit chance card adds 5 points each time', () => {
  const G = world(), pl = mk(G), before = pl.critChance;
  card(G, 'crit').apply(pl); card(G, 'crit').apply(pl);
  near(pl.critChance, before + 0.10);
});
test('crit damage card adds 20 points to the multiplier, also on top of a passive that changes it', () => {
  const G = world(), pl = mk(G);
  near(pl.critFactor(), 1.5);
  card(G, 'critdmg').apply(pl);
  near(pl.critFactor(), 1.7);
  pl.abil = { critMul: 2 };
  near(pl.critFactor(), 2.2);
});
test('boss and execute cards multiply the damage dealt to the right enemies', () => {
  const G = world(), pl = mk(G);
  const boss = { boss: true, hp: 100, maxHp: 100 }, weak = { hp: 20, maxHp: 100 }, plain = { hp: 100, maxHp: 100 };
  near(pl.statDmgK(boss), 1); near(pl.statDmgK(weak), 1);
  card(G, 'boss').apply(pl); card(G, 'execute').apply(pl);
  near(pl.statDmgK(boss), 1.15);
  near(pl.statDmgK(weak), 1.25);
  near(pl.statDmgK(plain), 1);
  near(pl.statDmgK({ boss: true, hp: 10, maxHp: 100 }), 1.15 * 1.25);
  near(pl.statDmgK({ hp: 30, maxHp: 100 }), 1);                       // "por debajo del 30 %": el 30 % justo no cuenta
});
test('dodge card makes the player avoid hits at that rate', () => {
  const G = world(), pl = mk(G);
  const real = Math.random;
  try {
    Math.random = () => 0;
    pl.hurt(20, 'normal', false, 'physical');
    assert.ok(pl.hp < pl.maxHp, 'sin la carta no esquiva');
    pl.hp = pl.maxHp; pl.invuln = 0;
    card(G, 'dodge').apply(pl);
    near(pl.dodgeChance, 0.03);
    pl.hurt(20, 'normal', false, 'physical');
    assert.equal(pl.hp, pl.maxHp, 'esquiva con tirada baja');
    pl.invuln = 0; Math.random = () => 0.99;
    pl.hurt(20, 'normal', false, 'physical');
    assert.ok(pl.hp < pl.maxHp, 'recibe el golpe con tirada alta');
  } finally { Math.random = real; }
});
test('healing card scales every heal, stacking with a passive that heals more', () => {
  const G = world(), pl = mk(G);
  pl.hp = 1; pl.heal(10); near(pl.hp, 11);
  card(G, 'healmore').apply(pl);
  pl.hp = 1; pl.heal(10); near(pl.hp, 13);
  pl.abil = { healMul: 1.5 };
  pl.hp = 1; pl.heal(10); near(pl.hp, 1 + 10 * 1.2 * 1.5);
});
test('fortune card raises the coins earned by 10 % each time', () => {
  const G = world(), pl = mk(G), before = pl.coinMul;
  card(G, 'coins').apply(pl); card(G, 'coins').apply(pl);
  near(pl.coinMul, before * 1.1 * 1.1);
});
test('level-ups offer four cards, chosen with keys 1-4', () => {
  assert.match(source('js/systems/levelup.js'), /function offer\(pl, n = 4\)/);
  assert.match(source('js/game.js'), /i < 4; i\+\+\) \{\s*if \(G\.Input\.tap\('digit' \+ \(i \+ 1\)\)[^\n]*G\.RunUI\.pick\(i\)/);
  assert.match(source('dev.html'), /Elige una recompensa · <kbd>1<\/kbd> <kbd>2<\/kbd> <kbd>3<\/kbd> <kbd>4<\/kbd>/);
});
test('the pause summary shows the crit damage', () => {
  assert.match(source('js/ui/run-ui.js'), /'Daño crítico', k2\(pl\.critFactor\(\)\)/);
});

// ---------------- rareza de las cartas de mejora ----------------

const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const stub = G => { G.Moves = { levelUp: m => { m.lvl++; return true; } }; return G; };

test('rarity is rolled with the gacha rates plus a rare Mythic', () => {
  const G = world();
  const r = x => G.LevelUp.rollRarity(() => x);
  assert.deepEqual([0, 0.449, 0.45, 0.749, 0.75, 0.919, 0.92, 0.984, 0.985, 0.994, 0.995, 0.9999].map(r),
                   [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
});
test('single-stat cards scale with rarity 1-3: the same stat, a bigger number', () => {
  const G = stub(world());
  const atk = card(G, 'atk'), pool = G.LevelUp.STATS;
  const val = rarity => { const pl = mk(G), c = G.LevelUp.statCard(pl, atk, rarity, pool, seq(0)); c.apply(pl); return pl.atkMul; };
  const [a, b, c] = [1, 2, 3].map(val);
  assert.ok(a < b && b < c, `${a} < ${b} < ${c}`);
  const card1 = G.LevelUp.statCard(mk(G), atk, 1, pool, seq(0)), card3 = G.LevelUp.statCard(mk(G), atk, 3, pool, seq(0));
  assert.equal(card1.rarity, 1); assert.equal(card3.rarity, 3);
  assert.notEqual(card1.desc, card3.desc);
  assert.ok(card3.desc.includes('+' + Math.round((c - 1) * 100) + '%'), card3.desc);
});
test('Epic and Legendary cards combine 2 or 3 different stats, Legendary stronger', () => {
  const G = stub(world()), pool = G.LevelUp.STATS.filter(s => s.id !== 'heal');
  for (const rarity of [4, 5]) for (const r of [0, 0.99]) {
    const pl = mk(G), c = G.LevelUp.statCard(pl, card(G, 'atk'), rarity, pool, seq(r, 0.1, 0.2, 0.3, 0.4));
    assert.ok(c.parts.length >= 2 && c.parts.length <= 3, 'partes: ' + c.parts.length);
    assert.equal(new Set(c.parts.map(p => p.id)).size, c.parts.length, 'sin repetir');
    assert.ok(c.parts.every(p => p.k > 0));
    for (const p of c.parts) assert.ok(c.desc.includes(G.LevelUp.STATS.find(s => s.id === p.id).title));
  }
  const total = rarity => G.LevelUp.statCard(mk(G), card(G, 'atk'), rarity, pool, seq(0, 0.1, 0.2)).parts.reduce((a, p) => a + p.k, 0);
  assert.ok(total(5) > total(4));
  assert.ok(total(4) > G.LevelUp.statCard(mk(G), card(G, 'atk'), 3, pool, seq(0)).parts[0].k, 'Épica > Rara');
});
test('combined cards count one pick of each included stat (move evolutions need those picks)', () => {
  const G = stub(world()), pl = mk(G), pool = G.LevelUp.STATS.filter(s => s.id !== 'heal');
  const c = G.LevelUp.statCard(pl, card(G, 'atk'), 4, pool, seq(0, 0.1));
  const before = Object.assign({}, pl.statsTaken);
  c.apply(pl);
  for (const p of c.parts) assert.equal(pl.statsTaken[p.id], (before[p.id] || 0) + 1, p.id);
});
test('bundles never include a stat that has no room left, nor the instant heal', () => {
  const G = stub(world());
  const pool = G.LevelUp.STATS.filter(s => s.id !== 'heal' && ['atk', 'spd'].includes(s.id));
  const c = G.LevelUp.statCard(mk(G), card(G, 'atk'), 5, pool, seq(0.99, 0.5, 0.5));
  assert.ok(c.parts.every(p => ['atk', 'spd'].includes(p.id)));
});
test('Mythic trade-off lowers one small stat and raises another a lot', () => {
  const G = stub(world()), pool = G.LevelUp.STATS.filter(s => s.id !== 'heal');
  const pl = mk(G), before = { spd: pl.spdMul, cd: pl.cdMul, atk: pl.atkMul };
  const c = G.LevelUp.statCard(pl, card(G, 'atk'), 6, pool, seq(0.1, 0.1, 0.1, 0.1));   // < 0.5: kind "Pacto"
  assert.equal(c.rarity, 6);
  const up = c.parts.filter(p => p.k > 0), down = c.parts.filter(p => p.k < 0);
  assert.equal(up.length, 1); assert.equal(down.length, 1);
  assert.ok(up[0].k >= 3 && down[0].k > -1 && down[0].k < 0);
  assert.ok(['spd', 'cd', 'mag', 'xp'].includes(down[0].id), 'sólo baja un stat que no te deja sin nada');
  c.apply(pl);
  assert.ok(pl.statsTaken[up[0].id] === 1 && !pl.statsTaken[down[0].id], 'la bajada no cuenta como elección');
});
test('Mythic ascension is a Legendary-sized bundle plus a level for one of your moves', () => {
  const G = stub(world()), pool = G.LevelUp.STATS.filter(s => s.id !== 'heal');
  const pl = mk(G);
  const maxed = { lvl: 5, def: { maxLvl: 5 } }, open = { lvl: 2, def: { maxLvl: 5 } };
  pl.moves = [maxed, open];
  const c = G.LevelUp.statCard(pl, card(G, 'atk'), 6, pool, seq(0.9, 0.1, 0.2, 0.3, 0.4));   // >= 0.5: "Ascensión"
  assert.ok(c.parts.length === 3 && c.parts.every(p => p.k > 0));
  c.apply(pl);
  assert.equal(open.lvl, 3); assert.equal(maxed.lvl, 5, 'no toca un movimiento ya al máximo');
});
test('negative effects never leave the player with impossible values', () => {
  const G = stub(world()), pl = mk(G);
  for (const s of G.LevelUp.STATS) { if (s.id === 'heal') continue; s.apply(pl, -1.5); }
  assert.ok(pl.dmgReduce >= 0 && pl.critChance >= 0 && pl.dodgeChance >= 0 && pl.spdMul > 0 && pl.cdMul > 0 && pl.maxHp > 0);
});
test('the heal card scales with rarity', () => {
  const G = stub(world()), pool = G.LevelUp.STATS;
  const heal = r => { const pl = mk(G); pl.hp = 1; G.LevelUp.statCard(pl, card(G, 'heal'), r, pool, seq(0)).apply(pl); return pl.hp; };
  assert.ok(heal(1) < heal(2) && heal(2) < heal(3));
});
test('the offer shows rarity: card carries rarity, name and colour', () => {
  const G = stub(world()), pl = mk(G);
  const c = G.LevelUp.statCard(pl, card(G, 'atk'), 4, G.LevelUp.STATS.filter(s => s.id !== 'heal'), seq(0, 0.1));
  assert.equal(c.rarity, 4); assert.equal(c.tag, 'Épica'); assert.match(c.rcolor, /^#[0-9a-f]{6}$/i);
  assert.equal(G.LevelUp.statCard(pl, card(G, 'atk'), 1, G.LevelUp.STATS, seq(0)).tag, 'Mejora');
  assert.match(source('js/ui/run-ui.js'), /c\.rarity/);
});

test('the pause summary lists every stat the level-up cards can change', () => {
  const ui = source('js/ui/run-ui.js');
  for (const row of ["'Esquiva', pct(pl.dodgeChance", "'Daño a jefes', k2(pl.bossDmg", "'Daño a débiles', k2(pl.executeDmg",
                     "'Curación', k2(pl.healMul", "'Imán', k2(pl.magnet", "'Experiencia', k2(pl.xpMul", "'Pokémonedas', k2(pl.coinMul"]) {
    assert.ok(ui.includes(row), row);
  }
});
