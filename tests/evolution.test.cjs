const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function world(...files) {
  const G = { U: { TYPE_NAME: {} }, Types: { mult: () => 1 }, Weather: { current: null } };
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const data = () => world('js/data/pokedex.js', 'js/data/evolutions.js');

test('every EVO target exists in the pokedex and never points to itself', () => {
  const G = data();
  for (const [from, to] of Object.entries(G.EVO)) {
    assert.ok(G.DEX_BY[from], 'source ' + from);
    for (const t of to) { assert.ok(G.DEX_BY[t], `${from} -> ${t}`); assert.notEqual(+from, t); }
  }
});
test('chains have no cycles', () => {
  const G = data();
  for (const start of Object.keys(G.EVO)) {
    let layer = [+start];
    for (let step = 0; step < 6 && layer.length; step++) layer = layer.flatMap(d => G.EVO[d] || []);
    assert.equal(layer.length, 0, 'chain from ' + start + ' is too long or cyclic');
  }
});
test('known chains', () => {
  const G = data();
  assert.deepEqual(G.EVO[4], [5]);
  assert.deepEqual(G.EVO[5], [6]);
  for (const d of [134, 135, 136, 196, 197]) assert.ok(G.EVO[133].includes(d), 'eevee -> ' + d);
  assert.ok(!(G.EVO[6] || []).length);
});
test('EVO_FROM is the inverse of EVO', () => {
  const G = data();
  for (const [from, to] of Object.entries(G.EVO)) for (const t of to) assert.ok(G.EVO_FROM[t].includes(+from));
  for (const [to, froms] of Object.entries(G.EVO_FROM)) for (const f of froms) assert.ok(G.EVO[f].includes(+to));
});

// ---------------- G.Evo ----------------
function evoWorld(owned) {
  const G = data();
  G.DB = { owns: d => owned.includes(d) };
  G.T = s => s;
  G.I18n = { f: (s, ...v) => { let i = 0; return s.replace(/\{(?:x|name)\}/g, () => v[i++]); } };
  new Function('G', source('js/systems/evolution.js'))(G);
  return G;
}
const mk = (dex, level, evoStone = 0) => ({ dex, level, evoStone, evolve() {} });

test('options needs level and ownership; second evolution needs the higher level', () => {
  const G = evoWorld([5, 6]);
  assert.deepEqual(G.Evo.options(mk(4, 11)), []);
  assert.deepEqual(G.Evo.options(mk(4, 12)), [5]);
  assert.deepEqual(G.Evo.options(mk(5, 12)), []);
  assert.deepEqual(G.Evo.options(mk(5, 24)), [6]);
  assert.deepEqual(evoWorld([]).Evo.options(mk(4, 30)), []);
});
test('Eevee only offers owned forms', () => {
  assert.deepEqual(evoWorld([134]).Evo.options(mk(133, 12)), [134]);
  assert.deepEqual(evoWorld([134, 135]).Evo.options(mk(133, 12)).sort(), [134, 135]);
});
test('ready needs a stone', () => {
  const G = evoWorld([5]);
  assert.equal(G.Evo.ready(mk(4, 12, 0)), false);
  assert.equal(G.Evo.ready(mk(4, 12, 1)), true);
  assert.equal(G.Evo.ready(mk(4, 5, 1)), false);
});
test('lootFor: boss and chest always when eligible without a stone; enemies rarely', () => {
  const G = evoWorld([5]);
  for (const kind of ['boss', 'chest']) {
    assert.equal(G.Evo.lootFor(mk(4, 12, 0), kind), true);
    assert.equal(G.Evo.lootFor(mk(4, 12, 1), kind), false);
    assert.equal(G.Evo.lootFor(mk(4, 11, 0), kind), false);
    assert.equal(G.Evo.lootFor(mk(6, 40, 0), kind), false);
  }
  assert.equal(G.Evo.lootFor(mk(4, 12), 'enemy', () => 0.0004), true);
  assert.equal(G.Evo.lootFor(mk(4, 12), 'enemy', () => 0.0006), false);
  assert.equal(G.Evo.lootFor(mk(4, 5), 'enemy', () => 0), false);
});
test('cards: one per owned target; applying one evolves, consumes the stone and celebrates', () => {
  const G = liveWorld([134, 136]);
  const pl = live(133, 12, 1); pl.mon = { name: 'Eevee' };
  const cards = G.Evo.cards(pl);
  assert.equal(cards.length, 2);
  assert.ok(cards.every(c => c.type === 'mevo' && c.icon && c.title && c.desc));
  cards.find(c => c.dex === 136).apply(pl);
  assert.deepEqual(pl.evolved, [136]);
  assert.equal(pl.evoStone, 0);
  assert.match(G.said, /Eevee/);
});

// ---------------- Player.evolve ----------------
function playerWorld() {
  const G = world('js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passive-unique-fx.js', 'js/data/passives-common.js',
    'js/data/passives.js', 'js/data/ability-fx.js');
  G.Sprites = {
    hasShiny: () => false, playerScale: () => 1, playerRadius: () => 10, bodyHeight: () => 30,
    preload: () => Promise.resolve(), Animator: class { constructor(dex) { this.dex = dex; } play() {} }
  };
  G.Mons = { monFor: dex => G.DEX_BY[dex] };
  G.Coop = { active: false };
  new Function('G', source('js/entities/player.js'))(G);
  return G;
}
const FIELDS = ['critChance', 'magnet', 'xpMul', 'coinMul', 'regenFlat', 'cdMul', 'maxHp'];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test('evolve keeps level, xp, moves and the hp ratio', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[4]); pl.setAbility();
  pl.level = 15; pl.xp = 77; pl.moves = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; pl.hp = pl.maxHp * 0.5;
  pl.evolve(5);
  assert.equal(pl.dex, 5); assert.equal(pl.mon.dex, 5); assert.equal(pl.anim.dex, 5);
  assert.equal(pl.level, 15); assert.equal(pl.xp, 77); assert.equal(pl.moves.length, 3);
  near(pl.hp / pl.maxHp, 0.5, 'hp ratio');
});
test('evolve scales the hp difference by the Prestige and Rank bonus of the line', () => {
  const G = playerWorld();
  G.Prestige = { bonus: () => ({ hpMul: 1.2 }) }; G.Rank = { bonus: () => ({ hpMul: 1.5 }) };
  const pl = new G.Player(G.DEX_BY[4]); pl.setAbility();
  const before = pl.maxHp;
  pl.evolve(5);
  assert.equal(pl.maxHp, before + Math.round((G.DEX_BY[5].hp - G.DEX_BY[4].hp) * 1.8));
  const rem = new G.Player(G.DEX_BY[4]); rem.remote = true; rem.setAbility();
  const b2 = rem.maxHp; rem.evolve(5);
  assert.equal(rem.maxHp, b2 + G.DEX_BY[5].hp - G.DEX_BY[4].hp, 'a remote player is not scaled');
});
test('two evolutions leave the passive fields like a fresh Charizard', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[4]); pl.setAbility();
  pl.evolve(5); pl.evolve(6);
  const fresh = new G.Player(G.DEX_BY[6]); fresh.setAbility();
  for (const k of FIELDS) near(pl[k], fresh[k], k);
});
test('evolving back and forth many times does not drift', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[150]); pl.setAbility();      // pasiva con varios efectos
  const base = FIELDS.map(k => pl[k]);
  for (let i = 0; i < 20; i++) { pl.evolve(493); pl.evolve(150); }
  FIELDS.forEach((k, i) => near(pl[k], base[i], k));
});
test('clearAbility removes conditional state', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[4]); pl.setAbility();
  Object.assign(pl, { streakN: 5, streakT: 3, pulseT: 2, hurtBoostT: 1, moxie: 0.1 });
  pl.clearAbility();
  for (const k of ['streakN', 'streakT', 'pulseT', 'hurtBoostT', 'moxie']) assert.ok(!pl[k], k);
  assert.equal(pl.abil, null);
});
test('evolving while dead does not revive, and hp stays inside 0..maxHp', () => {
  const G = playerWorld();
  const dead = new G.Player(G.DEX_BY[4]); dead.setAbility(); dead.hp = 0; dead.dead = true;
  dead.evolve(5);
  assert.equal(dead.dead, true); assert.equal(dead.hp, 0);
  const low = new G.Player(G.DEX_BY[4]); low.setAbility(); low.hp = 1;
  low.evolve(5);
  assert.ok(low.hp >= 1 && low.hp <= low.maxHp);
});

