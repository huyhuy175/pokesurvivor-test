const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// ---------------- datos: los diez potenciadores nuevos ----------------

function moves() {
  const G = { U: { TYPE_COLOR: {}, TYPE_NAME: {} }, I18n: { add() {}, f: s => s } };
  new Function('G', source('js/data/moves.js'))(G);
  return G;
}

const NEW = {
  'focus-energy': ['bug', 'crit', 0.03, 5], 'laser-focus': ['ghost', 'critdmg', 0.08, 5], 'life-dew': ['fairy', 'hp', 0.06, 5],
  'volt-charge': ['electric', 'haste', 0.05, 5], 'bulk-up': ['fighting', 'atk', 0.08, 5], 'calm-mind': ['psychic', 'satk', 0.12, 5],
  'iron-defense': ['steel', 'def', 0.09, 5], 'rock-polish': ['rock', 'spd', 0.11, 5], 'ingrain': ['grass', 'regen', 2.0, 4],
  'hone-claws': ['dark', 'patk', 0.12, 5]
};
// Lo máximo que puede dar un potenciador a tope de acumulaciones (amount × stacks).
const CAP = { patk: 0.65, satk: 0.65, atk: 0.65, spd: 0.55, def: 0.45, regen: 8, crit: 0.15, critdmg: 0.40, hp: 0.30, haste: 0.25 };

test('the ten new buff moves exist with their type, stat, power and stacks', () => {
  const G = moves();
  for (const [id, [type, stat, amount, stacks]] of Object.entries(NEW)) {
    const m = G.Moves.BY_ID[id];
    assert.ok(m, id + ' missing');
    assert.equal(m.kind, 'buff', id);
    assert.equal(m.type, type, id);
    assert.equal(m.stat, stat, id);
    assert.equal(m.amount, amount, id);
    assert.equal(m.stacks, stacks, id);
    assert.ok(m.dur >= 7 && m.dur <= 9 && m.cd >= 0.7 && m.cd <= 1.0, id + ' timings');
    assert.ok(G.Moves.POOL[type].includes(id), id + ' is learnable by its type');
    assert.ok(/^No hace daño/.test(m.desc), id + ' desc follows the buff wording');
  }
  assert.equal(G.Moves.ALL.length, 113);
});

test('every buff move, old and new, stays under the cap of its stat', () => {
  const G = moves();
  const buffs = G.Moves.ALL.filter(m => m.kind === 'buff');
  assert.equal(buffs.length, 16);
  for (const m of buffs) {
    assert.ok(CAP[m.stat] != null, `${m.id}: unknown stat ${m.stat}`);
    assert.ok(m.amount * m.stacks <= CAP[m.stat] + 1e-9, `${m.id}: ${m.amount} × ${m.stacks} > ${CAP[m.stat]}`);
  }
});

// ---------------- jugador: las cuatro estadísticas nuevas ----------------

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
  G.T = s => s;
  G.Audio = { sfx() {} }; G.Camera = { kick() {} }; G.Pad = { rumble() {} };
  G.FX = { dmgText() {}, burst() {}, ring() {} }; G.Projectiles = { clearOrbs() {} };
  new Function('G', source('js/entities/player.js'))(G);
  return G;
}
const mk = G => { const pl = new G.Player(G.DEX_BY[4]); pl.activeGroup = () => []; pl.x = 0; pl.y = 0; return pl; };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('crit buff adds to the crit chance and ends with the buff', () => {
  const G = world(), pl = mk(G);
  pl.critChance = 0.1;
  near(pl.critNow(), 0.1);
  pl.addBuff('crit', 0.03, 8, 5);
  pl.addBuff('crit', 0.03, 8, 5);
  near(pl.critNow(), 0.16);
  assert.equal(pl.critChance, 0.1, 'the permanent chance is untouched');
  pl.tickBuffs(8.1);
  near(pl.critNow(), 0.1);
});

test('crit damage buff adds to the crit factor', () => {
  const G = world(), pl = mk(G);
  const base = pl.critFactor();
  pl.addBuff('critdmg', 0.08, 8, 5);
  pl.addBuff('critdmg', 0.08, 8, 5);
  near(pl.critFactor(), base + 0.16);
  pl.tickBuffs(9);
  near(pl.critFactor(), base);
});

