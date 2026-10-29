/* ============ gacha.js — un banner por generación ============
 * Lógica pura: no toca la interfaz. La pantalla está en ui/gacha-ui.js.
 *
 * 9 banners (Kanto ... Paldea). Cada uno con su propio pity.
 * Probabilidades por tirada:  1★ 45% · 2★ 30% · 3★ 17% · 4★ 6.5% · 5★ 1.5%
 * Garantías:
 *   - la tirada ×10 trae al menos un 4★ o superior
 *   - a las 70 tiradas sin 5★ en ese banner, el siguiente es 5★ seguro
 * Shiny: 1 de cada 100 tiradas sale en su versión shiny (2 de cada 100 con el
 *   Amuleto Iris de esa generación).
 * Amuleto Iris: uno por generación. Se tiene al completar su Pokédex (todos sus
 *   Pokémon, legendarios incluidos). No se guarda aparte: sale de lo que tienes.
 * Repetidos: suben el Rank de su línea (G.Rank, hasta 15 repetidos = 10★), sin
 *   monedas. A partir del 16º se convierten en Pokémonedas (los shiny, el triple).
 *
 * Se tira con TICKETS (se consiguen jugando):
 *   ×1   1 ticket (ya sin botón: desde el 22-10-2026 se tira de 10 en 10 o de 100 en 100)
 *   ×10  10 tickets normales, o 1 ticket ×10 (eliges con qué)
 *   ×100 100 tickets normales, o 10 tickets ×10: son diez ×10 seguidas (cada
 *        una con su Épica asegurada)
 */
