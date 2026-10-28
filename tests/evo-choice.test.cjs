const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

/** levelup.js con un jugador mínimo (sin movimientos que mejorar) y una Evo / Mega de pega. */
function lvWorld({ evo = [], mega = [] } = {}) {
  const G = { T: s => s, U: { pickN: (a, n) => a.slice(0, n) }, I18n: { f: s => s }, Moves: { levelUp: () => null, evolve: () => null, evoInfo: () => null, poolFor: () => [], BY_ID: {} } };
  const preloaded = [];
  G.Sprites = { preload: (dexes) => { preloaded.push(...dexes); return Promise.resolve(); } };
  const mk = list => ({ ready: () => list.length > 0, cards: () => list.map(dex => ({ w: 100, type: 'mevo', key: 'e:' + dex, dex, apply() {} })) });
  G.Evo = mk(evo);
  G.Mega = mk(mega);
  new Function('G', source('js/systems/levelup.js'))(G);
  const pl = { slots: [1, 2, 3, 4], maxMoves: 4, moves: [], statsTaken: {}, shiny: false, bonds: 0, hasEvoWaiting: () => false };
  return { G, pl, preloaded };
}
const dexes = cards => cards.filter(c => c.type === 'mevo').map(c => c.dex);

test('offer: an evolution card per owned form is always in the level-up cards', () => {
  const { G, pl } = lvWorld({ evo: [134, 135] });
  for (let i = 0; i < 30; i++) {
    const o = G.LevelUp.offer(pl);
    assert.deepEqual(dexes(o).sort(), [134, 135]);
    assert.ok(o.length >= 3 && o.some(c => c.type !== 'mevo'), 'at least one normal card');
  }
});

test('offer: nothing is added when no evolution is ready', () => {
  const { G, pl } = lvWorld();
  for (let i = 0; i < 20; i++) assert.deepEqual(dexes(G.LevelUp.offer(pl)), []);
});

test('offer: Mega cards come only when there is no normal evolution ready', () => {
  const both = lvWorld({ evo: [5], mega: [10034] });
  assert.deepEqual(dexes(both.G.LevelUp.offer(both.pl)), [5]);
  const mega = lvWorld({ mega: [10034, 10035] });
  assert.deepEqual(dexes(mega.G.LevelUp.offer(mega.pl)).sort(), [10034, 10035]);
});

test('offer: at most 5 form cards, and always at least one normal card', () => {
  const { G, pl } = lvWorld({ evo: [1, 2, 3, 4, 5, 6, 7, 8] });
  const o = G.LevelUp.offer(pl);
  assert.equal(dexes(o).length, 5);
  assert.ok(o.some(c => c.type !== 'mevo'));
});

test('offer: the sprites of the offered forms are preloaded', () => {
  const { G, pl, preloaded } = lvWorld({ evo: [134, 135] });
  G.LevelUp.offer(pl);
  assert.deepEqual([...new Set(preloaded)].sort(), [134, 135]);
});

test('offer works without Evo / Mega / Sprites loaded', () => {
  const { G, pl } = lvWorld();
  delete G.Evo; delete G.Mega; delete G.Sprites;
  assert.ok(G.LevelUp.offer(pl).length >= 1);
});
