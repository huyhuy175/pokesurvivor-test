#!/usr/bin/env node
/* gen_passives.js — genera js/data/passives.js (pasiva única de cada Pokémon).
 *
 *   node tools/gen_passives.js
 *
 * Rareza 4-5: nombre y plantillas elegidos a mano en tools/passive_design.json
 *   ({ "dex": ["Nombre", "plantilla", ...] }); aquí sólo se calculan los valores para
 *   que el poder caiga en la banda de la rareza (más alto cuanto más BST) y que
 *   ninguna firma se repita.
 * Rareza 1-3: plantillas por tipo (y por sesgo físico/especial), nombre «Adjetivo Sustantivo».
 * El poder de cada plantilla y las bandas están en js/data/passive-fx.js.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const G = { U: { TYPE_NAME: {} }, Types: { mult: () => 1 }, Weather: {} };
for (const f of ['js/data/pokedex.js', 'js/data/passive-fx.js']) new Function('G', fs.readFileSync(path.join(root, f), 'utf8'))(G);
const { TEMPLATES, BANDS, power, signature } = G.PassiveFX;
const design = JSON.parse(fs.readFileSync(path.join(__dirname, 'passive_design.json'), 'utf8'));
const errors = [];
const fail = m => errors.push(m);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Ajusta v (valores enteros) hasta que el poder esté en [lo, hi]; `lock` = índice que no se toca. */
function adjust(ids, v, lo, hi, lock = -1) {
  const pw = () => power(ids.map((id, i) => [id, v[i]]));
  for (let guard = 0; guard < 5000; guard++) {
    const p = pw();
    if (p >= lo && p <= hi) return true;
    const up = p < lo, cand = [];
    ids.forEach((id, i) => {
      const t = TEMPLATES[id];
      if (i === lock || (up ? v[i] >= t.max : v[i] <= t.min)) return;
      cand.push({ i, c: t.cost });
    });
    if (!cand.length) return false;
    const fits = cand.filter(x => (up ? p + x.c <= hi : p - x.c >= lo)).sort((a, b) => b.c - a.c);
    const pick = fits.length ? fits[0] : cand.sort((a, b) => a.c - b.c)[0];
    v[pick.i] += up ? 1 : -1;
  }
  return false;
}

function fit(ids, target, lo, hi) {
  const v = ids.map(id => { const t = TEMPLATES[id]; return clamp(Math.round(target / ids.length / t.cost), t.min, t.max); });
  return adjust(ids, v, lo, hi) ? v : null;
}

/** Posición 0..1 de cada Pokémon dentro de su rareza según el BST. */
const pos = {};
for (let r = 1; r <= 5; r++) {
  const l = G.DEX.filter(p => p.rarity === r).sort((a, b) => a.bst - b.bst || a.dex - b.dex);
  l.forEach((p, i) => { pos[p.dex] = l.length > 1 ? i / (l.length - 1) : 0; });
}

const out = {}, names = new Set(), sigs = new Set();
const useName = (dex, n) => {
  if (names.has(n.toLowerCase())) fail(`dex ${dex}: nombre repetido «${n}»`);
  names.add(n.toLowerCase());
};

// ---------- rareza 4-5: diseño a mano ----------
for (const p of G.DEX.filter(p => p.rarity >= 4)) {
  const d = design[p.dex];
  if (!d) { fail(`dex ${p.dex} ${p.name} (rareza ${p.rarity}) sin diseño`); continue; }
  const [n, ...ids] = d;
  const bad = ids.filter(id => !TEMPLATES[id]);
  if (bad.length) { fail(`dex ${p.dex}: plantilla desconocida ${bad}`); continue; }
  if (ids.length !== new Set(ids).size) { fail(`dex ${p.dex}: plantilla repetida`); continue; }
  if (p.rarity === 4 && ids.length !== 2) fail(`dex ${p.dex}: rareza 4 pide 2 efectos`);
  if (p.rarity === 5 && (ids.length < 2 || ids.length > 3)) fail(`dex ${p.dex}: rareza 5 pide 2-3 efectos`);
  const [lo, hi] = BANDS[p.rarity], target = lo + (hi - lo) * pos[p.dex];
  let v = fit(ids, target, lo, hi);
  if (!v) { fail(`dex ${p.dex} ${p.name}: ${ids} no alcanza la banda ${lo}-${hi}`); continue; }
  const sig = v2 => signature(ids.map((id, i) => [id, v2[i]]));
  if (sigs.has(sig(v))) {                       // firma repetida: mover un valor y reequilibrar
    let found = null;
    for (let mag = 1; mag <= 6 && !found; mag++) {
      for (let i = 0; i < ids.length && !found; i++) {
        for (const s of [1, -1]) {
          const w = v.slice(), t = TEMPLATES[ids[i]];
          w[i] = clamp(w[i] + s * mag, t.min, t.max);
          if (adjust(ids, w, lo, hi, i) && !sigs.has(sig(w))) { found = w; break; }
        }
      }
    }
    if (!found) { fail(`dex ${p.dex} ${p.name}: no se pudo hacer única la firma`); continue; }
    v = found;
  }
  sigs.add(sig(v));
  useName(p.dex, n);
  out[p.dex] = { n, fx: ids.map((id, i) => [id, v[i]]) };
}

