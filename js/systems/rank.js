/* ============ rank.js — estrellas (Rank) de cada Pokémon por copias repetidas ============
 * Cada copia repetida del gacha suma 1 a save.dupes[forma base] (0-15). Las estrellas (0-10) salen de
 * esas copias y dan un bonus permanente de daño/vida y mejoras de pasiva. Independiente de Prestige
 * (nivel permanente con Gemas). Lógica pura; los avisos y la pantalla están en otros módulos.
 * Textos nuevos sólo en inglés.
 */
G.Rank = (() => {
  /** Ajustable aquí. */
  const MAX_DUPES = 15;
  const THRESHOLDS = [1, 2, 3, 4, 5, 7, 9, 11, 13, 15];     // copias necesarias para la estrella 1..10
  const STAT_BONUS = [0.02, 0.02, 0, 0.025, 0.025, 0, 0.03, 0, 0.03, 0];   // bonus de daño y vida por estrella

  const save = () => G.DB && G.DB.save;
  /** Forma base de la línea (una Mega o una evolución vuelven a ella); null si el dex no existe. */
  const root = dex => {
    if (!G.DEX_BY || !G.DEX_BY[dex]) return null;
    const line = G.Mons.lineage(dex);
    return line.length ? line[0] : +dex;
  };

  /** Estrellas (0-10) para un número de copias. */
  function starsFor(dupes) {
    let n = 0;
    while (n < THRESHOLDS.length && dupes >= THRESHOLDS[n]) n++;
    return n;
  }

  const dupesOf = dex => {
    const r = root(dex), s = save();
    return r == null || !s || !s.dupes ? 0 : Math.min(MAX_DUPES, Math.max(0, +s.dupes[r] || 0));
  };
  const starsOf = dex => starsFor(dupesOf(dex));

  /** Suma una copia repetida. → { star: estrella nueva (0 si no sube), over: ya estaba al máximo (no suma) } */
  function add(dex) {
    const r = root(dex), s = save();
    if (r == null || !s) return { star: 0, over: false };
    s.dupes = s.dupes || {};
    const before = +s.dupes[r] || 0;
    if (before >= MAX_DUPES) return { star: 0, over: true };
    s.dupes[r] = before + 1;
    const a = starsFor(before), b = starsFor(before + 1);
    return { star: b > a ? b : 0, over: false };
  }

  /** Para la ficha: estrellas, copias, copias de la siguiente estrella (null al máximo) y cuántas faltan. */
  function progress(dex) {
    const dupes = dupesOf(dex), stars = starsFor(dupes);
    const next = stars < THRESHOLDS.length ? THRESHOLDS[stars] : null;
    return { stars, dupes, next, missing: next == null ? 0 : next - dupes };
  }

  /** Lo que da cada estrella (1..10), como textos para la ficha. Debe ir a la par con bonus(). */
  const EXTRA_PERKS = { 3: ['Unlocks the Unique passive'], 5: ['Unlocks the Signature move'], 6: ['Common passive ×1.2'],
    8: ['Unique passive ×1.25'], 10: ['Common and Unique passives ×1.5'] };
  function perks(star) {
    const out = [], v = STAT_BONUS[star - 1];
    if (v) out.push(`+${+(v * 100).toFixed(1)}% damage and HP`);
    return out.concat(EXTRA_PERKS[star] || []);
  }

  /** Bonus permanente: ×1 si no tiene estrellas. */
  function bonus(dex) {
    const stars = starsOf(dex);
    let m = 1;
    for (let i = 0; i < stars; i++) m += STAT_BONUS[i];
    return {
      dmgMul: m, hpMul: m,
      commonMul: stars >= 10 ? 1.5 : stars >= 6 ? 1.2 : 1,
      uniqueMul: stars >= 10 ? 1.5 : stars >= 8 ? 1.25 : 1,
      uniqueOn: stars >= 3
    };
  }

  /** Ajusta las mejoras de la partida igual que G.Prestige.apply: daño y vida máxima. */
  function apply(perks, mon) {
    const b = bonus(mon.dex);
    perks.atkMul = (perks.atkMul || 1) * b.dmgMul;
    perks.hp = Math.round((mon.hp + (perks.hp || 0)) * b.hpMul - mon.hp);
    return perks;
  }

  return { MAX_DUPES, THRESHOLDS, root, starsFor, dupesOf, starsOf, progress, perks, add, bonus, apply };
})();
