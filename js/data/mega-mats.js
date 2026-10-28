/* ============ mega-mats.js — Materiales Mega ============
 * Un material por tipo (id: 'mat' + tipo, p. ej. 'matfire'). Viven en la Mochila (save.bag),
 * se sueltan en las partidas (systems/mega.js), se compran en la tienda Kecleon (data/shop.js)
 * y la Forja los pide para desbloquear una Mega (systems/forge.js).
 * El id no lleva guion bajo y mide como mucho 12: la libreta de db.js sólo acepta 'b:[a-z0-9]{1,12}'.
 * Los textos nuevos van sólo en inglés.
 */
G.MegaMats = (() => {
  const TYPES = Object.keys(G.U.TYPE_NAME);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const id = type => 'mat' + type;
  const typeOf = matId => TYPES.find(t => id(t) === matId) || null;
  const name = type => cap(type) + ' Core';
  const color = type => (G.U.TYPE_COLOR && G.U.TYPE_COLOR[type]) || '#ffffff';
  /** Un punto del color del tipo (hace de icono). */
  const dot = (type, px = 14) =>
    `<span class="mat-dot" style="display:inline-block;width:${px}px;height:${px}px;border-radius:50%;background:${color(type)};vertical-align:middle"></span>`;

  return { TYPES, id, typeOf, name, color, dot };
})();
