const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// Azar fijo y alto: una grieta normal necesita 5 fallos seguidos (150 s sin otra grieta) para salir,
// así no se cruza con la especial en estas pruebas.
Math.random = () => 0.999;

// G mínimo para cargar js/systems/rift.js sin el juego.
function world(opts = {}) {
  const calls = { broadcast: [], give: [], commit: [], say: [], added: [], rolls: 0, dmgText: [] };
  const pl = { x: 0, y: 0, dead: false, bonds: 0, bodyH: 20, dex: 1, revive() {} };
  let boss = false;
  const enemies = new Map();
  const mons = [{ dex: 150, name: 'Mewtwo', leg: true, types: ['psychic'], spd: 130 },
                { dex: 151, name: 'Mew', leg: true, types: ['psychic'], spd: 100 }];
  const G = {
    U: {
      dist2: (a, b, c, d) => (a - c) ** 2 + (b - d) ** 2,
      pick: a => a[0], rand: (a, b) => (a + b) / 2, clamp: (v, a, b) => Math.min(b, Math.max(a, v)), mmss: () => ''
    },
    Coop: Object.assign({ active: false, isHost: false, broadcast(m) { calls.broadcast.push(m); }, toHost() {}, scaleHp: () => 1 }, opts.coop),
    Game: { player: pl, everyone: () => [pl], st: { time: 1500 }, flash() {}, offerBond() {} },
    World: { biome: 'grass', isFree: () => true, setArena() {}, setBiome() {} },
    Tiles: { T: 16, arenaBiome: t => t, ARENA_THEMES: {} },
    Sprites: { PX: 3, hasShiny: () => false },
    Audio: { sfx() {} },
    FX: { ring() {}, px() {}, dmgText(x, y, t) { calls.dmgText.push(t); } },
    EnemyMgr: {
      bossAlive: () => boss, stash() {}, clearRemote() {}, restore() {}, all: () => [...enemies.values()],
      add(e) { e.id = enemies.size + 1; enemies.set(e.id, e); calls.added.push(e); }, get: id => enemies.get(id)
    },
    Projectiles: { clear() {} }, Combat: { clearFields() {} }, Hazards: { clear() {} },
    Weather: { force() {}, clear() {} }, Camera: { kick() {} },
    Spawner: { say(t) { calls.say.push(t); } },
    // La de verdad (30:00). Las grietas normales no estorban: Math.random fijo (arriba) las deja sin salir.
    Judgment: { AT: 1800 },
    Modes: { classic: () => true },
    DEX: mons, DEX_BY: { 150: mons[0], 151: mons[1] }, SPRITE_META: { 150: {}, 151: {} },
    DB: { save: { legends: {} }, commit(u) { calls.commit.push(u); return true; } },
    Progress: { event() {} },
    Pickups: { pullAll() {} },
    Enemy: class { constructor(def) { this.def = def; this.name = def.name; this.maxHp = def.hp; this.dead = false; } makeShiny() {} },
    Gacha: { rollWish() { calls.rolls++; return 'wishtype'; } },
    Shop: {
      give(id, n) { calls.give.push([id, n]); return n; },
      ITEMS: { wishsure: { name: 'Guarantee Ticket' }, wishtype: { name: 'Type Pick Ticket' }, wishany: { name: 'Free Pick Ticket' } }
    },
    Prestige: { bonus: () => ({ dmgMul: 1, hpMul: 1 }) },
    Rank: { bonus: () => ({ dmgMul: 1, hpMul: 1 }) }
  };
  new Function('G', source('js/systems/rift.js'))(G);
  return { G, R: G.Rift, pl, calls, setBoss(v) { boss = v; } };
}

/** Avanza el reloj de la partida de 1 s en 1 s (el jugador no entra en la grieta: está lejos). */
function run(w, from, to) { for (let t = from; t <= to; t++) w.R.update(1, w.pl, t); }
const specialRifts = w => w.calls.broadcast.filter(m => m[0] === 'rift').length;

