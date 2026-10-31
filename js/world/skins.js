/* ============ skins.js — mapas con tilesets del itch-bundle ============
 * Cada "skin" es un atlas (assets/tilesets/<id>.png, generado por
 * tools/make_tilesets.py) con autotiles de suelo, tierra, pared, líquido y
 * algunos objetos. Los datos de cada uno están en G.Tilesets
 * (js/data/tilesets.js). Si el atlas no carga, se ve el bioma de código.
 *
 * El orden de los skins de una run sale de la semilla de la partida, así que
 * en cooperativo todos los ordenadores ven la misma cadena.
 */
G.Skins = (() => {
  /** Generador determinista (mulberry32). */
  function prng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Ids de G.Tilesets en orden barajado por la semilla (todos, una vez cada uno). */
  function order(seed) {
    const ids = (G.Tilesets || []).map(t => t.id);
    const rnd = prng(Math.floor(Number(seed)) || 0);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  /**
   * Índice en G.Tiles.BIOMES del skin número `b` de la cadena de la run
   * (da la vuelta al acabarse). Sin tilesets, los biomas de código de siempre.
   */
  function biomeAt(seed, b) {
    const list = G.Tilesets || [];
    if (!list.length) return b % G.Tiles.NORMAL;
    const id = order(seed)[b % list.length];
    return G.Tiles.SKIN0 + list.findIndex(t => t.id === id);
  }

  // ---------------- atlas ----------------
  /*
   * Convención del atlas (la misma que tools/make_tilesets.py), celdas de 32 px:
   *   y=0   suelo ×counts.floor (desde x=0) · pared 64×96 en x=192 · cara de pared 64×64 en x=256
   *         · autotile de las manchas 64×96 en x=320 (si counts.altBlock)
   *   y=32  suelo alternativo plano ×counts.alt · y=64 líquido ×counts.liquid
   *   y>=96 props, con su rectángulo en meta.props[tipo]
   */
  const CELL = 32, WALL_X = 192, FACE_X = 256, ALT_X = 320, ROW_ALT = 32, ROW_LIQ = 64;
  const atlas = new Map();                 // id -> { img, ok, cbs, props: Map }
  const meta = id => (G.Tilesets || []).find(t => t.id === id);

  /** Pide el atlas (una sola Image por id). `cb` se llama al terminar de cargar bien. */
  function load(id, cb) {
    const m = meta(id);
    if (!m) return;
    let a = atlas.get(id);
    if (a && a.ok) return;
    if (!a) {
      a = { img: new Image(), ok: false, failed: false, cbs: [], props: new Map() };
      atlas.set(id, a);
      a.img.onload = () => { a.ok = true; const f = a.cbs; a.cbs = []; f.forEach(fn => fn()); };
      a.img.onerror = () => { a.failed = true; a.cbs = []; };
      a.img.src = 'assets/tilesets/' + id + '.png';
    }
    if (cb && !a.failed) a.cbs.push(cb);
  }

  const ready = id => !!(atlas.get(id) && atlas.get(id).ok);

  /** Recorte del atlas como sprite del mundo (1 px de imagen = 1 px de mundo), o null. */
  function propSprite(id, type) {
    const a = atlas.get(id), m = meta(id);
    if (!a || !a.ok || !m || !m.props[type]) return null;
    let cv = a.props.get(type);
    if (!cv) {
      const r = m.props[type];
      cv = document.createElement('canvas');
      cv.width = r.w; cv.height = r.h;
      cv.getContext('2d').drawImage(a.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      cv.px = 1;
      a.props.set(type, cv);
    }
    return cv;
  }

  // ---------------- pintado de chunks ----------------

  const H = (x, y, s) => G.U.hash(x, y, s);
  let faceCv = null;                       // lienzo auxiliar para la cara de las paredes

  /**
   * Chunk de n×n tiles a 32 px/tile. `at(tx,ty)` da 'floor' | 'wall' | 'liquid'
   * (global, así los bordes ven más allá del chunk). `dirtField(gx,gy)` es el
   * ruido de manchas en px de arte (16 por tile): donde pasa de 0.64 sale el
   * suelo alternativo (autotile con bordes si el atlas lo trae, si no tiles planos).
   */
  function paintChunk(cx, cy, n, at, dirtField, B, seed = 0) {
    const m = meta(B.skin), img = atlas.get(B.skin).img, c = m.counts;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n * CELL;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const A = G.Autotile;
    const tx0 = cx * n, ty0 = cy * n;
    const isAlt = (x, y) => dirtField(x * 16 + 8, y * 16 + 8) > 0.64;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const tx = tx0 + i, ty = ty0 + j, dx = i * CELL, dy = j * CELL;
      const kind = at(tx, ty);
      // 1) Suelo bajo todo; encima, la mancha alternativa donde el ruido es alto.
      const flatAlt = c.alt && !c.altBlock && isAlt(tx, ty);
      const k = Math.floor(H(tx, ty, 41) * (flatAlt ? c.alt : c.floor));
      ctx.drawImage(img, k * CELL, flatAlt ? ROW_ALT : 0, CELL, CELL, dx, dy, CELL, CELL);
      if (c.altBlock && isAlt(tx, ty)) {
        const a = (x, y) => isAlt(x, y);
        A.draw(ctx, img, ALT_X, 0, A.FLOOR_TABLE, A.floorShape(a(tx, ty - 1), a(tx + 1, ty), a(tx, ty + 1), a(tx - 1, ty),
          a(tx + 1, ty - 1), a(tx + 1, ty + 1), a(tx - 1, ty + 1), a(tx - 1, ty - 1)), dx, dy, CELL);
      }
      if (kind === 'wall') paintWall(ctx, img, A, at, tx, ty, dx, dy);
      else if (kind === 'liquid') paintLiquid(ctx, img, B, c, at, tx, ty, dx, dy);
      else if (at(tx, ty - 1) === 'wall') {          // sombra de contacto bajo la pared
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.fillRect(dx, dy, CELL, 5);
      }
    }
    return cv;
  }

  function paintWall(ctx, img, A, at, tx, ty, dx, dy) {
    const W = (x, y) => at(x, y) === 'wall';
    const n = W(tx, ty - 1), e = W(tx + 1, ty), s = W(tx, ty + 1), w = W(tx - 1, ty);
    A.draw(ctx, img, WALL_X, 0, A.FLOOR_TABLE,
      A.floorShape(n, e, s, w, W(tx + 1, ty - 1), W(tx + 1, ty + 1), W(tx - 1, ty + 1), W(tx - 1, ty - 1)), dx, dy, CELL);
    if (s) return;
    // Sin pared al sur se ve la cara frontal: franja inferior de 12 px.
    if (!faceCv) { faceCv = document.createElement('canvas'); faceCv.width = faceCv.height = CELL; }
    const f = faceCv.getContext('2d');
    f.clearRect(0, 0, CELL, CELL);
    A.draw(f, img, FACE_X, 0, A.WALL_TABLE, A.wallShape(true, e, false, w), 0, 0, CELL);
    ctx.drawImage(faceCv, 0, CELL - 12, CELL, 12, dx, dy + CELL - 12, CELL, 12);
  }

  function paintLiquid(ctx, img, B, c, at, tx, ty, dx, dy) {
    const k = Math.floor(H(tx, ty, 42) * c.liquid);
    ctx.drawImage(img, k * CELL, ROW_LIQ, CELL, CELL, dx, dy, CELL, CELL);
    // Orilla: labio de tierra y espuma en los lados sin líquido.
    const L = (x, y) => at(x, y) === 'liquid';
    const side = (ok, x, y, w, h, x2, y2) => {
      if (ok) return;
      ctx.fillStyle = B.shore; ctx.fillRect(dx + x, dy + y, w, h);
      ctx.fillStyle = B.foam; ctx.fillRect(dx + x2, dy + y2, w === CELL ? CELL : 1, h === CELL ? CELL : 1);
    };
    side(L(tx, ty - 1), 0, 0, CELL, 2, 0, 2);
    side(L(tx, ty + 1), 0, CELL - 2, CELL, 2, 0, CELL - 3);
    side(L(tx - 1, ty), 0, 0, 2, CELL, 2, 0);
    side(L(tx + 1, ty), CELL - 2, 0, 2, CELL, CELL - 3, 0);
  }

  /** Empieza a bajar el atlas del skin que viene después del número `b` de la cadena. */
  function preloadNext(seed, b) {
    const list = G.Tilesets || [];
    if (list.length) load(order(seed)[(b + 1) % list.length]);
  }

  return { order, biomeAt, load, ready, propSprite, paintChunk, preloadNext };
})();
