const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, compare } = require('./helpers/balance-sim.cjs');

// Cuánto más fuerte es la run con las cartas nuevas (4 cartas, con rareza) que con las de antes
// (3 cartas, sin rareza), si el jugador siempre coge la mejor. Ver tests/helpers/balance-sim.cjs.
// Si cambias las fuerzas de levelup.js, esto te dice si te has pasado (y entonces toca subir la
// dificultad de fin de partida en data/enemies.js o bajar las fuerzas).
const OPTS = { trials: 300, pStat: 0.4 };

test('the new cards do not run away from the old power curve', () => {
  const G = load();
  const at = lv => compare(G, Object.assign({ levels: lv }, OPTS));
  const r10 = at(10), r30 = at(30), r40 = at(40);
  assert.ok(r10 > 0.95 && r10 < 1.15, 'nivel 10: ' + r10);
  assert.ok(r30 > 1.05 && r30 < 1.30, 'nivel 30: ' + r30);
  assert.ok(r40 > 1.05 && r40 < 1.40, 'nivel 40: ' + r40);
  assert.ok(r10 <= r30 && r30 <= r40 + 0.02, 'crece con la run, no se dispara');
});
test('the same three cards with rarity are not stronger than before (the extra card is what adds power)', () => {
  const G = load();
  assert.ok(compare(G, Object.assign({ levels: 30, newCards: 3 }, OPTS)) < 1.05);
});
test('stronger rarities are worth more, up to the Legendary', () => {
  const G = load();
  const { SINGLE_K, BUNDLE_K } = G.LevelUp;
  assert.ok(SINGLE_K[1] < SINGLE_K[2] && SINGLE_K[2] < SINGLE_K[3]);
  for (const n of [2, 3]) assert.ok(BUNDLE_K[4][n] * n > SINGLE_K[3] && BUNDLE_K[5][n] > BUNDLE_K[4][n]);
});
