const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
function load() { const G = {}; new Function('G', source('js/world/autotile.js'))(G); return G.Autotile; }
const A = load();

const combos = [];
for (let m = 0; m < 256; m++) combos.push(Array.from({ length: 8 }, (_, i) => !!(m >> i & 1)));

test('las tablas tienen 48 y 16 formas con cuartos dentro de la rejilla', () => {
  assert.equal(A.FLOOR_TABLE.length, 48);
  assert.equal(A.WALL_TABLE.length, 16);
  for (const t of A.FLOOR_TABLE) for (const [qx, qy] of t) assert.ok(qx >= 0 && qx < 4 && qy >= 0 && qy < 6);
  for (const t of A.WALL_TABLE) for (const [qx, qy] of t) assert.ok(qx >= 0 && qx < 4 && qy >= 0 && qy < 4);
});

test('floorShape: interior es 0 y aislado es 47', () => {
  assert.equal(A.floorShape(true, true, true, true, true, true, true, true), 0);
  assert.equal(A.floorShape(false, false, false, false, false, false, false, false), 47);
});

test('floorShape: siempre 0..47 y una diagonal sólo cuenta con sus dos lados presentes', () => {
  for (const [n, e, s, w, ne, se, sw, nw] of combos) {
    const sh = A.floorShape(n, e, s, w, ne, se, sw, nw);
    assert.ok(Number.isInteger(sh) && sh >= 0 && sh < 48);
    // Invento diagonales que no cuentan (un lado ausente): no debe cambiar nada.
    const sh2 = A.floorShape(n, e, s, w, ne || !(n && e), se || !(s && e), sw || !(s && w), nw || !(n && w));
    assert.equal(sh2, sh);
  }
});

test('floorShape: falta una esquina interior -> sólo cambia el cuarto de esa esquina', () => {
  const q = sh => A.FLOOR_TABLE[sh];
  const full = q(A.floorShape(true, true, true, true, true, true, true, true));
  const noNW = q(A.floorShape(true, true, true, true, true, true, true, false));
  assert.notDeepEqual(noNW[0], full[0]);
  assert.deepEqual(noNW.slice(1), full.slice(1));
});

test('wallShape: interior 0, aislado 15, y cada lado ausente es un bit', () => {
  assert.equal(A.wallShape(true, true, true, true), 0);
  assert.equal(A.wallShape(false, false, false, false), 15);
  assert.equal(A.wallShape(true, true, true, false), 1);   // sin vecino a la izquierda
  assert.equal(A.wallShape(false, true, true, true), 2);   // sin vecino arriba
});

test('draw pinta 4 cuartos de tile/2 desde el bloque indicado', () => {
  const calls = [];
  const ctx = { drawImage: (...a) => calls.push(a) };
  A.draw(ctx, 'IMG', 64, 0, A.FLOOR_TABLE, 0, 10, 20, 32);
  assert.equal(calls.length, 4);
  for (const c of calls) { assert.equal(c[0], 'IMG'); assert.equal(c[3], 16); assert.equal(c[4], 16); assert.equal(c[7], 16); assert.equal(c[8], 16); }
  // Interior: el primer cuarto sale de (2,4) del bloque, pegado en (10,20).
  assert.deepEqual(calls[0].slice(1, 3), [64 + 2 * 16, 0 + 4 * 16]);
  assert.deepEqual(calls[0].slice(5, 7), [10, 20]);
  assert.deepEqual(calls[3].slice(5, 7), [26, 36]);
});
