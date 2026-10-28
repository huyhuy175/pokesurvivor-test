// Mundo mínimo para probar vfx.js / fx.js / vfx-shapes-*.js sin navegador.
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

function hash(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Canvas falso: guarda cada fillRect (para comparar fotogramas).
function fakeCanvas() {
  const calls = [];
  const ctx = {
    fillStyle: '',
    fillRect(x, y, w, h) { calls.push(`${x},${y},${w},${h},${this.fillStyle}`); }
  };
  return { width: 0, height: 0, calls, getContext: () => ctx };
}

function world(...files) {
  const G = {
    Sprites: { PX: 2 },
    U: { hash, rand: (a, b) => (a + b) / 2, lerp: (a, b, t) => a + (b - a) * t,
         TYPE_COLOR: {}, TYPE_NAME: {} },
    I18n: { add() {}, f: s => s },
    Settings: { fx: 2, get: () => true },
    Camera: { sees: () => true },
    LIFT: 12
  };
  const document = { createElement: () => fakeCanvas() };
  for (const f of files) new Function('G', 'document', source(f))(G, document);
  return G;
}

module.exports = { world, source, fakeCanvas };
