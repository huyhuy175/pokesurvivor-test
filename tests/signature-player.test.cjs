const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// Rank de cada dex en esta prueba (stars[dex] -> estrellas).
function world(stars = {}) {
  const G = { U: { TYPE_NAME: {}, TYPE_COLOR: {} }, Types: { mult: () => 1, label: () => null }, Weather: { mult: () => 1, current: null },
              I18n: { add() {}, f: s => s }, EnemyMgr: { queryCircle: () => [] } };
  for (const f of ['js/data/pokedex.js', 'js/data/mega.js', 'js/data/evolutions.js', 'js/data/passive-fx.js', 'js/data/passive-unique-fx.js',
    'js/data/passives-common.js', 'js/data/passives.js', 'js/data/ability-fx.js', 'js/data/moves.js', 'js/data/sigfx.js', 'js/data/signature-moves.js']) {
    new Function('G', source(f))(G);
  }
  G.Sprites = {
    hasShiny: () => false, playerScale: () => 1, playerRadius: () => 10, bodyHeight: () => 30,
    preload: () => Promise.resolve(), Animator: class { constructor(dex) { this.dex = dex; } play() {} }
  };
  G.Mons = { monFor: dex => G.DEX_BY[dex] };
  G.Coop = { active: false };
  G.Game = { st: { time: 0 } };
  G.Stats = { taken: () => 1 };
  G.T = s => s;
  G.Audio = { sfx() {} }; G.Camera = { kick() {} }; G.Pad = { rumble() {} };
  G.FX = { dmgText() {}, burst() {}, ring() {} }; G.Projectiles = { clearOrbs() {} };
  G.Mega = { BONUS: { dmg: 0.15, spd: 0.08, crit: 0.1, hp: 0.2, heal: 0.25 } };
  G.Rank = { stars, starsOf: dex => G.Rank.stars[G.Mons.monFor(dex) && rootOf(G, dex)] || 0 };
  new Function('G', source('js/entities/player.js'))(G);
  return G;
}
// Dex raíz de la línea (como Rank.root): el primero de la cadena de evolución o la base de una Mega.
function rootOf(G, dex) {
  let d = G.MEGA_FROM[dex] != null ? G.MEGA_FROM[dex] : dex;
  while (G.EVO_FROM[d] && G.EVO_FROM[d].length) d = G.EVO_FROM[d][0];
  return d;
}
const mk = (G, dex) => { const pl = new G.Player(G.DEX_BY[dex]); pl.setAbility(); pl.x = 0; pl.y = 0; return pl; };

test('below 5 stars there is no signature move; at 5 it appears in the last slot', () => {
  const G = world({ 150: 4 });
  const pl = mk(G, 150);
  pl.addMove('confusion');
  pl.syncSignature();
  assert.equal(pl.sig, null);
  assert.equal(pl.slots.length, 1);
  G.Rank.stars[150] = 5;
  pl.syncSignature();
  assert.equal(pl.sig.id, 'sig-150');
  assert.equal(pl.slots.length, 2);
  assert.equal(pl.slots[1][0], pl.sig, 'last slot');
  assert.ok(pl.moves.includes(pl.sig));
  assert.ok(pl.isSigSlot(1) && !pl.isSigSlot(0));
});

test('the signature slot does not use one of the four normal slots', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.addMove('confusion'); pl.syncSignature();
  for (const id of ['psybeam', 'psychic', 'psycho-cut']) assert.ok(pl.addMove(id), id);
  assert.equal(pl.slots.length, 5);
  assert.equal(pl.addMove('extrasensory'), false, 'a fifth normal move is still refused');
  assert.equal(pl.maxMoves, 4);
  assert.equal(pl.slots[4][0], pl.sig, 'it stays last after more moves are learned');
});

test('syncSignature is idempotent and never duplicates the move', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.addMove('confusion');
  pl.syncSignature(); const first = pl.sig;
  pl.syncSignature(); pl.syncSignature();
  assert.equal(pl.sig, first);
  assert.equal(pl.moves.filter(m => m.id === 'sig-150').length, 1);
  assert.equal(pl.slots.length, 2);
});

test('it can be selected with setActive and arrange never moves it', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.bind = { confusion: 3, psybeam: 0 };
  pl.addMove('confusion'); pl.addMove('psybeam'); pl.syncSignature();
  pl.arrange();
  assert.equal(pl.slots[pl.slots.length - 1][0], pl.sig);
  pl.setActive(pl.slots.length - 1);
  assert.equal(pl.activeMove(), pl.sig);
  pl.arrange();
  assert.equal(pl.activeMove(), pl.sig, 'still the active one after arrange');
});

