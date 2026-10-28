const { test } = require('node:test');
const assert = require('node:assert/strict');
const { world } = require('./helpers/vfx-world.cjs');

const CORE = 'js/entities/vfx.js';
const TYPES = ['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy', 'normal'];

// ---------------- núcleo: add / addMoves / hitFor / forMove ----------------

test('add registers shapes and draw falls back to ball for unknown shape', () => {
  const G = world(CORE);
  G.VFX.add({ t1: { w: 3, h: 3, frames: 4, gen(P) { P.set(1, 1, 'm'); } } });
  const cv = G.VFX.sprite('t1', 'fire', 3);
  assert.equal(cv.width, 3);
  assert.equal(cv.height, 3);
  assert.equal(G.VFX.frames('t1'), 4);
  assert.doesNotThrow(() => G.VFX.sprite('no-such', 'fire', 0));
  assert.doesNotThrow(() => G.VFX.sprite('t1', 'no-such-pal', 0));
});

test('addMoves replaces whole entries and invalidates the forMove cache', () => {
  const G = world(CORE);
  const m = { id: 'ember', type: 'fire' };
  assert.equal(G.VFX.forMove(m).proj, 'fire');
  assert.equal(G.VFX.forMove(m).trail, 'ember');
  G.VFX.addMoves({ ember: { proj: 'ball' } });
  assert.equal(G.VFX.forMove(m).proj, 'ball');
  assert.equal(G.VFX.forMove(m).trail, undefined);
});

test('forMove is memoised, frozen and carries hit', () => {
  const G = world(CORE);
  const m = { id: 'ember', type: 'fire' };
  assert.equal(G.VFX.forMove(m), G.VFX.forMove(m));
  assert.ok(Object.isFrozen(G.VFX.forMove(m)));
  assert.equal(G.VFX.forMove(m).hit, 'burn');
  assert.equal(G.VFX.hitFor({ id: 'zzz', type: 'water' }), 'splash');
  assert.equal(G.VFX.hitFor({ id: 'zzz', type: 'nope' }), null);
  G.VFX.addMoves({ ember: { proj: 'fire', hit: 'blaze' } });
  assert.equal(G.VFX.hitFor(m), 'blaze');
});

test('TYPE_HIT covers all 18 types', () => {
  const G = world(CORE);
  assert.deepEqual(Object.keys(G.VFX.TYPE_HIT).sort(), [...TYPES].sort());
  assert.deepEqual(Object.keys(G.VFX.TYPE_SHAPE).sort(), [...TYPES].sort());
});

// ---------------- G.FX.hit ----------------

const FX = ['js/entities/vfx.js', 'js/entities/fx.js'];

test('every hit kind adds something and never throws', () => {
  const G = world(...FX);
  assert.equal(G.FX.HIT_KINDS.length, 24);
  for (const kind of G.FX.HIT_KINDS) {
    G.FX.clear();
    assert.doesNotThrow(() => G.FX.hit(kind, 'fire', 100, 100), kind);
    assert.ok(G.FX.count > 0, kind);
  }
});

test('every TYPE_HIT value is an implemented kind', () => {
  const G = world(...FX);
  for (const k of Object.values(G.VFX.TYPE_HIT)) assert.ok(G.FX.HIT_KINDS.includes(k), k);
});

test('hit ignores unknown kind and bad coordinates', () => {
  const G = world(...FX);
  G.FX.clear();
  for (const k of [undefined, null, 'nope', 'constructor', '__proto__']) G.FX.hit(k, 'fire', 1, 1);
  G.FX.hit('burn', 'fire', NaN, 1);
  G.FX.hit('burn', 'fire', 1, undefined);
  assert.equal(G.FX.count, 0);
  G.Camera.sees = () => false;
  G.FX.hit('burn', 'fire', 1, 1);
  assert.equal(G.FX.count, 0);
});

test('hit with an unknown palette still draws (falls back to normal)', () => {
  const G = world(...FX);
  G.FX.clear();
  assert.doesNotThrow(() => G.FX.hit('burn', 'no-such-pal', 5, 5));
  assert.ok(G.FX.count > 0);
});

test('per-frame budget caps hits and update restores it', () => {
  const G = world(...FX);
  G.Settings.fx = 0;
  G.FX.clear();
  for (let i = 0; i < 500; i++) G.FX.hit('blaze', 'fire', 1, 1);
  const first = G.FX.count;
  assert.ok(first > 0 && first <= 4 * 8, 'count ' + first);
  G.FX.update(0.001);
  G.FX.hit('blaze', 'fire', 1, 1);
  assert.ok(G.FX.count > first);
});

