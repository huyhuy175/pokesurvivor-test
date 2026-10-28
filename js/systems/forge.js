/* ============ forge.js — Forja Evolutiva ============
 * Con Fragmentos Evolutivos se desbloquean las formas evolucionadas de los Pokémon que ya
 * tienes (data/evolutions.js). La forma de origen no se pierde. El gacha no da formas
 * evolucionadas (ver gacha.js) y sólo las formas base se eligen de compañero: una forma
 * desbloqueada aquí se ve en la colección y es la meta de la evolución durante la partida
 * (systems/evolution.js). Lógica pura; la pantalla está en ui/forge-ui.js.
 */
G.Forge = (() => {
  /** Fragmentos por rareza de la forma que se desbloquea. Ajustable aquí. */
  const PRICE = { 1: 20, 2: 40, 3: 80, 4: 160, 5: 300 };

  const price = dex => PRICE[G.DEX_BY[dex].rarity];

  /** Mega: Fragmentos (normal / X, Y, Z) y Cristales de sus tipos (8 si es de un tipo, 6 + 6 si de dos). */
  const MEGA_SHARDS = { mega: 400, xy: 450 };
  const MEGA_CRYSTALS = { one: 8, two: 6 };

  /**
   * Lo que se puede forjar ahora: { from, to, price } por cada forma que aún no tienes y
   * cuya pre-evolución sí. Una sola entrada por forma (con varios orígenes, el de menor Nº).
   * Ordenadas de barata a cara y por Nº.
   */
  function offers() {
    const s = G.DB.save;
    if (!s) return [];
    const out = new Map();
    for (const from of Object.keys(s.owned).map(Number).sort((a, b) => a - b)) {
      for (const to of (G.EVO && G.EVO[from]) || []) {
        if (!G.DB.owns(to) && !out.has(to)) out.set(to, { from, to, price: price(to) });
      }
    }
    return [...out.values()].sort((a, b) => a.price - b.price || a.to - b.to);
  }

  /** Compra la forma `to`. → { ok: true } o { ok: false, reason: 'unknown'|'owned'|'locked'|'shards' } */
  function buy(to) {
    const s = G.DB.save;
    if (!s || !G.DEX_BY[to]) return { ok: false, reason: 'unknown' };
    if (G.DB.owns(to)) return { ok: false, reason: 'owned' };
    const offer = offers().find(o => o.to === to);
    if (!offer) return { ok: false, reason: 'locked' };
    if ((s.shards || 0) < offer.price) return { ok: false, reason: 'shards' };
    s.shards -= offer.price;
    G.DB.grant(to, 'forge');
    G.DB.commit(true);
    return { ok: true };
  }

  /** Lo que cuesta desbloquear la Mega `to`: { shards, crystals: { tipo: n } }. */
  function megaCost(to) {
    const m = G.DEX_BY[to];
    const n = m.types.length === 1 ? MEGA_CRYSTALS.one : MEGA_CRYSTALS.two;
    return { shards: m.form === 'mega' ? MEGA_SHARDS.mega : MEGA_SHARDS.xy, crystals: Object.fromEntries(m.types.map(t => [t, n])) };
  }

  /** Megas que se pueden desbloquear ya: las de formas que tienes y que aún no tienes. */
  function offersMega() {
    const s = G.DB.save;
    if (!s || !G.MEGA) return [];
    const out = [];
    for (const from of Object.keys(s.owned).map(Number)) {
      for (const to of G.MEGA[from] || []) if (!G.DB.owns(to)) out.push(Object.assign({ from, to }, megaCost(to)));
    }
    return out.sort((a, b) => a.shards - b.shards || a.to - b.to);
  }

  /** Desbloquea la Mega `to`. → { ok: true } o { ok: false, reason: 'unknown'|'owned'|'locked'|'shards'|'crystals' } */
  function buyMega(to) {
    const s = G.DB.save;
    if (!s || !G.MEGA_FROM || G.MEGA_FROM[to] == null) return { ok: false, reason: 'unknown' };
    if (G.DB.owns(to)) return { ok: false, reason: 'owned' };
    const offer = offersMega().find(o => o.to === to);
    if (!offer) return { ok: false, reason: 'locked' };
    if ((s.shards || 0) < offer.shards) return { ok: false, reason: 'shards' };
    for (const t of Object.keys(offer.crystals)) if (G.DB.crystals(t) < offer.crystals[t]) return { ok: false, reason: 'crystals' };
    s.shards -= offer.shards;
    for (const t of Object.keys(offer.crystals)) s.cry[t] -= offer.crystals[t];
    G.DB.grant(to, 'forge');
    G.DB.commit(true);
    return { ok: true };
  }

  return { PRICE, price, offers, buy, MEGA_SHARDS, MEGA_CRYSTALS, megaCost, offersMega, buyMega };
})();
