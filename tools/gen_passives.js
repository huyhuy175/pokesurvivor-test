#!/usr/bin/env node
/* gen_passives.js — genera js/data/passives.js: la pasiva UNIQUE de cada línea evolutiva.
 *
 *   node tools/gen_passives.js
 *
 * Una por forma base (la de G.Mons.lineage: una evolución o una Mega vuelven a ella), que se
 * abre a 3★ y se queda al evolucionar. Las comunes (una por tipo) están escritas a mano en
 * js/data/passives-common.js; las plantillas, en js/data/passive-unique-fx.js (y passive-fx.js).
 *
 * Bandeja según la rareza de la forma base: 1-3 basic, 4 adv, 5 / legendario / singular supreme.
 * La rareza cambia la CLASE de mecánica, no el número: el presupuesto (poder = Σ cost × valor)
 * es el medio de su bandeja (cost × max de sus plantillas: 6 / 7,5 / 9) ×(1 ± 0,15), más alto
 * cuanto más floja es la línea (BST de su forma más fuerte) dentro de la bandeja.
 *
 * Escritas a mano en tools/passive_design.json ({ "dexBase": ["Nombre", "plantilla", ...] }):
 * iniciales, legendarios y singulares (supreme siempre a mano); aquí sólo se calculan los valores.
 * Las demás: plantillas según el tipo principal de la forma base y nombre «Adjetivo Sustantivo».
 * Determinista: mismo resultado en cada ejecución. Textos sólo en inglés.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const G = { U: { TYPE_NAME: {} }, Types: { mult: () => 1 }, Weather: {} };
for (const f of ['js/data/pokedex.js', 'js/data/evolutions.js', 'js/data/mega.js', 'js/systems/mons.js',
  'js/data/passive-fx.js', 'js/data/passive-unique-fx.js', 'js/data/passives-common.js']) {
  new Function('G', fs.readFileSync(path.join(root, f), 'utf8'))(G);
}
const { power, signature } = G.PassiveFX;
const { TEMPLATES: UT, TIERS } = G.UniqueFX;
const tpl = id => G.PassiveFX.TEMPLATES[id] || UT[id];
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
      const t = tpl(id);
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
  const v = ids.map(id => { const t = tpl(id); return clamp(Math.round(target / ids.length / t.cost), t.min, t.max); });
  return adjust(ids, v, lo, hi) ? v : null;
}

// ---------------- líneas, bandejas y presupuesto ----------------
const lineOf = {};                                   // forma base → miembros
for (const p of G.DEX) {
  const l = G.Mons.lineage(p.dex), r = l.length ? l[0] : p.dex;
  (lineOf[r] = lineOf[r] || []).push(p);
}
const ROOTS = Object.keys(lineOf).map(Number).sort((a, b) => a - b);
const RANK = { basic: 0, adv: 1, supreme: 2 };
const tierOf = p => (p.leg || p.rarity >= 5 ? 'supreme' : p.rarity === 4 ? 'adv' : 'basic');
const BUDGET = {};
for (const t of Object.keys(TIERS)) BUDGET[t] = TIERS[t].reduce((s, id) => s + UT[id].cost * UT[id].max, 0) / TIERS[t].length;
const SPREAD = 0.15, WINDOW = 0.03;                  // ±15 % según la línea; ±3 % de holgura alrededor del objetivo
const lineBst = r => Math.max(...lineOf[r].map(p => p.bst));
const span = {};
for (const r of ROOTS) {
  const t = tierOf(G.DEX_BY[r]), b = lineBst(r);
  span[t] = span[t] ? { lo: Math.min(span[t].lo, b), hi: Math.max(span[t].hi, b) } : { lo: b, hi: b };
}
/** [lo, hi] de poder de la línea: la más floja de su bandeja apunta a +15 %, la más fuerte a −15 %. */
function band(r) {
  const t = tierOf(G.DEX_BY[r]), B = BUDGET[t], s = span[t];
  const pos = s.hi > s.lo ? (lineBst(r) - s.lo) / (s.hi - s.lo) : 0.5;
  const target = B * (1 + SPREAD * (1 - 2 * pos));
  return [Math.max(B * (1 - SPREAD), target - B * WINDOW), Math.min(B * (1 + SPREAD), target + B * WINDOW)];
}

