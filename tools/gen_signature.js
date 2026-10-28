#!/usr/bin/env node
/* Genera js/data/signature-moves.js: el movimiento especial de cada especie rara (G.SIG).
 *
 *   node tools/gen_signature.js              escribe js/data/signature-moves.js
 *   node tools/gen_signature.js --worksheet  tabla de los legendarios (dex, nombre, tipos, bst) para tools/signature_design.json
 *
 * - Legendarios (87): tools/signature_design.json, a mano ({ name, kind, fx, v }).
 * - Resto (Mega y pseudolegendarios): plantilla por tipo (TEMPLATE) y un nombre del banco NAMES.
 * - El daño NO se escribe a mano: se calcula para que dps × POWER[fx](v) = SIG_POWER × mediana de los movimientos normales
 *   (G.Moves.dps / median, ver js/data/moves.js). El resto de parámetros del kind se copian del primer movimiento normal de ese kind.
 */
const fs = require('node:fs');
const path = require('node:path');
const { speciesList } = require('./sig_species.js');
const root = path.join(__dirname, '..');

// Qué hace cada kind, en una frase (la descripción es esta frase + el texto de la mecánica de SigFX).
const KIND_TEXT = {
  projectile: 'A heavy shot at the nearest foe.', homing: 'Seeking shots that chase foes.', bounce: 'A shot that ricochets between foes.',
  boomerang: 'A blade that flies out and comes back.', cone: 'A wide blast in front of you.', nova: 'A burst in every direction.',
  orbit: 'Orbs that circle you.', melee: 'A mighty swing in a wide arc.', dash: 'You charge through everything in your path.',
  spin: 'A spinning strike all around you.', beam: 'A piercing beam.', chain: 'A strike that arcs from foe to foe.',
  charge: 'Charges for a moment, then fires a huge beam.', aura: 'A field of power around you.', quake: 'A shockwave rolls across the ground.',
  vortex: 'A whirlpool that draws foes in and damages them.', shove: 'A shockwave that damages and pushes foes away.',
  stun: 'A marked zone that damages and stuns.', mine: 'Traps that explode when stepped on.', meteor: 'Meteors rain down on foes.',
  turret: 'Leaves a guardian that fires on its own.', trail: 'Leaves damaging patches behind you.'
};

// Plantillas del resto de especies: opciones [kind, fx, v] por tipo (se alternan por orden de dex dentro del tipo).
const TEMPLATE = {
  grass: [['melee', 'drain', 4], ['nova', 'poison', 2]],
  fire: [['cone', 'burn', 2], ['meteor', 'splash', 45]],
  water: [['vortex', 'slow', 35], ['beam', 'knock', 140]],
  bug: [['bounce', 'chain', 35], ['dash', 'stun', 15]],
  normal: [['projectile', 'surgeHaste', 140], ['shove', 'knock', 110]],
  electric: [['chain', 'stun', 15], ['beam', 'surgeCrit', 130]],
  fairy: [['homing', 'drain', 4], ['aura', 'slow', 30]],
  psychic: [['beam', 'execute', 70], ['homing', 'surgeAtk', 110]],
  ghost: [['dash', 'drain', 4], ['vortex', 'pull', 120]],
  rock: [['meteor', 'bossbane', 45], ['quake', 'knock', 130]],
  dragon: [['cone', 'execute', 60], ['dash', 'bossbane', 55], ['beam', 'burn', 2]],
  steel: [['melee', 'bossbane', 50], ['shove', 'stun', 18]],
  dark: [['spin', 'execute', 60], ['dash', 'surgeCrit', 130]],
  fighting: [['melee', 'surgeAtk', 110], ['dash', 'knock', 120]],
  ice: [['nova', 'slow', 40], ['beam', 'stun', 15]],
  ground: [['quake', 'pull', 130], ['melee', 'execute', 60]],
  poison: [['cone', 'poison', 3]],
  flying: [['homing', 'surgeHaste', 120]]
};
const NAMES = {
  grass: ['Vine Lash', 'Thorn Barrage', 'Verdant Surge', 'Bloom Burst', 'Canopy Crash', 'Spore Cyclone', 'Ironwood Smash', 'Seed Salvo'],
  fire: ['Inferno Charge', 'Ember Lance', 'Magma Burst', 'Flare Barrage', 'Scorch Wave'],
  water: ['Tidal Slam', 'Torrent Blade', 'Riptide Rush', 'Brine Barrage', 'Hydro Whirl', 'Maelstrom Crash', 'Wave Cutter', 'Deep Current', 'Surf Fang'],
  bug: ['Stinger Volley', 'Pincer Storm', 'Swarm Rush', 'Chitin Slash', 'Scarab Charge', 'Hive Burst'],
  normal: ['Hyper Rush', 'Power Slam', 'Boundless Strike', 'Crescent Kick', 'Gale Talon', 'Mighty Bash', 'Echo Cry'],
  electric: ['Volt Crash', 'Static Burst', 'Surge Beam', 'Arc Lash'],
  fairy: ['Moonbeam', 'Glimmer Burst'],
  psychic: ['Mind Lance', 'Psyche Wave', 'Dream Pulse', 'Aura Break', 'Echo Mind'],
  ghost: ['Spectral Claw', 'Night Haunt', 'Wisp Barrage'],
  rock: ['Boulder Crush', 'Fossil Slash', 'Tectonic Shatter', 'Gem Barrage'],
  dragon: ['Draco Surge', 'Wyrm Fang', 'Scale Storm', 'Dragon Roar', 'Cragged Rush', 'Twilight Drake', 'Sky Raze', 'Rift Maw', 'Frost Wyrm', 'Ruin Bloom'],
  steel: ['Iron Rend', 'Gear Smash', 'Meteor Hammer', 'Alloy Strike', 'Cannon Burst', 'Diamond Edge'],
  dark: ['Shadow Fang', 'Night Raid', 'Malice Wave', 'Dusk Slash', 'Umbral Pounce', 'Void Claw'],
  fighting: ['Rising Fist', 'Dojo Combo', 'Aura Crush', 'Mountain Strike'],
  ice: ['Frost Veil', 'Blizzard Fang'],
  ground: ['Quake Smash', 'Sand Drill'],
  poison: ['Venom Torrent'],
  flying: ['Sky Talon']
};

