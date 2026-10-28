/* ============ evolution.js — evolución del Pokémon durante la partida ============
 * Cuando el Pokémon tiene el nivel exigido y lleva una Piedra Evolutiva, evoluciona
 * (Player.evolve) a una forma que ya tienes en la colección. Las cadenas están en
 * data/evolutions.js (G.EVO). La piedra cae de jefes y cofres grandes (siempre, si
 * hay algo a lo que evolucionar) y, rarísima vez, de enemigos normales.
 */
G.Evo = (() => {
  /** Nivel exigido: [primera evolución, segunda]. Ajustable aquí. */
  const LEVELS = [12, 24];
  /** Probabilidad de que un enemigo normal suelte la piedra (si hay algo a lo que evolucionar). */
  const ENEMY_DROP = 0.0005;

  /** Sin pre-evolución (Charmander) exige el primer nivel; con ella (Charmeleon), el segundo. */
  const levelFor = dex => ((G.EVO_FROM && G.EVO_FROM[dex] || []).length ? LEVELS[1] : LEVELS[0]);

  /** Formas a las que puede evolucionar ahora: las que posee y para las que tiene nivel. */
  function options(pl) {
    if (pl.level < levelFor(pl.dex)) return [];
    return ((G.EVO && G.EVO[pl.dex]) || []).filter(d => G.DB.owns(d));
  }

  const ready = pl => options(pl).length > 0 && pl.evoStone > 0;

  /** ¿Suelta la piedra? kind: 'boss' | 'chest' | 'enemy'. */
  function lootFor(pl, kind, rand = Math.random) {
    if (pl.evoStone > 0 || !options(pl).length) return false;
    return kind === 'enemy' ? rand() < ENEMY_DROP : true;
  }

  /** Una carta por forma posible (como las de subida de nivel). */
  function cards(pl) {
    const from = G.DEX_BY[pl.dex].name;
    return options(pl).map(dex => {
      const to = G.DEX_BY[dex].name;
      return {
        w: 100, type: 'mevo', key: 'mevo:' + dex, dex,
        icon: 'evostone', color: '#ffd23f', tag: 'EVOLUCIÓN',
        title: from + ' → ' + to, desc: G.I18n.f('Evoluciona a {x}', to),
        apply: p => { p.evolve(dex); p.evoStone = 0; }
      };
    });
  }

  // ---------------- botín y evolución ----------------
  // La piedra no es un objeto del suelo: se da directamente al jugador de ESTE ordenador
  // cuando cae un jefe, se abre un cofre o (rarísimo) cae un enemigo. Así en cooperativo
  // cada jugador recibe la suya sin que el anfitrión tenga que repartirla.

  function grantStone(pl) {
    pl.evoStone = 1;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 12, G.T('¡Piedra Evolutiva!'), '#ffd23f', true);
    G.FX.ring(pl.x, pl.y, 8, 90, '#ffd23f', 0.6, 5);
    G.Audio.sfx('legend');
  }

  /** Fragmentos Evolutivos (moneda de la Forja Evolutiva): jefe y cofre grande, siempre. */
  const SHARDS = { boss: 3, chest: 1 };

  /** Se guardan al instante (como los tickets), así no se pierden si se cierra la pestaña. */
  function grantShards(pl, n) {
    G.Progress.grant({ shards: n });
    pl.shardsFound = (pl.shardsFound || 0) + n;     // para la pantalla final
    G.DB.commit('run');
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 28, '+' + n + ' ' + G.T('Fragmentos'), '#7fe3ff', true);
  }

  /** Cae un enemigo (e.boss: jefe; e.judge: legendario de la Sentencia, no suelta nada). */
  function onKill(pl, e, rand) {
    if (e.judge) return;
    if (e.boss) grantShards(pl, SHARDS.boss);
    if (G.Mega) G.Mega.onKill(pl, e, rand);
    if (lootFor(pl, e.boss ? 'boss' : 'enemy', rand)) grantStone(pl);
  }

  /** Se abre un cofre grande. */
  function onChest(pl) {
    grantShards(pl, SHARDS.chest);
    if (G.Mega) G.Mega.onChest(pl);
    if (lootFor(pl, 'chest')) grantStone(pl);
  }

  function celebrate(pl, from, dex) {
    G.FX.ring(pl.x, pl.y, 8, 140, '#ffd23f', 0.8, 6);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffe14d', 48, 260);
    G.Audio.sfx('legend');
    G.Spawner.say(G.I18n.f('¡{x} ha evolucionado a {x}!', from, G.DEX_BY[dex].name), 3, true);
  }

  /** Evoluciona ya a `dex` (con su hoja de sprites cargada). Una sola vez aunque se llame dos. */
  async function evolveNow(pl, dex) {
    if (pl.evolving) return;
    pl.evolving = true;
    try {
      await G.Sprites.preload([dex], 4000, pl.shiny);
      const g = G.Game;
      if (pl.dead || !(pl.evoStone > 0) || (g && (g.player !== pl || g.state === 'over' || g.state === 'ui'))) return;   // otra partida o ya acabó
      const from = G.DEX_BY[pl.dex].name;
      pl.evolve(dex);
      pl.evoStone = 0;
      celebrate(pl, from, dex);
    } finally { pl.evolving = false; }
  }

  return { LEVELS, SHARDS, levelFor, options, ready, lootFor, cards, grantStone, grantShards, onKill, onChest, celebrate, evolveNow };
})();
