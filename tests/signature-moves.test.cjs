const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function moves() {
  const G = { U: { TYPE_COLOR: {}, TYPE_NAME: {} }, I18n: { add() {}, f: s => s } };
  new Function('G', source('js/data/moves.js'))(G);
  return G;
}

// ---------------- Task 1: dps, median, register ----------------

test('dps is damage x hits x area / cooldown, and zero for buffs', () => {
  const G = moves(), M = G.Moves;
  const ember = M.BY_ID.ember;
  assert.equal(M.dps(ember), ember.dmg * 1 * M.AREA.projectile / ember.cd);
  const nova = M.BY_ID['heat-wave'];
  assert.equal(M.dps(nova), nova.dmg * nova.count * M.AREA.nova / nova.cd);
  const orbit = M.BY_ID['fire-spin'];
  assert.equal(M.dps(orbit), orbit.dmg * (orbit.count || 1) * M.AREA.orbit / 0.34);
  assert.equal(M.dps(M.BY_ID['swords-dance']), 0);
});

test('dps grows with the move level', () => {
  const M = moves().Moves;
  for (const id of ['ember', 'tackle', 'ice-beam', 'heat-wave']) {
    const d = M.BY_ID[id];
    assert.ok(M.dps(d, 5) > M.dps(d, 1), id);
  }
});

test('AREA covers every non-buff kind used by a move', () => {
  const M = moves().Moves;
  for (const m of M.ALL) if (m.kind !== 'buff') assert.ok(M.AREA[m.kind] > 0, m.id + ' kind ' + m.kind);
});

test('median is the median of the damage moves and SIG_POWER is 4', () => {
  const M = moves().Moves;
  const xs = M.ALL.filter(m => m.kind !== 'buff').map(m => M.dps(m)).sort((a, b) => a - b);
  assert.equal(xs.length, 97);
  const mid = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  assert.equal(M.median(), mid);
  assert.ok(M.median() > xs[0] && M.median() < xs[xs.length - 1]);
  assert.equal(M.SIG_POWER, 4);
});

test('register adds to BY_ID only, never to ALL or POOL, and refuses buffs and duplicates', () => {
  const M = moves().Moves;
  const n = M.ALL.length, pool = M.POOL.fire.length;
  const def = { id: 'sig-test', name: 'Test Move', type: 'fire', kind: 'melee', desc: 'x', cd: 1, dmg: 50, radius: 80, arc: 2, cat: 'special' };
  const r = M.register(def);
  assert.equal(M.BY_ID['sig-test'], r);
  assert.equal(r.maxLvl, r.ups.length + 1);
  assert.equal(M.ALL.length, n);
  assert.equal(M.POOL.fire.length, pool);
  assert.ok(!M.POOL.fire.includes('sig-test') && !M.POOL.normal.includes('sig-test'));
  assert.throws(() => M.register(Object.assign({}, def)), /duplicate|exists/i);
  assert.throws(() => M.register({ id: 'sig-buff', name: 'B', type: 'fire', kind: 'buff', cd: 1, stat: 'atk', amount: 0.1, dur: 8, stacks: 5 }), /buff/i);
  // un movimiento registrado se puede instanciar y subir de nivel como cualquier otro
  const inst = M.instance('sig-test', 2);
  assert.equal(inst.lvl, 2);
  assert.ok(inst.dmg > 50);
});

// ---------------- Task 1: lista de especies ----------------