// ---------------- nombres ----------------
const out = {}, names = new Set(), sigs = { basic: new Set(), adv: new Set(), supreme: new Set() };
for (const p of Object.values(G.PASSIVES_COMMON)) names.add(p.n.toLowerCase());
const useName = (r, n) => {
  if (names.has(n.toLowerCase())) fail(`línea ${r}: nombre repetido «${n}»`);
  names.add(n.toLowerCase());
};

/** Valores para `ids` dentro de la banda de la línea y con firma nueva en su bandeja. */
function values(r, tier, ids) {
  const [lo, hi] = band(r);
  let v = fit(ids, (lo + hi) / 2, lo, hi);
  if (!v) { fail(`línea ${r}: ${ids} no alcanza ${lo.toFixed(2)}-${hi.toFixed(2)}`); return null; }
  const sig = w => signature(ids.map((id, i) => [id, w[i]]));
  if (sigs[tier].has(sig(v))) {                      // firma repetida: mover un valor y reequilibrar
    let found = null;
    const B = BUDGET[tier], maxMag = Math.max(...ids.map(id => tpl(id).max - tpl(id).min));
    // primero dentro de su banda; si no cabe, en todo el ±15 % de la bandeja
    for (const [a, b] of [[lo, hi], [B * (1 - SPREAD), B * (1 + SPREAD)]]) {
      for (let mag = 1; mag <= maxMag && !found; mag++) {
        for (let i = 0; i < ids.length && !found; i++) {
          for (const s of [1, -1]) {
            const w = v.slice(), t = tpl(ids[i]);
            w[i] = clamp(w[i] + s * mag, t.min, t.max);
            if (adjust(ids, w, a, b, i) && !sigs[tier].has(sig(w))) { found = w; break; }
          }
        }
      }
      if (found) break;
    }
    if (!found) { fail(`línea ${r}: no se pudo hacer única la firma`); return null; }
    v = found;
  }
  sigs[tier].add(sig(v));
  return ids.map((id, i) => [id, v[i]]);
}

/** Reglas de cualquier unique: plantillas que existen, sin repetir, de su bandeja o de una menor
 *  (y al menos una de la suya), 1-3 efectos y critDmg sólo con critChance. */
function check(r, tier, ids) {
  const bad = ids.filter(id => !tpl(id));
  if (bad.length) { fail(`línea ${r}: plantilla desconocida ${bad}`); return false; }
  if (ids.length < 1 || ids.length > 3) { fail(`línea ${r}: pide 1-3 efectos`); return false; }
  if (ids.length !== new Set(ids).size) { fail(`línea ${r}: plantilla repetida`); return false; }
  const over = ids.filter(id => tpl(id).tier && RANK[tpl(id).tier] > RANK[tier]);
  if (over.length) { fail(`línea ${r} (${tier}): ${over} es de una bandeja mayor`); return false; }
  if (!ids.some(id => tpl(id).tier === tier)) { fail(`línea ${r}: ningún efecto de la bandeja ${tier}`); return false; }
  if (ids.includes('critDmg') && !ids.includes('critChance')) { fail(`línea ${r}: critDmg sin critChance`); return false; }
  return true;
}

// ---------------- diseño a mano ----------------
for (const [k, d] of Object.entries(design)) {
  const r = +k, p = G.DEX_BY[r];
  if (!lineOf[r]) { fail(`passive_design.json: ${k} no es una forma base`); continue; }
  const tier = tierOf(p), [n, ...ids] = d;
  if (!check(r, tier, ids)) continue;
  const fx = values(r, tier, ids);
  if (!fx) continue;
  useName(r, n);
  out[r] = { n, tier, fx };
}
for (const r of ROOTS) {
  const p = G.DEX_BY[r];
  if (!design[r] && (lineOf[r].some(m => m.leg || m.starter) || tierOf(p) === 'supreme')) {
    fail(`línea ${r} ${p.name}: inicial, legendario, singular o supreme sin diseño a mano`);
  }
}

