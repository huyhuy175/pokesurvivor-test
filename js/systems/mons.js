/* ============ mons.js — naturaleza, pasiva y MT de cada Pokémon ============
 * (20-10-2026, de la Tienda Kecleon del PR #236 de TheAdro7, adaptado.)
 *
 * Cada Pokémon de tu colección tiene:
 *   - NATURALEZA (data/natures.js): +10 % a un stat y −10 % a otro, como en los
 *     juegos (5 son neutras). Se cambia con una Menta.
 *   - PASIVA: la común de su tipo (data/passives-common.js) y la unique de su línea
 *     evolutiva (data/passives.js), que se abre a 3★ (G.Rank). Ya no hay Cápsulas de Habilidad.
 *   - MT aprendidas: ataques que no son de sus tipos pero sí los aprende en los
 *     juegos (Mewtwo, Bola Sombra; Psyduck, Lanzallamas no). Salen en sus cartas
 *     de nivel y se pueden elegir de movimiento inicial (G.Moves.poolFor).
 *
 * Lo que le TOCÓ (la naturaleza) no se guarda: sale "al azar" pero fijo
 * para cada cuenta y Pokémon (semilla: fecha de creación de la partida + nº de la
 * Pokédex), así todos los aparatos de la misma cuenta ven lo mismo y también los
 * Pokémon que ya tenías antes de esto tienen la suya. Lo cambiado con Menta
 * sí se guarda (save.pnat, con la fecha para fusionar).
 */
G.Mons = (() => {
  const save = () => G.DB && G.DB.save;

  /** Nombre en el idioma del juego: [es, en, fr, it, zh-Hans, zh-Hant] (pt-BR, el inglés). */
  const LANG_I = { es: 0, en: 1, fr: 2, it: 3, 'pt-BR': 1, 'zh-Hans': 4, 'zh-Hant': 5 };
  function name(n) {
    if (!Array.isArray(n)) return String(n || '');
    return n[LANG_I[G.I18n ? G.I18n.lang : 'es'] || 0] || n[1] || n[0];
  }

  // Número pseudoaleatorio fijo para (cuenta, Pokémon, sal), entre 0 y 1.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const roll = (dex, salt) => hash(((save() && save().created) || 0) + ':' + dex + ':' + salt);

  // ---------------- naturaleza ----------------

  /** La que le tocó (sin Menta). */
  function rolledNature(dex) { return G.NATURES[Math.floor(roll(dex, 'nat') * G.NATURES.length)]; }
  /** La que tiene ahora: la de la Menta o la que le tocó. */
  function natureOf(dex) {
    const s = save(), p = s && s.pnat && s.pnat[dex];
    return (p && G.NATURE_BY[p[0]]) || rolledNature(dex);
  }
  function setNature(dex, id) {
    const s = save();
    if (!s || !G.NATURE_BY[id]) return;
    s.pnat = s.pnat || {};
    s.pnat[dex] = [id, Date.now()];
  }

  /**
   * El Pokémon con su naturaleza aplicada (una copia: G.DEX_BY no se toca).
   * pa/sa: daño de sus ataques físicos/especiales · df/sd: defensas · spd: velocidad.
   */
  function monFor(dex) {
    const base = G.DEX_BY[dex];
    if (!base) return base;
    const n = natureOf(dex), m = Object.assign({}, base);
    if (n.up) m[n.up] = base[n.up] * 1.1;
    if (n.down) m[n.down] = base[n.down] * 0.9;
    m.atk = Math.max(m.pa, m.sa);
    m.nature = n.id;
    return m;
  }

  // ---------------- pasiva ----------------

  /**
   * Su pasiva: { id, name, desc, slot, unique: { name, desc, locked } }. name y desc son las del
   * efecto que lleva ahora (G.AbilityFX.of: la común de su tipo y, desde 3★, la unique de su
   * línea); unique es la de su línea aunque esté bloqueada (locked por debajo de 3★). Ya no hay
   * huecos de habilidad ni Cápsulas (save.pabil de partidas antiguas se ignora). Sólo en inglés.
   */
  function abilityOf(dex) {
    const mon = G.DEX_BY[dex];
    if (!mon) return { id: String(dex), name: '', desc: '', slot: 0, unique: { name: '', desc: '', locked: true }, sig: null };
    const fx = G.AbilityFX.of(mon), p = G.AbilityFX.parts(mon), u = p.unique;
    const sg = G.SIG_OF ? G.SIG_OF(dex) : null;             // movimiento especial de la especie (Rank 5★)
    return {
      id: String(dex), name: fx.name || '', desc: fx.d, slot: 0,
      unique: { name: u ? u.n : '', desc: u ? G.PassiveFX.build(u, mon).d : '', locked: !p.on },
      sig: sg ? { name: sg.name, desc: sg.desc, rare: sg.rare, locked: !(G.Rank && G.Rank.starsOf(dex) >= 5) } : null
    };
  }

  // ---------------- MT ----------------

  /** Movimientos que ha aprendido con MT. */
  function taught(dex) {
    const s = save(), l = s && s.ptm && s.ptm[dex];
    return Array.isArray(l) ? l.filter(id => G.Moves.BY_ID[id]) : [];
  }
  /** ¿Ya lo sabe sin MT (es de sus tipos)? */
  const natural = (dex, id) => G.Moves.poolFor(G.DEX_BY[dex], true).includes(id);
  /** MT que puede aprender (las que no sabe ya). */
  function learnable(dex) { return G.TM_OF(dex).filter(id => G.Moves.BY_ID[id] && !natural(dex, id) && !taught(dex).includes(id)); }
  const canLearn = (dex, id) => learnable(dex).includes(id);
  /** Enseña una MT de la Mochila (se gasta). → true si se ha aprendido. */
  function teach(dex, id) {
    const s = save();
    if (!s || !canLearn(dex, id) || !G.Shop.takeTm(id)) return false;
    s.ptm = s.ptm || {};
    s.ptm[dex] = taught(dex).concat([id]);
    return true;
  }

  /** Forma base: sin pre-evolución ni Mega. Sólo ésas salen del gacha y se eligen de compañero. */
  const isBase = dex => !(G.EVO_FROM && G.EVO_FROM[dex]) && !(G.MEGA_FROM && G.MEGA_FROM[dex]);

  /**
   * De quién viene: sus pre-evoluciones, de la forma base a la directa (Charizard → [Charmander,
   * Charmeleon]); vacío si es una forma base. Con varios orígenes sigue el de menor Nº.
   */
  function lineage(dex) {
    const mega = G.MEGA_FROM && G.MEGA_FROM[dex];
    if (mega != null) return [...lineage(mega), mega];       // una Mega viene de su forma base
    const out = [];
    for (let d = dex, from; (from = G.EVO_FROM && G.EVO_FROM[d]) && from.length && out.length < 8;) {
      d = Math.min(...from);
      if (d === dex || out.includes(d)) break;
      out.unshift(d);
    }
    return out;
  }

  return { name, natureOf, setNature, rolledNature, monFor, abilityOf, isBase, lineage,
           taught, learnable, canLearn, teach, natural };
})();