// Aspecto por tipo (formas de js/entities/vfx-shapes-*.js): proj = proyectil/orbe/nova, beam = lo que viaja por el rayo,
// aura = partícula del aura, melee = golpe, trail = estela. Cada kind usa sólo los campos que dibuja (ver combat.js).
const LOOK = {
  fire: { proj: 'fire_comet', beam: 'fire', aura: 'fire_ring', melee: 'impact', trail: 'ember' },
  water: { proj: 'water_wave', beam: 'water_jet', aura: 'water_swirl', melee: 'impact', trail: 'drip' },
  grass: { proj: 'grass_petal', beam: 'grass_thorn', aura: 'grass_seed', melee: 'vine' },
  electric: { proj: 'elec_orb', beam: 'lightning', aura: 'elec_spark', melee: 'impact', trail: 'spark' },
  psychic: { proj: 'psy_orb', beam: 'psy_wave', aura: 'psy_eye', melee: 'impact', trail: 'wisp' },
  ice: { proj: 'ice_crystal', beam: 'ice_spike', aura: 'ice_flake', melee: 'claw' },
  fighting: { proj: 'fight_wave', beam: 'fight_shock', aura: 'fight_fist', melee: 'fight_fist' },
  poison: { proj: 'poison_glob', beam: 'poison_fang', aura: 'poison_skull', melee: 'jaws', trail: 'bubbles' },
  ground: { proj: 'ground_clod', beam: 'ground_spike', aura: 'ground_wave', melee: 'impact', trail: 'dirt' },
  flying: { proj: 'fly_swirl', beam: 'fly_slash', aura: 'fly_feather', melee: 'feather' },
  bug: { proj: 'bug_swarm', beam: 'bug_stinger', aura: 'bug_wing', melee: 'jaws' },
  rock: { proj: 'rock_boulder', beam: 'rock_chip', aura: 'rock_chip', melee: 'impact', trail: 'dirt' },
  ghost: { proj: 'ghost_flame', beam: 'ghost_face', aura: 'ghost_soul', melee: 'impact', trail: 'wisp' },
  dragon: { proj: 'dragon_flame', beam: 'dragon_flame', aura: 'dragon_scale', melee: 'dragon_claw', trail: 'ember' },
  dark: { proj: 'dark_orb', beam: 'dark_slash', aura: 'dark_claw', melee: 'dark_slash' },
  steel: { proj: 'steel_blade', beam: 'steel_bolt', aura: 'steel_gear', melee: 'steel_gear', trail: 'spark' },
  fairy: { proj: 'fairy_sparkle', beam: 'fairy_ribbon', aura: 'fairy_moon', melee: 'fairy_ribbon' },
  normal: { proj: 'norm_star', beam: 'norm_streak', aura: 'norm_swirl', melee: 'impact' }
};
function lookOf(type, kind) {
  const l = LOOK[type];
  if (kind === 'melee' || kind === 'spin') return { melee: l.melee };
  if (kind === 'beam' || kind === 'chain') return { beam: l.beam };
  if (kind === 'charge') return { beam: l.beam, proj: l.proj };
  if (kind === 'aura') return { aura: l.aura };
  return l.trail ? { proj: l.proj, trail: l.trail } : { proj: l.proj };
}

function loadGame() {
  const G = { U: { TYPE_COLOR: {}, TYPE_NAME: {} }, I18n: { add() {}, f: s => s }, EnemyMgr: { queryCircle: () => [] } };
  for (const f of ['js/data/moves.js', 'js/data/sigfx.js']) new Function('G', fs.readFileSync(path.join(root, f), 'utf8'))(G);
  return G;
}

const STRIP = ['id', 'name', 'type', 'desc', 'cat', 'ups', 'maxLvl', 'burn', 'poison', 'slow', 'drain'];