// ---------------- el resto: por tipo principal de la forma base ----------------
const PREF = {   // [plantillas basic (5), plantillas adv (3)]
  normal: [['coinBonus', 'xpBurst', 'startShield', 'speedOnKill', 'comebackHeal'], ['comboCharge', 'killHealPulse', 'dashOnHurt']],
  fire: [['burnTouch', 'deathBurst', 'critStreak', 'rangedBonus', 'speedOnKill'], ['killNova', 'executeLow', 'hurtNova']],
  water: [['comebackHeal', 'slowAura', 'rangedBonus', 'lifeSteal', 'startShield'], ['barrier', 'killHealPulse', 'hurtNova']],
  grass: [['thornAura', 'lifeSteal', 'comebackHeal', 'slowAura', 'xpBurst'], ['killHealPulse', 'orbitGuard', 'barrier']],
  electric: [['speedOnKill', 'rangedBonus', 'critStreak', 'deathBurst', 'xpBurst'], ['chainSpark', 'dashOnHurt', 'killNova']],
  ice: [['slowAura', 'critStreak', 'startShield', 'rangedBonus', 'thornAura'], ['barrier', 'executeLow', 'orbitGuard']],
  fighting: [['critStreak', 'lifeSteal', 'speedOnKill', 'comebackHeal', 'thornAura'], ['comboCharge', 'executeLow', 'hurtNova']],
  poison: [['thornAura', 'lifeSteal', 'slowAura', 'deathBurst', 'comebackHeal'], ['chainSpark', 'orbitGuard', 'executeLow']],
  ground: [['startShield', 'thornAura', 'deathBurst', 'slowAura', 'comebackHeal'], ['hurtNova', 'barrier', 'killNova']],
  flying: [['speedOnKill', 'rangedBonus', 'xpBurst', 'critStreak', 'coinBonus'], ['dashOnHurt', 'chainSpark', 'comboCharge']],
  psychic: [['xpBurst', 'rangedBonus', 'slowAura', 'startShield', 'critStreak'], ['orbitGuard', 'barrier', 'reviveOnce']],
  bug: [['speedOnKill', 'lifeSteal', 'deathBurst', 'xpBurst', 'thornAura'], ['comboCharge', 'killNova', 'chainSpark']],
  rock: [['startShield', 'thornAura', 'deathBurst', 'rangedBonus', 'comebackHeal'], ['hurtNova', 'barrier', 'reviveOnce']],
  ghost: [['lifeSteal', 'slowAura', 'deathBurst', 'critStreak', 'coinBonus'], ['orbitGuard', 'executeLow', 'reviveOnce']],
  dragon: [['critStreak', 'burnTouch', 'deathBurst', 'speedOnKill', 'lifeSteal'], ['executeLow', 'killNova', 'comboCharge']],
  dark: [['critStreak', 'coinBonus', 'lifeSteal', 'speedOnKill', 'deathBurst'], ['executeLow', 'dashOnHurt', 'comboCharge']],
  steel: [['startShield', 'thornAura', 'rangedBonus', 'comebackHeal', 'coinBonus'], ['barrier', 'hurtNova', 'orbitGuard']],
  fairy: [['comebackHeal', 'lifeSteal', 'slowAura', 'xpBurst', 'coinBonus'], ['killHealPulse', 'reviveOnce', 'barrier']]
};
const ADJ = {
  normal: ['Plain', 'Homely', 'Sturdy', 'Humble', 'Earnest', 'Patient', 'Faithful', 'Cheerful'],
  fire: ['Ember', 'Scorching', 'Smoldering', 'Searing', 'Kindled', 'Ashen', 'Fiery', 'Molten'],
  water: ['Tidal', 'Rippling', 'Brine', 'Misty', 'Flowing', 'Coral', 'Torrent', 'Drizzling'],
  grass: ['Verdant', 'Mossy', 'Leafy', 'Budding', 'Thorny', 'Rooted', 'Blooming', 'Sappy'],
  electric: ['Static', 'Crackling', 'Charged', 'Voltaic', 'Sparking', 'Humming', 'Jolting', 'Buzzing'],
  ice: ['Frosty', 'Glacial', 'Icy', 'Frigid', 'Snowy', 'Hoary', 'Wintry', 'Crystal'],
  fighting: ['Brawling', 'Gritty', 'Tenacious', 'Disciplined', 'Bruising', 'Valiant', 'Rugged', 'Iron-Willed'],
  poison: ['Toxic', 'Venomous', 'Noxious', 'Acrid', 'Festering', 'Caustic', 'Sludgy', 'Miasmic'],
  ground: ['Earthen', 'Dusty', 'Sandy', 'Muddy', 'Quaking', 'Burrowing', 'Loamy', 'Rumbling'],
  flying: ['Soaring', 'Windswept', 'Gusting', 'Airy', 'Feathered', 'Skyward', 'Breezy', 'Lofty'],
  psychic: ['Mindful', 'Telepathic', 'Dreaming', 'Lucid', 'Prescient', 'Hypnotic', 'Astral', 'Uncanny'],
  bug: ['Skittering', 'Chitinous', 'Swarming', 'Hive', 'Silken', 'Molting', 'Crawling', 'Droning'],
  rock: ['Craggy', 'Stony', 'Granite', 'Pebbled', 'Rocky', 'Boulder', 'Flinty', 'Jagged'],
  ghost: ['Spectral', 'Haunting', 'Ghostly', 'Eerie', 'Wraith', 'Phantom', 'Spooky', 'Hollow'],
  dragon: ['Draconic', 'Wyrm', 'Scaled', 'Ancient', 'Regal', 'Fanged', 'Mythic', 'Primal'],
  dark: ['Shadowy', 'Sinister', 'Moonless', 'Sly', 'Murky', 'Cunning', 'Nocturnal', 'Shady'],
  steel: ['Forged', 'Iron', 'Riveted', 'Polished', 'Chrome', 'Gleaming', 'Tempered', 'Steely'],
  fairy: ['Gleeful', 'Charming', 'Twinkling', 'Dreamy', 'Pixie', 'Sugary', 'Starry', 'Rosy']
};
const NOUN = {
  deathBurst: ['Burst', 'Blast', 'Eruption', 'Detonation', 'Pop'], lifeSteal: ['Leech', 'Drain', 'Siphon', 'Thirst', 'Bite'],
  thornAura: ['Thorns', 'Brambles', 'Spines', 'Barbs', 'Prickles'], speedOnKill: ['Dash', 'Chase', 'Rush', 'Sprint', 'Pursuit'],
  startShield: ['Ward', 'Guard', 'Shell', 'Bulwark', 'Aegis'], coinBonus: ['Fortune', 'Hoard', 'Purse', 'Trove', 'Luck'],
  xpBurst: ['Insight', 'Wisdom', 'Lesson', 'Study', 'Lore'], slowAura: ['Haze', 'Mire', 'Lull', 'Drag', 'Fog'],
  critStreak: ['Strike', 'Finisher', 'Rhythm', 'Cadence', 'Edge'], burnTouch: ['Touch', 'Scald', 'Brand', 'Singe', 'Scorch'],
  rangedBonus: ['Volley', 'Aim', 'Barrage', 'Sling', 'Shot'], comebackHeal: ['Rally', 'Recovery', 'Resolve', 'Mending', 'Rebound'],
  reviveOnce: ['Rebirth', 'Undying', 'Phoenix', 'Return', 'Encore'], killNova: ['Nova', 'Flash', 'Pulse', 'Shockwave', 'Flare'],
  hurtNova: ['Backlash', 'Recoil', 'Retort', 'Repulse', 'Outburst'], orbitGuard: ['Orbit', 'Halo', 'Satellites', 'Sentinels', 'Ring'],
  chainSpark: ['Chain', 'Arc', 'Relay', 'Link', 'Fork'], dashOnHurt: ['Escape', 'Evasion', 'Slip', 'Sidestep', 'Flight'],
  executeLow: ['Execution', 'Verdict', 'Reaper', 'Coup', 'Guillotine'], comboCharge: ['Combo', 'Momentum', 'Crescendo', 'Tempo', 'Streak'],
  killHealPulse: ['Feast', 'Harvest', 'Renewal', 'Bounty', 'Banquet'], barrier: ['Barrier', 'Screen', 'Bubble', 'Veil', 'Shroud']
};
const hash = n => (n * 2654435761) >>> 0;

