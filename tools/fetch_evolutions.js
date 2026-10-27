#!/usr/bin/env node
/* fetch_evolutions.js — baja las cadenas de evolución de PokeAPI y escribe js/data/evolutions.js.
 *
 *   node tools/fetch_evolutions.js
 *
 * G.EVO[dex]      = destinos directos (puede haber varios: Eevee)
 * G.EVO_FROM[dex] = pre-evoluciones
 * Sólo entran Pokémon que existan en js/data/pokedex.js. Se guarda lo bajado en
 * tools/cache/evolutions.json: se puede relanzar sin volver a descargar.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const cacheFile = path.join(__dirname, 'cache', 'evolutions.json');
const API = 'https://pokeapi.co/api/v2/evolution-chain/';
const MAX_CHAIN = 600;

const G = {};
new Function('G', fs.readFileSync(path.join(root, 'js/data/pokedex.js'), 'utf8'))(G);

const speciesId = url => +/\/(\d+)\/?$/.exec(url)[1];

async function get(id, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + id, { headers: { 'User-Agent': 'pokesurvivor/1.0' } });
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch (e) { /* reintenta */ }
    await new Promise(res => setTimeout(res, 500 * (i + 1)));
  }
  throw new Error('no se pudo bajar la cadena ' + id);
}

async function main() {
  let edges = [];                                  // [desde, hasta]
  if (fs.existsSync(cacheFile)) edges = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  else {
    const ids = Array.from({ length: MAX_CHAIN }, (_, i) => i + 1);
    let next = 0;
    const walk = (node, out) => {
      for (const c of node.evolves_to) { out.push([speciesId(node.species.url), speciesId(c.species.url)]); walk(c, out); }
    };
    await Promise.all(Array.from({ length: 12 }, async () => {
      while (next < ids.length) {
        const chain = await get(ids[next++]);
        if (chain) walk(chain.chain, edges);
      }
    }));
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(edges));
  }

  const EVO = {}, FROM = {};
  for (const [a, b] of edges) {
    if (!G.DEX_BY[a] || !G.DEX_BY[b] || a === b) continue;
    (EVO[a] = EVO[a] || []).includes(b) || EVO[a].push(b);
    (FROM[b] = FROM[b] || []).includes(a) || FROM[b].push(a);
  }
  const fmt = o => Object.keys(o).map(Number).sort((x, y) => x - y)
    .map(k => `  ${k}:[${o[k].sort((x, y) => x - y).join(',')}]`).join(',\n');
  fs.writeFileSync(path.join(root, 'js/data/evolutions.js'),
`/* ============ evolutions.js — GENERADO por tools/fetch_evolutions.js, no editar a mano ============
 * G.EVO[dex]      = evoluciones directas · G.EVO_FROM[dex] = pre-evoluciones.
 * Datos de PokeAPI. Lo usa systems/evolution.js.
 */
G.EVO = {
${fmt(EVO)}
};
G.EVO_FROM = {
${fmt(FROM)}
};
`);
  console.log(`ok: ${Object.keys(EVO).length} Pokémon evolucionan · ${edges.length} pasos bajados`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