// ---------------- botín, evolución al instante y avisos ----------------
function liveWorld(owned) {
  const G = evoWorld(owned);
  G.Sprites = { preload: () => Promise.resolve() };
  G.FX = { ring() {}, burst() {}, dmgText() {} };
  G.Audio = { sfx() {} };
  G.Spawner = { say(msg) { G.said = msg; } };
  G.Progress = { grant() {} };
  G.DB.commit = () => {};
  return G;
}
const live = (dex, level, stone = 0) => {
  const pl = mk(dex, level, stone);
  Object.assign(pl, { x: 0, y: 0, bodyH: 20, dead: false, evolved: [] });
  pl.evolve = d => { pl.evolved.push(d); pl.dex = d; };
  return pl;
};

test('grantStone gives one stone and onKill/onChest follow the loot rules', () => {
  const G = liveWorld([5]);
  const pl = live(4, 12);
  G.Evo.onKill(pl, { boss: true });
  assert.equal(pl.evoStone, 1);
  const pl2 = live(4, 12);
  G.Evo.onKill(pl2, { boss: true, judge: true });                    // legendarios de la Sentencia: nada
  assert.equal(pl2.evoStone, 0);
  const pl3 = live(4, 12);
  G.Evo.onChest(pl3);
  assert.equal(pl3.evoStone, 1);
  const pl4 = live(4, 5);                                            // sin nivel: nada
  G.Evo.onChest(pl4); G.Evo.onKill(pl4, { boss: true });
  assert.equal(pl4.evoStone, 0);
  const pl5 = live(4, 12);
  G.Evo.onKill(pl5, {}, () => 0.0001);                                 // enemigo normal con suerte
  assert.equal(pl5.evoStone, 1);
});
test('game wiring: hooks are in place and evolution is a level-up card, not an automatic trigger', () => {
  assert.match(source('js/entities/enemy.js'), /G\.Evo\.onKill\(/);
  assert.match(source('js/world/world.js'), /G\.Evo\.onChest\(/);
  assert.doesNotMatch(source('js/game.js'), /offerEvolution|evoOpen|evolveNow|megaNow/);
  assert.match(source('js/systems/levelup.js'), /formCards\(pl\)/);
  assert.doesNotMatch(source('js/ui/run-ui.js'), /some\(c => c\.type === 'mevo'\)/);       // se puede cambiar de cartas
  const html = source('dev.html');
  assert.ok(html.indexOf('systems/evolution.js') < html.indexOf('js/game.js'));
});

// ---------------- cooperativo: evento ev ----------------
test('the evo event round-trips through the binary codec, alone and inside a frame', () => {
  const G = {}; new Function('G', source('js/net/codec.js'))(G);
  const C = G.NetCodec;
  for (const v of [['evo', 'u1', 6], { ev: [['evo', 'u1', 6], ['pb', 3, 4]], p: [1, 2, 3] }]) {
    const b = C.encode(v); assert.ok(b); assert.deepEqual(C.decode(b), v);
  }
});
test('setLook changes only the look: mon, dex, size and animation', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[4]); pl.setAbility();
  const hp = pl.maxHp, crit = pl.critChance;
  pl.setLook(G.DEX_BY[6]);
  assert.equal(pl.dex, 6); assert.equal(pl.mon.dex, 6); assert.equal(pl.anim.dex, 6);
  assert.equal(pl.maxHp, hp); assert.equal(pl.critChance, crit); assert.ok(pl.abil);
});
test('coop wiring: evo is sent when evolving and handled by host and clients', () => {
  const coop = source('js/net/coop.js');
  assert.equal((coop.match(/case 'evo':/g) || []).length, 2);      // anfitrión (de un invitado) y copia
  assert.match(coop, /function evolved\(/);
  assert.match(coop, /propBroken, evolved,/);                       // exportada en el return
  assert.match(source('js/entities/player.js'), /G\.Coop\.evolved\(/);
  assert.match(source('docs/MULTIPLAYER_PROTOCOL.md'), /`evo`/);
});

// ---------------- correcciones de la revisión final ----------------
test('the run keeps the starting Pokémon (dex, types, shiny) after evolving', () => {
  const G = playerWorld();
  const pl = new G.Player(G.DEX_BY[4]); pl.setAbility();
  pl.evolve(5); pl.evolve(6);
  assert.equal(pl.startDex, 4);
  assert.deepEqual(pl.startTypes, G.DEX_BY[4].types);
  assert.equal(pl.startShiny, false);
  assert.equal(pl.dex, 6);
});
test('endRun records the starting Pokémon, not the evolved one', () => {
  const game = source('js/game.js');
  assert.match(game, /save\.pused\[pl\.startDex\]/);
  assert.match(game, /types: pl\.startTypes/);
  assert.match(game, /dex: pl\.startDex, shiny: pl\.startShiny/);
});
// ---------------- fragmentos evolutivos de la partida ----------------
function shardWorld(owned) {
  const G = liveWorld(owned);
  G.said = null;
  G.DB.save = { shards: 0 }; G.DB.commits = [];
  G.DB.commit = k => G.DB.commits.push(k);
  G.Progress = { grant: r => { G.DB.save.shards += r.shards || 0; } };
  return G;
}
test('bosses give 3 shards and big chests 1, even with nothing to evolve into', () => {
  const G = shardWorld([]);                                          // no posee ninguna forma: no hay piedra
  const pl = live(4, 1);
  G.Evo.onKill(pl, { boss: true });
  assert.equal(G.DB.save.shards, 3);
  assert.equal(pl.evoStone, 0);
  G.Evo.onChest(pl);
  assert.equal(G.DB.save.shards, 4);
  assert.ok(G.DB.commits.length >= 2, 'se guardan al instante');
});
test('normal enemies and Judgment legendaries give no shards', () => {
  const G = shardWorld([5]);
  const pl = live(4, 12);
  G.Evo.onKill(pl, {}, () => 0);
  G.Evo.onKill(pl, { boss: true, judge: true });
  assert.equal(G.DB.save.shards, 0);
});
test('the run remembers how many shards it found, and the end screen shows them', () => {
  const G = shardWorld([]);
  const pl = live(4, 1);
  G.Evo.onKill(pl, { boss: true });
  G.Evo.onChest(pl);
  assert.equal(pl.shardsFound, 4);
  assert.match(source('js/game.js'), /shards: pl\.shardsFound/);
  assert.match(source('js/ui/run-ui.js'), /r\.shards/);
});