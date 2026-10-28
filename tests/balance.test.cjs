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

// ---------------- move đặc trưng vs nhóm 4 move ghép ----------------
// Potencia nominal (Moves.dps) de cada movimiento especial frente a un grupo de cuatro movimientos normales del mismo nivel
// (4 × la mediana). Es una medida interna, no un DPS real: tras jugar hay que revisar SIG_POWER (js/data/moves.js).
// La dispersión por kind en los niveles altos viene de que cada kind tiene su propia escalera de mejoras frente a una
// mediana global; frente a un movimiento normal del MISMO kind y nivel, el especial vale siempre SIG_POWER / POWER(fx).
test('a signature move is worth about one fused group of four regular moves, at any move level', () => {
  const fs2 = require('node:fs');
  const G = { DEX_BY: {}, U: { TYPE_COLOR: {}, TYPE_NAME: {} }, I18n: { add() {}, f: s => s }, EnemyMgr: { queryCircle: () => [] } };
  for (const f of ['js/data/pokedex.js', 'js/data/mega.js', 'js/data/moves.js', 'js/data/sigfx.js', 'js/data/signature-moves.js']) {
    new Function('G', fs2.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8'))(G);
  }
  const M = G.Moves;
  const ratios = lvl => Object.values(G.SIG).map(d => M.dps(d, lvl) * G.SigFX.POWER[d.sig.fx](d.sig.v) / (4 * M.median(lvl)));
  const stats = lvl => { const r = ratios(lvl); return { min: Math.min(...r), max: Math.max(...r), mean: r.reduce((a, b) => a + b, 0) / r.length }; };
  const l1 = stats(1), l3 = stats(3), l5 = stats(5);
  assert.ok(l1.min >= 0.95 && l1.max <= 1.05, `level 1: ${JSON.stringify(l1)}`);
  assert.ok(l3.min >= 0.7 && l3.max <= 2.0 && l3.mean >= 0.9 && l3.mean <= 1.2, `level 3: ${JSON.stringify(l3)}`);
  assert.ok(l5.min >= 0.6 && l5.max <= 2.8 && l5.mean >= 0.9 && l5.mean <= 1.25, `level 5: ${JSON.stringify(l5)}`);
});
