// Mundo mínimo para crear un G.Enemy jefe (js/entities/enemy.js) con los Hazards y las habilidades Apex de verdad.
const { world: apexWorld, source } = require('./apex-world.cjs');

/** opts como apex-world; añade lo que pide el constructor y bossInit/bossStart/bossCast. Devuelve { G, calls, pl, players, arena, enemy(o) }. */
function world(opts = {}) {
  const w = apexWorld(opts);
  const { G, calls } = w;
  const mons = {
    150: { dex: 150, name: 'Mewtwo', types: ['psychic'], spd: 130 },
    4: { dex: 4, name: 'Charmander', types: ['fire'], spd: 65 },
    999: { dex: 999, name: 'Odd', types: ['nope'], spd: 65 }
  };
  G.DEX_BY = mons;
  G.Sprites = {
    PX: 2, animMeta: () => ({ ay: 30 }), bodyRadius: () => 14, bodyHeight: () => 30, hovers: () => false, dirFromAngle: () => 0,
    Animator: class { constructor() { this.dir = 0; } play(a) { calls.anims = (calls.anims || []).concat(a); } loop() {} }
  };
  G.Stats = { sideOf: () => 'special' };
  G.Projectiles = { spawn: o => { calls.shotsSpawned = (calls.shotsSpawned || 0) + 1; return o; } };
  G.Settings = { fx: 2 };
  Object.assign(G.FX, { dmgText() {}, px() {}, twinkle() {} });
  Object.assign(G.U, { norm: (x, y) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; }, lerp: (a, b, t) => a + (b - a) * t });
  new Function('G', source('js/entities/enemy.js'))(G);
  /** Un jefe legendario de la arena. o.apex marca al Apex. */
  const enemy = (o = {}) => {
    const def = { dex: o.dex || 150, name: 'Boss', hp: 1000, spd: 60, dmg: 40, shotDmg: 20, shotCd: 1, behavior: 'ranged', xp: 1 };
    const e = new G.Enemy(def, w.arena.x, w.arena.y, { hp: 1, spd: 1, dmg: 1 }, true);
    e.legend = true;
    if (o.apex) e.apex = true;
    return e;
  };
  return Object.assign(w, { enemy });
}

module.exports = { world };