/** «Adjetivo Sustantivo» libre: adjetivos de su tipo, sustantivos de su primer efecto (o del segundo). */
function nameFor(r, type, ids) {
  const adj = ADJ[type], h = hash(r);
  for (const id of ids) {
    const nouns = NOUN[id];
    for (let k = 0; k < adj.length * nouns.length; k++) {
      const n = adj[(h + k) % adj.length] + ' ' + nouns[Math.floor((h + k) / adj.length) % nouns.length];
      if (!names.has(n.toLowerCase())) return n;
    }
  }
  return null;
}

for (const r of ROOTS.filter(r => !out[r] && !design[r])) {
  const p = G.DEX_BY[r], tier = tierOf(p), type = p.types[0], [basic, adv] = PREF[type], h = hash(r);
  if (tier === 'supreme') continue;                  // ya avisado arriba
  let ids;
  if (tier === 'basic') {
    const i = h % basic.length, j = (i + 1 + (Math.floor(h / basic.length) % (basic.length - 1))) % basic.length;
    ids = [basic[i], basic[j]];
  } else ids = [adv[h % adv.length], basic[Math.floor(h / adv.length) % basic.length]];
  if (!check(r, tier, ids)) continue;
  const fx = values(r, tier, ids);
  const n = fx && nameFor(r, type, ids);
  if (!n) { if (fx) fail(`línea ${r}: sin nombre libre`); continue; }
  useName(r, n);
  out[r] = { n, tier, fx };
}

