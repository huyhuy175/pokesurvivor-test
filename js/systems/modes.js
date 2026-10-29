/* ============ modes.js — modos de partida (Normal, Wave, Boss Rush) + Hardcore ============
 *
 * Registro de modos con ganchos opcionales. "normal" no define ninguno, así que la
 * partida normal se comporta exactamente como siempre. Hardcore es un modificador
 * aparte (cfg.hc) que sirve para cualquier modo.
 *
 *   G.Modes.cfg = { type, hc }   → se fija en begin() y se limpia en end().
 *   Los modos nuevos se registran desde su archivo con G.Modes.register(id, def).
 */
(function () {
  const DEFAULT = () => ({ type: 'normal', hc: false });

  // Constantes de Hardcore (estimaciones, se ajustan tras probar).
  const HARDCORE = { hpK: 1.5, dmgK: 1.4, rateK: 1.25, spdK: 1.1, healK: 0.5, rewardK: 1.75, dropK: 1.5 };

  // Cooperativo: el anfitrión manda el estado del modo en un evento ['md', tipo, n, fase, obj, prog, máscara]
  // (cada modo define netKind, netState() y onNet(estado)). Lo que llega de la red se limpia aquí.
  const SYNC_EVERY = 0.5, RESEND_EVERY = 2;
  let syncT = 0, resendT = 0, lastKey = '', lastProg = -1;
  const clampInt = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : null);

  const TYPES = Object.create(null);
  TYPES.normal = { id: 'normal', name: 'Normal', desc: 'The classic run.', classic: true };

  const M = {
    TYPES, HARDCORE,
    cfg: DEFAULT(),
    net: null,                 // último estado válido recibido del anfitrión

    register(id, def) { TYPES[id] = def; },

    // Cualquier cosa rara (red, save) cae en Normal sin lanzar errores.
    normalize(raw) {
      if (!raw || typeof raw !== 'object') return DEFAULT();
      const type = typeof raw.type === 'string' && Object.prototype.hasOwnProperty.call(TYPES, raw.type) ? raw.type : null;
      if (!type) return DEFAULT();
      return { type, hc: raw.hc === true };
    },

    begin(raw, players) {
      M.end();
      M.cfg = M.normalize(raw);
      M.net = null; syncT = 0; resendT = 0; lastKey = ''; lastProg = -1;
      const m = M.current;
      if (m.begin) m.begin(players || [], M.cfg);
    },

    end() {
      const m = M.current;
      if (m.end) m.end();
      M.cfg = DEFAULT();
    },

    get current() { return TYPES[M.cfg.type] || TYPES.normal; },
    classic() { return M.current.classic === true; },
    arenaRun() { return M.current.arena === true; },
    hc() { return M.cfg.hc === true; },

    tick(dt, players, t) {
      const m = M.current;
      if (m.onTick) m.onTick(dt, players, t);
      if (m.netState && G.Coop && G.Coop.active && G.Coop.isHost) M.sync(dt, m);
    },

    /** Anfitrión: manda el estado al cambiar la fase/oleada/objetivo (ya), el avance (cada 0,5 s) y de vez en cuando por si se pierde. */
    sync(dt, m) {
      const s = m.netState();
      if (!s) return;
      syncT -= dt; resendT -= dt;
      const key = [s[1], s[2], s[3], s[4], s[6]].join(',');
      if (key !== lastKey || (s[5] !== lastProg && syncT <= 0) || resendT <= 0) {
        lastKey = key; lastProg = s[5]; syncT = SYNC_EVERY; resendT = RESEND_EVERY;
        G.Coop.broadcast(s);
      }
    },

    /** Invitado: llega ['md', ...]; sólo vale si es del tipo del modo en curso. */
    onNet(ev) {
      if (!Array.isArray(ev) || ev[0] !== 'md') return;
      const m = M.current;
      if (!m.onNet || m.netKind !== ev[1]) return;
      const s = { kind: ev[1], n: clampInt(ev[2], 0, 1e6), phase: clampInt(ev[3], 0, 3), obj: clampInt(ev[4], 0, 1e6),
                  prog: clampInt(ev[5], 0, 1e6), mask: clampInt(ev[6], 0, 2 ** 31 - 1),
                  cx: clampInt(ev[7], -1e7, 1e7), cy: clampInt(ev[8], -1e7, 1e7) };      // cx, cy: opcionales (null si faltan)
      if (s.n === null || s.phase === null || s.obj === null || s.prog === null || s.mask === null) return;
      M.net = s;
      m.onNet(s);
    },

    onKill(e) { const m = M.current; if (m.onKill) m.onKill(e); },
    hudLine() { const m = M.current; return m.hud ? m.hud() : ''; },
    result() { const m = M.current; return m.result ? m.result() : null; },

    rewardMul() {
      const m = M.current;
      return (m.rewardMul ? m.rewardMul() : 1) * (M.hc() && HARDCORE.rewardK ? HARDCORE.rewardK : 1);
    },

    // Kernel de récords locales (claves planas en save.stats; sin ranking online).
    recordKeys() {
      const hc = M.hc();
      if (M.cfg.type === 'wave') return { best: hc ? 'bestWaveHc' : 'bestWave' };
      if (M.cfg.type === 'bossrush') return { best: hc ? 'bestStageHc' : 'bestStage', clears: hc ? 'rushClearsHc' : 'rushClears' };
      return null;
    },
    record(n) {
      const k = M.recordKeys(), S = G.DB.save && G.DB.save.stats;
      n = Math.floor(+n);
      if (!k || !S || !(n > 0)) return;
      S[k.best] = Math.max(S[k.best] || 0, Math.min(n, 1e6));
    },
    recordClear() {
      const k = M.recordKeys(), S = G.DB.save && G.DB.save.stats;
      if (k && k.clears && S) S[k.clears] = (S[k.clears] || 0) + 1;
    },

    // Consola (sólo con ?dev): G.Modes.debug('wave', true) empieza ya esa partida; G.Modes.debugWave(25) salta de oleada.
    debug(type, hc) {
      if (typeof location === 'undefined' || !/[?&]dev\b/.test(location.search)) return false;
      G.Flow.play(M.normalize({ type, hc }));
      return true;
    },
    debugWave(n) {
      if (typeof location === 'undefined' || !/[?&]dev\b/.test(location.search) || !G.Wave) return false;
      G.Wave.debugWave(n);
      return true;
    },

    // Reglas de Hardcore (sin él, todo vale 1 / false y la partida no cambia).
    scaleEnemy(sc) {
      return M.hc() ? Object.assign({}, sc, { hp: sc.hp * HARDCORE.hpK, dmg: sc.dmg * HARDCORE.dmgK, spd: sc.spd * HARDCORE.spdK }) : sc;
    },
    rateK() { return M.hc() ? HARDCORE.rateK : 1; },
    healK() { return M.hc() ? HARDCORE.healK : 1; },
    noReroll() { return M.hc(); },
    noRevive() { return M.hc(); },
    // Tirada de botín: Hardcore la sesga a la baja para que salga más a menudo.
    rand() { return M.hc() ? () => Math.random() / HARDCORE.dropK : Math.random; },
  };

  G.Modes = M;
})();