test('evolving to another species with a signature move swaps it and keeps its level', () => {
  const G = world({ 4: 5 });                       // Charmander -> Charmeleon -> Charizard, línea con Rank 5
  const pl = mk(G, 4);
  pl.addMove('ember');
  pl.syncSignature();
  assert.equal(pl.sig, null, 'Charmander has no signature move');
  pl.evolve(5);
  assert.equal(pl.sig, null, 'neither has Charmeleon');
  pl.evolve(6);
  assert.equal(pl.sig.id, 'sig-6', 'Charizard does');
  G.Moves.levelUp(pl.sig); G.Moves.levelUp(pl.sig);
  assert.equal(pl.sig.lvl, 3);
  pl.megaUp(G.MEGA[6][0]);
  assert.equal(pl.sig.id, 'sig-6', 'a Mega keeps the move of its species');
  assert.equal(pl.sig.lvl, 3);
});

test('moving to a species without the move removes it and leaves a valid active slot', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.addMove('confusion'); pl.syncSignature();
  pl.setActive(1);
  pl.dex = 25; pl.mon = G.DEX_BY[25];              // sin su Rank en la tabla de pruebas
  G.Rank.stars[25] = 0;
  pl.syncSignature();
  assert.equal(pl.sig, null);
  assert.equal(pl.slots.length, 1);
  assert.ok(pl.active >= 0 && pl.active < pl.slots.length);
  assert.ok(!pl.moves.some(m => m.id === 'sig-150'));
  assert.equal(pl.activeGroup().length, 1);
});

test('the level of a removed signature move comes back with the species', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.addMove('confusion'); pl.syncSignature();
  G.Moves.levelUp(pl.sig);
  const lvl = pl.sig.lvl;
  G.Rank.stars[150] = 4; pl.syncSignature();       // el Rank tiene que bajar por un guardado antiguo
  assert.equal(pl.sig, null);
  G.Rank.stars[150] = 5; pl.syncSignature();
  assert.equal(pl.sig.lvl, lvl);
});

test('without the data or the Rank module nothing happens', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  delete G.SIG_OF;
  assert.doesNotThrow(() => pl.syncSignature());
  assert.equal(pl.sig, null);
  const H = world({ 150: 5 });
  const p2 = mk(H, 150);
  delete H.Rank;
  assert.doesNotThrow(() => p2.syncSignature());
  assert.equal(p2.sig, null);
});

test('a remote teammate never gets a signature move of its own', () => {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.remote = true;
  pl.syncSignature();
  assert.equal(pl.sig, null);
});

