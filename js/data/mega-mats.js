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
  // Icono: una gema de 12x12 píxeles con las luces y sombras sacadas del color del tipo.
  // o contorno · L brillo · l claro · m color del tipo · d sombra · w destello
  const GEM = [
    '...oooooo...',
    '..oLLllmmo..',
    '.oLLllmmmmmo',
    'oLwllmmmmdmo',
    'olllmmmmmddo',
    'ollmmmmmdddo',
    '.ommmmmdddo.',
    '..ommmmddo..',
    '...ommddo...',
    '....ommdo...',
    '.....odo....',
    '......o.....',
  ];
  const mix = (hex, to, t) => {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [16, 8, 0].map(s => Math.round(((n >> s) & 255) * (1 - t) + to * t).toString(16).padStart(2, '0')).join('');
  };
  const gems = {};
  const gem = type => {
    if (gems[type]) return gems[type];
    const c = color(type);
    const fill = { o: mix(c, 0, 0.62), L: mix(c, 255, 0.72), l: mix(c, 255, 0.38), m: c, d: mix(c, 0, 0.32), w: '#ffffff' };
    let r = '';
    GEM.forEach((row, y) => [...row].forEach((ch, x) => { if (fill[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill[ch]}"/>`; }));
    return (gems[type] = r);
  };
  /** Icono del material del tipo (una gema de su color). */
  const dot = (type, px = 14) =>
    `<svg class="mat-dot" width="${px}" height="${px}" viewBox="0 0 12 12" shape-rendering="crispEdges" style="vertical-align:middle;flex:none;filter:drop-shadow(0 0 ${Math.max(2, px / 8)}px ${color(type)}88)">${gem(type)}</svg>`;

  return { TYPES, id, typeOf, name, color, dot };
})();
