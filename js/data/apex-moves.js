/* ============ apex-moves.js — chiêu đặc trưng của los jefes Apex ============
 * El Apex de la grieta especial (systems/rift.js, e.apex) tiene, además de las cuatro
 * habilidades de cualquier legendario (entities/enemy.js: bossInit), una habilidad propia
 * según su tipo ("sig") y, por debajo de la mitad de vida, la repite como eco (Overdrive).
 *
 * Todo se monta con los avisos de siempre: G.Hazards.add (zone / beam, ya se mandan por
 * 'hz' en cooperativo) y boss.shoot (ya va por enemyShot). No hay mensajes nuevos.
 * Nombres y textos sólo en inglés (como el resto de textos del Apex).
 *
 *   G.ApexMoves.LIMITS            límites de dificultad (los vigila tests/apex-moves.test.cjs)
 *   G.ApexMoves.makeCtx(...)      contexto de una tirada: zone / beam con el daño ya limitado
 *   G.ApexMoves.PRIMS             piezas comunes (anillo, espiral, barrido, lluvia...)
 */
G.ApexMoves = (() => {
  const TAU = Math.PI * 2;
  const LIMITS = {
    DMG_CAP: 1.5,             // un hazard hace como mucho shotDmg × 1,5
    MAX_OVERLAP: 2,           // cuántos hazards de una misma tirada pueden cubrir el mismo punto
    MIN_SAFE: 0.35,           // fracción de la arena libre en cada momento de explosión
    MIN_DELAY: 0.7,           // aviso mínimo (s)
    MIN_TARGET_DELAY: 0.45,   // aviso mínimo de los que apuntan a un jugador
    MAX_HAZARDS: 40,          // por tirada, contando el eco
    DODGE: { SPEED: 100, REACT: 0.25, REACH: 11 },   // un aviso sobre el jugador da tiempo a salir de él: (r + REACH) / SPEED + REACT s
    ECHO: { delay: 1.2, dmgK: 0.7, rot: Math.PI / 6 }
  };

  const angDist = (a, b) => { const d = Math.abs(((a - b) % TAU + TAU) % TAU); return Math.min(d, TAU - d); };

  function arenaOf(boss) {
    const a = G.Rift && G.Rift.arenaInfo && G.Rift.arenaInfo();
    return a || { x: boss.x, y: boss.y, r: 307 };
  }

  /**
   * Contexto de una tirada. opts.echo: la repetición (más débil y girada).
   * zone / beam crean el hazard con G.Hazards.add (null si no cabe o el aviso es demasiado corto).
   */
  function makeCtx(boss, pl, cast, opts = {}) {
    const echo = !!opts.echo, arena = arenaOf(boss), type = boss.atkType;
    const everyone = G.Game && G.Game.everyone ? G.Game.everyone() : [pl];
    const ctx = {
      boss, pl, arena, type, echo, out: [], shot: null,
      players: everyone.filter(p => p && !p.dead),
      color: (G.U.TYPE_COLOR && G.U.TYPE_COLOR[type]) || '#ff7a9e',
      base: boss.shotDmg(), fury: !!(boss.ai && boss.ai.fury),
      rot: echo ? LIMITS.ECHO.rot : 0,
      seed: Math.floor(Math.random() * 1e6), used: opts.used || 0
    };
    // A quién persigue el jefe (pl); si ya no está en pie, el primer jugador vivo.
    ctx.focus = pl && !pl.dead && ctx.players.includes(pl) ? pl : ctx.players[0];
    const inArena = (x, y) => {                       // nada nace fuera de la arena
      const d = Math.hypot(x - arena.x, y - arena.y);
      if (d <= arena.r) return [x, y];
      const k = arena.r / d;
      return [arena.x + (x - arena.x) * k, arena.y + (y - arena.y) * k];
    };
    const dmgOf = k => ctx.base * Math.min(k, LIMITS.DMG_CAP) * (echo ? LIMITS.ECHO.dmgK : 1);
    const add = (h, target) => {
      if (ctx.used + ctx.out.length >= LIMITS.MAX_HAZARDS || !(h.delay >= (target ? LIMITS.MIN_TARGET_DELAY : LIMITS.MIN_DELAY))) return null;
      if (target && h.kind === 'zone' && h.delay < (h.r + LIMITS.DODGE.REACH) / LIMITS.DODGE.SPEED + LIMITS.DODGE.REACT) return null;   // no se podría esquivar
      const o = G.Hazards.add(Object.assign({ type, color: ctx.color, cat: boss.cat }, h));
      ctx.out.push(o);
      return o;
    };
    ctx.zone = (x, y, r, delay, k = 1, target = false) => {
      // Las que apuntan a un jugador se pegan al borde (el jugador puede pisar un poco fuera); las demás, si caen fuera, no existen:
      // pegarlas todas al borde amontonaba los avisos cuando el jefe estaba junto a la pared.
      if (!target && Math.hypot(x - arena.x, y - arena.y) > arena.r) return null;
      const [px, py] = inArena(x, y);
      return add({ kind: 'zone', x: px, y: py, r, delay, dmg: dmgOf(k), target: target || undefined }, target);
    };
    ctx.beam = (x, y, angle, len, w, delay, k = 1) => {
      const [px, py] = inArena(x, y);
      return add({ kind: 'beam', x: px, y: py, angle, len, w, delay, dmg: dmgOf(k) }, false);
    };
    ctx.rnd = (i, k = 0) => G.U.hash(i, ctx.seed, 11 + k);       // azar repartido por pieza (no depende del orden)
    return ctx;
  }

  const ok = hs => hs.filter(Boolean);
  const aimAt = ctx => {
    const p = ctx.focus || ctx.boss;
    return Math.atan2(p.y - ctx.boss.y, p.x - ctx.boss.x);
  };
  const rotAround = (ctx, x, y) => {                              // gira un punto alrededor del centro de la arena (eco)
    const c = Math.cos(ctx.rot), s = Math.sin(ctx.rot), dx = x - ctx.arena.x, dy = y - ctx.arena.y;
    return [ctx.arena.x + dx * c - dy * s, ctx.arena.y + dx * s + dy * c];
  };

  /** Piezas comunes. Cada una devuelve los hazards que ha creado. */
  const PRIMS = {
    /** n zonas de radio hr en un anillo de radio r alrededor del jefe; gap (rad) deja una abertura. */
    ring(ctx, o) {
      const hs = [], toC = Math.atan2(ctx.arena.y - ctx.boss.y, ctx.arena.x - ctx.boss.x);
      for (let i = 0; i < o.n; i++) {
        const a = ctx.rot + i * TAU / o.n;
        if (o.gap != null && angDist(a, toC + o.gap + ctx.rot) < 0.45) continue;
        hs.push(ctx.zone(ctx.boss.x + Math.cos(a) * o.r, ctx.boss.y + Math.sin(a) * o.r, o.hr, o.delay + (o.stagger || 0) * i));
      }
      return ok(hs);
    },
    /** Espiral de n zonas que se abre desde r0 hasta r1 dando `turns` vueltas. */
    spiral(ctx, o) {
      const hs = [];
      for (let i = 0; i < o.n; i++) {
        const t = o.n > 1 ? i / (o.n - 1) : 0, r = o.r0 + (o.r1 - o.r0) * t, a = ctx.rot + t * o.turns * TAU;
        hs.push(ctx.zone(ctx.boss.x + Math.cos(a) * r, ctx.boss.y + Math.sin(a) * r, o.hr, o.delay + i * o.stagger));
      }
      return ok(hs);
    },
    /** Abanico de nBeams rayos (separados `spacing`) hacia el jugador, repetido `steps` veces girando stepAngle. */
    sweep(ctx, o) {
      const hs = [], a0 = (o.angle != null ? o.angle : aimAt(ctx)) + ctx.rot;
      for (let s = 0; s < o.steps; s++) for (let i = 0; i < o.nBeams; i++) {
        const a = a0 + (i - (o.nBeams - 1) / 2) * o.spacing + s * o.stepAngle;
        const inner = o.inner != null ? o.inner : 40;
        hs.push(ctx.beam(ctx.boss.x + Math.cos(a) * inner, ctx.boss.y + Math.sin(a) * inner, a, o.len, o.w, o.delay + s * o.step));
      }
      return ok(hs);
    },
    /** n zonas sueltas: around 'arena' (repartidas) o 'players' (cerca de los jugadores). */
    rain(ctx, o) {
      const hs = [];
      for (let i = 0; i < o.n; i++) {
        let x, y;
        const p = o.around === 'players' && ctx.players.length ? ctx.players[i % ctx.players.length] : null;
        if (p) {
          const m = Math.ceil(o.n / ctx.players.length), k = Math.floor(i / ctx.players.length);
          const a = ctx.rot + k / m * TAU + ctx.rnd(i, 1) * 0.6, d = 65 + (k % 3) * 45 + ctx.rnd(i, 2) * 20;
          x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d * 0.8;
        } else {
          // un sector de la arena para cada zona (con algo de azar dentro): repartidas, sin amontonarse
          const a = (i + 0.1 + ctx.rnd(i, 1) * 0.8) / o.n * TAU, d = (0.3 + ctx.rnd(i, 2) * 0.6) * ctx.arena.r;
          [x, y] = rotAround(ctx, ctx.arena.x + Math.cos(a) * d, ctx.arena.y + Math.sin(a) * d);
        }
        hs.push(ctx.zone(x, y, o.hr, o.delay + i * o.stagger));
      }
      return ok(hs);
    },
    /** Una zona sobre cada jugador vivo (aviso corto, pero nunca menos de MIN_TARGET_DELAY). */
    target(ctx, o) {
      return ok(ctx.players.map(p => ctx.zone(p.x, p.y, o.r, o.delay, o.k || 1, true)));
    },
    /** n rayos paralelos (eje 'x' o 'y' de la arena) menos el número gapIndex, que es la vía libre. */
    lanes(ctx, o) {
      const hs = [], R = ctx.arena.r, axis = ctx.echo ? (o.axis === 'x' ? 'y' : 'x') : o.axis;
      const gap = o.gapIndex != null ? o.gapIndex : Math.floor(ctx.rnd(0, 3) * o.n);
      for (let i = 0; i < o.n; i++) {
        if (i === gap) continue;
        const off = -R + (i + 0.5) * (2 * R / o.n), chord = 2 * Math.sqrt(Math.max(0, R * R - off * off));
        const d = o.delay + i * o.step;
        hs.push(axis === 'x'
          ? ctx.beam(ctx.arena.x - chord / 2, ctx.arena.y + off, 0, chord, o.width, d)
          : ctx.beam(ctx.arena.x + off, ctx.arena.y - chord / 2, Math.PI / 2, chord, o.width, d));
      }
      return ok(hs);
    },
    /** `rings` anillos de n zonas que se cierran desde r0 hasta r1 (cada uno estalla después del anterior). */
    converge(ctx, o) {
      const hs = [];
      for (let k = 0; k < o.rings; k++) {
        const r = o.r0 + (o.r1 - o.r0) * (o.rings > 1 ? k / (o.rings - 1) : 0);
        for (let i = 0; i < o.n; i++) {
          const a = ctx.rot + (i + (k % 2) * 0.5) * TAU / o.n;
          hs.push(ctx.zone(ctx.boss.x + Math.cos(a) * r, ctx.boss.y + Math.sin(a) * r, o.hr, o.delay + k * o.stagger));
        }
      }
      return ok(hs);
    }
  };

  // ---------------- las 18 habilidades ----------------
  // Cada una dura `wind` s con el jefe parado y `after` s más antes de seguir (ver bossCast). Los hazards
  // llevan su propio aviso (delay), así que siguen estallando mientras el jefe vuelve a moverse.
  const MOVES = {
    normal: { id: 'hyperburst', name: 'Hyper Burst', desc: 'Two expanding rings of blasts, each with one gap to slip through.', wind: 0.8, after: 0.6,
      build(ctx) {
        PRIMS.ring(ctx, { n: 8, r: 110, hr: 52, delay: 1.2, gap: 0 });
        PRIMS.ring(ctx, { n: 10, r: 205, hr: 46, delay: 1.9, gap: Math.PI });
      } },
    fire: { id: 'infernospiral', name: 'Inferno Spiral', desc: 'Blasts erupt in a widening spiral from the boss.', wind: 0.7, after: 0.7,
      build(ctx) { PRIMS.spiral(ctx, { n: 8, r0: 50, r1: 250, turns: 1.5, hr: 50, delay: 1.0, stagger: 0.18 }); } },
    water: { id: 'tidalwave', name: 'Tidal Wave', desc: 'A wall of surging water sweeps the arena; one lane stays dry.', wind: 0.8, after: 0.5,
      build(ctx) { PRIMS.lanes(ctx, { n: 6, width: 60, axis: 'x', delay: 1.2, step: 0.28 }); } },
    grass: { id: 'thornfield', name: 'Thorn Field', desc: 'Thorns sprout across the arena while vines lash out from the boss.', wind: 0.8, after: 0.6,
      build(ctx) {
        PRIMS.rain(ctx, { n: 10, hr: 42, delay: 1.2, stagger: 0.2, around: 'arena' });
        PRIMS.sweep(ctx, { nBeams: 4, spacing: Math.PI / 2, steps: 1, stepAngle: 0, len: 380, w: 30, delay: 1.0, step: 0 });
      } },
    electric: { id: 'chainstorm', name: 'Chain Storm', desc: 'Lightning tracks every trainer three times, then strikes where they stand.', wind: 0.8, after: 0.7,
      build(ctx) {
        // Al que persigue y al que está más lejos de él (con cuatro apiñados los rayos se pisarían junto al jefe).
        const f = ctx.focus, far = ctx.players.filter(p => p !== f)
          .sort((a, b) => Math.hypot(b.x - f.x, b.y - f.y) - Math.hypot(a.x - f.x, a.y - f.y))[0];
        const targets = f ? [f, far].filter(Boolean) : [];
        for (let k = 0; k < 3; k++) for (const p of targets) {
          const a = Math.atan2(p.y - ctx.boss.y, p.x - ctx.boss.x) + ctx.rot + (k - 1) * 0.45;
          ctx.beam(ctx.boss.x + Math.cos(a) * 110, ctx.boss.y + Math.sin(a) * 110, a, 380, 24, 1.1 + k * 0.55);
        }
        PRIMS.target(ctx, { r: 55, delay: 2.4 });
      } },
    ice: { id: 'frostcross', name: 'Frost Cross', desc: 'A cross of freezing beams that rotates three times.', wind: 0.8, after: 0.6,
      build(ctx) { PRIMS.sweep(ctx, { nBeams: 4, spacing: Math.PI / 2, steps: 3, stepAngle: 0.38, len: 380, w: 34, delay: 1.2, step: 0.6 }); } },
    fighting: { id: 'seismiccombo', name: 'Seismic Combo', desc: 'Three stomps, each wider than the last.', wind: 0.9, after: 0.6,
      build(ctx) {
        [[70, 1.0], [110, 1.7], [150, 2.4]].forEach(([r, d]) => ctx.zone(ctx.boss.x, ctx.boss.y, r, d));
      } },
    poison: { id: 'toxicbloom', name: 'Toxic Bloom', desc: 'Toxic spores burst under a trainer and bloom in a ring around them.', wind: 0.8, after: 0.7,
      build(ctx) {
        PRIMS.target(ctx, { r: 70, delay: 1.1 });
        const p = ctx.focus;
        if (!p) return;
        for (let i = 0; i < 5; i++) {
          const a = ctx.rot + ctx.rnd(0, 4) * TAU + i * TAU / 5;
          ctx.zone(p.x + Math.cos(a) * 115, p.y + Math.sin(a) * 115, 40, 1.6);
        }
      } },
    ground: { id: 'fissurelines', name: 'Fissure Lines', desc: 'The ground splits along three long fissures.', wind: 0.8, after: 0.6,
      build(ctx) { PRIMS.sweep(ctx, { nBeams: 3, spacing: TAU / 3, steps: 1, stepAngle: 0, len: 450, w: 38, delay: 1.3, step: 0 }); } },
    flying: { id: 'cyclone', name: 'Cyclone', desc: 'Two wide gusts spin around the boss, followed by a volley.', wind: 0.8, after: 0.6,
      build(ctx) {
        PRIMS.sweep(ctx, { nBeams: 2, spacing: Math.PI, steps: 3, stepAngle: 0.5, len: 420, w: 34, delay: 1.2, step: 0.55, inner: 70 });
        ctx.shot = { spread: 1.4, n: 8, k: 0.8 };
      } },
    psychic: { id: 'mindcrush', name: 'Mind Crush', desc: 'A crushing force lands on every trainer, then a ring of blasts closes in.', wind: 0.8, after: 0.7,
      build(ctx) {
        PRIMS.target(ctx, { r: 60, delay: 1.0 });
        PRIMS.ring(ctx, { n: 6, r: 150, hr: 48, delay: 1.5 });
      } },
    bug: { id: 'swarmrain', name: 'Swarm Rain', desc: 'A swarm drops across the arena and fires a volley.', wind: 0.8, after: 0.6,
      build(ctx) {
        PRIMS.rain(ctx, { n: 12, hr: 30, delay: 1.1, stagger: 0.07, around: 'arena' });
        ctx.shot = { spread: 1.2, n: 7, k: 0.8 };
      } },
    rock: { id: 'meteorstorm', name: 'Meteor Storm', desc: 'Boulders crash down around the trainers.', wind: 0.7, after: 0.7,
      build(ctx) { PRIMS.rain(ctx, { n: 8, hr: 45, delay: 1.0, stagger: 0.15, around: 'players' }); } },
    ghost: { id: 'phantomtrap', name: 'Phantom Trap', desc: 'Phantoms close in around a trainer, then strike where they stood.', wind: 0.8, after: 0.7,
      build(ctx) {
        const p = ctx.focus;
        if (p) for (let i = 0; i < 3; i++) {
          const a = ctx.rot + ctx.rnd(0, 5) * TAU + i * TAU / 3;
          ctx.zone(p.x + Math.cos(a) * 95, p.y + Math.sin(a) * 95, 45, 1.1);
        }
        PRIMS.target(ctx, { r: 60, delay: 1.9 });
      } },
    dragon: { id: 'draconicbreath', name: 'Draconic Breath', desc: 'A fan of dragon fire sweeps twice, then a ring of blasts.', wind: 0.9, after: 0.6,
      build(ctx) {
        PRIMS.sweep(ctx, { nBeams: 5, spacing: 0.4, steps: 2, stepAngle: 0.2, len: 380, w: 22, delay: 1.2, step: 0.7, inner: 110 });
        PRIMS.ring(ctx, { n: 8, r: 235, hr: 36, delay: 2.0 });
      } },
    dark: { id: 'blackhole', name: 'Black Hole', desc: 'Rings of darkness close in on the centre.', wind: 0.8, after: 0.7,
      build(ctx) { PRIMS.converge(ctx, { rings: 4, r0: 220, r1: 60, n: 5, hr: 44, delay: 1.2, stagger: 0.45 }); } },
    steel: { id: 'ironbarrage', name: 'Iron Barrage', desc: 'Two passes of steel beams, each leaving a different gap.', wind: 0.8, after: 0.6,
      build(ctx) {
        PRIMS.lanes(ctx, { n: 5, width: 50, axis: 'y', gapIndex: 2, delay: 1.2, step: 0.3 });
        PRIMS.lanes(ctx, { n: 5, width: 50, axis: 'y', gapIndex: 0, delay: 2.9, step: 0.3 });
      } },
    fairy: { id: 'moonlitpetals', name: 'Moonlit Petals', desc: 'A ring of petals and a burst of light from the boss.', wind: 0.8, after: 0.7,
      build(ctx) {
        PRIMS.ring(ctx, { n: 8, r: 140, hr: 42, delay: 1.3 });
        PRIMS.rain(ctx, { n: 4, hr: 40, delay: 1.8, stagger: 0.1, around: 'players' });
        ctx.shot = { spread: TAU, n: 12, k: 0.7 };
      } }
  };

  /** La habilidad de un Apex: la de su primer tipo (null si no hay ninguna). */
  function of(types) {
    return Array.isArray(types) && types.length && Object.prototype.hasOwnProperty.call(MOVES, types[0]) ? MOVES[types[0]] : null;
  }

  /** Empieza la habilidad: crea los hazards y rellena la tirada (cast) que lee bossCast. */
  function start(boss, pl, cast) {
    const move = of(boss.types);
    if (!move) return [];
    const ctx = makeCtx(boss, pl, cast);
    move.build(ctx);
    cast.wind = move.wind;
    cast.after = ctx.fury ? Math.max(move.after, LIMITS.ECHO.delay + 0.3) : move.after;
    cast.shot = ctx.shot;
    cast.sig = move;
    cast.n = ctx.out.length;
    cast.span = ctx.out.reduce((m, h) => Math.max(m, h.delay), 0);       // bossEnd no empieza otro ataque antes
    if (!G.Coop.active || G.Coop.isHost) G.Spawner.say('APEX ' + boss.name + ': ' + move.name + '!', 1.6);
    return ctx.out;
  }

  /** El eco del Overdrive: la misma habilidad, girada y más débil. Una vez por tirada, y nunca con el jefe caído. */
  function echo(boss, pl, cast) {
    if (!cast || cast.echoed || !cast.sig || boss.dead) return [];
    cast.echoed = true;
    const ctx = makeCtx(boss, pl, cast, { echo: true, used: cast.n || 0 });
    cast.sig.build(ctx);
    cast.span = Math.max(cast.span || 0, (cast.t || 0) + ctx.out.reduce((m, h) => Math.max(m, h.delay), 0));
    return ctx.out;
  }

  return { LIMITS, makeCtx, PRIMS, MOVES, of, start, echo };
})();