// ---------------- hojas de formas (vfx-shapes-*.js) ----------------

const SHAPES_1 = ['fire_comet', 'fire_ring', 'fire_pillar', 'water_wave', 'water_swirl', 'water_jet',
  'grass_petal', 'grass_thorn', 'grass_seed', 'elec_orb', 'elec_arc', 'elec_spark', 'ice_crystal', 'ice_flake',
  'ice_spike', 'ground_clod', 'ground_spike', 'ground_wave', 'rock_boulder', 'rock_chip', 'steel_blade',
  'steel_gear', 'steel_bolt', 'fight_fist', 'fight_wave', 'fight_shock'];
const TRAILS = ['ember', 'drip', 'spark', 'bubbles', 'dirt', 'wisp'];
const SHAPELESS = ['lightning'];                 // beam especial que no es una forma
const MELEE_BUILTIN = ['vine', 'feather'];       // golpes de hojas que dibuja fx.slash

function shapeSuite(label, names, ownMoves) {
  // Los movimientos de una hoja pueden usar formas de la otra (p. ej. un buff de lucha con la espada de acero).
  const load = () => world('js/entities/vfx.js', 'js/entities/vfx-shapes-1.js', 'js/entities/vfx-shapes-2.js');

  test(`${label} registers its shapes with 4-6 frames`, () => {
    const G = load();
    for (const n of names) {
      assert.ok(G.VFX.SHAPES[n], n + ' missing');
      const fr = G.VFX.frames(n);
      assert.ok(fr >= 4 && fr <= 6, `${n} frames ${fr}`);
    }
  });

  test(`${label} shapes draw something on every frame and palette`, () => {
    const G = load();
    for (const n of names) for (const pal of Object.keys(G.VFX.PAL)) for (let f = 0; f < G.VFX.frames(n); f++) {
      assert.ok(G.VFX.sprite(n, pal, f).calls.length > 0, `${n} ${pal} f${f} is empty`);
    }
  });

  test(`${label} animations change between frames and loop`, () => {
    const G = load();
    for (const n of names) {
      const fr = G.VFX.frames(n), keys = [];
      for (let f = 0; f < fr; f++) keys.push(G.VFX.sprite(n, 'fire', f).calls.join('|'));
      assert.notEqual(keys[0], keys[1], n + ' frame 0 == 1');
      assert.ok(new Set(keys).size >= 2, n);
      assert.equal(G.VFX.sprite(n, 'fire', fr).calls.join('|'), keys[0], n + ' does not loop');
    }
  });

  test(`${label} moves only name shapes, trails and melee kinds that exist`, () => {
    const G = load();
    const known = s => G.VFX.SHAPES[s] || SHAPELESS.includes(s);
    for (const id of ownMoves) {
      const v = G.VFX.MOVE[id];
      assert.ok(v, id + ' has no entry');
      for (const k of ['proj', 'beam', 'aura', 'buff']) if (v[k]) assert.ok(known(v[k]), `${id}.${k}=${v[k]}`);
      if (v.melee) assert.ok(G.VFX.SHAPES[v.melee] || MELEE_BUILTIN.includes(v.melee), `${id}.melee=${v.melee}`);
      if (v.trail) assert.ok(TRAILS.includes(v.trail), `${id}.trail=${v.trail}`);
      if (v.pal) assert.ok(G.VFX.PAL[v.pal], `${id}.pal=${v.pal}`);
    }
  });
}

const MOVES_1 = ['ember', 'flamethrower', 'fire-spin', 'heat-wave', 'will-o-wisp', 'flame-wheel', 'flame-charge',
  'water-gun', 'bubble', 'hydro-pump', 'aqua-ring', 'bubble-beam', 'whirlpool',
  'vine-whip', 'razor-leaf', 'leaf-storm', 'giga-drain', 'seed-bomb', 'energy-ball', 'solar-beam',
  'thunder-shock', 'discharge', 'thunderbolt', 'thunder-wave', 'electro-ball',
  'ice-beam', 'powder-snow', 'hail', 'ice-shard', 'freeze-dry',
  'mud-shot', 'bulldoze', 'bonemerang', 'spikes', 'sand-tomb', 'magnitude',
  'rock-throw', 'rock-slide', 'rock-tomb', 'ancient-power', 'power-gem',
  'metal-claw', 'flash-cannon', 'meteor-mash', 'mirror-shot', 'gyro-ball',
  'karate-chop', 'aura-sphere', 'rolling-kick', 'vacuum-wave', 'dynamic-punch',
  'bulk-up', 'iron-defense', 'rock-polish', 'ingrain', 'volt-charge'];
shapeSuite('shapes-1', SHAPES_1, MOVES_1);

