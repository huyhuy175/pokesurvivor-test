/* ============ forge-ui.js — pantalla de la Forja Evolutiva ============
 * La lógica (precios, ofertas, compra) está en systems/forge.js; aquí sólo se pinta.
 */
G.ForgeUI = (() => {
  const $ = G.UI.$;
  let rar = 0;                      // filtro de rareza (0 = todas); dura mientras no recargas
  const PAGE = 30;

  function chips(offers) {
    const have = new Set(offers.map(o => G.DEX_BY[o.to].rarity));
    const mk = (r, label) => `<button class="chip${rar === r ? ' on' : ''}" data-rar="${r}" type="button">${label}</button>`;
    return mk(0, G.T('Todas')) + [1, 2, 3, 4, 5].filter(r => have.has(r)).map(r => mk(r, r + '★')).join('');
  }

  function card(o) {
    const to = G.DEX_BY[o.to], from = G.DEX_BY[o.from], enough = (G.DB.save.shards || 0) >= o.price;
    const el = document.createElement('div');
    el.className = 'panel upg-item';
    el.innerHTML = `<div class="ic"></div>
      <div><b translate="no">${to.name}</b> ${G.UI.stars(to.rarity)}
        <div class="sub" style="font-size:13px">${G.I18n.f('Desde {x}', from.name)} · ${G.UI.typeChips(to.types)}</div></div>
      <div class="upg-btns"><button class="btn small gold" data-buy="${o.to}" data-sfx="none"${enough ? '' : ' disabled'}>
        ${G.Icons.html('shard', 14)} ${o.price}</button></div>`;
    el.querySelector('.ic').appendChild(G.UI.spriteCanvas(o.to, 64, 56, { scale: 1, lively: true }));
    return el;
  }

  function render() {
    const box = $('forge-body'), s = G.DB.save, offers = G.Forge.offers();
    if (rar && !offers.some(o => G.DEX_BY[o.to].rarity === rar)) rar = 0;
    const shown = rar ? offers.filter(o => G.DEX_BY[o.to].rarity === rar) : offers;
    box.innerHTML = `<p class="row" style="gap:8px;align-items:center;margin:8px 0">${G.Icons.html('shard', 18)}
        <b>${(s.shards || 0).toLocaleString(G.I18n.locale)}</b> <span class="sub">${G.T('Fragmentos Evolutivos')}</span></p>
      <div class="chips" style="margin-bottom:10px">${chips(offers)}</div>
      <div class="upg" id="forge-list"></div>`;
    const list = $('forge-list');
    if (!offers.length) list.innerHTML = `<p class="sub">${G.T('Nada que forjar por ahora. Consigue Pokémon que evolucionen.')}</p>`;
    // De PAGE en PAGE: con toda la colección hay centenares de ofertas, cada una con su sprite animado.
    const more = document.createElement('button');
    more.className = 'btn small ghost'; more.style.margin = '10px auto 0'; more.style.display = 'block';
    const add = () => {
      for (const o of shown.slice(count, count + PAGE)) list.appendChild(card(o));
      count = Math.min(shown.length, count + PAGE);
      more.textContent = G.I18n.f('Mostrar más ({x} más)', shown.length - count);
      more.classList.toggle('hidden', count >= shown.length);
    };
    let count = 0;
    add();
    list.after(more);
    more.onclick = add;
    box.querySelectorAll('[data-rar]').forEach(b => { b.onclick = () => { rar = +b.dataset.rar; render(); }; });
    list.addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) buy(b); });
  }

  function buy(btn) {
    const to = +btn.dataset.buy, r = G.Forge.buy(to);
    if (r.ok) {
      G.Audio.sfx('buy');
      G.UI.refreshCoins();
      G.UI.toast(G.I18n.f('¡{x} desbloqueado!', G.DEX_BY[to].name));
    } else if (r.reason === 'shards') {
      G.UI.toast(G.T('No tienes suficientes fragmentos'));
      G.Audio.sfx('error');
      return;
    }
    render();      // (otro motivo: la lista ya no es la de ahora, por ejemplo tras fusionar con la nube)
  }

  function open() {
    G.UI.show('scr-forge', true);
    render();
  }

  return { open };
})();
