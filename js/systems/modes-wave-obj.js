/* ============ modes-wave-obj.js — objetivos de mapa de Wave (rescate, escolta, farolillos) ============
 *
 * Decisión de diseño (leída de events.js 'lost' y interact.js 'bigchest'):
 *   - Escolta: no se reescribe nada; Events.startEscort reutiliza el Pokémon perdido (lostTick, 'lp' por red)
 *     con una marca puesta y un tiempo máximo. Aquí sólo se consulta Events.escortState().
 *   - Rescate y farolillos: mismo patrón que bigchest (el avance sube mientras estás cerca y baja al
 *     alejarte). Los mide sólo quien manda; el resto recibe avance y máscara en el evento 'md' (applyNet).
 *   - Las posiciones salen de (centro, n): el centro viaja en el 'md' y el mundo es el mismo en todos los
 *     ordenadores, así que invitados y anfitrión dibujan lo mismo sin mandar posiciones.
 *   - El rescate no pelea: el rescatado te sigue unos segundos como adorno.
 */
G.WaveObj = (() => {
  const RESCUE_HOLD = 3, RESCUE_DIST = [500, 700], RESCUE_R = 70, GUARDS = [2, 4];
  const LIGHT_HOLD = 2.5, LIGHT_R = 60, LIGHT_RING = [300, 500];
  const FOLLOW_TIME = 30, DECAY = 0.5;
  const authority = () => !G.Coop.active || G.Coop.isHost;

  let cur = null;      // { kind, n, rescue?: {...}, lamps?: [...], t }

  /** Generador determinista (mulberry32). */
  function rng(seed) {
    let a = seed | 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const seedOf = (center, n, seed) => ((Math.round(center.x) * 73856093) ^ (Math.round(center.y) * 19349663) ^ (n * 83492791) ^ (seed | 0)) | 0;

  /** Primer punto libre de una lista de ángulos candidatos (determinista). */
  function spot(c, a0, dist, r) {
    for (let i = 0; i < 12; i++) {
      const a = a0 + i * 0.52;
      const x = c.x + Math.cos(a) * dist, y = c.y + Math.sin(a) * dist * 0.85;
      if (G.World.isFree(x, y, r)) return { x, y, a };
    }
    return { x: c.x + Math.cos(a0) * dist, y: c.y + Math.sin(a0) * dist * 0.85, a: a0 };
  }

  function clear() { cur = null; }

  function spawn(kind, center, seed, n) {
    clear();
    const r = rng(seedOf(center, n, seed));
    cur = { kind, n, t: 0 };
    if (kind === 'rescue') {
      const p = spot(center, r() * 6.2832, RESCUE_DIST[0] + r() * (RESCUE_DIST[1] - RESCUE_DIST[0]), 20);
      const pool = G.DEX.filter(m => m.rarity <= 3 && !m.leg && G.SPRITE_META[m.dex]);
      const mon = pool.length ? pool[Math.floor(r() * pool.length)] : null;
      cur.rescue = { x: p.x, y: p.y, dex: mon ? mon.dex : 0, hold: 0, freed: false, follow: 0, fx: p.x, fy: p.y };
      if (authority()) {                                     // los guardias los pone quien manda
        const vt = G.Wave ? G.Wave.virtualT(n) : n * 90, k = GUARDS[0] + Math.floor(r() * (GUARDS[1] - GUARDS[0] + 1));
        for (let i = 0; i < k; i++) G.Spawner.spawnOne(G.Spawner.anchor(), vt, p.a + (Math.random() - 0.5) * 0.5, {});
      }
    } else if (kind === 'light') {
      const count = 3 + (n % 3), a0 = r() * 6.2832;
      cur.lamps = [];
      for (let i = 0; i < count; i++) {
        const p = spot(center, a0 + i * (6.2832 / count) + (r() - 0.5) * 0.3, LIGHT_RING[0] + r() * (LIGHT_RING[1] - LIGHT_RING[0]), 18);
        cur.lamps.push({ x: p.x, y: p.y, hold: 0, lit: false });
      }
    }
  }

  const near = (players, o, rad) => players.some(p => !p.dead && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < rad * rad);
  const step = (o, isNear, dt, need) => { o.hold = isNear ? Math.min(need, o.hold + dt) : Math.max(0, o.hold - dt * DECAY); };

  function update(dt, players) {
    if (!cur) return;
    cur.t += dt;
    const R = cur.rescue;
    if (R && R.freed) {                                     // adorno: el rescatado te sigue un rato
      R.follow += dt;
      const me = G.Game && G.Game.player;
      if (me && R.follow < FOLLOW_TIME) {
        const d = Math.hypot(me.x - R.fx, me.y - R.fy);
        if (d > 50) { const s = Math.min(d - 50, 150 * dt); R.fx += (me.x - R.fx) / d * s; R.fy += (me.y - R.fy) / d * s; }
      }
    }
    if (!authority()) return;                               // el avance sólo lo mide quien manda
    if (R && !R.freed) {
      step(R, near(players, R, RESCUE_R), dt, RESCUE_HOLD);
      if (R.hold >= RESCUE_HOLD) { R.freed = true; R.fx = R.x; R.fy = R.y; free(R); }
    }
    if (cur.lamps) {
      for (const l of cur.lamps) {
        if (l.lit) continue;
        step(l, near(players, l, LIGHT_R), dt, LIGHT_HOLD);
        if (l.hold >= LIGHT_HOLD) l.lit = true;
      }
    }
  }

  function free(R) {
    if (G.FX) { G.FX.burst(R.x, R.y - 10, '#7dffb0', 24, 180); }
    if (G.Audio) G.Audio.sfx('legend');
  }

  const done = () => !!cur && (cur.rescue ? cur.rescue.freed : cur.lamps ? cur.lamps.every(l => l.lit) : false);
  const failed = () => false;                                // se pierde por no acabar antes de que termine la oleada

  /** Avance entero: rescate 0..100 (%), farolillos = encendidos. */
  function progress() {
    if (!cur) return 0;
    if (cur.rescue) return cur.rescue.freed ? 100 : Math.floor(cur.rescue.hold / RESCUE_HOLD * 100);
    if (cur.lamps) return cur.lamps.filter(l => l.lit).length;
    return 0;
  }

  /** Máscara de bits: rescate = bit0 liberado; farolillos = un bit por farolillo encendido. */
  function mask() {
    if (!cur) return 0;
    if (cur.rescue) return cur.rescue.freed ? 1 : 0;
    return cur.lamps ? cur.lamps.reduce((m, l, i) => m | (l.lit ? 1 << i : 0), 0) : 0;
  }

  /** Invitado: copia lo que mide el anfitrión. */
  function applyNet(prog, m) {
    if (!cur) return;
    if (cur.rescue) {
      const R = cur.rescue;
      if ((m & 1) && !R.freed) { R.freed = true; R.fx = R.x; R.fy = R.y; free(R); }
      if (!R.freed) R.hold = Math.min(RESCUE_HOLD, prog / 100 * RESCUE_HOLD);
    } else if (cur.lamps) cur.lamps.forEach((l, i) => { l.lit = !!(m & (1 << i)); });
  }

  // ---------------- dibujo ----------------

  function drawable() {
    if (!cur) return null;
    const R = cur.rescue;
    if (R && R.freed && R.follow >= FOLLOW_TIME) return null;
    const ys = R ? [R.freed ? R.fy : R.y] : (cur.lamps || []).map(l => l.y);
    if (!ys.length) return null;
    return {
      y: Math.min(...ys),
      draw(ctx) {
        const now = performance.now() / 1000;
        if (R) drawCaptive(ctx, R, now);
        if (cur.lamps) for (const l of cur.lamps) drawLamp(ctx, l, now);
      }
    };
  }

  function drawCaptive(ctx, R, now) {
    if (!R.anim && R.dex && G.Sprites.Animator) { R.anim = new G.Sprites.Animator(R.dex, 1); G.Sprites.preload([R.dex]); }
    const x = R.freed ? R.fx : R.x, y = R.freed ? R.fy : R.y;
    ctx.save();
    if (!R.freed) {
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(x, y, RESCUE_R, RESCUE_R * 0.7, 0, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      if (R.hold > 0) {
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y - 30, 12, -1.5708, -1.5708 + 6.2832 * (R.hold / RESCUE_HOLD)); ctx.stroke();
      }
    } else ctx.globalAlpha = Math.min(1, (FOLLOW_TIME - R.follow) / 3);
    if (R.anim) { R.anim.update(1 / 60); R.anim.loop(R.freed ? 'Walk' : 'Idle'); R.anim.draw(ctx, x, y, {}); }
    ctx.restore();
  }

  function drawLamp(ctx, l, now) {
    ctx.save();
    const glow = l.lit ? 0.45 + Math.sin(now * 4) * 0.1 : 0.15;
    ctx.globalAlpha = glow;
    ctx.fillStyle = l.lit ? '#ffe9a0' : '#9ae6ff';
    ctx.beginPath(); ctx.ellipse(l.x, l.y, LIGHT_R, LIGHT_R * 0.6, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(l.x - 3, l.y - 22, 6, 22);
    ctx.fillStyle = l.lit ? '#ffd23f' : '#6b7a90';
    ctx.beginPath(); ctx.arc(l.x, l.y - 26, 7, 0, 6.2832); ctx.fill();
    if (!l.lit && l.hold > 0) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(l.x, l.y - 26, 11, -1.5708, -1.5708 + 6.2832 * (l.hold / LIGHT_HOLD)); ctx.stroke();
    }
    ctx.restore();
  }

  return {
    RESCUE_HOLD, RESCUE_DIST, LIGHT_HOLD, LIGHT_COUNT: [3, 5], ESCORT_TTL: 90,
    spawn, update, done, failed, progress, mask, applyNet, drawable, clear,
    kind() { return cur ? cur.kind : null; },
    /** Para pruebas y para pintar. */
    target() { return cur && cur.rescue ? cur.rescue : null; },
    lamps() { return cur && cur.lamps ? cur.lamps : []; }
  };
})();
