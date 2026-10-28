/* ============ passive-fx.js — catálogo de efectos de las pasivas ============
 * Cada Pokémon tiene una pasiva propia (data/passives.js, generado por
 * tools/gen_passives.js): un nombre y 1-3 efectos [plantilla, valor]. Aquí están
 * las plantillas y G.PassiveFX.build las convierte en los ganchos que ya entiende
 * G.AbilityFX (ver la lista de ganchos en data/ability-fx.js). Textos sólo en inglés.
 *
 * cost = poder por unidad de valor; min/max = rango permitido del valor.
 * La suma de cost × valor de una pasiva debe caer en la banda de su rareza (BANDS).
 * Las plantillas con cond: true son condicionales y sólo las llevan las de rareza 5.
 * Los estados (rachas, contadores) viven en el jugador `pl`, que se recrea en cada run.
 */
G.PassiveFX = (() => {
  const TN = t => { const n = (G.U.TYPE_NAME && G.U.TYPE_NAME[t]) || t; return G.T ? G.T(n) : n; };
  const low = pl => pl.hp < pl.maxHp / 3;
  const t1 = mon => mon.types[0];
  const t2 = mon => mon.types[1] || mon.types[0];
  const k = v => 1 + v / 100;
  const cat = (m, c) => !!m && m.cat === c;

  const TEMPLATES = {
    // --- daño ---
    typeDmg:  { cost: 0.25, min: 8, max: 40, text: (v, mon) => `+${v}% damage with ${TN(t1(mon))} moves.`,
      hooks: (v, mon) => ({ out: (pl, m) => (m.type === t1(mon) ? k(v) : 1) }) },
    type2Dmg: { cost: 0.25, min: 8, max: 30, text: (v, mon) => `+${v}% damage with ${TN(t2(mon))} moves.`,
      hooks: (v, mon) => ({ out: (pl, m) => (m.type === t2(mon) ? k(v) : 1) }) },
    physDmg:  { cost: 0.2, min: 8, max: 35, text: v => `+${v}% damage with physical moves.`,
      hooks: v => ({ out: (pl, m) => (cat(m, 'physical') ? k(v) : 1) }) },
    specDmg:  { cost: 0.2, min: 8, max: 35, text: v => `+${v}% damage with special moves.`,
      hooks: v => ({ out: (pl, m) => (cat(m, 'special') ? k(v) : 1) }) },
    lowHpDmg: { cost: 0.12, min: 20, max: 60, text: v => `+${v}% damage when below 1/3 health.`,
      hooks: v => ({ out: pl => (low(pl) ? k(v) : 1) }) },
    multiHitDmg: { cost: 0.15, min: 15, max: 50, text: v => `+${v}% damage with multi-hit moves.`,
      hooks: v => ({ out: (pl, m) => ((m.count || 1) > 2 || m.bounce ? k(v) : 1) }) },
    // --- crítico ---
    critChance: { cost: 0.5, min: 3, max: 15, text: v => `+${v}% critical hit chance.`,
      hooks: v => ({ start: pl => { pl.critChance += v / 100; } }) },
    critDmg:  { cost: 0.06, min: 10, max: 60, text: v => `Critical hits deal x${(1.5 + v / 100).toFixed(2).replace(/0$/, '')} damage instead of x1.5.`,
      hooks: v => ({ critMul: 1.5 + v / 100 }) },
    // --- defensa ---
    dmgTaken: { cost: 0.35, min: 4, max: 25, text: v => `Takes ${v}% less damage.`,
      hooks: v => ({ inMul: () => 1 - v / 100 }) },
    typeTaken: { cost: 0.15, min: 15, max: 50, text: (v, mon) => `Takes ${v}% less damage from ${TN(t1(mon))} attacks.`,
      hooks: (v, mon) => ({ inMul: (pl, type) => (type === t1(mon) ? 1 - v / 100 : 1) }) },
    dodge:    { cost: 0.4, min: 3, max: 15, text: v => `${v}% chance to dodge a hit.`,
      hooks: v => ({ dodge: () => v / 100 }) },
    maxHp:    { cost: 0.2, min: 5, max: 30, text: v => `+${v}% max health.`,
      hooks: v => ({ start: pl => { pl.addMaxHp(Math.round(pl.maxHp * v / 100)); } }) },
    reflect:  { cost: 0.04, min: 50, max: 200, text: v => `Melee attackers take ${v}% of a thorn hit.`,
      hooks: v => ({ contact: (pl, e) => e.hurt((10 + pl.level * 3) * v / 100, '#9aa6b5') }) },
    // --- recuperación ---
    killHeal: { cost: 0.6, min: 2, max: 10, text: v => `Heals ${v / 10}% of max health per enemy defeated.`,
      hooks: v => ({ kill: pl => { pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * v / 1000); } }) },
    regen:    { cost: 0.8, min: 1, max: 6, text: v => `Regenerates ${v / 10}% of max health per second.`,
      hooks: v => ({ start: pl => { pl.regenFlat += pl.maxHp * v / 1000; } }) },
    healMul:  { cost: 0.1, min: 10, max: 60, text: v => `Healing received is ${v}% stronger.`,
      hooks: v => ({ healMul: k(v) }) },
    // --- utilidad ---
    speed:    { cost: 0.25, min: 4, max: 20, text: v => `+${v}% movement speed.`,
      hooks: v => ({ speed: () => k(v) }) },
    magnet:   { cost: 0.05, min: 10, max: 60, text: v => `+${v}% pickup range.`,
      hooks: v => ({ start: pl => { pl.magnet *= k(v); } }) },
    cdMul:    { cost: 0.5, min: 3, max: 12, text: v => `Moves recharge ${v}% faster.`,
      hooks: v => ({ cdMul: 1 - v / 100 }) },
    xp:       { cost: 0.15, min: 5, max: 30, text: v => `+${v}% experience gained.`,
      hooks: v => ({ start: pl => { pl.xpMul *= k(v); } }) },
    // --- condicionales (sólo rareza 5) ---
    streakDmg: { cost: 0.3, min: 10, max: 40, cond: true, text: v => `Defeating enemies in a streak adds up to +${v}% damage (lasts 4 s).`,
      hooks: v => ({
        kill: pl => { pl.streakN = Math.min(20, (pl.streakN || 0) + 1); pl.streakT = 4; },
        tick: (pl, dt) => { if ((pl.streakT = (pl.streakT || 0) - dt) <= 0) pl.streakN = 0; },
        out: pl => k(Math.min(v, (pl.streakN || 0) * 2))
      }) },
    pulseEvery: { cost: 0.7, min: 3, max: 10, cond: true, text: v => `Every 8 s heals ${v}% of max health.`,
      hooks: v => ({ tick: (pl, dt) => {
        if ((pl.pulseT = (pl.pulseT || 0) + dt) >= 8) { pl.pulseT = 0; if (pl.heal) pl.heal(pl.maxHp * v / 100); }
      } }) },
    hurtBoost: { cost: 0.25, min: 10, max: 40, cond: true, text: v => `After being hit, +${v}% damage for 4 s.`,
      hooks: v => ({
        hurt: pl => { pl.hurtBoostT = 4; },
        tick: (pl, dt) => { if (pl.hurtBoostT > 0) pl.hurtBoostT -= dt; },
        out: pl => (pl.hurtBoostT > 0 ? k(v) : 1)
      }) }
  };

  /** Banda de poder por rareza: [mín, máx]. */
  const BANDS = { 1: [2, 3], 2: [4, 5], 3: [6, 8], 4: [10, 13], 5: [16, 20] };

  const round = x => Math.round(x * 1000) / 1000;
  const power = fx => round(fx.reduce((s, [id, ...v]) => s + TEMPLATES[id].cost * v[0], 0));
  const signature = fx => JSON.stringify(fx.map(([id, ...v]) => [id, ...v]).sort());

  const SEQ = ['start', 'hit', 'hurt', 'contact', 'tick', 'kill'];
  const MUL = ['out', 'inMul', 'speed'];

  /** { n, fx } + Pokémon → efecto con descripción `d` y los ganchos de G.AbilityFX. */
  function build(p, mon) {
    const parts = p.fx.map(([id, ...v]) => ({ t: TEMPLATES[id], v }));
    const res = { d: parts.map(({ t, v }) => t.text(v[0], mon)).join(' '), name: p.n, passive: true };
    for (const { t, v } of parts) {
      const h = t.hooks(v[0], mon);
      for (const key of SEQ) {
        if (!h[key]) continue;
        const prev = res[key];
        res[key] = prev ? (...a) => { prev(...a); h[key](...a); } : h[key];
      }
      for (const key of MUL) {
        if (!h[key]) continue;
        const prev = res[key];
        res[key] = prev ? (...a) => prev(...a) * h[key](...a) : h[key];
      }
      if (h.dodge) { const prev = res.dodge; res.dodge = prev ? (...a) => prev(...a) + h.dodge(...a) : h.dodge; }
      if (h.cdMul) res.cdMul = (res.cdMul || 1) * h.cdMul;
      if (h.healMul) res.healMul = (res.healMul || 1) * h.healMul;
      if (h.critMul) res.critMul = Math.max(res.critMul || 0, h.critMul);
    }
    return res;
  }

  return { TEMPLATES, BANDS, power, signature, build };
})();