const SHAPES_2 = ['poison_glob', 'poison_skull', 'poison_fang', 'fly_feather', 'fly_slash', 'fly_swirl',
  'bug_stinger', 'bug_wing', 'bug_swarm', 'ghost_soul', 'ghost_face', 'ghost_flame', 'dragon_claw', 'dragon_flame',
  'dragon_scale', 'dark_claw', 'dark_orb', 'dark_slash', 'fairy_sparkle', 'fairy_ribbon', 'fairy_moon', 'psy_eye',
  'psy_wave', 'psy_orb', 'norm_swirl', 'norm_streak', 'norm_star'];
const MOVES_2 = ['sludge', 'poison-sting', 'toxic', 'toxic-spikes', 'acid-spray',
  'gust', 'wing-attack', 'aerial-ace', 'whirlwind', 'air-slash',
  'bug-bite', 'string-shot', 'bug-buzz', 'signal-beam', 'u-turn',
  'lick', 'shadow-ball', 'hex', 'shadow-sneak', 'ominous-wind',
  'dragon-rage', 'dragon-dance', 'dragon-breath', 'dragon-claw', 'outrage',
  'bite', 'dark-pulse', 'night-shade', 'sucker-punch', 'night-slash',
  'fairy-wind', 'dazzling-gleam', 'draining-kiss', 'play-rough', 'disarming-voice',
  'confusion', 'psybeam', 'psychic', 'psycho-cut', 'extrasensory', 'mist-ball',
  'tackle', 'quick-attack', 'swords-dance', 'nasty-plot', 'agility', 'harden', 'body-slam', 'hyper-voice',
  'substitute', 'hyper-beam', 'rapid-spin',
  'calm-mind', 'hone-claws', 'focus-energy', 'laser-focus', 'life-dew'];
shapeSuite('shapes-2', SHAPES_2, MOVES_2);

// ---------------- cobertura de los 103 movimientos ----------------

function fullWorld() {
  const G = world('js/data/moves.js', 'js/entities/vfx.js', 'js/entities/vfx-shapes-1.js', 'js/entities/vfx-shapes-2.js', 'js/entities/fx.js');
  return G;
}

test('every move has a MOVE entry and no MOVE entry is orphaned', () => {
  const G = fullWorld();
  assert.equal(G.Moves.ALL.length, 113);
  const ids = new Set(G.Moves.ALL.map(m => m.id));
  for (const id of ids) assert.ok(G.VFX.MOVE[id], id + ' has no MOVE entry');
  for (const id of Object.keys(G.VFX.MOVE)) assert.ok(ids.has(id), id + ' is not a move');
});

test('every shape, palette and hit kind a move resolves to exists', () => {
  const G = fullWorld();
  for (const m of G.Moves.ALL) {
    const v = G.VFX.forMove(m);
    assert.ok(G.VFX.SHAPES[v.proj], `${m.id}.proj=${v.proj}`);
    for (const k of ['beam', 'aura', 'buff']) if (v[k] && v[k] !== 'lightning') assert.ok(G.VFX.SHAPES[v[k]], `${m.id}.${k}=${v[k]}`);
    if (v.melee) assert.ok(G.VFX.SHAPES[v.melee] || MELEE_BUILTIN.includes(v.melee), `${m.id}.melee=${v.melee}`);
    assert.ok(G.VFX.PAL[v.pal], `${m.id}.pal=${v.pal}`);
    assert.ok(G.FX.HIT_KINDS.includes(v.hit), `${m.id}.hit=${v.hit}`);
  }
});

// Qué campos de MOVE se ven de verdad según el `kind` (combat.js): lo demás no cuenta como diferencia.
const SHOWN = {
  melee: ['melee', 'hit', 'pal'], spin: ['melee', 'hit', 'pal'],
  beam: ['beam', 'hit', 'pal'], chain: ['beam', 'hit', 'pal'], charge: ['beam', 'proj', 'hit', 'pal'],
  aura: ['aura', 'rise', 'inward', 'hit', 'pal'], buff: ['buff', 'pal']
};
const SHOWN_DEFAULT = ['proj', 'trail', 'aura', 'hit', 'pal'];

test('no two moves of the same type look identical', () => {
  const G = fullWorld();
  const seen = new Map();
  for (const m of G.Moves.ALL) {
    const v = G.VFX.forMove(m);
    const key = m.type + '|' + m.kind + '|' + JSON.stringify((SHOWN[m.kind] || SHOWN_DEFAULT).map(k => v[k] || null));
    assert.ok(!seen.has(key), `${m.id} looks the same as ${seen.get(key)}`);
    seen.set(key, m.id);
  }
});
