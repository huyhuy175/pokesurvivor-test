/* ============ boost-move.js — herramienta de pruebas (NO forma parte del juego) ============
 * Sube la probabilidad de que salgan ciertos movimientos en las cartas de subida de nivel.
 * Sólo funciona con dev.html (en el index.html publicado G no existe en window).
 *
 * Uso: abre dev.html?dev, pulsa F12 > Consola, pega TODO este archivo y Enter.
 *      Sale un panel abajo a la izquierda (tecla F2 lo oculta/muestra).
 *      Se pierde al recargar la página (la lista elegida sí se recuerda).
 *
 * Cómo funciona: envuelve G.LevelUp.offer. Con la probabilidad "fuerza" vuelve a sortear las
 * cartas (hasta 300 veces) hasta que sale una de los movimientos elegidos: nuevo (new:id) o
 * mejora del que ya tienes (up:id). Si no puede salir (ya lo tienes al máximo, no queda hueco,
 * no es de este Pokémon...) devuelve las cartas normales.
 *
 * Ojo: es trampa para tu propia partida. No subas a la nube ni al ranking runs jugadas así.
 */
(() => {
  const G = window.G;
  if (!G) { console.error('[boost] window.G no existe en este contexto. ¿index.html publicado, o la consola apunta a otro iframe (selector "top" arriba de la consola)?'); return; }
  if (!G.LevelUp || !G.Moves) { console.error('[boost] G existe pero aún le faltan módulos (LevelUp: ' + !!G.LevelUp + ', Moves: ' + !!G.Moves + '). Espera a que cargue el juego y vuelve a pegarlo. Módulos cargados: ' + Object.keys(G).join(', ')); return; }
  if (G.LevelUp.__boosted) { console.warn('[boost] ya estaba activo'); return; }

  const K = 'ps.boost';
  let st = { ids: [], force: 1, on: true };
  try { const v = JSON.parse(localStorage.getItem(K)); if (v && Array.isArray(v.ids)) st = Object.assign(st, v); } catch (e) { /* nada */ }
  const saveSt = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) { /* nada */ } };

  const orig = G.LevelUp.offer;
  G.LevelUp.offer = function (pl, n) {
    let cards = orig.call(this, pl, n);
    if (!st.on || !st.ids.length || Math.random() >= st.force) return cards;
    const want = new Set();
    for (const id of st.ids) { want.add('new:' + id); want.add('up:' + id); }
    const hit = cs => cs.some(c => want.has(c.key));
    if (hit(cards)) return cards;
    for (let i = 0; i < 300; i++) {
      const c = orig.call(this, pl, n);
      if (hit(c)) return c;
    }
    return cards;
  };
  G.LevelUp.__boosted = true;

  // ---------------- panel ----------------
  const nameOf = id => { const d = G.Moves.BY_ID[id]; return d ? (G.T ? G.T(d.name, 'move') : d.name) : id; };
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#111d;color:#fff;font:12px sans-serif;' +
    'padding:8px;border:1px solid #888;border-radius:6px;max-width:280px';
  const dl = document.createElement('datalist'); dl.id = 'boost-moves';
  dl.innerHTML = Object.keys(G.Moves.BY_ID).map(id => `<option value="${id}">${nameOf(id)}</option>`).join('');
  panel.innerHTML = `<b>Boost de movimientos</b>
    <label style="float:right"><input type="checkbox" id="bo-on"> activo</label>
    <div style="margin:6px 0"><input id="bo-in" list="boost-moves" placeholder="id del movimiento" style="width:170px">
      <button id="bo-add">+</button></div>
    <div id="bo-list" style="margin:4px 0"></div>
    <div>Fuerza: <input id="bo-f" type="range" min="0" max="100" style="vertical-align:middle;width:120px"> <span id="bo-fv"></span>%</div>`;
  panel.appendChild(dl);
  document.body.appendChild(panel);

  const $ = id => panel.querySelector('#' + id);
  function render() {
    $('bo-on').checked = st.on;
    $('bo-f').value = Math.round(st.force * 100); $('bo-fv').textContent = Math.round(st.force * 100);
    $('bo-list').innerHTML = st.ids.map(id =>
      `<span data-id="${id}" style="display:inline-block;background:#345;margin:2px;padding:2px 6px;border-radius:10px;cursor:pointer" title="quitar">${nameOf(id)} ✕</span>`).join('') || '<i>ninguno</i>';
  }
  $('bo-on').onchange = e => { st.on = e.target.checked; saveSt(); };
  $('bo-f').oninput = e => { st.force = e.target.value / 100; $('bo-fv').textContent = e.target.value; saveSt(); };
  $('bo-add').onclick = () => {
    const raw = $('bo-in').value.trim();
    const id = G.Moves.BY_ID[raw] ? raw : Object.keys(G.Moves.BY_ID).find(k => nameOf(k).toLowerCase() === raw.toLowerCase());
    if (!id) { $('bo-in').style.outline = '2px solid red'; return; }
    $('bo-in').style.outline = ''; $('bo-in').value = '';
    if (!st.ids.includes(id)) st.ids.push(id);
    saveSt(); render();
  };
  $('bo-list').onclick = e => {
    const id = e.target.dataset && e.target.dataset.id;
    if (id) { st.ids = st.ids.filter(x => x !== id); saveSt(); render(); }
  };
  addEventListener('keydown', e => { if (e.key === 'F2') { panel.style.display = panel.style.display === 'none' ? '' : 'none'; e.preventDefault(); } });
  render();
  console.log('[boost] activo. Panel abajo a la izquierda (F2 lo oculta).');
})();
