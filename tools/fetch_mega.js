#!/usr/bin/env node
/* fetch_mega.js — baja las Megaevoluciones de PokeAPI y escribe js/data/mega.js.
 *
 *   node tools/fetch_mega.js
 *
 * Cada Mega es una fila aparte (dex >= 10000) que NO entra en G.DEX (así no sale de enemigo,
 * ni del gacha, ni cuenta en la Pokédex); sólo en G.DEX_BY. Los stats usan las mismas fórmulas
 * que tools/fetch_pokedex.py. Se guarda lo bajado en tools/cache/mega.json: se puede relanzar
 * sin volver a descargar.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const cacheFile = path.join(__dirname, 'cache', 'mega.json');
const API = 'https://pokeapi.co/api/v2/';
const MAX_SPECIES = 1025;
const FIRST_DEX = 10000;

const G = {};
for (const f of ['js/data/pokedex.js', 'js/data/evolutions.js']) new Function('G', fs.readFileSync(path.join(root, f), 'utf8'))(G);

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'pokesurvivor/1.0' } });
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch (e) { /* reintenta */ }
    await new Promise(res => setTimeout(res, 500 * (i + 1)));
  }
  throw new Error('no se pudo bajar ' + url);
}

/** Como rarity() de fetch_pokedex.py. */
function rarity(bst, base) {
  if (base.leg || bst >= 580) return 5;
  if (bst >= 495) return 4;
  if (bst >= 410) return 3;
  if (bst >= 320) return 2;
  return 1;
}

async function download() {
  const rows = [];                                   // { base, slug, types, stats }
  let next = 1;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next <= MAX_SPECIES) {
      const id = next++;
      if (!G.DEX_BY[id]) continue;
      const sp = await get(API + 'pokemon-species/' + id);
      if (!sp) continue;
      for (const v of sp.varieties) {
        if (!/-mega(-[xyz])?$/.test(v.pokemon.name)) continue;
        const p = await get(v.pokemon.url);
        if (!p) continue;
        rows.push({
          base: id, slug: p.name, types: p.types.map(t => t.type.name),
          stats: Object.fromEntries(p.stats.map(s => [s.stat.name, s.base_stat]))
        });
      }
    }
  }));
  rows.sort((a, b) => a.base - b.base || a.slug.localeCompare(b.slug));
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(rows));
  return rows;
}

async function main() {
  const raw = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : await download();
  const out = [];
  for (const r of raw) {
    const base = G.DEX_BY[r.base];
    if (!base || (G.EVO[r.base] || []).length) continue;           // sólo formas finales o únicas
    const s = r.stats, bst = Object.values(s).reduce((a, b) => a + b, 0);
    if (bst <= base.bst) continue;
    const form = (/-mega-([xyz])$/.exec(r.slug) || [])[1] || 'mega';
    const r2 = v => Math.round(v * 100) / 100;
    out.push({
      dex: FIRST_DEX + out.length,
      name: 'Mega ' + base.name + (form === 'mega' ? '' : ' ' + form.toUpperCase()),
      slug: r.slug, mega: r.base, form, types: r.types,
      // Nunca por debajo de la forma base (Mega Ampharos baja de Velocidad en los juegos).
      hp: Math.max(base.hp, Math.round(70 + s.hp * 0.45)), spd: Math.max(base.spd, Math.round(78 + s.speed * 0.42)),
      atk: Math.max(base.atk, r2(0.70 + Math.max(s.attack, s['special-attack']) / 100 * 0.55)),
      pa: Math.max(base.pa, r2(0.70 + s.attack / 100 * 0.55)), sa: Math.max(base.sa, r2(0.70 + s['special-attack'] / 100 * 0.55)),
      df: Math.max(base.df, s.defense), sd: Math.max(base.sd, s['special-defense']),
      rarity: rarity(bst, base), bst, starter: false, gen: base.gen, leg: !!base.leg
    });
  }
  const lines = out.map(m => '  ' + JSON.stringify(m));
  fs.writeFileSync(path.join(root, 'js/data/mega.js'),
`/* ============ mega.js — GENERADO por tools/fetch_mega.js, no editar a mano ============
 * Megaevoluciones (datos de PokeAPI). Filas aparte de G.DEX: sólo están en G.DEX_BY, así que ni
 * salen de enemigo, ni del gacha, ni cuentan en la Pokédex. Su pasiva sale de su línea (G.AbilityFX.of, por G.Mons.lineage).
 * G.MEGA[base] = [megas] · G.MEGA_FROM[mega] = base · G.isMega(dex).
 * Los sprites que falten se sustituyen por los de la forma base con un aura (core/sprites.js).
 */
G.MEGA_DEX = [
${lines.join(',\n')}
];
G.MEGA = {};
G.MEGA_FROM = {};
for (const m of G.MEGA_DEX) {
  (G.MEGA[m.mega] = G.MEGA[m.mega] || []).push(m.dex);
  G.MEGA_FROM[m.dex] = m.mega;
  G.DEX_BY[m.dex] = m;
}
G.isMega = dex => dex >= ${FIRST_DEX} && !!G.MEGA_FROM[dex];
`);
  console.log(`ok: ${out.length} Megas (de ${raw.length} bajadas)`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