const BASE = { hp: 1000, dmg: 40, shotDmg: 20, spd: 60, shotCd: 0.9, xp: 500, name: 'Mew' };

test('apexDef multiplies hp, dmg, shotDmg and spd, shoots faster and does not touch its input', () => {
  const { R } = world();
  const d = Object.assign({}, BASE);
  const a = R.apexDef(d, 1);
  assert.deepEqual(d, BASE, 'pura: no cambia el def original');
  assert.notEqual(a, d);
  assert.equal(a.hp, BASE.hp * R.APEX.hp);
  assert.equal(a.dmg, BASE.dmg * R.APEX.dmg);
  assert.equal(a.shotDmg, BASE.shotDmg * R.APEX.dmg);
  assert.equal(a.spd, BASE.spd * R.APEX.spd);
  assert.ok(Math.abs(a.shotCd - BASE.shotCd / R.APEX.shots) < 1e-9);
  assert.equal(a.xp, BASE.xp);
  assert.deepEqual(R.APEX, { hp: 6, dmg: 1.8, spd: 1.2, shots: 1.5 });
});

test('apexDef power multiplies only hp a bit more', () => {
  const { R } = world();
  const a = R.apexDef(BASE, 1), b = R.apexDef(BASE, 1.4);
  assert.ok(Math.abs(b.hp / a.hp - 1.4) < 0.01);
  assert.equal(b.dmg, a.dmg);
  assert.equal(R.apexDef(BASE).hp, a.hp, 'sin power cuenta como 1');
});

test('the special rift comes before the Judgment of Arceus', () => {
  const { R } = world();
  assert.equal(R.SPECIAL_AT, 1500);
  assert.match(source('js/systems/judgment.js'), /const AT = 30 \* 60;/);
  assert.ok(R.SPECIAL_AT < 1800);
  assert.equal(R.SPECIAL_END, 1800 - 120 - 45, 'portal (45 s) + arena (2 min) acaban antes de las 30:00');
});

test('a retry that would fall after AT - ARENA_TIME - TTL does not open the special rift', () => {
  // con un jefe vivo hasta 1625, los reintentos son 1500, 1530 … 1620 (jefe) y el siguiente, 1650 > 1635
  const w = world({ coop: { active: true, isHost: true } });
  w.setBoss(true);
  run(w, 1500, 1625);
  w.setBoss(false);
  run(w, 1626, 1799);
  assert.equal(specialRifts(w), 0, 'ya no da tiempo: no se abre');
  assert.ok(!w.R.rift || !w.R.rift.special);
  // antes del límite sí se reintenta: jefe hasta 1595 → se abre en 1620
  const v = world({ coop: { active: true, isHost: true } });
  v.setBoss(true);
  run(v, 1500, 1595);
  v.setBoss(false);
  run(v, 1596, 1620);
  assert.ok(v.R.rift && v.R.rift.special);
});

test('host: no special rift at 1499 s and exactly one at 1500 s (never two at once)', () => {
  const w = world({ coop: { active: true, isHost: true } });
  w.R.update(1, w.pl, 1499);
  assert.equal(w.R.rift, null);
  w.R.update(1, w.pl, 1500);
  assert.ok(w.R.rift && w.R.rift.special, 'abre la grieta especial');
  assert.equal(specialRifts(w), 1);
  run(w, 1501, 1540);                         // aún no caduca: sigue la misma, sin abrir otra
  assert.equal(specialRifts(w), 1);
});

test('an unvisited special rift reopens after it expires, until it no longer fits before the Judgment', () => {
  const w = world({ coop: { active: true, isHost: true } });
  run(w, 1500, 1634);                         // caduca sin que nadie entre (TTL 45 s)
  const n = specialRifts(w);
  assert.ok(n >= 2, 'se vuelve a abrir al caducar: ' + n);
  run(w, 1635, 1799);
  assert.equal(specialRifts(w), n, 'pasado AT - ARENA_TIME - TTL ya no se abre');
  assert.ok(!w.R.rift || !w.R.rift.special || w.R.rift.ttl > 0);
});