test('the species list is built from the game data: legends, Mega species and pseudo-legendaries', () => {
  const { speciesList } = require('../tools/sig_species.js');
  const list = speciesList();
  const by = w => list.filter(s => s.why === w);
  assert.equal(by('legend').length, 87);
  assert.equal(by('mega').length, 74);
  assert.equal(by('pseudo').length, 10);
  assert.equal(list.length, 171);
  assert.equal(new Set(list.map(s => s.dex)).size, list.length, 'no duplicates');
  assert.deepEqual(list.map(s => s.dex), [...list.map(s => s.dex)].sort((a, b) => a - b), 'sorted by dex');
  for (const s of list) assert.ok(s.type && s.bst > 0, s.dex);
  assert.ok(by('legend').every(s => s.dex < 10000), 'no Mega forms');
  const mewtwo = list.find(s => s.dex === 150);
  assert.equal(mewtwo.why, 'legend', 'Mewtwo is a legend even though it has Megas');
  assert.equal(list.find(s => s.dex === 6).why, 'mega');
  assert.ok(by('pseudo').every(s => s.bst >= 580));
});

// ---------------- Task 2: SigFX ----------------

function sigWorld(pl, enemies) {
  const G = { U: { TYPE_COLOR: { fire: '#ff6a1f' } } };
  G.EnemyMgr = { queryCircle: (x, y, r) => enemies.filter(e => Math.hypot(e.x - x, e.y - y) <= r) };
  new Function('G', source('js/data/sigfx.js'))(G);
  return G;
}

function foe(x, y, o = {}) {
  const e = Object.assign({ x, y, hp: 100, maxHp: 100, boss: false, dead: false, kx: 0, ky: 0, hits: [], calls: [] }, o);
  e.hurt = (d, col, dx, dy, kn) => { e.hits.push(d); };
  e.applySlow = f => e.calls.push(['slow', f]);
  e.applyBurn = n => e.calls.push(['burn', n]);
  e.applyPoison = n => e.calls.push(['poison', n]);
  e.applyStun = d => e.calls.push(['stun', d]);
  return e;
}
const player = () => ({ x: 0, y: 0, maxHp: 1000, healed: [], heal(n, quiet) { this.healed.push(n); this.quiet = quiet; }, buffsAdded: [],
                        addBuff(...a) { this.buffsAdded.push(a); } });
const mv = (fx, v) => ({ type: 'fire', kind: 'projectile', sig: { fx, v } });

test('the catalogue has 14 mechanisms with English text and a sane value range', () => {
  const G = sigWorld(player(), []);
  const ids = Object.keys(G.SigFX.FX);
  assert.equal(ids.length, 14);
  for (const id of ids) {
    const f = G.SigFX.FX[id];
    assert.ok(f.min < f.max, id);
    const t = f.text(Math.round((f.min + f.max) / 2));
    assert.ok(t.length > 10 && !/[áéíóúñ¿¡]/.test(t) && !/NaN|undefined/.test(t), id + ': ' + t);
    assert.ok(typeof G.SigFX.POWER[id] === 'function' && G.SigFX.POWER[id](f.min) >= 1, id + ' power');
    assert.ok(G.SigFX.POWER[id](f.max) >= G.SigFX.POWER[id](f.min), id + ' power grows with v');
    assert.ok(f.onHit || f.onCast, id + ' has a hook');
  }
});

test('splash hurts nearby foes but not the target nor distant ones', () => {
  const t = foe(100, 0), near = foe(140, 0), far = foe(300, 0), pl = player();
  const G = sigWorld(pl, [t, near, far]);
  G.SigFX.onHit(pl, t, mv('splash', 50), 200);
  assert.deepEqual(t.hits, []);
  assert.deepEqual(near.hits, [100]);
  assert.deepEqual(far.hits, []);
});

test('chain jumps to at most two other foes within range', () => {
  const t = foe(0, 0), a = foe(50, 0), b = foe(100, 0), c = foe(150, 0), pl = player();
  const G = sigWorld(pl, [t, a, b, c]);
  G.SigFX.onHit(pl, t, mv('chain', 40), 100);
  const hurt = [a, b, c].filter(e => e.hits.length);
  assert.equal(hurt.length, 2);
  assert.ok(hurt.every(e => e.hits[0] === 40));
  assert.deepEqual(t.hits, []);
});