test('haste buff shortens cooldowns on top of cdMul', () => {
  const G = world(), pl = mk(G);
  pl.cdMul = 0.9;
  near(pl.cdNow(), 0.9);
  pl.addBuff('haste', 0.05, 8, 5);
  pl.addBuff('haste', 0.05, 8, 5);
  near(pl.cdNow(), 0.9 / 1.1);
  pl.tickBuffs(9);
  near(pl.cdNow(), 0.9);
});

test('max hp buff raises max hp and hp, never compounds, and gives the hp back when it ends', () => {
  const G = world(), pl = mk(G);
  const base = pl.maxHp;
  pl.hp = pl.maxHp;
  pl.addBuff('hp', 0.06, 8, 5);
  pl.addBuff('hp', 0.06, 8, 5);
  pl.addBuff('hp', 0.06, 8, 5);
  const extra = Math.round(base * 0.18);
  assert.equal(pl.maxHp, base + extra);
  assert.equal(pl.hp, base + extra, 'the new hp is available straight away');
  pl.addBuff('hp', 0.06, 8, 5);                       // otra acumulación: se calcula sobre el máximo base
  assert.equal(pl.maxHp, base + Math.round(base * 0.24));
  pl.tickBuffs(9);
  assert.equal(pl.maxHp, base);
  assert.equal(pl.hp, base, 'full hp is clamped down to the normal maximum');
});

test('max hp buff ending while hurt keeps the hp and never kills', () => {
  const G = world(), pl = mk(G);
  const base = pl.maxHp;
  pl.addBuff('hp', 0.06, 8, 5);
  pl.addBuff('hp', 0.06, 8, 5);
  pl.hp = 5;
  pl.tickBuffs(9);
  assert.equal(pl.maxHp, base);
  assert.equal(pl.hp, 5);
  const dead = mk(G);
  dead.addBuff('hp', 0.06, 8, 5);
  dead.hp = 0; dead.dead = true;
  dead.tickBuffs(9);
  assert.equal(dead.hp, 0);
});

test('max hp buff respects other max hp changes made while it lasts', () => {
  const G = world(), pl = mk(G);
  const base = pl.maxHp;
  pl.addBuff('hp', 0.06, 8, 5);
  pl.addMaxHp(20);                                    // una carta de Vigor a mitad del buff
  pl.tickBuffs(9);
  assert.equal(pl.maxHp, base + 20);
});

test('the buff timer is shared: every stack of every buff expires on schedule', () => {
  const G = world(), pl = mk(G);
  pl.addBuff('crit', 0.03, 8, 5);
  pl.addBuff('haste', 0.05, 4, 5);
  pl.tickBuffs(5);
  assert.equal(pl.buffs.haste.n, 0);
  assert.equal(pl.buffs.crit.n, 1);
  pl.tickBuffs(4);
  assert.equal(pl.buffs.crit.n, 0);
});

// ---------------- cableado: quién lee los getters ----------------

test('combat, hud and the pause screen read the effective values', () => {
  assert.match(source('js/systems/combat.js'), /pl\.critNow\(\) > 0 && Math\.random\(\) < pl\.critNow\(\)/);
  assert.match(source('js/systems/combat.js'), /m\.cd \* pl\.cdNow\(\)/);
  assert.match(source('js/entities/player.js'), /m\.cd \* this\.cdNow\(\)/);
  assert.match(source('js/ui/hud.js'), /m\.cd \* pl\.cdNow\(\)/);
  const run = source('js/ui/run-ui.js');
  assert.match(run, /pct\(pl\.critNow\(\)\)/);
  assert.match(run, /pl\.cdNow\(\) < 0\.995/);
});

test('a remote teammate (ghost) never has its max hp changed by the hp buff', () => {
  const G = world(), pl = mk(G);
  pl.remote = true;
  const base = pl.maxHp;
  pl.addBuff('hp', 0.06, 8, 5);
  assert.equal(pl.maxHp, base);
  pl.tickBuffs(9);
  assert.equal(pl.maxHp, base);
});