// ---------- rareza 1-3: por tipo ----------
const SIG = {
  normal: ['healMul', 'maxHp'], fighting: ['physDmg', 'killHeal'], flying: ['speed', 'dodge'], poison: ['reflect', 'specDmg'],
  ground: ['dmgTaken', 'physDmg'], rock: ['dmgTaken', 'typeTaken'], bug: ['multiHitDmg', 'speed'], ghost: ['dodge', 'specDmg'],
  steel: ['dmgTaken', 'reflect'], fire: ['critChance', 'specDmg'], water: ['regen', 'healMul'], grass: ['regen', 'killHeal'],
  electric: ['speed', 'cdMul'], psychic: ['cdMul', 'specDmg'], ice: ['dodge', 'typeTaken'], dragon: ['physDmg', 'critChance'],
  dark: ['critChance', 'dodge'], fairy: ['healMul', 'dodge']
};
const NOUN = {
  normal: ['Instinct', 'Hide', 'Stride', 'Spirit', 'Fur', 'Grit'], fighting: ['Fist', 'Stance', 'Resolve', 'Guard', 'Blow', 'Drive'],
  flying: ['Wing', 'Gust', 'Feather', 'Soar', 'Draft', 'Talon'], poison: ['Fang', 'Venom', 'Spore', 'Haze', 'Sting', 'Barb'],
  ground: ['Burrow', 'Dust', 'Tremor', 'Clay', 'Dune', 'Mud'], rock: ['Crag', 'Shell', 'Boulder', 'Flint', 'Slate', 'Cairn'],
  bug: ['Swarm', 'Silk', 'Molt', 'Carapace', 'Buzz', 'Chitin'], ghost: ['Veil', 'Whisper', 'Shade', 'Hush', 'Echo', 'Wisp'],
  steel: ['Plate', 'Rivet', 'Alloy', 'Bulwark', 'Edge', 'Temper'], fire: ['Ember', 'Cinder', 'Blaze', 'Flare', 'Kindling', 'Spark'],
  water: ['Ripple', 'Current', 'Tide', 'Spray', 'Brook', 'Mist'], grass: ['Sprout', 'Bloom', 'Leaf', 'Root', 'Pollen', 'Thicket'],
  electric: ['Static', 'Surge', 'Volt', 'Arc', 'Charge', 'Pulse'], psychic: ['Focus', 'Mind', 'Trance', 'Insight', 'Aura', 'Reverie'],
  ice: ['Frost', 'Glaze', 'Rime', 'Flurry', 'Chill', 'Floe'], dragon: ['Scale', 'Breath', 'Claw', 'Pride', 'Roar', 'Horn'],
  dark: ['Shadow', 'Cunning', 'Gloom', 'Prowl', 'Dusk', 'Snare'], fairy: ['Charm', 'Glimmer', 'Ribbon', 'Lullaby', 'Dew', 'Sparkle']
};
const ADJ = ['Swift', 'Hardy', 'Quiet', 'Keen', 'Bold', 'Gentle', 'Wild', 'Proud', 'Sturdy', 'Nimble', 'Calm', 'Fierce', 'Bright',
  'Stout', 'Sly', 'Eager', 'Lone', 'Humble', 'Brisk', 'Steady', 'Lively', 'Rugged', 'Silent', 'Vivid', 'Gallant', 'Cunning',
  'Mellow', 'Plucky', 'Stalwart', 'Spry', 'Hushed', 'Radiant', 'Dusky', 'Feral', 'Tender', 'Zesty', 'Wary', 'Jolly', 'Mighty', 'Serene'];

for (const p of G.DEX.filter(p => p.rarity <= 3)) {
  const t1 = p.types[0], t2 = p.types[1];
  const bias = p.pa >= p.sa ? 0 : 1;
  const sigType = p.rarity === 2 && t2 && p.dex % 2 === 0 ? t2 : t1;
  const sig = SIG[sigType][bias];
  const ids = p.rarity === 1 ? ['typeDmg'] : p.rarity === 2 ? [sig] : ['typeDmg', sig];
  const [lo, hi] = BANDS[p.rarity], v = fit(ids, lo + (hi - lo) * pos[p.dex], lo, hi);
  if (!v) { fail(`dex ${p.dex} ${p.name}: ${ids} no alcanza la banda ${lo}-${hi}`); continue; }
  const nouns = NOUN[t1];
  let h = (p.dex * 2654435761) >>> 0, n = '';
  for (let k = 0; k < ADJ.length * nouns.length; k++, h++) {
    n = ADJ[h % ADJ.length] + ' ' + nouns[Math.floor(h / ADJ.length) % nouns.length];
    if (!names.has(n.toLowerCase())) break;
  }
  useName(p.dex, n);
  out[p.dex] = { n, fx: ids.map((id, i) => [id, v[i]]) };
}

if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length} errores`); process.exit(1); }

const lines = G.DEX.map(p => `  ${p.dex}:${JSON.stringify(out[p.dex])}`);
fs.writeFileSync(path.join(root, 'js/data/passives.js'),
`/* ============ passives.js — GENERADO por tools/gen_passives.js, no editar a mano ============
 * G.PASSIVES[dex] = { n: nombre, fx: [[plantilla, valor], ...] }
 * Las plantillas y lo que hacen están en js/data/passive-fx.js. Textos sólo en inglés.
 */
G.PASSIVES = {
${lines.join(',\n')}
};
`);

for (let r = 1; r <= 5; r++) {
  const w = G.DEX.filter(p => p.rarity === r).map(p => power(out[p.dex].fx));
  console.log(`rareza ${r}: ${w.length} Pokémon · poder mín ${Math.min(...w)} · media ${(w.reduce((a, b) => a + b, 0) / w.length).toFixed(2)} · máx ${Math.max(...w)}`);
}