test('drain heals a share of the damage, capped at 2% of max hp', () => {
  const t = foe(10, 0), pl = player();
  const G = sigWorld(pl, [t]);
  G.SigFX.onHit(pl, t, mv('drain', 4), 100);
  assert.deepEqual(pl.healed, [4]);
  G.SigFX.onHit(pl, t, mv('drain', 6), 1e6);
  assert.deepEqual(pl.healed, [4, 20]);
});

test('bossbane and execute add damage only when their condition holds', () => {
  const pl = player(), boss = foe(0, 0, { boss: true }), grunt = foe(0, 0), low = foe(0, 0, { hp: 20 });
  const G = sigWorld(pl, []);
  G.SigFX.onHit(pl, boss, mv('bossbane', 50), 100);
  G.SigFX.onHit(pl, grunt, mv('bossbane', 50), 100);
  assert.deepEqual(boss.hits, [50]);
  assert.deepEqual(grunt.hits, []);
  G.SigFX.onHit(pl, low, mv('execute', 80), 100);
  G.SigFX.onHit(pl, grunt, mv('execute', 80), 100);
  assert.deepEqual(low.hits, [80]);
  assert.deepEqual(grunt.hits, []);
});

test('status mechanisms call the right enemy method', () => {
  const pl = player(), e = foe(10, 0), G = sigWorld(pl, [e]);
  G.SigFX.onHit(pl, e, mv('slow', 30), 10);
  G.SigFX.onHit(pl, e, mv('burn', 2), 10);
  G.SigFX.onHit(pl, e, mv('poison', 3), 10);
  assert.deepEqual(e.calls, [['slow', 0.3], ['burn', 2], ['poison', 3]]);
  const r = Math.random; Math.random = () => 0;
  try { G.SigFX.onHit(pl, e, mv('stun', 20), 10); } finally { Math.random = r; }
  assert.deepEqual(e.calls[3], ['stun', 0.6]);
  Math.random = () => 0.99;
  try { G.SigFX.onHit(pl, e, mv('stun', 20), 10); } finally { Math.random = r; }
  assert.equal(e.calls.length, 4, 'no stun on a high roll');
});

test('knock pushes the foe away from the player and pull draws it in', () => {
  const pl = player(), e = foe(100, 0), G = sigWorld(pl, [e]);
  G.SigFX.onHit(pl, e, mv('knock', 150), 10);
  assert.ok(e.kx > 100 && Math.abs(e.ky) < 1e-9);
  const f = foe(100, 0);
  G.SigFX.onHit(pl, f, mv('pull', 150), 10);
  assert.ok(f.kx < -100);
});

test('surge mechanisms add a buff every third cast, with the stat of their name', () => {
  const pl = player(), G = sigWorld(pl, []);
  for (let i = 0; i < 6; i++) G.SigFX.onCast(pl, mv('surgeHaste', 100));
  assert.equal(pl.buffsAdded.length, 2);
  assert.equal(pl.buffsAdded[0][0], 'haste');
  const p2 = player();
  for (let i = 0; i < 3; i++) G.SigFX.onCast(p2, mv('surgeCrit', 200));
  assert.equal(p2.buffsAdded[0][0], 'crit');
  assert.ok(Math.abs(p2.buffsAdded[0][1] - 0.06) < 1e-9, 'amount scales with v');
  const p3 = player();
  for (let i = 0; i < 3; i++) G.SigFX.onCast(p3, mv('surgeAtk', 100));
  assert.equal(p3.buffsAdded[0][0], 'atk');
});

test('hooks never throw on a move without sig, an unknown mechanism, a dead foe or a bad value', () => {
  const pl = player(), e = foe(5, 5), dead = foe(5, 5, { dead: true }), G = sigWorld(pl, [e]);
  assert.doesNotThrow(() => G.SigFX.onHit(pl, e, { kind: 'melee' }, 10));
  assert.doesNotThrow(() => G.SigFX.onHit(pl, e, mv('no-such', 10), 10));
  assert.doesNotThrow(() => G.SigFX.onHit(pl, dead, mv('splash', 50), 10));
  assert.doesNotThrow(() => G.SigFX.onHit(pl, e, mv('splash', NaN), NaN));
  assert.doesNotThrow(() => G.SigFX.onCast(pl, { kind: 'melee' }));
  assert.doesNotThrow(() => G.SigFX.onCast(pl, mv('no-such', 10)));
  assert.deepEqual(dead.hits, []);
});

