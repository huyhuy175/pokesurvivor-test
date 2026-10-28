/* ============ levelup.js — las tres cartas de subida de nivel ============
 * Tipos de carta:
 *   new   aprender un movimiento nuevo (sólo si quedan huecos de los 4; un vínculo libera huecos)
 *   up    mejorar un movimiento que ya tienes
 *   stat  mejora permanente de la run
 */
G.LevelUp = (() => {

  /*
   * Cada mejora de stat es un dato: op 'add' (pl[f] += v·k), 'mul' (pl[f] *= v^k), 'hp' (vida
   * máxima) o 'heal' (cura instantánea); k es la fuerza de la carta (1 = la de siempre, más
   * con la rareza, negativo = una bajada). 'desc' lleva {x} con lo que da: ver statCard.
   * 'max' = veces que se puede coger en una run; lo que desbloquea una evolución sale siempre.
   */
  const STATS = [
    { id: 'hp',   icon: 'heart', title: 'Vigor',        desc: '+{x} de vida máxima (y la recupera).', op: 'hp', v: 20 },
    { id: 'atk',  icon: 'fist', title: 'Potencia',     desc: '+{x}% de daño con todos los movimientos.', op: 'mul', f: 'atkMul', v: 1.10, max: 40 },
    { id: 'spd',  icon: 'boot', title: 'Carrera',      desc: '+{x}% de velocidad de movimiento.', op: 'mul', f: 'spdMul', v: 1.07, max: 8 },
    { id: 'cd',   icon: 'clock', title: 'Reflejos',     desc: '-{x}% de recarga en todos los movimientos.', op: 'mul', f: 'cdMul', v: 0.92, max: 10 },
    { id: 'def',  icon: 'shield', title: 'Coraza',       desc: '+{x}% de reducción de daño recibido.', op: 'add', f: 'dmgReduce', v: 0.06, pct: true, lo: 0, hi: 0.7, max: 12 },
    { id: 'rgn',  icon: 'sprout', title: 'Síntesis',     desc: '+{x} de vida regenerada por segundo.', op: 'add', f: 'regenFlat', v: 0.9, lo: 0, unit: '/s' },
    { id: 'mag',  icon: 'magnet', title: 'Imán',         desc: '+{x}% de radio de recogida de experiencia.', op: 'mul', f: 'magnet', v: 1.30, max: 6 },
    { id: 'xp',   icon: 'book', title: 'Aprendizaje',  desc: '+{x}% de experiencia ganada.', op: 'mul', f: 'xpMul', v: 1.12, max: 8 },
    { id: 'heal', icon: 'berry', title: 'Baya Zidra',   desc: 'Recupera el {x}% de tu vida ahora mismo.', op: 'heal', v: 0.45 },
    // (28-10-2026) Más opciones de mejora; se suman a lo de Mejoras y a la pasiva.
    { id: 'crit', icon: 'star', title: 'Ojo certero',  desc: '+{x}% de probabilidad de golpe crítico.', op: 'add', f: 'critChance', v: 0.05, pct: true, lo: 0, max: 8 },
    { id: 'critdmg', icon: 'bomb', title: 'Golpe certero', desc: '+{x}% de daño en los golpes críticos.', op: 'add', f: 'critDmgBonus', v: 0.2, pct: true, lo: 0, max: 8 },
    { id: 'boss', icon: 'crown', title: 'Cazajefes',   desc: '+{x}% de daño a los jefes.', op: 'mul', f: 'bossDmg', v: 1.15, max: 6 },
    { id: 'execute', icon: 'trophy', title: 'Rematador', desc: '+{x}% de daño a los enemigos con menos del 30% de vida.', op: 'mul', f: 'executeDmg', v: 1.25, max: 4 },
    { id: 'dodge', icon: 'flying', title: 'Esquiva',    desc: '+{x}% de probabilidad de esquivar un golpe.', op: 'add', f: 'dodgeChance', v: 0.03, pct: true, lo: 0, hi: 0.6, max: 6 },
    { id: 'healmore', icon: 'leftovers', title: 'Curación mejorada', desc: '+{x}% de vida en todas las curas que recibes.', op: 'mul', f: 'healMul', v: 1.2, max: 5 },
    { id: 'coins', icon: 'amuletcoin', title: 'Fortuna', desc: '+{x}% de Pokémonedas ganadas.', op: 'mul', f: 'coinMul', v: 1.10, max: 8 }
  ];

  const OPS = {
    add: (pl, s, k) => { pl[s.f] += s.v * k; if (s.lo != null) pl[s.f] = Math.max(s.lo, pl[s.f]); if (s.hi != null) pl[s.f] = Math.min(s.hi, pl[s.f]); },
    mul: (pl, s, k) => { pl[s.f] *= Math.pow(s.v, k); },
    hp: (pl, s, k) => {
      const d = s.v * k;
      pl.addMaxHp(d < 0 ? -Math.min(-d, pl.maxHp - 1) : d);
      pl.hp = Math.max(1, pl.hp);
    },
    heal: (pl, s, k) => pl.heal(pl.maxHp * s.v * k)
  };
  for (const s of STATS) s.apply = (pl, k = 1) => OPS[s.op](pl, s, k);

  /** Lo que da la mejora con fuerza k, como número a enseñar (sin signo). */
  function amount(s, k) {
    const v = s.op === 'mul' ? Math.abs(Math.pow(s.v, k) - 1) * 100
      : s.op === 'hp' ? Math.abs(s.v * k)
      : s.f === 'regenFlat' ? Math.abs(s.v * k)
      : Math.abs(s.v * k) * 100;
    return s.f === 'regenFlat' ? Math.round(v * 10) / 10 : Math.round(v);
  }
  const unitOf = s => (s.unit != null ? s.unit : s.op === 'hp' ? '' : '%');
  /** "Potencia +15%" (la bajada, con −). */
  const partText = (s, k) => G.T(s.title) + ' ' + (k < 0 ? '−' : '+') + amount(s, k) + unitOf(s);
  /** Texto con {x} traducible. */
  const tf = (es, ...vals) => (G.I18n ? G.I18n.f(es, ...vals) : es.replace(/\{x\}/g, () => vals.shift()));

  // ---------------- rareza de las cartas de stat (28-10-2026) ----------------
  // Sólo las de stat. Las tiradas y la fuerza de cada rareza se afinan con tests/balance.test.cjs:
  // la run con esta carta (4 cartas, con rareza) no debe pasar de lo que rendía la de antes.
  const RARITY = {
    1: { n: 'Común', c: '#9fb1c9' }, 2: { n: 'Poco común', c: '#5fe08a' }, 3: { n: 'Rara', c: '#4fb4ff' },
    4: { n: 'Épica', c: '#c47bff' }, 5: { n: 'Legendaria', c: '#ffcb3d' }, 6: { n: 'Mítica', c: '#ff5fa8' }
  };
  const RATES = [[1, 45], [2, 30], [3, 17], [4, 6.5], [5, 1], [6, 0.5]];     // % por carta de stat
  /** Fuerza (k) de una carta de un solo stat, según rareza. */
  const SINGLE_K = { 1: 0.6, 2: 0.9, 3: 1.35 };
  /** Épica y Legendaria: 2 stats con la fuerza de la izquierda, o 3 con la de la derecha. */
  const BUNDLE_K = { 4: { 2: 0.75, 3: 0.55 }, 5: { 2: 1.35, 3: 1.05 } };
  /** Mítica: "Pacto" (uno sube mucho, otro baja poco) o "Ascensión" (3 stats y +1 nivel a un movimiento). */
  const MYTHIC = { up: 3, down: -0.5, ascend: 1.2 };
  const BUNDLE_NAME = { 4: 'Armonía', 5: 'Maestría' };
  /** Stats que pueden bajar en un Pacto: ninguno deja sin nada al jugador. */
  const DOWNSIDE = ['spd', 'cd', 'mag', 'xp'];

  function rollRarity(rand = Math.random) {
    let x = rand() * 100;
    for (const [r, w] of RATES) { if (x < w) return r; x -= w; }
    return 6;
  }

  /** n stats distintos de list, con rand. */
  function takeSome(list, n, rand) {
    const rest = list.slice(), out = [];
    while (out.length < n && rest.length) out.push(rest.splice(Math.min(rest.length - 1, Math.floor(rand() * rest.length)), 1)[0]);
    return out;
  }

  /**
   * La carta de stat con la rareza indicada (1-6). pool = stats que se pueden coger ahora
   * (con hueco); las rarezas altas juntan varios. Devuelve { rarity, parts: [{ id, k }], ... }.
   */
  function statCard(pl, stat, rarity, pool, rand = Math.random) {
    const mix = pool.filter(s => s.id !== 'heal' && s.id !== stat.id);
    if (stat.id === 'heal' && rarity > 3) rarity = 3;
    if (rarity > 3 && !mix.length) rarity = 3;
    let parts, title = G.T(stat.title), desc, ascend = false;
    if (rarity <= 3) {
      parts = [{ id: stat.id, k: SINGLE_K[rarity] }];
      desc = tf(stat.desc, amount(stat, parts[0].k));
    } else {
      let names, text;
      if (rarity === 6 && rand() < 0.5) {                                   // Pacto
        const down = takeSome(mix.filter(s => DOWNSIDE.includes(s.id)), 1, rand);
        parts = [{ id: stat.id, k: MYTHIC.up }].concat(down.map(s => ({ id: s.id, k: MYTHIC.down })));
        names = 'Pacto';
      } else {
        const n = rarity === 6 ? 3 : rand() < 0.5 ? 2 : 3;
        const k = rarity === 6 ? MYTHIC.ascend : BUNDLE_K[rarity][Math.min(n, mix.length + 1)] || BUNDLE_K[rarity][2];
        parts = [stat].concat(takeSome(mix, n - 1, rand)).map(s => ({ id: s.id, k }));
        ascend = rarity === 6;
        names = ascend ? 'Ascensión' : BUNDLE_NAME[rarity];
      }
      title = G.T(names);
      text = parts.map(p => partText(STATS.find(s => s.id === p.id), p.k)).join(' · ');
      desc = ascend ? text + ' · ' + G.T('+1 nivel a un movimiento al azar') : text;
    }
    return {
      type: 'stat', key: 'stat:' + stat.id,
      icon: stat.icon, rarity, rcolor: RARITY[rarity].c, color: RARITY[rarity].c,
      tag: rarity > 1 ? RARITY[rarity].n : 'Mejora', title, desc, parts,
      apply: p => {
        for (const part of parts) {
          STATS.find(s => s.id === part.id).apply(p, part.k);
          if (part.k > 0) p.statsTaken[part.id] = (p.statsTaken[part.id] || 0) + 1;
        }
        if (ascend) {
          const up = p.moves.filter(m => m.lvl < m.def.maxLvl);
          if (up.length) G.Moves.levelUp(up[Math.floor(rand() * up.length)]);
        }
      }
    };
  }

  /** n elementos distintos de list, cada uno con probabilidad según weight(x). */
  function pickWeighted(list, n, weight) {
    const rest = list.map(x => [x, weight(x)]), out = [];
    while (out.length < n && rest.length) {
      let r = Math.random() * rest.reduce((a, [, w]) => a + w, 0), i = 0;
      while (i < rest.length - 1 && (r -= rest[i][1]) > 0) i++;
      out.push(rest.splice(i, 1)[0][0]);
    }
    return out;
  }

  /** Construye el conjunto de cartas candidatas, con pesos. */
  /** Huecos de movimiento normales en uso (el del movimiento especial de la especie no cuenta). */
  const normalSlots = pl => (pl.normalSlots ? pl.normalSlots() : pl.slots.length);

  function candidates(pl) {
    const out = [];

    // --- movimientos nuevos ---
    if (normalSlots(pl) < pl.maxMoves) {
      // Con 2 potenciadores ya no se ofrecen más: los buff no hacen daño y
      // llenar los 4 huecos con ellos deja la run sin salida.
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      // Si es de su lado flojo, cuánto rinde (Machamp con Bola Sombra...).
      const fitNote = (mon, cat) => {
        const f = G.Stats.fit(mon, cat);
        return f < 0.95 ? ` <span class="fit-low">Con ${mon.name} rinde un ${Math.round(f * 100)} %: pega mejor con ataques ${G.Stats.sideOf(mon) === 'special' ? 'especiales' : 'físicos'}.</span>` : '';
      };
      const pool = G.Moves.poolFor(pl.mon).filter(id =>
        !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= 2 && G.Moves.BY_ID[id].kind === 'buff'));
      // Los de su lado bueno (y los empatados y mejoras) salen el doble.
      const weight = id => { const d = G.Moves.BY_ID[id]; return G.Stats.fit(pl.mon, d.cat) >= 0.999 ? 2 : 1; };
      for (const id of pickWeighted(pool, 6, weight)) {
        const d = G.Moves.BY_ID[id];
        out.push({
          w: 10, type: 'new', key: 'new:' + id,
          icon: 'move:' + id, color: G.U.TYPE_COLOR[d.type],
          // (Físico o especial va en su propia etiqueta, con borde: ver run-ui.js. Los
          // potenciadores no tienen categoría, pero Danza Espada y Danza Dragón suben el
          // ataque físico y Maquinación el especial: llevan la del lado que suben.)
          tag: G.U.TYPE_NAME[d.type],
          cat: G.Stats.NAME[d.cat || (d.stat === 'patk' ? 'physical' : d.stat === 'satk' ? 'special' : '')] || '',
          title: G.T(d.name, 'move'), desc: d.desc + fitNote(pl.mon, d.cat),
          apply: p => p.addMove(id)
        });
      }
    }

    // --- evoluciones: movimiento al máximo + su condición cumplida ---
    const waiting = {};                   // stat -> movimiento que la espera para evolucionar
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, pl.statsTaken);
      if (!ev) continue;
      if (!ev.ready) { waiting[ev.needs] = m; continue; }
      out.push({
        w: 40, type: 'evo', key: 'evo:' + m.id,
        icon: 'move:' + m.id, color: '#ffd23f', tag: 'EVOLUCIÓN',
        title: G.T(m.name, 'move') + ' → ' + G.T(ev.name, 'move'), desc: ev.text,
        apply: p => {
          G.Moves.evolve(m);
          G.FX.ring(p.x, p.y, 8, 120, '#ffd23f', 0.8, 6);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- mejoras de movimientos que ya tienes ---
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      out.push({
        w: 8, type: 'up', key: 'up:' + m.id,
        icon: 'move:' + m.id, color: G.U.TYPE_COLOR[m.type],
        tag: 'Nv.' + m.lvl + ' > ' + (m.lvl + 1),
        title: G.T(m.name, 'move'), desc: txt,
        apply: () => G.Moves.levelUp(m)
      });
    }

    // --- stats ---
    // Las que desbloquean una evolución salen siempre y con aviso.
    // Cada mejora tiene un tope de veces (`max`): en partidas muy largas se
    // acumulaban sin fin (velocidad, recarga y experiencia por las nubes) y el
    // juego acababa colgándose. Las que piden una evolución salen siempre.
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const eligible = STATS.filter(s => room(s));
    const pickStats = G.U.pickN(STATS.filter(s => !waiting[s.id] && room(s)), 5).concat(STATS.filter(s => waiting[s.id]));
    for (const s of pickStats) {
      const evoFor = waiting[s.id];
      // La que espera una evolución sale siempre y con aviso: sin rareza a la vista, con la fuerza de
      // una Poco común (que es la de siempre) y cuenta como una elección más.
      const c = statCard(pl, s, evoFor ? 2 : rollRarity(), eligible);
      c.w = evoFor ? 14 : normalSlots(pl) < pl.maxMoves ? 4 : 7;
      if (evoFor) { c.color = '#ffd23f'; c.rcolor = null; c.tag = 'Evoluciona ' + G.T(evoFor.name, 'move'); }
      out.push(c);
    }

    return out;
  }

  /** Tope de cartas de forma (evolución / Mega) en una misma subida de nivel. */
  const MAX_FORM_CARDS = 5;

  /**
   * Las cartas para evolucionar o megaevolucionar (systems/evolution.js y mega.js), si el Pokémon
   * cumple lo exigido y lleva la piedra. Una por forma. Primero la evolución normal; la Mega, sólo si
   * no queda ninguna. Si no eliges una, la piedra se queda y vuelve a salir en la siguiente subida.
   */
  function formCards(pl) {
    const E = G.Evo && G.Evo.ready(pl) ? G.Evo : G.Mega && G.Mega.ready(pl) ? G.Mega : null;
    const cards = E ? E.cards(pl).slice(0, MAX_FORM_CARDS) : [];
    if (cards.length && G.Sprites) G.Sprites.preload(cards.map(c => c.dex), 4000, pl.shiny);    // listas al elegir
    return cards;
  }

  /** Devuelve 4 cartas distintas, elegidas por peso (más las de evolución, que siempre salen). */
  function offer(pl, n = 4) {
    const pool = candidates(pl);
    const picked = [];
    const used = new Set();
    // Si hay una evolución lista, su carta dorada sale siempre.
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) { const c = pool.splice(evo, 1)[0]; used.add(c.key); picked.push(c); }
    // Y las de forma (evolución / Mega), con al menos una carta normal más.
    const forms = formCards(pl);
    for (const c of forms) { used.add(c.key); picked.push(c); }
    n = Math.max(n, picked.length + 1);

    while (picked.length < n && pool.length) {
      const total = pool.reduce((a, c) => a + c.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
      const c = pool.splice(idx, 1)[0];
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push(c);
    }
    return picked;
  }

  return { offer, STATS, RARITY, RATES, rollRarity, statCard, SINGLE_K, BUNDLE_K, MYTHIC };
})();