if (errors.length) { console.error(errors.join('\n')); console.error(`\n${errors.length} errores`); process.exit(1); }

const lines = ROOTS.map(r => `  ${r}:${JSON.stringify(out[r])}`);
fs.writeFileSync(path.join(root, 'js/data/passives.js'),
`/* ============ passives.js — GENERADO por tools/gen_passives.js, no editar a mano ============
 * G.PASSIVES_UNIQUE[dexBase] = { n: nombre, tier: 'basic'|'adv'|'supreme', fx: [[plantilla, valor], ...] }
 * Una por línea evolutiva (su forma base: G.Mons.lineage). Se abre a 3★ (G.Rank) y la usa
 * G.AbilityFX.of junto a la común de su tipo (data/passives-common.js). Las plantillas están en
 * js/data/passive-unique-fx.js y js/data/passive-fx.js. Textos sólo en inglés.
 */
G.PASSIVES_UNIQUE = {
${lines.join(',\n')}
};
`);

for (const t of Object.keys(TIERS)) {
  const w = ROOTS.filter(r => out[r].tier === t).map(r => power(out[r].fx));
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  console.log(`${t}: ${w.length} líneas · presupuesto ${BUDGET[t]} (±15 %: ${(BUDGET[t] * 0.85).toFixed(2)}-${(BUDGET[t] * 1.15).toFixed(2)})` +
    ` · poder mín ${Math.min(...w)} · media ${mean.toFixed(2)} · máx ${Math.max(...w)} · a mano ${ROOTS.filter(r => out[r].tier === t && design[r]).length}`);
}
