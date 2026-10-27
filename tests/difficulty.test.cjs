const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function enemies() {
  const G = { U: { clamp: (v, a, b) => Math.min(b, Math.max(a, v)), TYPE_COLOR: {} }, Weather: {} };
  new Function('G', source('js/data/pokedex.js'))(G);
  G.SPRITE_META = new Proxy({}, { get: () => true });
  G.DEX = Object.values(G.DEX_BY);
  new Function('G', source('js/data/enemies.js'))(G);
  return G.Enemies;
}
// La curva de antes (hasta el 28-10-2026): máximo suavizada, sin subida al final.
const OLD = { hp: t => 1 + t / 95, dmg: t => 1 + t / 420, boss: t => 1 + t / 600 };

test('enemy stats are unchanged at the start and grow past the old curve over time', () => {
  const E = enemies();
  const a = E.scale(0), b = E.bossScale(0);
  assert.equal(a.hp, 1); assert.equal(a.dmg, 1); assert.equal(b.hp, 1); assert.equal(b.dmg, 1);
  let prev = 1;
  for (const t of [300, 600, 900, 1200, 1500, 1800]) {
    const k = E.scale(t).hp / OLD.hp(t);
    assert.ok(k >= prev - 1e-9 && k > 1, `t=${t}: ${k}`);
    prev = k;
  }
});
test('at minute 30 enemies have about 20 % more health and 15 % more damage than before', () => {
  const E = enemies(), t = 1800;
  assert.ok(Math.abs(E.scale(t).hp / OLD.hp(t) - 1.20) < 0.005);
  assert.ok(Math.abs(E.scale(t).dmg / OLD.dmg(t) - 1.15) < 0.005);
  assert.ok(Math.abs(E.bossScale(t).hp / OLD.boss(t) - 1.20) < 0.005);
  assert.ok(Math.abs(E.bossScale(t).dmg / OLD.boss(t) - 1.15) < 0.005);
});
test('the extra difficulty is gentle early and stops growing without bound', () => {
  const E = enemies();
  assert.ok(E.scale(300).hp / OLD.hp(300) < 1.04, 'minuto 5');
  assert.ok(E.scale(900).hp / OLD.hp(900) < 1.09, 'minuto 15');
  const end = E.scale(2400).hp / OLD.hp(2400);
  assert.ok(E.scale(9000).hp / OLD.hp(9000) <= end + 1e-9, 'tope: pasado el minuto 40 no sigue subiendo');
  assert.equal(E.scale(-5).hp, 1 + -5 / 95);                               // el reloj nunca baja de 0 en la práctica; no explota
});