test('entering the special rift spends the chance: it does not reopen later', () => {
  const w = world({ coop: { active: true, isHost: true } });
  w.R.update(1, w.pl, 1500);
  w.pl.x = w.R.rift.x; w.pl.y = w.R.rift.y - 10;
  w.R.update(1, w.pl, 1501);
  assert.ok(w.R.arena);
  const n = specialRifts(w);
  w.pl.x = 0; w.pl.y = 0;
  run(w, 1502, 1634);
  assert.equal(specialRifts(w), n);
});

test('a non-host never opens the special rift', () => {
  const w = world({ coop: { active: true, isHost: false } });
  run(w, 1495, 1700);
  assert.equal(w.R.rift, null);
});

test('it waits while a normal rift, arena or boss is active, then opens', () => {
  const w = world();
  w.R.debugOpen();                            // grieta normal abierta
  assert.ok(w.R.rift && !w.R.rift.special);
  w.R.update(1, w.pl, 1500);
  assert.ok(!w.R.rift.special, 'no la sustituye');
  run(w, 1501, 1600);                         // la normal caduca; se reintenta cada CHECK
  assert.ok(w.R.rift && w.R.rift.special, 'después se abre la especial');

  const w2 = world();
  w2.R.debugArena('psychic');                 // arena normal en marcha
  w2.R.update(1, w2.pl, 1500);
  assert.equal(w2.R.rift, null);
  assert.ok(w2.R.arena && !w2.R.special);

  const w3 = world();
  w3.setBoss(true);
  run(w3, 1500, 1560);
  assert.equal(w3.R.rift, null, 'con un jefe vivo espera');
  w3.setBoss(false);
  run(w3, 1561, 1610);
  assert.ok(w3.R.rift && w3.R.rift.special);
});

test('after a normal arena ends, the special rift opens', () => {
  const w = world();
  w.R.debugArena('psychic');
  w.R.onEvent(['al']);                        // perdida
  run(w, 1500, 1503);                         // vuelve al mapa (1,2 s) y espera su CHECK
  assert.equal(w.R.arena, null);
  run(w, 1504, 1560);
  assert.ok(w.R.rift && w.R.rift.special);
});

test('reset() re-arms the special rift for the next run', () => {
  const w = world();
  run(w, 1500, 1501);
  assert.ok(w.R.rift.special);
  w.R.reset();
  assert.equal(w.R.rift, null);
  w.R.update(1, w.pl, 1500);
  assert.ok(w.R.rift && w.R.rift.special);
});

test('the special rift does not count as a random-rift miss', () => {
  const w = world();
  assert.equal(w.R.misses, 0);
  run(w, 1500, 1501);
  assert.equal(w.R.misses, 0);
  const orig = Math.random;
  Math.random = () => 0.99;                   // la grieta normal nunca sale
  try { w.R.reset(); run(w, 76, 200); } finally { Math.random = orig; }
  assert.ok(w.R.misses > 0, 'las normales siguen contando');
});

test('entering the special rift starts a special Apex arena', () => {
  const w = world({ coop: { active: true, isHost: true } });
  w.R.update(1, w.pl, 1500);
  const r = w.R.rift;
  w.pl.x = r.x; w.pl.y = r.y - 10;
  w.R.update(1, w.pl, 1501);
  assert.ok(w.R.arena && w.R.special);
  const msg = w.calls.broadcast.find(m => m[0] === 'arena');
  assert.equal(msg[1].special, true, 'el aviso de arena lleva special');
  const e = w.calls.added[0];
  assert.ok(e.apex && e.legend);
  assert.ok(w.calls.say.some(t => /APEX/.test(t)));
});

test('a guest keeps special from the arena message', () => {
  const w = world({ coop: { active: true, isHost: false } });
  w.R.onEvent(['arena', { tx: 6000, ty: 6000, r: 11, dex: 150, shiny: false, type: 'psychic', special: true }]);
  assert.ok(w.R.special);
});

