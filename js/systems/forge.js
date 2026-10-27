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

  return { PRICE, price, offers, buy };
})();
