/* ============ modes-wave.js — modo Wave ============
 *
 * Oleadas fijas e infinitas: sólo termina al caer. Cada oleada n:
 *   intro (2 s) → fight (hasta spawnear la cuota y no quedar nadie) → rest (8 s) → n+1
 * Los bichos salen con el reloj ficticio t = n · 90 s (Enemies.bagAt / scale); pasada la
 * oleada 27 (donde acaba LATE) se les suma un refuerzo propio y crece el tramo de élites.
 * Cada 5 oleadas hay jefe; cada 25, un legendario Apex. Cada oleada trae un objetivo opcional:
 * cumplirlo da premio (xu, Fragmentos, Gemas, algún material Mega) y cura al descansar.
 * Pasado el tope de cuota (160) la oleada se endurece con élites, no con más bichos.
 *
 * Sólo manda el solitario o el anfitrión (Spawner.update ya sólo corre ahí).
 * Todas las cifras son estimaciones: están en las tablas de arriba para ajustarlas.
 */
G.Wave = (() => {
  const WAVE_INTRO = 2, WAVE_REST = 8;
  const QUOTA_CAP = 160, LATE_FROM = 27;
  const BURST = [4, 6], BURST_EVERY = 0.8;          // cada 0,8 s, de 4 a 6 bichos
  const HOLD_BELOW = 40, HOLD_GRACE = 5;            // "no más de 40 vivos" (se mira tras 5 s de combate)
  const BOSS_DELAY = 1, BOSS_TIME = 75, APEX_STEP = 0.3;
  const REST_HEAL = 0.25, MAT_CHANCE = 0.25;
  const OBJ_IDS = ['killType', 'speed', 'elites', 'holdBelow', 'bossTime', 'rescue', 'escort', 'light'];
  const DIFF = { killType: 1, speed: 2, elites: 2, holdBelow: 3, bossTime: 3, rescue: 2, escort: 3, light: 2 };
  const MAP_IDS = ['rescue', 'escort', 'light'];        // objetivos de mapa (systems/modes-wave-obj.js), desde la oleada 3
  const MAP_FROM = 3;

  const quota = n => Math.min(QUOTA_CAP, Math.round(10 + 4 * n ** 1.1));
  const virtualT = n => n * 90;
  const lateK = n => (n <= LATE_FROM ? { hp: 1, dmg: 1 } : { hp: 1 + 0.06 * (n - LATE_FROM), dmg: 1 + 0.04 * (n - LATE_FROM) });
  const eliteShare = n => (n <= LATE_FROM ? 0 : Math.min(0.5, 0.025 * (n - LATE_FROM)));
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const allTypes = () => Object.keys(G.U.TYPE_NAME);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  /** Jefe de la oleada n (null si no toca). */
  function bossFor(n) {
    if (n % 5 !== 0) return null;
    const k = n / 5;
    return k % 5 === 0 ? { kind: 'apex', index: k / 5 } : { kind: 'regular', index: (k % 5) - 1 };
  }

  function hash(seed, n) {
    let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n | 0, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return h >>> 0;
  }

  /** Un objetivo, con su código numérico (id·64 + tipo) para mandarlo por la red. */
  function build(idIx, argIx, n, types) {
    const id = OBJ_IDS[idIx], q = quota(n), o = { id };
    if (id === 'killType') { o.goal = Math.max(5, Math.round(q * 0.2)); o.arg = types[argIx]; }
    else if (id === 'speed') { o.goal = Math.round(25 + q); o.secs = o.goal; }
    else if (id === 'elites') o.goal = Math.min(12, 2 + Math.floor(n / 4));
    else if (id === 'holdBelow') o.goal = HOLD_BELOW;
    else if (id === 'bossTime') { o.goal = BOSS_TIME; o.secs = BOSS_TIME; }
    else if (id === 'light') o.goal = 3 + (n % 3);        // = nº de farolillos de WaveObj
    else o.goal = 100;                                    // rescate y escolta: en %
    o.code = idIx * 64 + (id === 'killType' ? argIx : 0);
    return o;
  }

  /** Puro: mismo (seed, n) → mismo objetivo. types: tipos que de verdad pueden salir. */
  function objectiveFor(seed, n, hasBoss, types) {
    const all = allTypes();
    const pool = (types || all).filter(t => all.includes(t));
    const ids = OBJ_IDS.filter(id => (id !== 'bossTime' || hasBoss) && (!MAP_IDS.includes(id) || n >= MAP_FROM));
    const h = hash(seed, n), idIx = OBJ_IDS.indexOf(ids[h % ids.length]);
    const tp = pool.length ? pool : all;
    const arg = tp[(h >>> 8) % tp.length];
    return build(idIx, all.indexOf(arg), n, all);
  }

  /** Del código de la red al objetivo (null si no vale). */
  function fromCode(code, n) {
    if (!Number.isInteger(code) || code < 0) return null;
    const idIx = Math.floor(code / 64), argIx = code % 64, all = allTypes();
    if (idIx >= OBJ_IDS.length) return null;
    if (OBJ_IDS[idIx] === 'killType' ? argIx >= all.length : argIx !== 0) return null;
    return build(idIx, argIx, n, all);
  }

  /** Premio por cumplir el objetivo (estimaciones). */
  function REWARDS(n, diff) {
    return { coins: 40 + 8 * n, shards: diff, gems: diff >= 3 ? 1 : 0, mats: diff >= 2 ? 1 : 0 };
  }

  function describe(o) {
    switch (o.id) {
      case 'killType': return 'Defeat ' + o.goal + ' ' + o.arg + '-type enemies';
      case 'speed': return 'Clear the wave in ' + o.secs + ' s';
      case 'elites': return 'Defeat ' + o.goal + ' elite enemies';
      case 'holdBelow': return 'Never more than ' + o.goal + ' enemies alive';
      case 'rescue': return 'Free the captive Pokémon (stand next to it)';
      case 'escort': return 'Guide the lost Pokémon to the marker';
      case 'light': return 'Light all ' + o.goal + ' lamps';
      default: return 'Defeat the boss within ' + o.secs + ' s';
    }
  }

  // ---------------- partida ----------------

  let st = null;

  function bagTypes(t) {
    const set = new Set();
    for (const d of G.Enemies.bagAt(t)) for (const x of d.types || []) set.add(x);
    return [...set];
  }

  function startWave(n) {
    const players = G.Game.everyone().length;
    const boss = bossFor(n), vt = virtualT(n);
    const obj = objectiveFor(st.seed, n, !!boss, bagTypes(vt));
    Object.assign(st, {
      n, phase: 'intro', t: WAVE_INTRO, fightT: 0, kills: 0, spawned: 0, burstT: 0.4,
      quota: Math.max(1, Math.round(quota(n) * G.Coop.scaleRate(players) * G.Modes.rateK())),
      obj, prog: 0, objDone: false, objFailed: false, elitesDown: 0, forcedElites: obj.id === 'elites' ? obj.goal : 0,
      boss, bossId: 0, bossSpawned: false, bossDead: !boss, bossT: 0, center: null
    });
    clearMap();
    // Spawner.update no corre en Wave, así que las hojas de sprites se piden aquí (como hace él cada 10 s).
    if (G.Sprites && G.Enemies.upcomingDex) G.Sprites.preload(G.Enemies.upcomingDex(virtualT(n), 90));
    G.Spawner.say('Wave ' + n + (boss ? ' · BOSS' : '') + ' — ' + describe(obj), 3.4);
  }

  function spawnBossFor(n) {
    const b = st.boss, vt = virtualT(n), mul = lateK(n), anchor = G.Spawner.anchor();
    let e;
    if (b.kind === 'regular') e = G.Spawner.spawnBoss(anchor, vt, G.Enemies.BOSSES[b.index], { mul });
    else {
      const mon = pick(G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex]));
      if (G.Sprites) G.Sprites.preload([mon.dex]);
      const def = G.Rift.apexDef(G.Rift.legendDef(mon, vt, 1), G.Rift.apexPower() * (1 + APEX_STEP * (b.index - 1)));
      e = G.Spawner.spawnBoss(anchor, vt, def, { mul, apex: true });
    }
    if (e) { st.bossId = e.id; st.bossSpawned = true; }
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function pump(dt) {
    st.burstT -= dt;
    if (st.burstT > 0 || st.spawned >= st.quota) return;
    st.burstT = BURST_EVERY;
    const room = G.Spawner.CAP - G.EnemyMgr.count;
    let k = Math.min(rnd(BURST[0], BURST[1]), st.quota - st.spawned, room);
    if (k <= 0) return;
    const anchor = G.Spawner.anchor(), vt = virtualT(st.n), mul = lateK(st.n), share = eliteShare(st.n);
    const base = Math.random() * 6.2832;
    for (let tries = 0; k > 0 && tries < 12; tries++) {
      const forced = st.forcedElites > 0, elite = forced || Math.random() < share;
      if (forced) st.forcedElites--;
      const e = G.Spawner.spawnOne(anchor, vt, base + (Math.random() - 0.5) * 1.1, { elite, mul });
      if (e) { st.spawned++; k--; } else if (forced) st.forcedElites++;     // no hubo sitio: se repite
    }
  }

  // ---------------- objetivos de mapa ----------------

  function clearMap() {
    if (G.WaveObj) G.WaveObj.clear();
    if (G.Events && G.Events.cancelEscort) G.Events.cancelEscort();
  }

  /** Al empezar el combate: pone el objetivo de mapa (el centro viaja en 'md' para que los invitados lo pinten igual). */
  function startMap() {
    const id = st.obj.id;
    if (!MAP_IDS.includes(id)) return;
    const a = G.Spawner.anchor();
    st.center = { x: Math.round(a.x), y: Math.round(a.y) };
    if (id === 'escort') {
      if (!G.Events.startEscort(G.Game.everyone(), { dist: 700, ttl: G.WaveObj.ESCORT_TTL })) st.objFailed = true;
    } else G.WaveObj.spawn(id, st.center, 0, st.n);
  }

  /** Avance entero del objetivo (el mismo número que viaja por la red). */
  function progOf() {
    const o = st.obj;
    switch (o.id) {
      case 'speed': return Math.floor(st.fightT);
      case 'holdBelow': return G.EnemyMgr.count;
      case 'bossTime': return Math.floor(st.bossT);
      case 'escort': return G.Events.escortState() === 'done' ? 100 : 0;
      case 'rescue': case 'light': return G.WaveObj.progress();
      default: return st.prog;
    }
  }

  function progText(o, prog, failed) {
    switch (o.id) {
      case 'killType': case 'elites': return ' (' + Math.min(prog, o.goal) + '/' + o.goal + ')';
      case 'speed': return ' (' + Math.max(0, o.secs - prog) + ' s)';
      case 'rescue': return ' (' + prog + '%)';
      case 'light': return ' (' + prog + '/' + o.goal + ')';
      case 'escort': return prog >= 100 ? ' (done)' : failed ? ' (failed)' : '';
      default: return failed ? ' (failed)' : '';
    }
  }

  function onTick(dt, players) {
    if (!st || !st.obj) return;
    if (st.phase === 'fight' && G.WaveObj) G.WaveObj.update(dt, players);
    if (st.phase !== 'fight' || !authority()) return;
    if (st.obj.id === 'escort' && G.Events.escortState() === 'failed') st.objFailed = true;
  }

  function objectiveMet() {
    const o = st.obj;
    switch (o.id) {
      case 'rescue': case 'light': return G.WaveObj.done();
      case 'escort': return G.Events.escortState() === 'done';
      case 'killType': case 'elites': return st.prog >= o.goal;
      case 'speed': return st.fightT <= o.secs;
      case 'holdBelow': return !st.objFailed;
      default: return st.bossDead && st.bossT <= o.secs && st.bossSpawned;
    }
  }

  function reward(n, diff) {
    const pl = G.Game.player, r = REWARDS(n, diff);
    if (!pl) return;
    pl.coins = (pl.coins || 0) + r.coins;
    G.Progress.grant({ shards: r.shards, gems: r.gems });
    pl.shardsFound = (pl.shardsFound || 0) + r.shards;
    pl.gemsFound = (pl.gemsFound || 0) + r.gems;
    if (r.mats && G.Mega && Math.random() < MAT_CHANCE) G.Mega.grantMats(pl, pick(allTypes()), r.mats);
    pl.heal(pl.maxHp * REST_HEAL);
    G.DB.commit(true);
  }

  function endWave() {
    G.Modes.record(st.n);
    G.Pickups.pullAll();
    st.objDone = objectiveMet();
    if (st.objDone) reward(st.n, DIFF[st.obj.id]);
    clearMap();
    st.phase = 'rest'; st.t = WAVE_REST;
    G.Spawner.say('Wave ' + st.n + ' cleared' + (st.objDone ? ' · objective complete!' : ''), 3);
  }

  function spawn(dt) {
    if (!st || !authority()) return;
    if (st.phase === 'intro') {
      st.t -= dt;
      if (st.t <= 0) { st.phase = 'fight'; startMap(); }
    } else if (st.phase === 'fight') {
      st.fightT += dt;
      if (st.boss) {
        if (!st.bossSpawned && st.fightT >= BOSS_DELAY) spawnBossFor(st.n);
        if (st.bossSpawned && !st.bossDead) st.bossT += dt;
      }
      pump(dt);
      if (st.obj.id === 'holdBelow' && st.fightT > HOLD_GRACE && G.EnemyMgr.count > st.obj.goal) st.objFailed = true;
      if (st.spawned >= st.quota && st.bossDead && st.bossSpawned === !!st.boss && G.EnemyMgr.count === 0) endWave();
    } else {
      st.t -= dt;
      if (st.t <= 0) startWave(st.n + 1);
    }
  }

  function onKill(e) {
    if (!st || st.phase !== 'fight') return;
    st.kills++;
    if (e.boss && e.id === st.bossId) st.bossDead = true;
    const o = st.obj;
    if (o.id === 'killType' && (e.types || []).includes(o.arg)) st.prog++;
    else if (o.id === 'elites' && e.elite) st.prog++;
  }

  function begin() {
    st = { seed: Math.floor(Math.random() * 1e9), n: 1 };
    if (authority()) startWave(1);          // el invitado sólo sigue lo que le manda el anfitrión (md)
  }

  // ---------------- red (kind 1) ----------------

  const PH = { intro: 0, fight: 1, rest: 2 };

  /** Anfitrión: ['md', 1, oleada, fase, código del objetivo, avance, máscara (bit0: cumplido al descansar, bit1: fallado)]. */
  function netState() {
    if (!st || !st.obj) return null;
    const o = st.obj;
    const map = MAP_IDS.includes(o.id) && st.phase === 'fight' && st.center;
    const ev = ['md', 1, st.n, PH[st.phase], o.code, progOf(),
      (st.phase === 'rest' && st.objDone ? 1 : 0) | (st.objFailed ? 2 : 0) | (map && o.id !== 'escort' ? G.WaveObj.mask() << 8 : 0)];
    if (map) ev.push(st.center.x, st.center.y);
    return ev;
  }

  /** Invitado: cada uno cobra su premio al llegar el descanso con el objetivo cumplido. */
  function onNet(s) {
    if (!st || authority()) return;
    if (st.n !== Math.max(1, s.n)) clearMap();
    st.n = Math.max(1, s.n);
    const o = fromCode(s.obj, st.n);
    if (o && MAP_IDS.includes(o.id) && o.id !== 'escort') {      // la escolta llega sola por los mensajes del Pokémon perdido
      if (s.phase === 1 && s.cx !== null && st.mapN !== st.n) { st.mapN = st.n; G.WaveObj.spawn(o.id, { x: s.cx, y: s.cy }, 0, st.n); }
      if (s.phase === 1) G.WaveObj.applyNet(s.prog, s.mask >>> 8);
    }
    if (s.phase === 2) clearMap();
    if (s.phase === 2 && st.n > (st.paid || 0)) {
      st.paid = st.n;
      G.Modes.record(st.n);
      const o = fromCode(s.obj, st.n);
      if (o && (s.mask & 1)) reward(st.n, DIFF[o.id]);
    }
  }

  function guestHud() {
    const s = G.Modes.net;
    if (!s) return 'Wave ' + st.n;
    if (s.phase === 2) return 'Wave ' + s.n + ' cleared';
    const o = fromCode(s.obj, s.n);
    if (!o) return 'Wave ' + s.n;
    return 'Wave ' + s.n + ' · ' + describe(o) + progText(o, s.prog, !!(s.mask & 2));
  }

  function hud() {
    if (!st) return '';
    if (!authority()) return guestHud();
    if (st.phase === 'rest') return 'Wave ' + st.n + ' cleared · next in ' + Math.ceil(st.t) + ' s';
    const left = st.quota - st.spawned + G.EnemyMgr.count;
    const o = st.obj;
    return 'Wave ' + st.n + ' · ' + left + ' left · ' + describe(o) + progText(o, progOf(), st.objFailed);
  }

  G.Modes.register('wave', {
    id: 'wave', name: 'Wave', desc: 'Endless waves with an objective each time.', classic: false, netKind: 1,
    begin, end() { clearMap(); st = null; }, spawn, onKill, onTick, hud, netState, onNet,
    result() { return st ? { won: false, label: 'Wave ' + st.n } : null; }
  });

  return {
    quota, virtualT, lateK, eliteShare, bossFor, objectiveFor, fromCode, REWARDS, describe,
    WAVE_INTRO, WAVE_REST, HOLD_BELOW,
    state() { return st; },
    /** Para pruebas: salta a la oleada n con el objetivo que sale de esa semilla. */
    debugObjective(seed, n) { if (st) { st.seed = seed; startWave(Math.max(1, Math.floor(n) || 1)); } },
    /** Para pruebas: salta a la oleada n. */
    debugWave(n) { if (st) startWave(Math.max(1, Math.floor(n) || 1)); }
  };
})();