test('combat passes the final damage to afterHit and runs the cast hook', () => {
  const src = source('js/systems/combat.js');
  assert.match(src, /function afterHit\(pl, e, m, dmg\)/);
  assert.match(src, /G\.SigFX\.onHit\(pl, e, m, dmg\)/);
  assert.match(src, /afterHit\(pl, e, p\.src, p\.dmg \* k\)/);
  assert.match(src, /afterHit\(pl, e, m, dmg\);/);
  assert.match(src, /if \(m\.sig && G\.SigFX\) G\.SigFX\.onCast\(pl, m\)/);
  assert.ok(source('dev.html').indexOf('js/data/sigfx.js') > source('dev.html').indexOf('js/data/moves.js'));
});

// ---------------- Task 3: datos y generador ----------------

function sigGame() {
  const G = { DEX_BY: {}, U: { TYPE_COLOR: {}, TYPE_NAME: {} }, I18n: { add() {}, f: s => s },
              EnemyMgr: { queryCircle: () => [] } };
  for (const f of ['js/data/pokedex.js', 'js/data/mega.js', 'js/data/moves.js', 'js/data/sigfx.js', 'js/data/signature-moves.js']) {
    new Function('G', source(f))(G);
  }
  return G;
}
const { speciesList } = require('../tools/sig_species.js');

test('there is one signature move per species, from the data, registered but outside ALL and POOL', () => {
  const G = sigGame(), list = speciesList();
  assert.equal(Object.keys(G.SIG).length, list.length);
  assert.deepEqual(Object.keys(G.SIG).map(Number).sort((a, b) => a - b), list.map(s => s.dex));
  assert.equal(G.Moves.ALL.length, 113);
  for (const s of list) {
    const d = G.SIG[s.dex];
    assert.equal(d.id, 'sig-' + s.dex);
    assert.equal(G.Moves.BY_ID[d.id], d, d.id);
    assert.ok(!G.Moves.ALL.includes(d), d.id + ' not in ALL');
    assert.equal(d.type, s.type, d.id + ' type');
    assert.equal(d.rare, s.why, d.id + ' rarity tag');
  }
  for (const t of Object.keys(G.Moves.POOL)) assert.ok(!G.Moves.POOL[t].some(id => id.startsWith('sig-')), t);
});

