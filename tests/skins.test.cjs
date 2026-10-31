const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
function load(tilesets = IDS.map(id => ({ id }))) {
  const G = { Tilesets: tilesets, Tiles: { SKIN0: 20, NORMAL: 3 } };
  new Function('G', source('js/world/skins.js'))(G);
  return G;
}

test('order contiene los 10 ids una sola vez', () => {
  const o = load().Skins.order(7);
  assert.deepEqual([...o].sort(), [...IDS].sort());
});

test('order es determinista por semilla y cambia con otra', () => {
  const { Skins } = load();
  assert.deepEqual(Skins.order(7), Skins.order(7));
  assert.notDeepEqual(Skins.order(7), Skins.order(8));
});

test('order con semillas raras: 10 ids, sin repetidos contiguos ni último===primero', () => {
  const { Skins } = load();
  for (const s of [0, -5, 1.5, NaN, 2 ** 40, 123456, 999999]) {
    const o = Skins.order(s);
    assert.equal(new Set(o).size, 10, 'semilla ' + s);
    for (let i = 0; i < o.length; i++) assert.notEqual(o[i], o[(i + 1) % o.length], 'semilla ' + s);
  }
});

test('biomeAt sin tilesets cae a los biomas de código', () => {
  const { Skins } = load([]);
  assert.equal(Skins.biomeAt(5, 0), 0);
  assert.equal(Skins.biomeAt(5, 4), 1);
});

test('biomeAt recorre los 10 skins con periodo 10', () => {
  const { Skins } = load();
  const seen = new Set();
  for (let b = 0; b < 10; b++) seen.add(Skins.biomeAt(7, b));
  assert.equal(seen.size, 10);
  for (const i of seen) assert.ok(i >= 20 && i < 30);
  assert.equal(Skins.biomeAt(7, 10), Skins.biomeAt(7, 0));
  assert.equal(Skins.biomeAt(7, 13), Skins.biomeAt(7, 3));
});

test('misma semilla en dos instancias (cooperativo) da la misma cadena', () => {
  const a = load().Skins, b = load().Skins;
  for (let i = 0; i < 25; i++) assert.equal(a.biomeAt(424242, i), b.biomeAt(424242, i));
});

// ---------- carga de atlas, props, biomas y pintado (con Image/canvas falsos) ----------

const PALETTE = { floor: '#4f9a3a', wall: '#7f7f86', liq: '#3b7fc6', foam: '#b3defa', leaf: '#3f9a3a',
  trunk: '#5b3b22', rock: '#8a8a8a', grass: '#4caa3f', flowers: ['#f4d65c', '#ffffff', '#f39ac0'] };
const META = [{ id: 'x', name: 'Zona X', liquid: 'lava', palette: PALETTE, prop: 'tree',
  props: { rock: { x: 0, y: 96, w: 32, h: 32 } }, counts: { floor: 2, alt: 1, liquid: 1 } },
  { id: 'y', name: 'Zona Y', liquid: 'water', palette: PALETTE, prop: 'tree', props: {}, counts: { floor: 1, alt: 0, liquid: 1 } },
  { id: 'z', name: 'Zona Z', liquid: 'water', palette: PALETTE, prop: 'tree', props: {}, counts: { floor: 1, alt: 0, altBlock: 1, liquid: 1 } }];

