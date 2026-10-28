// Mundo mínimo para probar js/data/apex-moves.js con los Hazards de verdad.
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

function hash(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** opts: { players, arena: {x,y,r}, host, active }. Devuelve { G, calls, pl, players, boss(o), arena }. */
function world(opts = {}) {
  const arena = opts.arena || { x: 0, y: 0, r: 300 };
  const calls = { broadcast: [], say: [], shots: [] };
  const n = opts.players == null ? 1 : opts.players;
  const players = Array.from({ length: n }, (_, i) => {
    const a = 0.5 + i * 6.2832 / Math.max(1, n);                    // repartidos en un círculo de 130 px
    return { x: arena.x + Math.cos(a) * 130, y: arena.y + Math.sin(a) * 130, r: 10, dead: false, invuln: 0, maxHp: 500, hurt() {} };
  });
  const G = {
    U: {
      hash, rand: (a, b) => (a + b) / 2, pick: a => a[0], clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
      dist2: (a, b, c, d) => (a - c) ** 2 + (b - d) ** 2, TYPE_COLOR: { fire: '#ff6a1f' }
    },
    Coop: { active: !!opts.active || !!opts.host, isHost: !!opts.host, broadcast(m) { calls.broadcast.push(m); }, enemyShot() {} },
    Game: { player: players[0], everyone: () => players },
    FX: { ring() {}, burst() {}, beam() {}, sp() {} },
    Camera: { sees: () => false, kick() {} },
    Audio: { sfx() {} },
    VFX: { forType: () => ({}) },
    Spawner: { say(t) { calls.say.push(t); } },
    Rift: { arenaInfo: () => ({ x: arena.x, y: arena.y, r: arena.r }) }
  };
  new Function('G', source('js/systems/hazards.js'))(G);
  new Function('G', source('js/data/apex-moves.js'))(G);
  const boss = (o = {}) => Object.assign({
    x: arena.x, y: arena.y, r: 14, name: 'Boss', types: ['fire'], atkType: 'fire', cat: 'special', apex: true, dead: false,
    shotDmg: () => 60, shoot(ax, ay, spread, n, k) { calls.shots.push([ax, ay, spread, n, k]); }, anim: { play() {} }, ai: { fury: false }
  }, o);
  return { G, calls, pl: players[0], players, boss, arena };
}

/** Cobertura de un grupo de hazards sobre el círculo de la arena (rejilla de `step` px, con Hazards.inside de verdad). */
function coverage(G, hs, arena, step = 12) {
  let total = 0, covered = 0, depth = 0;
  for (let y = -arena.r; y <= arena.r; y += step) for (let x = -arena.r; x <= arena.r; x += step) {
    if (x * x + y * y > arena.r * arena.r) continue;
    total++;
    let d = 0;
    for (const h of hs) if (G.Hazards.inside(h, arena.x + x, arena.y + y, 12)) d++;
    if (d) covered++;
    if (d > depth) depth = d;
  }
  return { frac: total ? covered / total : 0, depth };
}

module.exports = { world, coverage, source };