/** @returns {string} el contenido de js/data/signature-moves.js */
function build() {
  const G = loadGame(), M = G.Moves, FX = G.SigFX;
  const design = JSON.parse(fs.readFileSync(path.join(__dirname, 'signature_design.json'), 'utf8'));
  const list = speciesList();
  const target = M.SIG_POWER * M.median();
  const refOf = {};
  for (const m of M.ALL) if (m.kind !== 'buff' && !refOf[m.kind]) refOf[m.kind] = m;
  const used = new Set(), nth = {};
  const out = {}, look = {};

  for (const s of list) {
    let pick;
    if (s.why === 'legend') {
      pick = design[s.dex];
      if (!pick) throw new Error('falta el diseño del legendario ' + s.dex + ' ' + s.name);
    } else {
      const opts = TEMPLATE[s.type], names = NAMES[s.type];
      if (!opts || !names) throw new Error('sin plantilla para el tipo ' + s.type);
      const i = nth[s.type] = (nth[s.type] || 0) + 1, [kind, fx, v0] = opts[(i - 1) % opts.length];
      if (i > names.length) throw new Error('faltan nombres para el tipo ' + s.type);
      const f = FX.FX[fx], v = s.why === 'pseudo' ? Math.min(f.max, Math.round(v0 * 1.15)) : v0;
      pick = { name: names[i - 1], kind, fx, v };
    }
    const ref = refOf[pick.kind];
    if (!ref) throw new Error(`${s.dex}: kind desconocido ${pick.kind}`);
    if (!FX.FX[pick.fx]) throw new Error(`${s.dex}: fx desconocido ${pick.fx}`);
    if (used.has(pick.name)) throw new Error('nombre repetido: ' + pick.name);
    used.add(pick.name);

    const def = {};
    for (const k of Object.keys(ref)) if (!STRIP.includes(k)) def[k] = ref[k];
    Object.assign(def, { id: 'sig-' + s.dex, name: pick.name, type: s.type, kind: pick.kind });
    def.desc = `${KIND_TEXT[pick.kind]} ${FX.FX[pick.fx].text(pick.v)}`;
    def.cat = s.sa > s.pa ? 'special' : 'physical';                  // el lado fuerte de la especie (como Stats.sideOf)
    def.sig = { fx: pick.fx, v: pick.v };
    def.rare = s.why;
    const unit = M.dps(Object.assign({}, def, { dmg: 1 })) * FX.POWER[pick.fx](pick.v);
    def.dmg = Math.max(0.5, Math.round(target / unit * 10) / 10);
    // orden de claves estable: identificación primero
    const ordered = {};
    for (const k of ['id', 'name', 'type', 'kind', 'rare', 'cat', 'desc', 'cd', 'dmg']) if (k in def) ordered[k] = def[k];
    for (const k of Object.keys(def)) if (!(k in ordered)) ordered[k] = def[k];
    out[s.dex] = ordered;
    look['sig-' + s.dex] = lookOf(s.type, pick.kind);
  }

  const body = Object.keys(out).map(Number).sort((a, b) => a - b).map(d => `  ${d}: ${JSON.stringify(out[d])}`).join(',\n');
  return `/* ============ signature-moves.js — GENERADO por tools/gen_signature.js, no editar a mano ============
 * El movimiento especial de cada especie rara (legendarios, con Mega y pseudolegendarios): G.SIG[dex].
 * Se desbloquea con Rank 5★ y va en el hueco 5 (ver Player.syncSignature). Los registra G.Moves.register: están en
 * G.Moves.BY_ID pero no en ALL ni en POOL (no salen en las cartas de nivel).
 * El daño sale de SIG_POWER × mediana (js/data/moves.js) y la mecánica propia es de js/data/sigfx.js.
 * Debe cargarse DESPUÉS de moves.js y sigfx.js. Textos sólo en inglés.
 */
G.SIG = {
${body}
};
for (const d of Object.values(G.SIG)) G.Moves.register(d);

/** El movimiento especial de la especie \`dex\` (las Mega usan el de su especie base), o null. */
G.SIG_OF = dex => G.SIG[G.MEGA_FROM && G.MEGA_FROM[dex] != null ? G.MEGA_FROM[dex] : dex] || null;

/** Su aspecto (G.VFX.MOVE): lo registra js/entities/vfx-shapes-2.js, que se carga después. */
G.SIG_VFX = {
${Object.keys(look).map(id => `  '${id}': ${JSON.stringify(look[id])}`).join(',\n')}
};
`;
}

if (require.main === module) {
  if (process.argv.includes('--worksheet')) {
    const design = JSON.parse(fs.readFileSync(path.join(__dirname, 'signature_design.json'), 'utf8'));
    for (const s of speciesList().filter(x => x.why === 'legend')) {
      console.log([s.dex, s.name, s.types.join('/'), s.bst, design[s.dex] ? design[s.dex].name : '(sin diseño)'].join('\t'));
    }
  } else {
    const file = path.join(root, 'js', 'data', 'signature-moves.js');
    fs.writeFileSync(file, build());
    console.log('js/data/signature-moves.js:', speciesList().length, 'movimientos especiales');
  }
}

module.exports = { build };