test('game and hud are wired for the signature slot', () => {
  assert.match(source('js/game.js'), /pl\.syncSignature\(\)/);
  assert.match(source('js/game.js'), /for \(let i = 0; i < 4; i\+\+\) \{\s*\n\s*if \(G\.Input\.tap\('digit'/);
  const hud = source('js/ui/hud.js');
  assert.match(hud, /pl\.maxMoves \+ \(pl\.sig \? 1 : 0\)/);
  assert.match(hud, /pl\.isSigSlot\(i\)/);
  assert.match(source('js/entities/player.js'), /this\.syncSignature\(\)/);
});

// ---------------- Task 5: ghép con buff ----------------

function sigPlayer() {
  const G = world({ 150: 5 });
  const pl = mk(G, 150);
  pl.addMove('confusion');
  pl.syncSignature();
  return { G, pl };
}
const learn = (pl, ...ids) => ids.forEach(id => assert.ok(pl.addMove(id), id));

test('the signature move fuses like a normal group: up to BOND_MAX moves, spending one bond each', () => {
  const { pl } = sigPlayer();
  learn(pl, 'calm-mind', 'nasty-plot', 'agility');
  pl.bonds = 4;
  const m = id => pl.moves.find(x => x.id === id);
  let opt = pl.bondOptions();
  assert.equal(opt.mode, 'sig');
  assert.equal(opt.group, pl.sigGroup());
  assert.deepEqual(opt.loose.map(x => x.id).sort(), ['agility', 'calm-mind', 'confusion', 'nasty-plot']);
  const g = pl.fuse([m('calm-mind')], opt.group);
  assert.equal(g, pl.sigGroup());
  assert.deepEqual(g.map(x => x.id), ['sig-150', 'calm-mind']);
  assert.equal(pl.bonds, 3);
  assert.equal(pl.slots.length, 4, 'the buff left its normal slot (4 = confusion, 2 buffs, sig group)');
  pl.fuse([m('confusion')], pl.sigGroup());
  pl.fuse([m('nasty-plot')], pl.sigGroup());
  assert.deepEqual(pl.sigGroup().map(x => x.id), ['sig-150', 'calm-mind', 'confusion', 'nasty-plot']);
  assert.equal(pl.bonds, 1);
  assert.equal(pl.activeMove(), pl.sig, 'the group is led by the signature move');
  assert.equal(pl.activeGroup().length, 4);
  assert.equal(pl.fuse([m('agility')], pl.sigGroup()), null, 'a fifth move is refused');
  assert.equal(pl.bonds, 1, 'and it costs nothing');
  assert.equal(pl.sigGroup().length, 4);
});

test('any loose move goes into the signature group, but the signature move never goes into a normal group', () => {
  const { pl } = sigPlayer();
  learn(pl, 'psybeam', 'calm-mind');
  pl.bonds = 5;
  const m = id => pl.moves.find(x => x.id === id);
  assert.equal(pl.fuse([pl.sig, m('psybeam')]), null, 'the signature move cannot be paired with a normal one');
  assert.equal(pl.bonds, 5);
  assert.equal(pl.fuse([m('psybeam')], pl.sigGroup()).length, 2, 'an attack joins the signature group');
  assert.equal(pl.bonds, 4);
  assert.equal(pl.slots.filter(s => s.length === 1).length, 2);
});

test('normal groups behave as before, as the alternative to the signature group', () => {
  const { pl } = sigPlayer();
  learn(pl, 'psybeam', 'psychic');
  pl.bonds = 4;
  let opt = pl.bondOptions();
  assert.equal(opt.mode, 'sig');
  opt = opt.alt;                                   // los grupos normales siguen ahí, como alternativa
  assert.equal(opt.mode, 'pair');
  assert.ok(opt.loose.every(m => m !== pl.sig), 'the signature move is never offered to pair');
  const m = id => pl.moves.find(x => x.id === id);
  const g = pl.fuse([m('confusion'), m('psybeam')]);
  assert.equal(g.length, 2);
  opt = pl.bondOptions().alt;
  assert.equal(opt.mode, 'add');
  assert.deepEqual(opt.loose.map(x => x.id), ['psychic']);
  pl.fuse([m('psychic')], opt.group);
  assert.equal(opt.group.length, 3, 'a normal group still tops out at BOND_MAX');
  learn(pl, 'psycho-cut');
  pl.fuse([m('psycho-cut')], opt.group);
  assert.equal(opt.group.length, 4);
  assert.equal(pl.bondOptions(), null, 'full group, no loose moves');
});

test('a full signature group falls back to the normal options', () => {
  const { pl } = sigPlayer();
  learn(pl, 'calm-mind', 'nasty-plot', 'psybeam');
  pl.bonds = 5;
  const m = id => pl.moves.find(x => x.id === id);
  pl.fuse([m('calm-mind')], pl.sigGroup());
  pl.fuse([m('nasty-plot')], pl.sigGroup());
  pl.fuse([m('psybeam')], pl.sigGroup());
  learn(pl, 'psychic');
  const opt = pl.bondOptions();
  assert.equal(opt.mode, 'pair');
  assert.deepEqual(opt.loose.map(x => x.id).sort(), ['confusion', 'psychic']);
});

test('with room in the signature group and in a normal group the player is offered both (opt.alt)', () => {
  const { pl } = sigPlayer();
  learn(pl, 'calm-mind', 'nasty-plot', 'psybeam');
  pl.bonds = 5;
  const m = id => pl.moves.find(x => x.id === id);
  const opt0 = pl.bondOptions();
  assert.equal(opt0.mode, 'sig');
  assert.equal(opt0.alt.mode, 'pair', 'two loose attacks can still be paired');
  pl.fuse([m('confusion'), m('psybeam')]);
  const opt = pl.bondOptions();
  assert.equal(opt.mode, 'sig');
  assert.equal(opt.alt.mode, 'add');
  assert.notEqual(opt.alt.group, opt.group);
  assert.equal(pl.fuse([m('calm-mind')], opt.alt.group).length, 3, 'the normal group grows, the signature one is untouched');
  assert.equal(pl.sigGroup().length, 1);
  assert.equal(pl.bondOptions().alt.mode, 'add');
  pl.fuse([m('nasty-plot')], pl.sigGroup());
  assert.equal(pl.bondOptions(), null, 'nothing loose is left');
});

test('losing the signature move returns its fused buffs to normal slots', () => {
  const { G, pl } = sigPlayer();
  learn(pl, 'calm-mind', 'nasty-plot');
  pl.bonds = 2;
  const m = id => pl.moves.find(x => x.id === id);
  pl.fuse([m('calm-mind')], pl.sigGroup());
  pl.fuse([m('nasty-plot')], pl.sigGroup());
  assert.equal(pl.slots.length, 2);
  pl.setActive(1);
  G.Rank.stars[150] = 4;
  pl.syncSignature();
  assert.equal(pl.sig, null);
  assert.deepEqual(pl.slots.map(s => s.map(x => x.id)), [['confusion'], ['calm-mind'], ['nasty-plot']]);
  assert.ok(pl.moves.some(x => x.id === 'calm-mind') && pl.moves.some(x => x.id === 'nasty-plot'));
  assert.ok(pl.active >= 0 && pl.active < pl.slots.length);
});

test('the bond screen treats the signature option like adding to a group, and a refused fusion changes nothing', () => {
  const run = source('js/ui/run-ui.js');
  assert.match(run, /const single = o => o\.mode === 'add' \|\| o\.mode === 'sig'/);
  assert.equal((run.match(/single\(/g) || []).length >= 4, true);
  const game = source('js/game.js');
  assert.match(game, /const group = pl\.fuse\(picked, \(chosen \|\| opt\)\.group\);\s*\n\s*if \(group\) \{/);
});

// ---------------- lượt sửa sau review ----------------

test('with a signature move the player can still learn four normal moves from level-up cards', () => {
  const G = world({ 150: 5 });
  G.Stats = { fit: () => 1, NAME: {}, taken: () => 1, sideOf: () => 'special' };
  G.Mons.taught = () => [];
  G.U.pickN = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
  G.Mega.ready = () => false; G.Evo = { ready: () => false }; G.Progress = { event() {} };
  new Function('G', source('js/systems/levelup.js'))(G);
  const pl = mk(G, 150);
  pl.addMove('confusion'); pl.syncSignature(); pl.addMove('psybeam'); pl.addMove('psychic');
  assert.equal(pl.slots.length, 4, '3 normal slots + the signature slot');
  const types = () => { const seen = new Set(); for (let i = 0; i < 40; i++) for (const c of G.LevelUp.offer(pl, 4)) seen.add(c.type); return seen; };
  assert.ok(types().has('new'), 'a new-move card is still offered while there is a free normal slot');
  pl.addMove('psycho-cut');
  assert.equal(pl.slots.length, 5);
  assert.ok(!types().has('new'), 'and none once the four normal slots are used');
});

test('the signature slot has its own key (0) and Q/E still reach it; keys 5-8 stay for the orbs', () => {
  const { pl } = sigPlayer();
  learn(pl, 'psybeam');
  assert.equal(pl.normalSlots(), 2);
  pl.selectSig();
  assert.equal(pl.activeMove(), pl.sig);
  pl.setActive(0);
  pl.cycle(-1);
  assert.equal(pl.activeMove(), pl.sig, 'Q from the first slot wraps to the signature slot');
  const game = source('js/game.js');
  assert.match(game, /for \(let i = 0; i < 4; i\+\+\) \{\s*\n\s*if \(G\.Input\.tap\('digit' \+ \(i \+ 1\)\)/);
  assert.match(game, /G\.Input\.tap\('digit0'\) \|\| G\.Input\.tap\('numpad0'\)\) pl\.selectSig\(\)/);
  assert.match(game, /G\.Orbs\.use\(pl, i\)/);
});

test('evolving from one signature species to another keeps the fused buffs even with the normal slots full', () => {
  const G = world({ 789: 5 });                           // Cosmog -> Cosmoem -> Solgaleo / Lunala, los tres con move especial
  const pl = mk(G, 789);
  pl.addMove('confusion'); pl.syncSignature();
  learn(pl, 'calm-mind', 'nasty-plot', 'psybeam');
  pl.bonds = 2;
  const m = id => pl.moves.find(x => x.id === id);
  pl.fuse([m('calm-mind')], pl.sigGroup());
  pl.fuse([m('nasty-plot')], pl.sigGroup());
  learn(pl, 'psychic', 'extrasensory');
  assert.equal(pl.normalSlots(), 4);
  assert.equal(pl.sig.id, 'sig-789');
  G.Moves.levelUp(pl.sig);
  const group = pl.sigGroup();
  pl.evolve(790);
  assert.equal(pl.sig.id, 'sig-790');
  assert.equal(pl.sigGroup(), group, 'the same group');
  assert.deepEqual(pl.sigGroup().map(x => x.id), ['sig-790', 'calm-mind', 'nasty-plot']);
  assert.ok(pl.moves.some(x => x.id === 'calm-mind') && pl.moves.some(x => x.id === 'nasty-plot'), 'no buff lost');
  assert.equal(pl.sig.lvl, 2, 'level kept');
  assert.equal(pl.normalSlots(), 4);
  assert.equal(pl.slots[pl.slots.length - 1], pl.sigGroup());
});
