/* ============ autotile.js — autotiles de RPG Maker (cuartos de tile) ============
 * Cada tile se compone de 4 cuartos sacados de un bloque de autotile (rejilla
 * de 4×6 cuartos para suelo/líquido, 4×4 para la cara de las paredes).
 * Las tablas FLOOR_TABLE y WALL_TABLE son las de RPG Maker MV
 * (Tilemap.FLOOR_AUTOTILE_TABLE / WALL_AUTOTILE_TABLE, corescript, licencia MIT:
 * https://github.com/rpgtkoolmv/corescript). RPG Maker guarda la "forma" en el
 * mapa (la calcula su editor); aquí se deduce de los vecinos con la misma
 * geometría y se busca en la tabla.
 */
G.Autotile = (() => {
  const FLOOR_TABLE = [
    [[2,4],[1,4],[2,3],[1,3]],[[2,0],[1,4],[2,3],[1,3]],
    [[2,4],[3,0],[2,3],[1,3]],[[2,0],[3,0],[2,3],[1,3]],
    [[2,4],[1,4],[2,3],[3,1]],[[2,0],[1,4],[2,3],[3,1]],
    [[2,4],[3,0],[2,3],[3,1]],[[2,0],[3,0],[2,3],[3,1]],
    [[2,4],[1,4],[2,1],[1,3]],[[2,0],[1,4],[2,1],[1,3]],
    [[2,4],[3,0],[2,1],[1,3]],[[2,0],[3,0],[2,1],[1,3]],
    [[2,4],[1,4],[2,1],[3,1]],[[2,0],[1,4],[2,1],[3,1]],
    [[2,4],[3,0],[2,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],
    [[0,4],[1,4],[0,3],[1,3]],[[0,4],[3,0],[0,3],[1,3]],
    [[0,4],[1,4],[0,3],[3,1]],[[0,4],[3,0],[0,3],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[2,2],[1,2],[2,3],[3,1]],
    [[2,2],[1,2],[2,1],[1,3]],[[2,2],[1,2],[2,1],[3,1]],
    [[2,4],[3,4],[2,3],[3,3]],[[2,4],[3,4],[2,1],[3,3]],
    [[2,0],[3,4],[2,3],[3,3]],[[2,0],[3,4],[2,1],[3,3]],
    [[2,4],[1,4],[2,5],[1,5]],[[2,0],[1,4],[2,5],[1,5]],
    [[2,4],[3,0],[2,5],[1,5]],[[2,0],[3,0],[2,5],[1,5]],
    [[0,4],[3,4],[0,3],[3,3]],[[2,2],[1,2],[2,5],[1,5]],
    [[0,2],[1,2],[0,3],[1,3]],[[0,2],[1,2],[0,3],[3,1]],
    [[2,2],[3,2],[2,3],[3,3]],[[2,2],[3,2],[2,1],[3,3]],
    [[2,4],[3,4],[2,5],[3,5]],[[2,0],[3,4],[2,5],[3,5]],
    [[0,4],[1,4],[0,5],[1,5]],[[0,4],[3,0],[0,5],[1,5]],
    [[0,2],[3,2],[0,3],[3,3]],[[0,2],[1,2],[0,5],[1,5]],
    [[0,4],[3,4],[0,5],[3,5]],[[2,2],[3,2],[2,5],[3,5]],
    [[0,2],[3,2],[0,5],[3,5]],[[0,0],[1,0],[0,1],[1,1]]
  ];

  const WALL_TABLE = [
    [[2,2],[1,2],[2,1],[1,1]],[[0,2],[1,2],[0,1],[1,1]],
    [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
    [[2,2],[3,2],[2,1],[3,1]],[[0,2],[3,2],[0,1],[3,1]],
    [[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[0,2],[1,2],[0,3],[1,3]],
    [[2,0],[1,0],[2,3],[1,3]],[[0,0],[1,0],[0,3],[1,3]],
    [[2,2],[3,2],[2,3],[3,3]],[[0,2],[3,2],[0,3],[3,3]],
    [[2,0],[3,0],[2,3],[3,3]],[[0,0],[3,0],[0,3],[3,3]]
  ];

  // Forma de suelo a partir de las 4 esquinas: cada una se decide por sus dos
  // lados contiguos y su diagonal. Se busca el resultado en FLOOR_TABLE.
  const BY_QUARTERS = new Map(FLOOR_TABLE.map((t, i) => [t.join('|'), i]));

  /**
   * @param n,e,s,w        ¿el vecino de ese lado es del mismo tipo?
   * @param ne,se,sw,nw    ídem para las diagonales
   * @returns 0..47 (0 = interior, 47 = tile aislado)
   */
  function floorShape(n, e, s, w, ne, se, sw, nw) {
    if (!n && !e && !s && !w) return 47;
    const tl = n && w ? (nw ? [2, 4] : [2, 0]) : w ? [2, 2] : n ? [0, 4] : [0, 2];
    const tr = n && e ? (ne ? [1, 4] : [3, 0]) : e ? [1, 2] : n ? [3, 4] : [3, 2];
    const bl = s && w ? (sw ? [2, 3] : [2, 1]) : w ? [2, 5] : s ? [0, 3] : [0, 5];
    const br = s && e ? (se ? [1, 3] : [3, 1]) : e ? [1, 5] : s ? [3, 3] : [3, 5];
    return BY_QUARTERS.get([tl, tr, bl, br].join('|'));
  }

  /** Forma de la cara de pared: un bit por lado SIN vecino (izq 1, arriba 2, der 4, abajo 8). */
  function wallShape(n, e, s, w) {
    return (w ? 0 : 1) | (n ? 0 : 2) | (e ? 0 : 4) | (s ? 0 : 8);
  }

  /**
   * Dibuja un tile (4 cuartos) en (dx,dy). El bloque de autotile empieza en
   * (bx,by) dentro de `img`; cada cuarto mide tile/2 px.
   */
  function draw(ctx, img, bx, by, table, shape, dx, dy, tile = 32) {
    const q = tile / 2, t = table[shape];
    for (let i = 0; i < 4; i++) {
      ctx.drawImage(img, bx + t[i][0] * q, by + t[i][1] * q, q, q, dx + (i % 2) * q, dy + (i >> 1) * q, q, q);
    }
  }

  return { FLOOR_TABLE, WALL_TABLE, floorShape, wallShape, draw };
})();
