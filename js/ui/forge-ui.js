/* ============ forge-ui.js — pantalla de la Forja Evolutiva ============
 * La lógica (precios, ofertas, compra) está en systems/forge.js; aquí sólo se pinta.
 */
G.ForgeUI = (() => {
  const $ = G.UI.$;
  let rar = 0;                      // filtro de rareza (0 = todas); dura mientras no recargas
  const PAGE = 30;
  let tab = 'evo';                  // 'evo' = formas evolucionadas · 'mega' = Megaevoluciones
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /** Megas que se pueden desbloquear, con lo que tienes y lo que falta de cada cristal (los textos de la Mega van en inglés). */
  function megaRows() {
    const shards = G.DB.save.shards || 0;
    return G.Forge.offersMega().map(o => {
      const crystals = Object.keys(o.crystals).map(type => ({ type, need: o.crystals[type], have: G.DB.crystals(type) }));
      const mats = Object.keys(o.mats || {}).map(type => ({ type, need: o.mats[type], have: G.Shop.count(G.MegaMats.id(type)) }));
      return Object.assign({}, o, { crystals, mats, affordable: shards >= o.shards && crystals.every(c => c.have >= c.need) && mats.every(c => c.have >= c.need) });
    });
  }

  function tabs() {
    const mk = (id, label) => `<button class="chip${tab === id ? ' on' : ''}" data-tab="${id}" type="button">${label}</button>`;
    return `<div class="chips" style="margin-bottom:8px">${mk('evo', G.T('Evolutions'))}${mk('mega', 'Mega')}</div>`;
  }

  function megaCard(r) {
    const to = G.DEX_BY[r.to], from = G.DEX_BY[r.from];
    const need = r.crystals.map(c => `<span class="sub" style="font-size:13px${c.have >= c.need ? '' : ';color:#ff8a8a'}">${cap(c.type)} ${c.have}/${c.need}</span>`).join(' · ');
    const mats = r.mats.map(c => `<span class="sub" style="font-size:13px${c.have >= c.need ? '' : ';color:#ff8a8a'}">${G.MegaMats.dot(c.type, 10)} ${G.MegaMats.name(c.type)} ${c.have}/${c.need}</span>`).join(' · ');
    const el = document.createElement('div');
    el.className = 'panel upg-item';
    el.innerHTML = `<div class="ic"></div>
      <div><b translate="no">${to.name}</b> ${G.UI.stars(to.rarity)}
        <div class="sub" style="font-size:13px">${G.I18n.f('Desde {x}', from.name)} · ${G.UI.typeChips(to.types)}</div>
        <div>${need}</div>${mats ? `<div>${mats}</div>` : ''}</div>
      <div class="upg-btns"><button class="btn small gold" data-buy-mega="${r.to}" data-sfx="none"${r.affordable ? '' : ' disabled'}>
        ${G.Icons.html('shard', 14)} ${r.shards}</button></div>`;
    el.querySelector('.ic').appendChild(G.UI.spriteCanvas(r.to, 64, 56, { scale: 1, lively: true }));
    return el;
  }

  /** Rellena `list` de PAGE en PAGE (con toda la colección hay centenares de ofertas, cada una con su sprite animado). */
  function paged(list, items, mk) {
    const more = document.createElement('button');
    more.className = 'btn small ghost'; more.style.margin = '10px auto 0'; more.style.display = 'block';
    let count = 0;
    const add = () => {
      for (const o of items.slice(count, count + PAGE)) list.appendChild(mk(o));
      count = Math.min(items.length, count + PAGE);
      more.textContent = G.I18n.f('Mostrar más ({x} más)', items.length - count);
      more.classList.toggle('hidden', count >= items.length);
    };
    add();
    list.after(more);
    more.onclick = add;
  }

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

  function wireTabs(box) {
    box.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
  }

  function renderMega() {
    const box = $('forge-body'), rows = megaRows();
    const owned = Object.entries(G.DB.save.cry || {}).filter(([, n]) => n > 0)
      .map(([t, n]) => `<span class="chip">${cap(t)} ${n.toLocaleString(G.I18n.locale)}</span>`).join(' ');
    box.innerHTML = `${tabs()}<p class="row" style="gap:8px;align-items:center;margin:8px 0">${G.Icons.html('shard', 18)}
        <b>${(G.DB.save.shards || 0).toLocaleString(G.I18n.locale)}</b> <span class="sub">${G.T('Fragmentos Evolutivos')}</span></p>
      <div class="chips" style="margin-bottom:10px">${owned || '<span class="sub">No Mega Crystals yet. Bosses and big chests drop them.</span>'}</div>
      <div class="upg" id="forge-list"></div>`;
    const list = $('forge-list');
    if (!rows.length) list.innerHTML = '<p class="sub">Nothing to unlock yet. Get a fully evolved Pokémon that has a Mega form.</p>';
    paged(list, rows, megaCard);
    wireTabs(box);
    list.addEventListener('click', e => { const b = e.target.closest('[data-buy-mega]'); if (b) buyMega(b); });
  }

  function render() {
    if (tab === 'mega') return renderMega();
    const box = $('forge-body'), s = G.DB.save, offers = G.Forge.offers();
    if (rar && !offers.some(o => G.DEX_BY[o.to].rarity === rar)) rar = 0;
    const shown = rar ? offers.filter(o => G.DEX_BY[o.to].rarity === rar) : offers;
    box.innerHTML = `${tabs()}<p class="row" style="gap:8px;align-items:center;margin:8px 0">${G.Icons.html('shard', 18)}
        <b>${(s.shards || 0).toLocaleString(G.I18n.locale)}</b> <span class="sub">${G.T('Fragmentos Evolutivos')}</span></p>
      <div class="chips" style="margin-bottom:10px">${chips(offers)}</div>
      <div class="upg" id="forge-list"></div>`;
    const list = $('forge-list');
    if (!offers.length) list.innerHTML = `<p class="sub">${G.T('Nada que forjar por ahora. Consigue Pokémon que evolucionen.')}</p>`;
    paged(list, shown, card);
    wireTabs(box);
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

  function buyMega(btn) {
    const to = +btn.dataset.buyMega, r = G.Forge.buyMega(to);
    if (r.ok) {
      G.Audio.sfx('buy');
      G.UI.refreshCoins();
      G.UI.toast(G.I18n.f('¡{x} desbloqueado!', G.DEX_BY[to].name));
    } else if (r.reason === 'shards' || r.reason === 'crystals' || r.reason === 'mats') {
      G.UI.toast(r.reason === 'shards' ? G.T('No tienes suficientes fragmentos') : r.reason === 'mats' ? 'Not enough Mega Materials' : 'Not enough Mega Crystals');
      G.Audio.sfx('error');
      return;
    }
    render();
  }

  function open() {
    G.UI.show('scr-forge', true);
    render();
  }

  return { open, megaRows, PAGE };
})();