test('power is the average of Prestige x Rank hp bonus of the players', () => {
  const w = world();
  const p2 = { x: 0, y: 0, dead: false, dex: 2 };
  w.G.Game.everyone = () => [w.pl, p2];
  w.G.Prestige.bonus = dex => ({ hpMul: dex === 1 ? 1.2 : 1 });
  w.G.Rank.bonus = dex => ({ hpMul: dex === 1 ? 1.5 : 1.2 });
  w.R.debugSpecial();
  const plain = world(); plain.G.Game.everyone = () => [plain.pl, p2]; plain.R.debugSpecial();
  const k = w.calls.added[0].def.hp / plain.calls.added[0].def.hp;
  assert.ok(Math.abs(k - (1.2 * 1.5 + 1.2) / 2) < 0.01, String(k));
});

test('winning the special arena pays one wish ticket once and commits', () => {
  const w = world();
  w.R.debugSpecial();
  assert.ok(w.R.special);
  w.R.onEvent(['aw']);
  w.R.onEvent(['aw']);
  assert.equal(w.calls.rolls, 1);
  assert.deepEqual(w.calls.give, [['wishtype', 1]]);
  assert.ok(w.calls.commit.includes(true));
  assert.equal(w.pl.wishFound, 'wishtype');
  assert.ok(w.calls.dmgText.includes('+1 Type Pick Ticket'));
});

test('with the bag at the 999 cap no ticket is claimed: no wishFound and no "+1" text', () => {
  const w = world();
  w.G.Shop.give = (id, n) => { w.calls.give.push([id, n]); return 0; };
  w.R.debugSpecial();
  w.R.onEvent(['aw']);
  assert.equal(w.calls.rolls, 1);
  assert.equal(w.pl.wishFound, undefined);
  assert.ok(!w.calls.dmgText.some(t => /^\+1 /.test(t)));
});

test('the real roll is always one of the three wish tickets', () => {
  const g = {};
  new Function('G', source('js/systems/gacha.js'))(g);
  for (const x of [0, 0.5, 0.79, 0.8, 0.9, 0.95, 0.999]) {
    assert.ok(['wishsure', 'wishtype', 'wishany'].includes(g.Gacha.rollWish(() => x)));
  }
});

test('losing the special arena pays nothing and it does not reopen', () => {
  const w = world();
  w.R.update(1, w.pl, 1500);
  const r = w.R.rift;
  w.pl.x = r.x; w.pl.y = r.y - 10;
  w.R.update(1, w.pl, 1501);
  assert.ok(w.R.special);
  w.R.onEvent(['al']);
  assert.equal(w.calls.rolls, 0);
  assert.deepEqual(w.calls.give, []);
  assert.equal(w.pl.wishFound, undefined);
  w.pl.x = 0; w.pl.y = 0;
  run(w, 1502, 1619);
  assert.equal(w.R.arena, null);
  assert.equal(w.R.rift, null, 'no se vuelve a abrir');
});

test('a normal arena win is unchanged: bond, no wish ticket', () => {
  const w = world();
  w.R.debugArena('psychic');
  assert.ok(!w.R.special);
  assert.ok(!w.calls.added[0].apex);
  w.R.onEvent(['aw']);
  assert.equal(w.pl.bonds, 1);
  assert.equal(w.calls.rolls, 0);
  assert.deepEqual(w.calls.give, []);
  assert.equal(w.pl.wishFound, undefined);
});

test('arenaInfo is null outside the arena and gives the centre and the playable radius inside', () => {
  const w = world({ coop: { active: true, isHost: true } });
  assert.equal(w.R.arenaInfo(), null);
  w.R.update(1, w.pl, 1500);
  w.pl.x = w.R.rift.x; w.pl.y = w.R.rift.y - 10;
  w.R.update(1, w.pl, 1501);
  assert.ok(w.R.arena);
  const a = w.R.arenaInfo();
  assert.equal(a.x, w.R.arena.x);
  assert.equal(a.y, w.R.arena.y);
  const ts = w.G.Tiles.T * w.G.Sprites.PX;                 // 16 × 3 en este mundo de pruebas
  assert.equal(a.r, (w.R.arena.r - 0.9) * ts);
});
