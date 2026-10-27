// Simulador del equilibrio de las cartas de stat (viejo: 3 cartas, sin rareza · nuevo: 4 cartas, con rareza).
// Lo usa tests/balance.test.cjs; a mano: node tests/helpers/balance-sim.cjs
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');

function load(overrides = {}) {
  const G = { T: s => s, U: {} };
  new Function('G', src('js/systems/levelup.js'))(G);
  Object.assign(G.LevelUp.SINGLE_K, overrides.single || {});
  for (const r of [4, 5]) Object.assign(G.LevelUp.BUNDLE_K[r], (overrides.bundle || {})[r] || {});
  Object.assign(G.LevelUp.MYTHIC, overrides.mythic || {});
  return G;
}
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const newPl = () => ({
  atkMul: 1, spdMul: 1, cdMul: 1, dmgReduce: 0, regenFlat: 0, magnet: 78, xpMul: 1, coinMul: 1, maxHp: 100, hp: 100,
  critChance: 0.1, critDmgBonus: 0, bossDmg: 1, executeDmg: 1, dodgeChance: 0, healMul: 1, statsTaken: {}, moves: [],
  addMaxHp(n) { this.maxHp += n; this.hp += n; }, heal(a) { this.hp = Math.min(this.maxHp, this.hp + a * this.healMul); }
});
/** Índice de poder: daño × raíz de la vida efectiva × movilidad × experiencia. */
function power(pl) {
  const crit = Math.min(1, pl.critChance), critMul = 1.5 + pl.critDmgBonus;
  const dmg = pl.atkMul / pl.cdMul * (1 + crit * (critMul - 1)) * (1 + 0.15 * (pl.bossDmg - 1) + 0.10 * (pl.executeDmg - 1));
  const ehp = (pl.maxHp + 40 * pl.regenFlat * pl.healMul) / 100 / ((1 - pl.dmgReduce) * (1 - pl.dodgeChance));
  return dmg * Math.sqrt(ehp) * (1 + 0.5 * (pl.spdMul - 1)) * Math.sqrt(pl.xpMul);
}
const clone = pl => Object.assign(Object.create(Object.getPrototypeOf(pl)), pl, { statsTaken: Object.assign({}, pl.statsTaken), moves: [] });

function run(G, mode, seed, levels, nCards, pStat) {
  const R = rng(seed), pl = newPl(), LU = G.LevelUp;
  for (let lv = 0; lv < levels; lv++) {
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const pool = LU.STATS.filter(room);
    let best = null, bestP = power(pl);
    for (let i = 0; i < nCards; i++) {
      if (R() >= pStat) continue;
      const s = pool[Math.floor(R() * pool.length)];
      const card = mode === 'old'
        ? { apply: p => { s.apply(p, 1); p.statsTaken[s.id] = (p.statsTaken[s.id] || 0) + 1; } }
        : LU.statCard(pl, s, LU.rollRarity(R), pool, R);
      const t = clone(pl); card.apply(t);
      const pw = power(t);
      if (pw > bestP) { bestP = pw; best = card; }
    }
    if (best) best.apply(pl);
  }
  return power(pl);
}
function compare(G, { levels = 30, trials = 600, pStat = 0.4, newCards = 4 } = {}) {
  let lo = 0, ln = 0;
  for (let i = 0; i < trials; i++) {
    lo += Math.log(run(G, 'old', 1000 + i, levels, 3, pStat));
    ln += Math.log(run(G, 'new', 1000 + i, levels, newCards, pStat));
  }
  return Math.exp((ln - lo) / trials);
}
module.exports = { load, compare, run, power };
if (require.main === module) {
  const G = load();
  for (const lv of [10, 20, 30, 40]) console.log('levels', lv, 'ratio new/old =', compare(G, { levels: lv }).toFixed(3));
  console.log('same 3 cards, rarity only:', compare(G, { newCards: 3 }).toFixed(3));
}
