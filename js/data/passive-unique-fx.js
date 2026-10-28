/* ============ passive-unique-fx.js — catálogo de mecánicas de las pasivas unique ============
 * Las unique van por línea evolutiva (datos en la tarea siguiente). Cada plantilla tiene la
 * MISMA forma que las de G.PassiveFX.TEMPLATES ({ cost, min, max, text(v, mon), hooks(v, mon) })
 * más su bandera `tier`, así G.PassiveFX.build/power/scale las entienden igual (buscan primero
 * en las comunes y luego aquí). Ganchos: los de data/ability-fx.js, más revive(pl) (player.js:
 * si devuelve true cancela la muerte). El estado (contadores, recargas) vive en `pl`, que se
 * recrea en cada run. Textos sólo en inglés.
 *
 * Presupuesto cost × max: basic 6, adv 7,5, supreme 9 (supreme = 1,5 × basic).
 * "power": el daño escala con el nivel del jugador (base + n por nivel) × v %.
 */
G.UniqueFX = (() => {
  const k = v => 1 + v / 100;
  const half = v => Math.round(v / 2);
  const lvl = pl => pl.level || 1;
  const low = pl => pl.hp < pl.maxHp / 3;
  /** Movimientos que pegan lejos de ti (las auras, órbitas, novas, estelas y terremotos no). */
  const RANGED = ['projectile', 'homing', 'bounce', 'beam', 'boomerang', 'cone', 'meteor', 'chain', 'turret'];
  const near = (x, y, r) => (G.EnemyMgr ? G.EnemyMgr.queryCircle(x, y, r) : []).filter(e => !e.dead);
  const ring = (x, y, r, col) => { if (G.FX) G.FX.ring(x, y, 8, r, col, 0.4, 4); };
  const say = (pl, txt, col) => { if (G.FX) G.FX.dmgText(pl.x, pl.y - (pl.bodyH || 0) - 16, txt, col, true); };
  const heal = (pl, n) => { if (pl.heal) pl.heal(n); else pl.hp = Math.min(pl.maxHp, pl.hp + n); };
  /** Daña a los enemigos en el círculo (x, y, r). */
  const blast = (x, y, r, dmg, col, knock = 0) => {
    for (const e of near(x, y, r)) e.hurt(dmg, col, e.x - x, e.y - y, knock);
  };
  /** Acumula dt en pl[key]; true (y vuelve a 0) cada `period` s. */
  const every = (pl, key, dt, period) => {
    pl[key] = (pl[key] || 0) + dt;
    if (pl[key] < period) return false;
    pl[key] = 0;
    return true;
  };
  /** Cuenta en pl[key]; true (y vuelve a 0) cada `n` veces. */
  const nth = (pl, key, n) => {
    pl[key] = (pl[key] || 0) + 1;
    if (pl[key] < n) return false;
    pl[key] = 0;
    return true;
  };
  const down = (pl, key, dt) => { if (pl[key] > 0) pl[key] -= dt; };

  const TEMPLATES = {
    // ---------------- basic (cost × max = 6) ----------------
    deathBurst: { tier: 'basic', cost: 0.05, min: 30, max: 120,
      text: v => `Defeated enemies burst, hitting foes nearby (${v}% power).`,
      // Las bajas se procesan luego, en el barrido de EnemyMgr (no dentro del golpe): quien cae
      // por una explosión queda marcado (byBurst) y su baja no explota, así no hay cadenas.
      hooks: v => ({ kill: (pl, e) => {
        if (!e || e.byBurst) return;
        ring(e.x, e.y, 60, '#ff9a5c');
        const dmg = (10 + lvl(pl) * 3) * v / 100;
        for (const o of near(e.x, e.y, 60)) {
          if (o === e) continue;
          o.hurt(dmg, '#ff9a5c', o.x - e.x, o.y - e.y, 0);
          if (o.dead) o.byBurst = true;
        }
      } }) },
    lifeSteal: { tier: 'basic', cost: 0.24, min: 5, max: 25,
      text: v => `${v}% chance on hit to heal 1% of max health.`,
      hooks: v => ({ hit: pl => { if (Math.random() < v / 100) heal(pl, pl.maxHp * 0.01); } }) },
    thornAura: { tier: 'basic', cost: 0.03, min: 50, max: 200,
      text: v => `Every second, foes close to you take thorn damage (${v}% power).`,
      hooks: v => ({ tick: (pl, dt) => {
        if (every(pl, 'thornT', dt, 1)) blast(pl.x, pl.y, 70, (5 + lvl(pl) * 2) * v / 100, '#9aa6b5');
      } }) },
    speedOnKill: { tier: 'basic', cost: 0.15, min: 10, max: 40,
      text: v => `+${v}% movement speed for 2 s after defeating an enemy.`,
      hooks: v => ({ kill: pl => { pl.sokT = 2; }, tick: (pl, dt) => down(pl, 'sokT', dt),
        speed: pl => (pl.sokT > 0 ? k(v) : 1) }) },
    startShield: { tier: 'basic', cost: 1.2, min: 1, max: 5,
      text: v => `Blocks the first ${v} ${v === 1 ? 'hit' : 'hits'} of each run.`,
      hooks: v => ({ start: pl => { pl.shieldHits = v; },
        dodge: pl => { if (!(pl.shieldHits > 0)) return 0; pl.shieldHits--; return 1; } }) },
    coinBonus: { tier: 'basic', cost: 0.12, min: 10, max: 50,
      text: v => `+${v}% coins collected.`,
      hooks: v => ({ start: pl => { pl.coinMul *= k(v); } }) },
    xpBurst: { tier: 'basic', cost: 0.2, min: 5, max: 30,
      text: v => `Every 15th enemy defeated drops ${v} extra experience.`,
      hooks: v => ({ kill: (pl, e) => {
        if (nth(pl, 'xpBurstN', 15) && e && G.Pickups) G.Pickups.drop('xp', e.x, e.y, v);
      } }) },
    slowAura: { tier: 'basic', cost: 0.15, min: 10, max: 40,
      text: v => `Slows foes nearby by ${v}%.`,
      hooks: v => ({ tick: (pl, dt) => {
        if (every(pl, 'slowAuraT', dt, 0.5)) for (const e of near(pl.x, pl.y, 90)) e.applySlow(v / 100, 0.7);
      } }) },
    critStreak: { tier: 'basic', cost: 0.05, min: 30, max: 120,
      text: v => `Every 6th hit strikes like a critical: +${v}% damage.`,
      // Cuenta en out (se llama una vez por golpe, también el que remata; afterHit no llega
      // a los que matan). Sin movimiento (m) no cuenta ni gasta el bonus.
      hooks: v => ({ out: (pl, m) => {
        if (!m) return 1;
        pl.critStreakN = ((pl.critStreakN || 0) + 1) % 6;
        return pl.critStreakN === 0 ? k(v) : 1;
      } }) },
    burnTouch: { tier: 'basic', cost: 0.2, min: 5, max: 30,
      text: v => `${v}% chance on hit to burn the target.`,
      hooks: v => ({ hit: (pl, e) => { if (e && e.applyBurn && Math.random() < v / 100) e.applyBurn(1); } }) },
    rangedBonus: { tier: 'basic', cost: 0.2, min: 6, max: 30,
      text: v => `+${v}% damage with ranged moves (shots, beams, cones and the like).`,
      hooks: v => ({ out: (pl, m) => (m && RANGED.includes(m.kind) ? k(v) : 1) }) },
    comebackHeal: { tier: 'basic', cost: 0.2, min: 5, max: 30,
      text: v => `When health drops below 1/3, heals ${v}% of max health (every 30 s).`,
      hooks: v => ({ tick: (pl, dt) => down(pl, 'comebackT', dt),
        hurt: pl => { if (low(pl) && !(pl.comebackT > 0)) { pl.comebackT = 30; heal(pl, pl.maxHp * v / 100); } } }) },

    // ---------------- adv (cost × max = 7,5) ----------------
    reviveOnce: { tier: 'adv', cost: 0.125, min: 20, max: 60,
      text: v => `Once per run, survives a fatal hit and revives with ${v}% health.`,
      hooks: v => ({ revive: pl => {
        if (pl.reviveUsed) return false;
        pl.reviveUsed = true;
        pl.hp = Math.min(pl.maxHp, Math.max(1, pl.maxHp * v / 100));
        say(pl, 'Revive!', '#ffe14d');
        ring(pl.x, pl.y, 90, '#ffe14d');
        return true;
      } }) },
    killNova: { tier: 'adv', cost: 0.05, min: 50, max: 150,
      text: v => `Every 10th enemy defeated releases a nova around you (${v}% power).`,
      hooks: v => ({ kill: pl => {
        if (!nth(pl, 'killNovaN', 10)) return;
        ring(pl.x, pl.y, 110, '#ffd36b');
        blast(pl.x, pl.y, 110, (20 + lvl(pl) * 5) * v / 100, '#ffd36b', 120);
      } }) },
    hurtNova: { tier: 'adv', cost: 0.05, min: 50, max: 150,
      text: v => `When hit, releases a shockwave that pushes foes away (${v}% power, every 3 s).`,
      hooks: v => ({ tick: (pl, dt) => down(pl, 'hurtNovaT', dt),
        hurt: pl => {
          if (pl.hurtNovaT > 0) return;
          pl.hurtNovaT = 3;
          ring(pl.x, pl.y, 90, '#8fd0ff');
          blast(pl.x, pl.y, 90, (15 + lvl(pl) * 4) * v / 100, '#8fd0ff', 220);
        } }) },
    orbitGuard: { tier: 'adv', cost: 0.05, min: 50, max: 150,
      text: v => `Guardian sparks circle you and strike foes very close 3 times per second (${v}% power).`,
      hooks: v => ({ tick: (pl, dt) => {
        if (every(pl, 'orbitT', dt, 1 / 3)) blast(pl.x, pl.y, 55, (3 + lvl(pl)) * v / 100, '#c8f0ff');
      } }) },
    chainSpark: { tier: 'adv', cost: 0.05, min: 50, max: 150,
      text: v => `1 in 5 hits sparks to another foe nearby (${v}% power).`,
      hooks: v => ({ hit: (pl, e) => {
        if (!e || Math.random() >= 0.2) return;
        const o = near(e.x, e.y, 120).find(x => x !== e);
        if (o) o.hurt((8 + lvl(pl) * 2) * v / 100, '#ffe14d', o.x - e.x, o.y - e.y, 0);
      } }) },
    dashOnHurt: { tier: 'adv', cost: 0.125, min: 20, max: 60,
      text: v => `When hit, +${v}% movement speed for 2 s and a short moment of invulnerability.`,
      hooks: v => ({ hurt: pl => { pl.dashHurtT = 2; pl.invuln = Math.max(pl.invuln || 0, 0.8); },
        tick: (pl, dt) => down(pl, 'dashHurtT', dt),
        speed: pl => (pl.dashHurtT > 0 ? k(v) : 1) }) },
    executeLow: { tier: 'adv', cost: 0.1, min: 20, max: 75,
      text: v => `+${v}% damage to foes below 25% health.`,
      hooks: v => ({ out: (pl, m, e) => (e && e.maxHp > 0 && e.hp < e.maxHp * 0.25 ? k(v) : 1) }) },
    comboCharge: { tier: 'adv', cost: 0.15, min: 10, max: 50,
      text: v => `Each hit adds +2% damage, up to +${v}%; resets when you are hit.`,
      hooks: v => ({ hit: pl => { pl.comboN = Math.min(60, (pl.comboN || 0) + 1); },
        hurt: pl => { pl.comboN = 0; },
        out: pl => k(Math.min(v, (pl.comboN || 0) * 2)) }) },
    killHealPulse: { tier: 'adv', cost: 0.5, min: 3, max: 15,
      text: v => `Every 15th enemy defeated heals ${v}% of max health.`,
      hooks: v => ({ kill: pl => {
        if (!nth(pl, 'healPulseN', 15)) return;
        heal(pl, pl.maxHp * v / 100);
        ring(pl.x, pl.y, 70, '#5fe08a');
      } }) },
    barrier: { tier: 'adv', cost: 0.125, min: 20, max: 60,
      text: v => `A barrier recharges every 10 s and absorbs ${v}% of the next hit.`,
      hooks: v => ({ tick: (pl, dt) => down(pl, 'barrierCd', dt),
        inMul: pl => { if (pl.barrierCd > 0) return 1; pl.barrierCd = 10; return 1 - v / 100; } }) },

    // ---------------- supreme (cost × max = 9) ----------------
    moveStorm: { tier: 'supreme', cost: 0.06, min: 50, max: 150,
      text: v => `Every 6 s a storm strikes all foes around you (${v}% power).`,
      hooks: v => ({ tick: (pl, dt) => {
        if (!every(pl, 'stormT', dt, 6)) return;
        ring(pl.x, pl.y, 160, '#b8a6ff');
        blast(pl.x, pl.y, 160, (25 + lvl(pl) * 6) * v / 100, '#b8a6ff');
      } }) },
    slowDomain: { tier: 'supreme', cost: 0.18, min: 20, max: 50,
      text: v => `Foes nearby are slowed by ${v}% and take +${half(v)}% damage while slowed.`,
      hooks: v => ({ tick: (pl, dt) => {
        if (every(pl, 'domainT', dt, 0.4)) for (const e of near(pl.x, pl.y, 130)) e.applySlow(v / 100, 0.6);
      }, out: (pl, m, e) => (e && e.slowT > 0 ? k(half(v)) : 1) }) },
    timeWarp: { tier: 'supreme', cost: 0.6, min: 5, max: 15,
      text: v => `Moves recharge ${v}% faster and +${v}% movement speed.`,
      hooks: v => ({ cdMul: 1 - v / 100, speed: () => k(v) }) },
    mirrorHit: { tier: 'supreme', cost: 0.06, min: 50, max: 150,
      text: v => `Melee attackers are struck back hard and knocked away (${v}% power).`,
      hooks: v => ({ contact: (pl, e) => e.hurt((20 + lvl(pl) * 5) * v / 100, '#e0e8ff', e.x - pl.x, e.y - pl.y, 200) }) },
    lastStand: { tier: 'supreme', cost: 0.15, min: 20, max: 60,
      text: v => `Below 1/3 health: +${v}% damage and takes ${half(v)}% less damage.`,
      hooks: v => ({ out: pl => (low(pl) ? k(v) : 1), inMul: pl => (low(pl) ? 1 - half(v) / 100 : 1) }) },
    apexAura: { tier: 'supreme', cost: 0.3, min: 10, max: 30,
      text: v => `+${half(v)}% damage to all foes and a further +${v}% to bosses.`,
      hooks: v => ({ out: (pl, m, e) => k(half(v)) * (e && e.boss ? k(v) : 1) }) },
    spectralClone: { tier: 'supreme', cost: 0.06, min: 50, max: 150,
      text: v => `A spectral echo repeats 1 in 4 hits (${v}% power).`,
      hooks: v => ({ hit: (pl, e) => {
        if (e && !e.dead && Math.random() < 0.25) e.hurt((8 + lvl(pl) * 2) * v / 100, '#b08cff', 0, 0, 0);
      } }) },
    rageEngine: { tier: 'supreme', cost: 0.15, min: 20, max: 60,
      text: v => `Each hit taken builds rage: up to +${v}% damage and +${half(v)}% speed; fades 5 s after the last hit.`,
      hooks: v => ({
        hurt: pl => { pl.rageN = Math.min(5, (pl.rageN || 0) + 1); pl.rageT = 5; },
        tick: (pl, dt) => { if (pl.rageT > 0 && (pl.rageT -= dt) <= 0) pl.rageN = 0; },
        out: pl => k(v * (pl.rageN || 0) / 5),
        speed: pl => k(half(v) * (pl.rageN || 0) / 5)
      }) }
  };

  const TIERS = { basic: [], adv: [], supreme: [] };
  for (const [id, t] of Object.entries(TEMPLATES)) TIERS[t.tier].push(id);

  return { TEMPLATES, TIERS };
})();