/** Entorno con Image y document falsos; `images` guarda las Image creadas para disparar onload/onerror. */
function env() {
  const images = [], calls = [];
  const canvas = () => { const c = { width: 0, height: 0, ctx: null };
    c.getContext = () => c.ctx || (c.ctx = { drawImage: (...a) => calls.push(['drawImage', c, ...a]), fillRect: (...a) => calls.push(['fillRect', c, ...a]),
      save() {}, restore() {}, clearRect() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, set fillStyle(v) {}, set globalAlpha(v) {}, set imageSmoothingEnabled(v) {} });
    return c; };
  globalThis.Image = class { constructor() { images.push(this); } set src(v) { this._src = v; } get src() { return this._src; } };
  globalThis.document = { createElement: () => canvas() };
  const G = { Tilesets: META, U: { hash: (x, y, s) => (Math.abs((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) % 1000) / 1000 } };
  new Function('G', source('js/world/autotile.js'))(G);
  new Function('G', source('js/world/tiles.js'))(G);
  new Function('G', source('js/world/skins.js'))(G);
  return { G, images, calls };
}

test('tiles.js añade un bioma por tileset, tras los de código y las arenas', () => {
  const { G } = env();
  const n0 = G.Tiles.SKIN0;
  assert.ok(n0 > G.Tiles.ARENA);
  assert.equal(G.Tiles.BIOMES.length, n0 + META.length);
  const b = G.Tiles.BIOMES[n0];
  assert.equal(b.skin, 'x'); assert.equal(b.name, 'Zona X'); assert.equal(b.liquid, 'lava');
  assert.equal(G.Tiles.BIOMES[n0 + 1].skin, 'y');
});

test('load: ready sólo tras onload, y cb se llama una vez', () => {
  const { G, images } = env();
  let n = 0;
  assert.equal(G.Skins.ready('x'), false);
  G.Skins.load('x', () => n++);
  G.Skins.load('x', () => n++);            // segunda petición: no crea otra Image
  assert.equal(images.length, 1);
  assert.equal(G.Skins.ready('x'), false);
  images[0].onload();
  assert.equal(G.Skins.ready('x'), true);
  assert.equal(n, 2);                      // los dos cb pendientes, una vez cada uno
  G.Skins.load('x', () => n++);            // ya cargado: no vuelve a llamar
  assert.equal(n, 2);
});

test('load: un error deja ready en false y no lanza', () => {
  const { G, images } = env();
  let n = 0;
  assert.doesNotThrow(() => { G.Skins.load('x', () => n++); images[0].onerror(); });
  assert.equal(G.Skins.ready('x'), false);
  assert.equal(n, 0);
  assert.doesNotThrow(() => G.Skins.load('nope'));   // id inexistente
  assert.equal(G.Skins.ready('nope'), false);
});

test('propSprite: null sin atlas o sin ese tipo; con atlas devuelve canvas con px 1', () => {
  const { G, images } = env();
  assert.equal(G.Skins.propSprite('x', 'rock'), null);
  G.Skins.load('x'); images[0].onload();
  assert.equal(G.Skins.propSprite('x', 'tree'), null);       // el pack no lo tiene
  const c = G.Skins.propSprite('x', 'rock');
  assert.equal(c.px, 1); assert.equal(c.width, 32);
  assert.equal(G.Skins.propSprite('x', 'rock'), c);          // cacheado
});

test('Tiles.propSprite usa el recorte del atlas y cae al sprite de código si falta', () => {
  const { G, images } = env();
  G.Skins.load('x'); images[0].onload();
  const idx = G.Tiles.SKIN0;
  assert.equal(G.Tiles.propSprite(idx, 'rock').px, 1);
  assert.equal(G.Tiles.propSprite(idx, 'tree').px, undefined);   // sprite de código
});

test('Tiles.paintChunk usa el bioma de código mientras el atlas no está cargado', () => {
  const { G } = env();
  const at = () => 'floor';
  const cv = G.Tiles.paintChunk(0, 0, 2, at, () => 0, G.Tiles.SKIN0, 1);   // sin atlas: bioma de código (16 px/tile)
  assert.equal(cv.width, 2 * G.Tiles.T);
});

test('Skins.paintChunk: tamaño 32 px/tile, un drawImage de suelo por tile', () => {
  const { G, images, calls } = env();
  G.Skins.load('x'); images[0].onload();
  const cv = G.Tiles.paintChunk(0, 0, 2, () => 'floor', () => 0, G.Tiles.SKIN0, 1);
  assert.equal(cv.width, 64); assert.equal(cv.height, 64);
  assert.equal(calls.filter(c => c[0] === 'drawImage' && c[1] === cv).length, 4);
});

test('Skins.paintChunk: pared y líquido pintan más cosas que el suelo, sin lanzar', () => {
  const { G, images, calls } = env();
  G.Skins.load('x'); images[0].onload();
  const at = (tx, ty) => (tx === 0 && ty === 0 ? 'wall' : tx === 1 && ty === 0 ? 'liquid' : 'floor');
  const cv = G.Tiles.paintChunk(0, 0, 2, at, () => 0, G.Tiles.SKIN0, 1);
  assert.ok(calls.filter(c => c[1] === cv).length > 6);
});

test('Skins.paintChunk: con dirtField alto usa el suelo alternativo', () => {
  const { G, images, calls } = env();
  G.Skins.load('x'); images[0].onload();
  G.Tiles.paintChunk(0, 0, 1, () => 'floor', () => 1, G.Tiles.SKIN0, 1);
  const d = calls.find(c => c[0] === 'drawImage');
  assert.equal(d[4], 32);   // sy del recorte: fila "alt" del atlas
});

test('Skins.paintChunk: con altBlock las manchas se pintan con autotile (4 cuartos del bloque en x=320)', () => {
  const { G, images, calls } = env();
  G.Skins.load('z'); images[0].onload();
  const idx = G.Tiles.SKIN0 + 2;
  // Mancha de un solo tile en medio de suelo: ruido alto sólo en (1,1).
  const dirt = (gx, gy) => (Math.floor(gx / 16) === 1 && Math.floor(gy / 16) === 1 ? 1 : 0);
  const cv = G.Tiles.paintChunk(0, 0, 3, () => 'floor', dirt, idx, 1);
  const alt = calls.filter(c => c[0] === 'drawImage' && c[1] === cv && c[3] >= 320);
  assert.equal(alt.length, 4);
  assert.equal(calls.filter(c => c[0] === 'drawImage' && c[1] === cv && c[3] < 320).length, 9);   // suelo base de los 9 tiles
});

test('Skins.paintChunk: sin ruido alto con altBlock no hay autotile de mancha', () => {
  const { G, images, calls } = env();
  G.Skins.load('z'); images[0].onload();
  const cv = G.Tiles.paintChunk(0, 0, 3, () => 'floor', () => 0, G.Tiles.SKIN0 + 2, 1);
  assert.equal(calls.filter(c => c[0] === 'drawImage' && c[1] === cv && c[3] >= 320).length, 0);
});

test('preloadNext pide el atlas del skin siguiente de la cadena', () => {
  const { G, images } = env();
  const next = G.Skins.order(7)[1];
  G.Skins.preloadNext(7, 0);
  assert.equal(images.length, 1);
  assert.ok(images[0].src.endsWith('assets/tilesets/' + next + '.png'));
  G.Skins.preloadNext(7, META.length);      // da la vuelta: el siguiente del último-más-uno vuelve al segundo
  assert.equal(images.length, 1);           // ya pedido: no crea otra Image
});

test('World.seed devuelve la semilla del reset (la misma que usa la cadena de skins)', () => {
  const G = { Tiles: { T: 16, BIOMES: [{ liquid: 'water' }] }, Sprites: { PX: 2 }, U: { hash: () => 0.5 } };
  new Function('G', source('js/world/world.js'))(G);
  G.World.reset(123456);
  assert.equal(G.World.seed, 123456);
  G.World.reset(0);
  assert.equal(G.World.seed, 1);            // reset normaliza 0 a 1
});