G.Gacha = (() => {
  /** ¿Qué gasta una tirada de n? → { t1, t10 } o null si no te llega. */
  /** @param use  't1' (tickets normales) o 't10' (un ticket ×10, sólo para la ×10) */
  function costOf(save, n, use = 't1') {
    const t = save.tickets || { t1: 0, t10: 0 };
    if (n === 100 && use === 't10') return t.t10 >= 10 ? { t1: 0, t10: 10 } : null;
    if (n === 10 && use === 't10') return t.t10 >= 1 ? { t1: 0, t10: 1 } : null;
    return t.t1 >= n ? { t1: n, t10: 0 } : null;
  }
  const RATES = [[1, 45], [2, 30], [3, 17], [4, 6.5], [5, 1.5]];
  const PITY_5 = 70;
  const SHINY_RATE = 1 / 100;
  const SHINY_RATE_IRIS = 2 / 100;
  const REFUND = { 1: 15, 2: 30, 3: 60, 4: 120, 5: 300 };
  const GEM_REFUND = { 4: 3, 5: 10 };   // banner agotado: Épica y Legendaria dan Gemas en vez de monedas
  let forceShiny = 0;           // para pruebas y vídeos: las N próximas salen shiny

  const RARITY_NAME = { 1: 'Común', 2: 'Poco común', 3: 'Rara', 4: 'Épica', 5: 'Legendaria' };
  const RARITY_COLOR = { 1: '#9fb1c9', 2: '#5fe08a', 3: '#4fb4ff', 4: '#c47bff', 5: '#ffcb3d' };

  const BANNERS = [
    { gen: 1, name: 'Kanto',   color: ['#3a1d6e', '#1b2f78', '#0f4d6e'] },
    { gen: 2, name: 'Johto',   color: ['#5a2a1a', '#7a3d1f', '#2d4a6e'] },
    { gen: 3, name: 'Hoenn',   color: ['#0f4d6e', '#1b6a5a', '#2a3d78'] },
    { gen: 4, name: 'Sinnoh',  color: ['#2a2a5e', '#3d3d8a', '#5a2a6e'] },
    { gen: 5, name: 'Teselia', color: ['#1a1a2a', '#3a3a4e', '#2a4a6e'] },
    { gen: 6, name: 'Kalos',   color: ['#4a1a3a', '#2a3a7a', '#1a5a7a'] },
    { gen: 7, name: 'Alola',   color: ['#7a3a1a', '#1a6a6a', '#2a4a8a'] },
    { gen: 8, name: 'Galar',   color: ['#4a1a5a', '#1a3a6a', '#6a1a3a'] },
    { gen: 9, name: 'Paldea',  color: ['#6a2a1a', '#4a1a5a', '#1a4a6a'] }
  ];

  /** Sólo formas base: las evolucionadas se consiguen en la Forja Evolutiva. */
  function inBanner(p, gen) { return p.gen === gen && !!G.SPRITE_META[p.dex] && G.Mons.isBase(p.dex); }

  /** Pokémon de una rareza en un banner. */
  function pool(rarity, gen) { return G.DEX.filter(p => inBanner(p, gen) && p.rarity === rarity); }

  /** Pool no vacío más cercano (algunas generaciones tienen rarezas casi vacías). */
  function poolNear(rarity, gen, ok = () => true) {
    for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = rarity + d;
      if (r < 1 || r > 5) continue;
      const p = pool(r, gen).filter(ok);
      if (p.length) return { rarity: r, list: p };
    }
    return { rarity, list: G.DEX.filter(p => inBanner(p, gen) && ok(p)) };
  }

  /** Un Pokémon con las 10★ (15 repetidos) ya no sale del banner. */
  const notMaxed = p => G.Rank.dupesOf(p.dex) < G.Rank.MAX_DUPES;

  /** Cuántos tienes de una generación → { have, total }. */
  function dexOf(save, gen) {
    const list = G.DEX.filter(p => p.gen === gen);
    return { have: list.filter(p => save.owned[p.dex]).length, total: list.length };
  }

  /** ¿Tiene el Amuleto Iris de esa generación (su Pokédex completa)? */
  function hasIris(save, gen) { const d = dexOf(save, gen); return d.have >= d.total; }

  function shinyRate(save, gen) { return hasIris(save, gen) ? SHINY_RATE_IRIS : SHINY_RATE; }

  function rollRarity(min = 1) {
    const rates = RATES.filter(([r]) => r >= min);
    const total = rates.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [r, w] of rates) { x -= w; if (x <= 0) return r; }
    return rates[rates.length - 1][0];
  }

  /** Los 3 más fuertes de la generación, para el cartel del banner. */
  function featured(gen) {
    return G.DEX.filter(p => inBanner(p, gen) && p.rarity === 5)
      .sort((a, b) => b.bst - a.bst).slice(0, 3).map(p => p.dex);
  }

  /**
   * Hace `n` tiradas en el banner `gen` sobre el guardado `save` (lo modifica).
   * Devuelve null si no hay monedas, o la lista de resultados:
   *   { dex, rarity, shiny, isNew, refund, star }
 * (un Pokémon con 10★ ya no sale; si todo el banner está al máximo la tirada es
 *   { dex: 0, converted: true, refund, gems }: monedas, o Gemas si era Épica/Legendaria)
   * (star = estrella nueva si este repetido ha subido el Rank, si no 0)
   * (y en .iris la generación si estas tiradas te han dado su Amuleto Iris).
   */
  function pull(save, n, gen = 1, use = 't1', opts = {}) {
    const sure = !!opts.sure && n === 10;
    if (sure && (!G.Shop.count('wishsure') || !missingIn(save, gen).length || !costOf(save, n, use))) return null;
    if (n === 100) {
      if (!costOf(save, 100, use)) return null;
      const hadIris = hasIris(save, gen);
      const out = [];
      for (let k = 0; k < 10; k++) out.push(...pull(save, 10, gen, use));
      out.iris = !hadIris && hasIris(save, gen) ? gen : 0;
      return out;
    }
    const cost = costOf(save, n, use);
    if (!cost) return null;
    save.tickets.t1 -= cost.t1;
    save.tickets.t10 -= cost.t10;
    save.pity = save.pity || {};
    save.shiny = save.shiny || {};
    save.pity[gen] = save.pity[gen] || 0;
    const hadIris = hasIris(save, gen), rate = shinyRate(save, gen);

    const out = [];
    for (let i = 0; i < n; i++) {
      save.pity[gen]++;
      let want;
      if (save.pity[gen] >= PITY_5) want = 5;
      else if (n === 10 && i === n - 1 && !out.some(r => r.rarity >= 4)) want = rollRarity(4);
      else want = rollRarity();

      let { rarity, list } = poolNear(want, gen, notMaxed);
      // Banner agotado (todos al máximo): la tirada se convierte en Pokémonedas, o en Gemas si era Épica/Legendaria.
      if (!list.length) {
        if (want === 5) save.pity[gen] = 0;
        const gems = GEM_REFUND[want] || 0, refund = gems ? 0 : REFUND[want];
        save.coins += refund;
        if (gems) save.gems = Math.min(1e9, (save.gems || 0) + gems);
        out.push({ dex: 0, rarity: want, shiny: false, isNew: false, refund, gems, star: 0, converted: true });
        continue;
      }
      // Vale de garantía: la última tirada es un Pokémon que aún no tienes. Respeta el pity (5★) y la
      // garantía del ×10 (≥4★ si no ha salido ninguno); si no queda de esa rareza, cualquiera que falte.
      // El vale sólo se gasta si esto se aplica de verdad (si las 9 primeras completaron el banner, no).
      if (sure && i === n - 1) {
        const miss = missingIn(save, gen);
        if (miss.length) {
          const noTop = !out.some(r => r.rarity >= 4);
          const tier = miss.filter(p => want === 5 ? p.rarity === 5 : noTop ? p.rarity >= want : p.rarity === want);
          list = tier.length ? tier : miss;
          rarity = G.U.pick(list).rarity;
          list = list.filter(p => p.rarity === rarity);
          G.Shop.take('wishsure');
        }
      }
      if (rarity === 5) save.pity[gen] = 0;
      let mon = G.U.pick(list);
      let shiny = G.Sprites.hasShiny(mon.dex) && (forceShiny > 0 ? (forceShiny--, true) : Math.random() < rate);
      // Los shiny no se repiten: si ya tienes ese, sale otro de la misma rareza
      // cuyo shiny te falte; si los tienes todos, sale normal.
      if (shiny && save.shiny[mon.dex]) {
        const missing = list.filter(p => G.Sprites.hasShiny(p.dex) && !save.shiny[p.dex]);
        if (missing.length) mon = G.U.pick(missing);
        else shiny = false;
      }

      let isNew = false, refund = 0, star = 0;
      if (shiny) {
        isNew = !save.shiny[mon.dex];
        if (isNew) save.shiny[mon.dex] = { at: Date.now(), from: 'gacha' };
        else { const r = G.Rank.add(mon.dex); star = r.star; if (r.over) refund = REFUND[rarity] * 3; }
        if (!save.owned[mon.dex]) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
      } else {
        isNew = !save.owned[mon.dex];
        if (isNew) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
        else { const r = G.Rank.add(mon.dex); star = r.star; if (r.over) refund = REFUND[rarity]; }
      }
      save.coins += refund;
      out.push({ dex: mon.dex, rarity, shiny, isNew, refund, star });
    }
    save.stats.pulls = (save.stats.pulls || 0) + n;
    out.iris = !hadIris && hasIris(save, gen) ? gen : 0;
    return out;
  }

  // ---------------- vales wish (ver data/shop.js) ----------------

  /** Formas base de un banner que aún no tienes. */
  function missingIn(save, gen) { return G.DEX.filter(p => inBanner(p, gen) && !save.owned[p.dex]); }

  /** Dex de formas base que no tienes (de todas las generaciones), filtrables por tipo. */
  function missing(save, type) {
    return G.DEX.filter(p => G.Mons.isBase(p.dex) && !save.owned[p.dex] && (!type || p.types.includes(type))).map(p => p.dex);
  }

  /**
   * Vale de tipo: gasta 1 y sortea un tipo con algún Pokémon por conseguir (queda en save.pendingType).
   * Quien llame debe hacer G.DB.commit(true) enseguida, o el sorteo (y el vale gastado) se pierde al recargar.
   */
  /*
   * Cada sorteo lleva un número que sólo crece (save.typeDraw) y save.typeClaim es el
   * último ya usado. El sorteo sólo está pendiente si typeDraw > typeClaim: así, al
   * fusionar con una copia vieja (la nube aún con pendingType), un tipo ya reclamado
   * no vuelve como otro Pokémon gratis (db.js merge toma el mayor de cada número).
   */
  const ctr = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  /** El tipo sorteado pendiente de elegir, o null. */
  function pendingType(save) {
    return save.pendingType && ctr(save.typeDraw) > ctr(save.typeClaim) ? save.pendingType : null;
  }
  /** Da por usado el sorteo actual (reclamado o descartado). */
  function closeDraw(save) {
    save.typeClaim = Math.max(ctr(save.typeClaim), ctr(save.typeDraw));
    delete save.pendingType;
  }

  function startTypePick(save) {
    const cur = pendingType(save);
    if (cur && missing(save, cur).length) return { ok: true, type: cur };
    // Ya tienes todos los de ese tipo (o ya se usó): el sorteo no sirve. Se descarta (el vale gastado se pierde).
    if (save.pendingType) closeDraw(save);
    if (!G.Shop.count('wishtype')) return { ok: false, reason: 'item' };
    const types = Object.keys(G.U.TYPE_NAME).filter(t => missing(save, t).length);
    if (!types.length) return { ok: false, reason: 'none' };
    G.Shop.take('wishtype');
    save.typeDraw = Math.max(ctr(save.typeDraw), ctr(save.typeClaim)) + 1;
    save.pendingType = G.U.pick(types);
    return { ok: true, type: save.pendingType };
  }

  /** Reclama el Pokémon de un vale ('type': el de pendingType; 'any': gasta 1 wishany). No toca el pity. */
  function claim(save, kind, dex) {
    const mon = G.DEX_BY[dex];
    if (!mon || !G.Mons.isBase(dex) || (kind !== 'type' && kind !== 'any')) return { ok: false, reason: 'invalid' };
    if (kind === 'type') {
      const t = pendingType(save);
      if (!t || !mon.types.includes(t)) return { ok: false, reason: 'type' };
      if (save.owned[dex]) return { ok: false, reason: 'owned' };
      closeDraw(save);
    } else {
      if (!G.Shop.count('wishany')) return { ok: false, reason: 'item' };
      if (save.owned[dex]) return { ok: false, reason: 'owned' };
      G.Shop.take('wishany');
    }
    save.owned[dex] = { at: Date.now(), from: 'wish' };
    return { ok: true };
  }

  /** Qué vale cae: 80% garantía, 15% tipo, 5% libre. */
  function rollWish(rand = Math.random) {
    const x = rand();
    return x < 0.80 ? 'wishsure' : x < 0.95 ? 'wishtype' : 'wishany';
  }

  return { debugForceShiny(n = 1) { forceShiny = n; }, missing, missingIn, pendingType, startTypePick, claim, rollWish,
           costOf, RATES, PITY_5, SHINY_RATE, SHINY_RATE_IRIS, REFUND, GEM_REFUND, RARITY_NAME, RARITY_COLOR, BANNERS,
           pool, featured, pull, dexOf, hasIris, shinyRate };
})();
