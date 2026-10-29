/* ============ prestige.js — nivel permanente y Prestigio de cada Pokémon ============
 * Cada Pokémon (su forma base: save.plv[dex] = { xp, star }) gana EXP al acabar cada partida.
 * El nivel sale de la EXP y tiene un límite (LV_BASE + LV_STEP por estrella). Al llegar al
 * límite se puede hacer Prestigio con Gemas: vuelve a Nv.1, gana una estrella (bonus permanente
 * de daño y vida) y su límite sube. Las Gemas (save.gems) salen de misiones, logros, jefes y,
 * rara vez, enemigos. Lógica pura; la pantalla está en ui/prestige-ui.js.
 * Textos nuevos sólo en inglés.
 */
G.Prestige = (() => {
  /** Ajustable aquí. */
  const LV_BASE = 30, LV_STEP = 10, MAX_STAR = 5;
  const XP_K = 6;                       // EXP acumulada para el nivel L: XP_K·(L−1)·L
  const LV_BONUS = 0.005, STAR_BONUS = 0.10;
  const GEMS_BASE = 50;
  const GEM_DROP = { boss: [1, 2], enemy: 0.0003 };

  const save = () => G.DB.save;
  /** Forma base de la línea (una Mega o una evolución vuelven a ella); null si el dex no existe. */
  const rootOf = dex => {
    if (!G.DEX_BY || !G.DEX_BY[dex]) return null;
    const line = G.Mons.lineage(dex);              // sus orígenes (sin ella misma): vacío si ya es forma base
    return line.length ? line[0] : dex;
  };
  const xpTo = level => XP_K * (level - 1) * level;
  const limitFor = star => LV_BASE + LV_STEP * star;

  function entry(root, create = false) {
    const s = save();
    if (!s) return null;
    s.plv = s.plv || {};
    if (!s.plv[root] && create) s.plv[root] = { xp: 0, star: 0 };
    return s.plv[root] || null;
  }
  const levelFor = e => {
    const limit = limitFor(e.star);
    let l = 1;
    while (l < limit && xpTo(l + 1) <= e.xp) l++;
    return l;
  };

  const limitOf = dex => { const r = rootOf(dex), e = r == null ? null : entry(r); return limitFor(e ? e.star : 0); };
  const levelOf = dex => { const r = rootOf(dex), e = r == null ? null : entry(r); return e ? levelFor(e) : 1; };

  /** Bonus permanente de un Pokémon: ×1 si es nuevo o no existe. */
  function bonus(dex) {
    const r = rootOf(dex), e = r == null ? null : entry(r);
    if (!e) return { dmgMul: 1, hpMul: 1 };
    const m = 1 + LV_BONUS * (levelFor(e) - 1) + STAR_BONUS * e.star;
    return { dmgMul: m, hpMul: m };
  }

  /** Ajusta las mejoras de la partida (ver data/upgrades.js): daño y vida máxima (Player.maxHp = mon.hp + perks.hp). */
  function apply(perks, mon) {
    const b = bonus(mon.dex);
    perks.atkMul = (perks.atkMul || 1) * b.dmgMul;
    perks.hp = Math.round((mon.hp + (perks.hp || 0)) * b.hpMul - mon.hp);
    return perks;
  }

  const runXp = r => Math.floor(((r.time || 0) / 10 + (r.kills || 0) / 20 + (r.bosses || 0) * 15 + (r.level || 0)) * (r.mul || 1));

  /** Suma la EXP de una partida. → { gained, level, capped } */
  function grantXp(dex, run) {
    const root = rootOf(dex);
    if (root == null) return { gained: 0, level: 1, capped: false };
    const e = entry(root, true), cap = xpTo(limitFor(e.star));
    if (e.xp >= cap) return { gained: 0, level: limitFor(e.star), capped: true };
    const gained = Math.min(runXp(run), cap - e.xp);
    if (gained > 0) { e.xp += gained; G.DB.commit('run'); }
    return { gained, level: levelFor(e), capped: e.xp >= cap };
  }

  const cost = dex => { const r = rootOf(dex), e = r == null ? null : entry(r); return GEMS_BASE * ((e ? e.star : 0) + 1); };
  /** ¿Está en el límite y quedan estrellas? (las gemas se comprueban aparte) */
  function canPrestige(dex) {
    const r = rootOf(dex), e = r == null ? null : entry(r);
    return !!e && e.star < MAX_STAR && levelFor(e) >= limitFor(e.star);
  }

  /** Prestigio. → { ok: true } o { ok: false, reason: 'unknown'|'maxed'|'level'|'gems' } */
  function prestige(dex) {
    const root = rootOf(dex);
    if (root == null) return { ok: false, reason: 'unknown' };
    const e = entry(root, true), s = save();
    if (e.star >= MAX_STAR) return { ok: false, reason: 'maxed' };
    if (levelFor(e) < limitFor(e.star)) return { ok: false, reason: 'level' };
    const price = GEMS_BASE * (e.star + 1);
    if ((s.gems || 0) < price) return { ok: false, reason: 'gems' };
    s.gems -= price;
    e.xp = 0;
    e.star++;
    G.DB.commit(true);
    return { ok: true };
  }

  /** Gemas que suelta un enemigo. kind: 'boss' | 'enemy'. */
  function rollGems(kind, rand = Math.random) {
    if (kind === 'boss') return GEM_DROP.boss[0] + Math.floor(rand() * (GEM_DROP.boss[1] - GEM_DROP.boss[0] + 1));
    return rand() < GEM_DROP.enemy ? 1 : 0;
  }

  /** Cae un enemigo (e.judge: legendario de la Sentencia, no suelta nada). Se guardan al instante. */
  function onKill(pl, e, rand = Math.random) {
    if (e.judge) return;
    const n = rollGems(e.boss ? 'boss' : 'enemy', rand);
    if (!n) return;
    G.Progress.grant({ gems: n });
    pl.gemsFound = (pl.gemsFound || 0) + n;              // para la pantalla final
    G.DB.commit('run');
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 76, '+' + n + ' ' + G.T('Gems'), '#7dffb0', true);
  }

  return { LV_BASE, LV_STEP, MAX_STAR, XP_K, LV_BONUS, STAR_BONUS, GEMS_BASE, GEM_DROP, rootOf, xpTo, limitOf, levelOf,
           bonus, apply, runXp, grantXp, cost, canPrestige, prestige, rollGems, onKill };
})();
