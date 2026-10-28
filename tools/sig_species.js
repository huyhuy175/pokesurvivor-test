/* Lista de especies con movimiento especial (signature), calculada desde los datos del juego.
 * La usan tools/gen_signature.js y los tests: así nunca se escribe a mano.
 *
 *   legend  leg: legendario o singular (js/data/pokedex.js)
 *   mega    tiene forma Mega (js/data/mega.js) y no es legendario
 *   pseudo  bst >= 580, sin Mega y no legendario
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function load() {
  const G = { DEX_BY: {} };
  for (const f of ['js/data/pokedex.js', 'js/data/mega.js']) new Function('G', fs.readFileSync(path.join(root, f), 'utf8'))(G);
  return G;
}

/** @returns {{ dex: number, name: string, type: string, types: string[], bst: number, why: 'legend'|'mega'|'pseudo' }[]} ordenada por dex */
function speciesList() {
  const G = load(), out = [];
  for (const m of G.DEX) {
    const why = m.leg ? 'legend' : G.MEGA[m.dex] ? 'mega' : m.bst >= 580 ? 'pseudo' : null;
    if (why) out.push({ dex: m.dex, name: m.name, type: m.types[0], types: m.types, bst: m.bst, pa: m.pa, sa: m.sa, why });
  }
  return out.sort((a, b) => a.dex - b.dex);
}

module.exports = { speciesList };
