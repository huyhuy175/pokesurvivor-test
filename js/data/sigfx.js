/* ============ sigfx.js — mecánicas propias de los movimientos especiales (signature) ============
 * Cada movimiento especial (data/signature-moves.js) lleva `sig: { fx, v }`: una de estas catorce mecánicas
 * y su valor. No hay `kind` nuevos: se enganchan a los que ya existen con dos ganchos de systems/combat.js:
 *
 *   onHit(pl, e, m, dmg, v)  tras cada golpe a `e` (afterHit; `dmg` ya es el daño final)
 *   onCast(pl, m, v)         tras lanzar el movimiento (tickMove); no se llama en los de órbita
 *
 * POWER[fx](v) es lo que vale la mecánica en potencia nominal (× la dps del movimiento): el generador
 * (tools/gen_signature.js) lo usa para bajar el daño base y que el total siga siendo SIG_POWER × mediana.
 * Textos sólo en inglés.
 */
G.SigFX = (() => {
  const colorOf = m => (G.U.TYPE_COLOR && G.U.TYPE_COLOR[m.type]) || '#ffffff';
  const near = (x, y, r, except) => (G.EnemyMgr ? G.EnemyMgr.queryCircle(x, y, r) : []).filter(o => o !== except && !o.dead);
  const extra = (e, m, dmg, from) => { if (dmg > 0) e.hurt(dmg, colorOf(m), e.x - from.x, e.y - from.y, 0); };

  /** Cada tercer lanzamiento da un potenciador de su estadística, con la potencia `base × v / 100`. */
  const surge = (stat, base) => ({
    min: 100, max: 200,
    text: v => `Every third cast grants a stacking ${stat === 'haste' ? 'attack speed' : stat === 'crit' ? 'critical chance' : 'damage'} boost (${v}% power).`,
    onCast(pl, m, v) {
      pl.sigCasts = (pl.sigCasts || 0) + 1;
      if (pl.sigCasts % 3 !== 0) return;
      // Nunca debilita al potenciador del mismo nombre que ya esté activo (addBuff pisaría su potencia, duración y tope).
      const b = pl.buffs && pl.buffs[stat], live = b && b.n > 0;
      pl.addBuff(stat, Math.max(base * v / 100, live ? b.amount : 0), Math.max(6, live ? b.t : 0), Math.max(3, live ? b.n : 0));
    }
  });

  // Reloj (segundos) de los topes de abajo; los tests lo sustituyen.
  const api = { clock: () => performance.now() / 1000 };
  /** Deja pasar a lo sumo una vez cada `gap` s por jugador y mecánica (en un aura o una nova cada golpe a cada enemigo la dispararía). */
  const proc = (pl, key, gap) => {
    const t = api.clock();
    pl.sigProc = pl.sigProc || {};
    if (pl.sigProc[key] != null && t - pl.sigProc[key] < gap) return false;
    pl.sigProc[key] = t;
    return true;
  };
  const immune = e => e.boss || e.judge || e.arceus;                 // a los jefes no se les empuja ni se les aturde del todo

  const FX = {
    splash: { min: 30, max: 60, text: v => `Hits splash to nearby foes for ${v}% damage.`,
      onHit(pl, e, m, dmg, v) { if (!proc(pl, 'splash', 0.2)) return; for (const o of near(e.x, e.y, 70, e)) extra(o, m, dmg * v / 100, e); } },
    chain: { min: 25, max: 50, text: v => `Jumps to up to two nearby foes for ${v}% damage each.`,
      onHit(pl, e, m, dmg, v) {
        if (!proc(pl, 'chain', 0.2)) return;
        const t = near(e.x, e.y, 160, e).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2);
        for (const o of t) extra(o, m, dmg * v / 100, e);
      } },
    drain: { min: 2, max: 6, text: v => `Heals you for ${v}% of the damage dealt (at most 2% of your health per hit and 3% per second).`,
      onHit(pl, e, m, dmg, v) {
        const t = api.clock(), w = pl.sigHeal = pl.sigHeal && t - pl.sigHeal.t < 1 ? pl.sigHeal : { t, n: 0 };
        const h = Math.min(dmg * v / 100, pl.maxHp * 0.02, pl.maxHp * 0.03 - w.n);
        if (h > 0) { w.n += h; pl.heal(h, true); }                  // sin números: con un aura serían cientos
      } },
    bossbane: { min: 30, max: 70, text: v => `Deals ${v}% extra damage to bosses.`,
      onHit(pl, e, m, dmg, v) { if (e.boss) extra(e, m, dmg * v / 100, pl); } },
    execute: { min: 40, max: 100, text: v => `Deals ${v}% extra damage to foes below 30% health.`,
      onHit(pl, e, m, dmg, v) { if (e.maxHp > 0 && e.hp / e.maxHp < 0.3) extra(e, m, dmg * v / 100, pl); } },
    slow: { min: 20, max: 50, text: v => `Slows foes by ${v}%.`,
      onHit(pl, e, m, dmg, v) { e.applySlow(v / 100); } },
    knock: { min: 80, max: 200, text: v => `Knocks foes away from you.`,
      onHit(pl, e, m, dmg, v) { if (immune(e)) return; const d = Math.hypot(e.x - pl.x, e.y - pl.y) || 1; e.kx += (e.x - pl.x) / d * v; e.ky += (e.y - pl.y) / d * v; } },
    pull: { min: 80, max: 200, text: v => `Drags foes towards you.`,
      onHit(pl, e, m, dmg, v) { if (immune(e)) return; const d = Math.hypot(e.x - pl.x, e.y - pl.y) || 1; e.kx -= (e.x - pl.x) / d * v; e.ky -= (e.y - pl.y) / d * v; } },
    stun: { min: 10, max: 25, text: v => `${v}% chance to stun foes for 0.6 s.`,
      onHit(pl, e, m, dmg, v) { if (Math.random() * 100 < v) e.applyStun(0.6 * (e.boss || e.judge ? 0.35 : 1)); } },
    burn: { min: 1, max: 3, text: v => `Burns foes (${v} ${v === 1 ? 'stack' : 'stacks'}).`,
      onHit(pl, e, m, dmg, v) { e.applyBurn(v); } },
    poison: { min: 1, max: 3, text: v => `Poisons foes (${v} ${v === 1 ? 'stack' : 'stacks'}).`,
      onHit(pl, e, m, dmg, v) { e.applyPoison(v); } },
    surgeHaste: surge('haste', 0.05),
    surgeCrit: surge('crit', 0.03),
    surgeAtk: surge('atk', 0.08)
  };

  /** Lo que vale cada mecánica en potencia nominal (≥ 1; sube con v). */
  const POWER = {
    splash: v => 1 + v / 100 * 0.5, chain: v => 1 + v / 100, drain: v => 1 + v / 100 * 0.6, bossbane: v => 1 + v / 100 * 0.3,
    execute: v => 1 + v / 100 * 0.2, slow: v => 1 + v / 100 * 0.3, knock: v => 1 + v / 1000, pull: v => 1 + v / 800,
    stun: v => 1 + v / 100, burn: v => 1 + 0.1 * v, poison: v => 1 + 0.1 * v,
    surgeHaste: v => 1 + v / 100 * 0.1, surgeCrit: v => 1 + v / 100 * 0.1, surgeAtk: v => 1 + v / 100 * 0.1
  };

  const ok = (m, hook) => m && m.sig && FX[m.sig.fx] && FX[m.sig.fx][hook] && Number.isFinite(m.sig.v);

  function onHit(pl, e, m, dmg) {
    if (!ok(m, 'onHit') || e.dead || !Number.isFinite(dmg)) return;
    FX[m.sig.fx].onHit(pl, e, m, dmg, m.sig.v);
  }

  function onCast(pl, m) {
    if (!ok(m, 'onCast')) return;
    FX[m.sig.fx].onCast(pl, m, m.sig.v);
  }

  return Object.assign(api, { FX, POWER, onHit, onCast });
})();
