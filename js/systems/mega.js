/* ============ mega.js — Megaevolución durante la partida ============
 * Con el nivel exigido y una Piedra Mega, el Pokémon pasa a una Mega que ya has desbloqueado
 * en la Forja (Forge.buyMega). Es el último paso y no se deshace en la partida. Además de los
 * stats de la forma Mega (data/mega.js), recibe una mejora fija (BONUS). La piedra cae de
 * jefes y cofres grandes (si hay una Mega a la que ir) y, rarísima vez, de enemigos normales.
 * Los jefes y los cofres grandes sueltan además un Cristal Mega (se guarda al instante).
 * Todos los textos nuevos de la Mega van sólo en inglés.
 */
G.Mega = (() => {
  /** Nivel exigido. Ajustable aquí. */
  const LEVEL = 36;
  /** Probabilidad de que un enemigo normal suelte la piedra (si hay una Mega a la que ir). */
  const ENEMY_DROP = 0.0005;
  /** Mejora fija de la Mega: daño, vida máxima (y cuánta se cura al transformarse), velocidad y crítico. */
  const BONUS = { dmg: 0.15, hp: 0.20, heal: 0.25, spd: 0.08, crit: 0.10 };

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /** Megas a las que puede ir ahora: las desbloqueadas de su forma, con el nivel exigido. */
  function options(pl) {
    if (pl.level < LEVEL || G.isMega(pl.dex)) return [];
    return ((G.MEGA && G.MEGA[pl.dex]) || []).filter(d => G.DB.owns(d));
  }

  const ready = pl => options(pl).length > 0 && pl.megaStone > 0;

  /** ¿Suelta la piedra? kind: 'boss' | 'chest' | 'enemy'. */
  function lootFor(pl, kind, rand = Math.random) {
    if (pl.megaStone > 0 || !options(pl).length) return false;
    return kind === 'enemy' ? rand() < ENEMY_DROP : true;
  }

  /** Una carta por Mega posible (como las de evolución). */
  function cards(pl) {
    const from = G.DEX_BY[pl.dex].name;
    return options(pl).map(dex => {
      const to = G.DEX_BY[dex].name;
      return {
        w: 100, type: 'mevo', key: 'mega:' + dex, dex,
        icon: 'evostone', color: '#ff6bd6', tag: 'MEGA',
        title: from + ' → ' + to, desc: G.I18n.f('Mega Evolves into {x}', to),
        apply: p => { p.megaUp(dex); p.megaStone = 0; }
      };
    });
  }

  function grantStone(pl) {
    pl.megaStone = 1;
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 12, G.T('Mega Stone!'), '#ff6bd6', true);
    G.FX.ring(pl.x, pl.y, 8, 90, '#ff6bd6', 0.6, 5);
    G.Audio.sfx('legend');
  }

  /** Un Cristal Mega del tipo dado: se guarda al instante (como los tickets). */
  function grantCrystal(pl, type) {
    G.Progress.grant({ crystals: { [type]: 1 } });
    pl.crystalsFound = (pl.crystalsFound || 0) + 1;       // para la pantalla final
    G.DB.commit('run');
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 44, '+1 ' + cap(type) + ' ' + G.T('Crystal'), '#ff6bd6', true);
  }

  function randomType(rand = Math.random) {
    const all = Object.keys(G.U.TYPE_NAME);
    return all[Math.floor(rand() * all.length)];
  }

  /** Cae un enemigo (e.boss: jefe; e.judge: legendario de la Sentencia, no suelta nada). */
  function onKill(pl, e, rand) {
    if (e.judge) return;
    // Un jefe sin Pokémon en la Pokédex tiene el tipo de reserva (normal): mejor un tipo al azar que siempre Normal.
    if (e.boss && e.types && e.types.length) grantCrystal(pl, e.mon === null ? randomType(rand) : e.types[0]);
    if (lootFor(pl, e.boss ? 'boss' : 'enemy', rand)) grantStone(pl);
  }

  /** Se abre un cofre grande: un cristal de uno de los tipos de tu Pokémon. */
  function onChest(pl, rand = Math.random) {
    const types = pl.mon.types;
    grantCrystal(pl, types[Math.floor(rand() * types.length)]);
    if (lootFor(pl, 'chest')) grantStone(pl);
  }

  function celebrate(pl, from, dex) {
    G.FX.ring(pl.x, pl.y, 8, 170, '#ff6bd6', 0.9, 7);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ff9be8', 64, 300);
    G.Audio.sfx('legend');
    G.Spawner.say(G.I18n.f('{x} Mega Evolved into {x}!', from, G.DEX_BY[dex].name), 3, true);
  }

  /** Megaevoluciona ya a `dex` (con su hoja de sprites cargada). Una sola vez aunque se llame dos. */
  async function megaNow(pl, dex) {
    if (pl.evolving) return;
    pl.evolving = true;
    try {
      await G.Sprites.preload([dex], 4000, pl.shiny);
      const g = G.Game;
      if (pl.dead || !(pl.megaStone > 0) || (g && (g.player !== pl || g.state === 'over' || g.state === 'ui'))) return;
      const from = G.DEX_BY[pl.dex].name;
      pl.megaUp(dex);
      pl.megaStone = 0;
      celebrate(pl, from, dex);
    } finally { pl.evolving = false; }
  }

  return { LEVEL, BONUS, options, ready, lootFor, cards, grantStone, grantCrystal, onKill, onChest, celebrate, megaNow };
})();
