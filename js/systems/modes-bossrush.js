/* ============ modes-bossrush.js — modo Boss Rush ============
 *
 * Diez jefes seguidos, sin bichos normales, en UNA arena para toda la partida:
 *   1-5   los jefes del mapa (Enemies.BOSSES[0..4]) con su escala de siempre
 *   6-9   legendarios Apex, cada vez más fuertes (chiflado de ApexMoves incluido)
 *   10    Apex final, siempre enfurecido y con más vida
 * Empieza con 3 cartas de nivel seguidas (draft). Entre jefes hay un descanso
 * para recoger el botín. Morir termina la partida; hundir al décimo es ganar.
 *
 * La arena sale de Rift.openRush (begin(cfg) vale desde el primer fotograma: el
 * punto de vuelta `back` sólo se usa en finish(), que la fase 'rush' no llama).
 * Sólo quien manda (solitario o anfitrión) hace avanzar los jefes; Spawner.update
 * ya sólo corre en ese ordenador, así que la máquina de estados vive en spawn().
 */
G.BossRush = (() => {
  // Estimaciones: se ajustan tras probar.
  const STAGE_REST = 10;                       // s de descanso entre jefes
  const START_DELAY = 4;                       // s hasta el primer jefe (tras el draft)
  const DRAFT = 3;                             // cartas de nivel de golpe al empezar
  const WIN_DELAY = 3.5;                       // s entre el último jefe y el resumen
  const FINAL_REWARD = { gems: 20, shards: 30 };
  const APEX_POWER = [1, 1.2, 1.4, 1.6, 2];    // multiplicador de vida de los Apex 6..10
  const APEX_T = [900, 1050, 1200, 1350, 1500];   // reloj ficticio para Rift.legendDef (vida y daño base)
  const FINAL_FURY_SPD = 1.15;

  const authority = () => !G.Coop.active || G.Coop.isHost;
  const shuffled = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

  /** Los 10 jefes de la tanda. legends: Pokémon legendarios elegibles (se toman 5 distintos). */
  function stages(bosses, legends) {
    const out = bosses.slice(0, 5).map((def, i) => ({ kind: 'regular', def, index: i }));
    shuffled(legends).slice(0, 5).forEach((def, i) => out.push({ kind: 'apex', def, index: i, power: APEX_POWER[i], t: APEX_T[i], final: i === 4 }));
    return out;
  }

  let st = null;     // { list, stage (1..10 en curso), defeated, phase, t, bossId, won, over }

  function fresh() { return { list: [], stage: 0, defeated: 0, phase: 'wait', t: START_DELAY, bossId: 0, won: false, over: false }; }

  function begin() {
    st = fresh();
    st.list = stages(G.Enemies.BOSSES, G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex]));
    if (G.Sprites) G.Sprites.preload(st.list.map(s => s.def.dex));
    if (!authority()) return;                  // los invitados reciben la arena (mensaje 'arena') y el estado ('md')
    G.Rift.openRush({
      tx: 5000 + Math.floor(Math.random() * 3000), ty: 5000 + Math.floor(Math.random() * 3000), r: 11,
      type: ['fire', 'water', 'grass', 'electric', 'ice', 'psychic', 'dragon', 'ghost'][Math.floor(Math.random() * 8)]
    });
    G.Spawner.say('BOSS RUSH · 10 bosses await', 3.2);
    G.Game.addPendingLevels(DRAFT);
  }

  function spawnStage() {
    const s = st.list[st.stage];             // st.stage = jefes ya sacados
    st.stage++;
    const n = G.Game.everyone().length;
    let e;
    if (s.kind === 'regular') {
      const k = G.Coop.scaleHp(n) * (n > 1 ? 1.4 : 1), b = G.Enemies.bossScale(s.def.at);
      e = G.Rift.rushSpawn(s.def, false, 1, { hp: b.hp * k, dmg: b.dmg, spd: b.spd });
    } else {
      e = G.Rift.rushSpawn(G.Rift.legendDef(s.def, s.t, n), true, s.power * G.Rift.apexPower());
      if (s.final) {                         // el último, siempre furioso (con eco de sus ataques)
        if (!e.ai) e.bossInit();
        e.ai.fury = true; e.spd *= FINAL_FURY_SPD;
      }
    }
    st.bossId = e.id; st.phase = 'fight';
    G.Spawner.say('Stage ' + st.stage + '/10 · ' + e.name + (s.final ? ' (FINAL)' : ''), 3);
  }

  function spawn(dt) {
    if (!st || st.over) return;
    if (st.phase === 'wait' || st.phase === 'rest') {
      st.t -= dt;
      if (st.t <= 0) spawnStage();
    } else if (st.phase === 'cheer') {
      st.t -= dt;
      if (st.t <= 0) { st.over = true; G.Game.winRun(); }
    }
  }

  /** Récord y premio de ganar: cada ordenador lo anota para su jugador. */
  function finalReward() {
    G.Modes.recordClear();
    G.Progress.grant(FINAL_REWARD);
    const pl = G.Game.player;
    if (pl) { pl.gemsFound = (pl.gemsFound || 0) + FINAL_REWARD.gems; pl.shardsFound = (pl.shardsFound || 0) + FINAL_REWARD.shards; }
    G.DB.commit(true);
  }

  function onKill(e) {
    if (!st || st.over || st.phase !== 'fight' || e.id !== st.bossId) return;
    st.defeated = st.stage;
    G.Modes.record(st.defeated);
    G.Pickups.pullAll();
    if (st.stage >= st.list.length) {
      st.won = true; st.phase = 'cheer'; st.t = WIN_DELAY;
      finalReward();
      G.Spawner.say('BOSS RUSH CLEARED!', 3.4);
    } else {
      st.phase = 'rest'; st.t = STAGE_REST;
      G.Spawner.say('Stage ' + st.defeated + ' down · next boss in ' + STAGE_REST + ' s', 3);
    }
  }

  function end() { st = null; }

  // ---------------- red (kind 2) ----------------

  const PHASES = ['wait', 'fight', 'rest', 'cheer'];

  /** Anfitrión: ['md', 2, jefes sacados, fase, 0, jefes vencidos, máscara (bit0: ganada)]. */
  function netState() {
    return st ? ['md', 2, st.stage, Math.max(0, PHASES.indexOf(st.phase)), 0, st.defeated, st.won ? 1 : 0] : null;
  }

  /** Invitado: sigue al anfitrión; sus récords y el premio final los anota cada uno. */
  function onNet(s) {
    if (!st || authority()) return;
    st.stage = s.n; st.phase = PHASES[s.phase] || st.phase;
    if (s.prog > st.defeated) { st.defeated = s.prog; G.Modes.record(st.defeated); }
    if ((s.mask & 1) && !st.won) { st.won = true; st.defeated = st.list.length; finalReward(); }
  }

  G.Modes.register('bossrush', {
    id: 'bossrush', name: 'Boss Rush', desc: 'Ten bosses in a row in one arena.', classic: false, arena: true, netKind: 2,
    begin, end, spawn, onKill, netState, onNet,
    result() { return st ? { won: st.won, label: 'Stage ' + (st.won ? st.list.length : st.defeated) + '/10' } : null; },
    hud() { return st ? 'Boss Rush · Stage ' + Math.min(10, st.won ? 10 : st.defeated + 1) + '/10' : ''; }
  });

  return { stages, STAGE_REST, DRAFT, FINAL_REWARD, START_DELAY, APEX_POWER };
})();