test('names are unique, English, and different from every regular move name', () => {
  const G = sigGame();
  const names = Object.values(G.SIG).map(d => d.name);
  assert.equal(new Set(names).size, names.length, 'unique names');
  const en = {};
  const L = { U: {}, I18n: { add(o) { Object.assign(en, o); } } };
  new Function('G', source('js/data/lang-en.js'))(L);
  const regular = new Set(G.Moves.ALL.map(m => (en[m.name] || m.name).toLowerCase()));
  for (const d of Object.values(G.SIG)) {
    assert.ok(/^[A-Za-z0-9' -]{4,32}$/.test(d.name), d.id + ': ' + d.name);
    assert.ok(!regular.has(d.name.toLowerCase()), d.id + ' reuses a regular move name: ' + d.name);
  }
});

test('every signature move is a valid damage kind with a mechanism in range', () => {
  const G = sigGame();
  for (const d of Object.values(G.SIG)) {
    assert.ok(G.Moves.AREA[d.kind] > 0 && d.kind !== 'buff', d.id + ' kind ' + d.kind);
    const f = G.SigFX.FX[d.sig.fx];
    assert.ok(f, d.id + ' fx ' + d.sig.fx);
    assert.ok(d.sig.v >= f.min && d.sig.v <= f.max, `${d.id}: ${d.sig.fx} v=${d.sig.v} outside ${f.min}-${f.max}`);
    assert.ok(!(d.kind === 'orbit' && f.onCast && !f.onHit), d.id + ': cast hooks never run for orbits');
    assert.ok(d.desc.length > 20 && d.desc.includes(f.text(d.sig.v)), d.id + ' desc');
    assert.ok(!/[áéíóúñ¿¡]/.test(d.name + d.desc), d.id + ' English only');
    assert.ok(['physical', 'special'].includes(d.cat), d.id + ' cat');
    assert.equal(d.maxLvl, d.ups.length + 1);
  }
});

test('signature power is SIG_POWER times the median of the regular moves', () => {
  const G = sigGame(), M = G.Moves, med = M.median();
  for (const d of Object.values(G.SIG)) {
    const ratio = M.dps(d) * G.SigFX.POWER[d.sig.fx](d.sig.v) / med;
    assert.ok(ratio >= 0.83 * M.SIG_POWER && ratio <= 1.17 * M.SIG_POWER, `${d.id} (${d.kind}/${d.sig.fx}): ratio ${ratio.toFixed(2)}`);
  }
});

test('the 87 legends are varied: no mechanism overused and (type, kind, mechanism) never repeated', () => {
  const G = sigGame(), legends = speciesList().filter(s => s.why === 'legend');
  const fxCount = {}, seen = new Map();
  for (const s of legends) {
    const d = G.SIG[s.dex];
    fxCount[d.sig.fx] = (fxCount[d.sig.fx] || 0) + 1;
    const key = [d.type, d.kind, d.sig.fx].join('/');
    assert.ok(!seen.has(key), `${d.id} repeats ${key} of ${seen.get(key)}`);
    seen.set(key, d.id);
  }
  for (const [fx, n] of Object.entries(fxCount)) assert.ok(n <= 12, `${fx} used ${n} times`);
  assert.ok(Object.keys(fxCount).length >= 12, 'at least 12 different mechanisms');
});

test('SIG_OF finds the move of the species and of its Mega forms', () => {
  const G = sigGame();
  assert.equal(G.SIG_OF(150).id, 'sig-150');
  assert.equal(G.SIG_OF(6).id, 'sig-6');
  const megaX = G.MEGA[6][0];
  assert.equal(G.SIG_OF(megaX).id, 'sig-6', 'Mega Charizard X uses Charizard\'s move');
  assert.equal(G.SIG_OF(1), null);
  assert.equal(G.SIG_OF(undefined), null);
});

test('the generator is deterministic and the data file is up to date', () => {
  const { build } = require('../tools/gen_signature.js');
  const a = build(), b = build();
  assert.equal(a, b);
  assert.equal(a.replace(/\r\n/g, '\n'), source('js/data/signature-moves.js').replace(/\r\n/g, '\n'), 'run: node tools/gen_signature.js');
});

test('dev.html loads the data after moves.js and sigfx.js, before the player', () => {
  const html = source('dev.html'), at = f => html.indexOf(f);
  assert.ok(at('js/data/signature-moves.js') > at('js/data/sigfx.js') && at('js/data/signature-moves.js') < at('js/entities/player.js'));
});

test('dps counts the real number of hits of a turret (one shot every rate) and a vortex (one tick every 0.4 s)', () => {
  const M = moves().Moves;
  const t = M.BY_ID['will-o-wisp'];
  assert.equal(M.dps(t), t.dmg * M.AREA.turret / t.rate);
  const v = M.BY_ID.whirlpool;
  assert.equal(M.dps(v), v.dmg * (v.dur / 0.4) * M.AREA.vortex / v.cd);
  // con la corrección ya no son un orden de magnitud más débiles que el resto
  assert.ok(M.dps(t) > M.median() * 0.5 && M.dps(v) > M.median() * 0.4, `${M.dps(t)} ${M.dps(v)} vs ${M.median()}`);
});

test('no signature move deals a hit far above SIG_POWER times the strongest regular move of its kind', () => {
  const G = sigGame(), M = G.Moves;
  for (const d of Object.values(G.SIG)) {
    const max = Math.max(...M.ALL.filter(m => m.kind === d.kind).map(m => m.dmg));
    assert.ok(d.dmg <= max * M.SIG_POWER * 1.3, `${d.id} (${d.kind}) deals ${d.dmg} per hit; strongest regular of its kind ${max}`);
  }
});

// ---------------- Task 6: VFX, icono y hoja de la especie ----------------

test('every signature move has a look made of shapes and hit effects that exist', () => {
  const { world } = require('./helpers/vfx-world.cjs');
  const G = world('js/data/moves.js', 'js/data/sigfx.js', 'js/data/signature-moves.js', 'js/entities/vfx.js',
    'js/entities/vfx-shapes-1.js', 'js/entities/vfx-shapes-2.js', 'js/entities/fx.js');
  const SHOWN = { melee: ['melee'], spin: ['melee'], beam: ['beam'], chain: ['beam'], charge: ['beam', 'proj'], aura: ['aura'] };
  for (const d of Object.values(G.SIG)) {
    const v = G.VFX.forMove(d), shown = SHOWN[d.kind] || ['proj'];
    assert.ok(G.VFX.MOVE[d.id], d.id + ' has its own MOVE entry');
    for (const k of shown) {
      assert.ok(v[k], `${d.id} (${d.kind}) needs ${k}`);
      assert.ok(G.VFX.SHAPES[v[k]] || v[k] === 'lightning' || ['vine', 'feather'].includes(v[k]), `${d.id}.${k}=${v[k]}`);
    }
    assert.ok(G.VFX.PAL[v.pal], d.id + ' palette');
    assert.ok(G.FX.HIT_KINDS.includes(v.hit), `${d.id}.hit=${v.hit}`);
    if (v.trail) assert.ok(['ember', 'drip', 'spark', 'bubbles', 'dirt', 'wisp'].includes(v.trail), d.id + ' trail');
  }
});

test('the regular 113 moves still have their own VFX entries (signature entries are extra)', () => {
  const { world } = require('./helpers/vfx-world.cjs');
  const G = world('js/data/moves.js', 'js/data/sigfx.js', 'js/data/signature-moves.js', 'js/entities/vfx.js',
    'js/entities/vfx-shapes-1.js', 'js/entities/vfx-shapes-2.js');
  for (const m of G.Moves.ALL) assert.ok(G.VFX.MOVE[m.id], m.id);
  assert.equal(Object.keys(G.VFX.MOVE).filter(k => k.startsWith('sig-')).length, 171);
});

function monsGame(stars) {
  const G = { U: { TYPE_NAME: {}, TYPE_COLOR: {} }, Types: { mult: () => 1 }, Weather: { current: null }, I18n: { add() {}, f: s => s },
              EnemyMgr: { queryCircle: () => [] } };
  for (const f of ['js/data/pokedex.js', 'js/data/evolutions.js', 'js/data/mega.js', 'js/data/passive-fx.js', 'js/data/passive-unique-fx.js',
    'js/data/passives-common.js', 'js/data/passives.js', 'js/data/ability-fx.js', 'js/data/moves.js', 'js/data/sigfx.js',
    'js/data/signature-moves.js', 'js/systems/mons.js']) new Function('G', source(f))(G);
  G.Rank = { starsOf: dex => stars[dex] || 0, bonus: () => ({ commonMul: 1, uniqueMul: 1, uniqueOn: true }) };
  G.Game = null;
  return G;
}

test('abilityOf reports the signature move of the species, locked below 5 stars', () => {
  const G = monsGame({ 150: 4, 6: 5 });
  const mt = G.Mons.abilityOf(150).sig;
  assert.deepEqual(Object.keys(mt).sort(), ['desc', 'locked', 'name', 'rare', 'via']);
  assert.equal(mt.via, null);
  assert.equal(mt.name, 'Psystrike');
  assert.equal(mt.locked, true);
  assert.equal(mt.rare, 'legend');
  assert.equal(G.Mons.abilityOf(6).sig.locked, false);
  assert.equal(G.Mons.abilityOf(6).sig.rare, 'mega');
  const base = G.Mons.abilityOf(1).sig;
  assert.equal(base.name, G.Mons.abilityOf(3).sig.name, 'Bulbasaur shows the move of its line');
  assert.equal(base.via, 'Venusaur');
  assert.equal(G.Mons.abilityOf(19).sig, null, 'Rattata line has none');
  assert.equal(G.Mons.abilityOf(99999).sig, null);
});

test('the Pokédex sheet shows the signature move: dimmed with a hint when locked, bright when open, gold for legends', () => {
  const src = source('js/ui/menu.js');
  const body = src.slice(src.indexOf('function rankHtml'), src.indexOf('function monExtras'));
  const mk = (stars) => {
    const G = monsGame({ 150: stars, 6: stars });
    G.UI = { rankStars: () => '' }; G.T = s => s;
    G.Rank.progress = () => ({ stars, next: 1, missing: 1 });
    return new Function('G', body + '; return rankHtml;')(G);
  };
  const locked = mk(4)(150), open = mk(5)(150), mega = mk(5)(6);
  assert.match(locked, /mx-locked"><span>Signature<\/span><b class="u5" translate="no">Psystrike<\/b><small>Unlocks at 5★/);
  assert.match(open, /<span>Signature<\/span><b class="u5" translate="no">Psystrike<\/b>/);
  assert.doesNotMatch(open, /Unlocks at 5/);
  assert.match(mega, /<span>Signature<\/span><b translate="no">Inferno Charge<\/b>/, 'only legends are gold');
  assert.match(mk(4)(1), /Unlocks at 5★ · on Venusaur/);
  assert.equal((mk(5)(19).match(/Signature/g) || []).length, 0, 'species without a move show nothing');
});

test('the move icon gets a star for signature moves and a teammate with an unknown move is ignored', () => {
  assert.match(source('js/ui/icons.js'), /emblem\(m \? m\.type : 'normal', m \? m\.kind : null, !!\(m && m\.rare\)\)/);
  assert.match(source('js/systems/combat.js'), /if \(!def \|\| def\.kind === 'orbit'\) return;/);
});

// ---------------- lượt sửa sau review ----------------

test('regular moves of every kind sit around the same nominal power, so one SIG_POWER means the same everywhere', () => {
  const M = moves().Moves, med = M.median();
  const mid = a => { a = [...a].sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
  for (const k of Object.keys(M.AREA)) {
    const xs = M.ALL.filter(m => m.kind === k).map(m => M.dps(m));
    if (!xs.length) continue;
    assert.ok(Math.abs(mid(xs) / med - 1) < 0.02, `${k}: median dps ${mid(xs).toFixed(1)} vs global ${med.toFixed(1)}`);
  }
});

test('a signature move hits harder than the typical regular move of its kind', () => {
  const G = sigGame(), M = G.Moves;
  const mid = a => { a = [...a].sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
  for (const d of Object.values(G.SIG)) {
    const reg = mid(M.ALL.filter(m => m.kind === d.kind).map(m => m.dmg));
    assert.ok(d.dmg >= reg * 1.5, `${d.id} (${d.kind}, ${d.sig.fx}): ${d.dmg} per hit vs a typical ${reg}`);
  }
});

test('each signature move attacks with the stronger side of its species', () => {
  const G = sigGame();
  for (const [dex, d] of Object.entries(G.SIG)) {
    const mon = G.DEX_BY[dex];
    assert.equal(d.cat, mon.sa > mon.pa ? 'special' : 'physical', `${d.id} ${mon.name}`);
  }
});

test('no signature move shares a name with the unique passive of its line', () => {
  const G = sigGame();
  for (const f of ['js/data/passives.js', 'js/data/evolutions.js']) new Function('G', source(f))(G);
  const root = dex => { let d = dex; while (G.EVO_FROM && G.EVO_FROM[d] && G.EVO_FROM[d].length) d = G.EVO_FROM[d][0]; return d; };
  const clashes = [];
  for (const [dex, d] of Object.entries(G.SIG)) {
    const p = G.PASSIVES_UNIQUE[root(+dex)];
    if (p && p.n.toLowerCase() === d.name.toLowerCase()) clashes.push(`${d.id} ${d.name}`);
  }
  assert.deepEqual(clashes, []);
});

// ---- SigFX: topes de curación, de procs y de refuerzos ----

test('drain cannot heal more than 3% of max hp per second however many foes are hit', () => {
  const t = foe(10, 0), pl = player(), G = sigWorld(pl, [t]);
  let now = 0; G.SigFX.clock = () => now;
  for (let i = 0; i < 50; i++) G.SigFX.onHit(pl, t, mv('drain', 6), 1e6);
  const sum = () => pl.healed.reduce((a, b) => a + b, 0);
  assert.ok(sum() <= 30 + 1e-9 && sum() > 0, 'healed ' + sum());
  assert.equal(pl.quiet, true, 'quiet heals: no number spam');
  now = 1.5;
  const before = sum();
  G.SigFX.onHit(pl, t, mv('drain', 6), 1e6);
  assert.ok(sum() > before, 'the budget comes back after a second');
});

test('splash and chain proc at most once every 0.2 s per player', () => {
  const t = foe(0, 0), a = foe(40, 0), pl = player(), G = sigWorld(pl, [t, a]);
  let now = 0; G.SigFX.clock = () => now;
  G.SigFX.onHit(pl, t, mv('splash', 50), 100);
  G.SigFX.onHit(pl, t, mv('splash', 50), 100);
  G.SigFX.onHit(pl, t, mv('chain', 40), 100);
  G.SigFX.onHit(pl, t, mv('chain', 40), 100);
  assert.deepEqual(a.hits, [50, 40], 'one splash and one chain, not four');
  now = 0.25;
  G.SigFX.onHit(pl, t, mv('splash', 50), 100);
  assert.equal(a.hits.length, 3, 'procs again after the gap');
});

test('a surge never weakens the matching buff move that is already running', () => {
  const pl = player();
  pl.buffs = { crit: { n: 5, t: 7, amount: 0.03 }, haste: { n: 0, t: 0, amount: 0 }, atk: { n: 0, t: 0, amount: 0 } };
  pl.addBuff = function (stat, amount, dur, max) { const b = this.buffs[stat]; this.buffsAdded.push([stat, amount, dur, max]); b.amount = amount; b.n = Math.min(max, b.n + 1); b.t = dur; };
  const G = sigWorld(pl, []);
  for (let i = 0; i < 3; i++) G.SigFX.onCast(pl, mv('surgeCrit', 100));
  assert.equal(pl.buffs.crit.n, 5, 'stacks kept');
  assert.ok(pl.buffs.crit.amount >= 0.03 - 1e-9, 'amount kept');
  assert.ok(pl.buffs.crit.t >= 7 - 1e-9, 'duration not shortened');
});

test('knock, pull and stun respect boss immunities', () => {
  const pl = player(), boss = foe(100, 0, { boss: true }), G = sigWorld(pl, [boss]);
  G.SigFX.onHit(pl, boss, mv('knock', 150), 10);
  G.SigFX.onHit(pl, boss, mv('pull', 150), 10);
  assert.equal(boss.kx, 0, 'bosses are not pushed or dragged');
  const r = Math.random; Math.random = () => 0;
  try { G.SigFX.onHit(pl, boss, mv('stun', 20), 10); } finally { Math.random = r; }
  assert.ok(boss.calls.length === 1 && Math.abs(boss.calls[0][1] - 0.21) < 1e-9, 'a boss is stunned for 35% of the time: ' + JSON.stringify(boss.calls));
});
