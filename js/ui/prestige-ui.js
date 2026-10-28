/* ============ prestige-ui.js — nivel permanente y Prestigio en la pantalla de Mejoras ============
 * La lógica (EXP, límite, coste, bonus) está en systems/prestige.js; aquí sólo se pinta.
 */
G.PrestigeUI = (() => {
  /** Panel del Pokémon `dex` (forma base): nivel, EXP, estrellas, bonus y botón de Prestigio. `rerender` repinta la pantalla. */
  function panel(dex, rerender) {
    const P = G.Prestige, s = G.DB.save;
    const e = (s.plv && s.plv[P.rootOf(dex)]) || { xp: 0, star: 0 };
    const level = P.levelOf(dex), limit = P.limitOf(dex), atLimit = level >= limit;
    const from = P.xpTo(level), to = P.xpTo(level + 1);
    const pct = atLimit ? 100 : Math.max(0, Math.min(100, Math.round((e.xp - from) / (to - from) * 100)));
    const b = P.bonus(dex), bonusPct = Math.round((b.dmgMul - 1) * 1000) / 10;
    const stars = Array.from({ length: P.MAX_STAR }, (_, i) => `<span style="color:${i < e.star ? '#ffd23f' : '#555'}">♦</span>`).join('');
    const maxed = e.star >= P.MAX_STAR, price = P.cost(dex), ready = P.canPrestige(dex) && (s.gems || 0) >= price;

    const el = document.createElement('div');
    el.className = 'panel upg-item';
    el.innerHTML = `<div class="ic">${G.Icons.html('gem', 32)}</div>
      <div>
        <b>Lv ${level} / ${limit}</b> <span style="letter-spacing:2px">${stars}</span>
        <div class="sub" style="font-size:13px">+${bonusPct}% damage and HP · ${atLimit ? 'Level limit reached' : e.xp - from + ' / ' + (to - from) + ' EXP'}</div>
        <div style="height:6px;background:#2a2f3a;border-radius:3px;margin-top:4px"><div style="height:100%;width:${pct}%;background:#7dffb0;border-radius:3px"></div></div>
      </div>
      <div class="upg-btns"><button class="btn small ${maxed || !ready ? '' : 'gold'}" data-prestige data-sfx="none" ${maxed || !ready ? 'disabled' : ''}>
        ${maxed ? 'Max' : `${G.Icons.html('gem', 14)} ${price} · Prestige`}</button></div>`;

    el.querySelector('[data-prestige]').onclick = () => {
      const name = G.DEX_BY[dex].name;
      if (!window.confirm(`Prestige ${name}? It goes back to Lv 1 and gets +1 diamond (+10% damage and HP); its level limit goes up by ${P.LV_STEP}. Costs ${price} gems.`)) return;
      const next = e.star + 1;                     // (`e` es la entrada guardada: prestige() ya la habrá cambiado)
      const r = P.prestige(dex);
      if (r.ok) {
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        G.UI.toast(`${name} reached ${next}♦!`);
      } else {
        G.Audio.sfx('error');
        if (r.reason === 'gems') G.UI.toast('Not enough gems');
      }
      rerender();
    };
    return el;
  }

  return { panel };
})();
