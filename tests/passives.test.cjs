const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function world(...files) {
  const G = {
    U: { TYPE_NAME: { fire: 'Fire', water: 'Water', grass: 'Grass', flying: 'Flying', poison: 'Poison', normal: 'Normal' } },
    Types: { mult: () => 1 },
    Weather: { current: null }
  };
  for (const f of files) new Function('G', source(f))(G);
  return G;
}
const fresh = () => ({ hp: 100, maxHp: 100, critChance: 0.1, magnet: 1, xpMul: 1, regenFlat: 0, coinMul: 1, level: 5 });
const MONS = [{ dex: 1, types: ['fire'] }, { dex: 2, types: ['fire', 'flying'] }];

test('power sums cost × value', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  assert.equal(P.power([['critChance', 4]]), P.TEMPLATES.critChance.cost * 4);
  assert.equal(P.power([['critChance', 4], ['dodge', 5]]), P.TEMPLATES.critChance.cost * 4 + P.TEMPLATES.dodge.cost * 5);
});

test('every template builds a non-empty English description for 1-type and 2-type mons', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  for (const [id, t] of Object.entries(P.TEMPLATES)) {
    for (const v of [t.min, Math.round((t.min + t.max) / 2), t.max]) {
      for (const mon of MONS) {
        const d = P.build({ n: 'X', fx: [[id, v]] }, mon).d;
        assert.ok(typeof d === 'string' && d.length > 5, id);
        assert.ok(!/[áéíóúñ¿¡]/.test(d) && !/NaN|undefined/.test(d), id + ': ' + d);
      }
    }
  }
});

test('typeDmg multiplies only matching moves', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  const a = P.build({ n: 'X', fx: [['typeDmg', 20]] }, MONS[0]);
  assert.ok(Math.abs(a.out(fresh(), { type: 'fire' }) - 1.2) < 1e-9);
  assert.equal(a.out(fresh(), { type: 'water' }), 1);
});

test('several effects combine: damage multiplies, start hooks all run', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  const a = P.build({ n: 'X', fx: [['typeDmg', 20], ['lowHpDmg', 50], ['critChance', 5], ['maxHp', 10]] }, MONS[0]);
  const pl = fresh(); pl.hp = 10;
  pl.addMaxHp = n => { pl.maxHp += n; pl.hp += n; };
  a.start(pl);
  assert.ok(Math.abs(pl.critChance - 0.15) < 1e-9);
  assert.equal(pl.maxHp, 110);
  assert.ok(Math.abs(a.out(pl, { type: 'fire' }) - 1.2 * 1.5) < 1e-9);
});

test('conditional state lives on the player object', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  const a = P.build({ n: 'X', fx: [['streakDmg', 30]] }, MONS[0]);
  const p1 = fresh(), p2 = fresh();
  for (let i = 0; i < 5; i++) a.kill(p1, {});
  assert.ok(a.out(p1, { type: 'fire' }) > 1);
  assert.equal(a.out(p2, { type: 'fire' }), 1);
  a.tick(p1, 10);                       // la racha caduca
  assert.equal(a.out(p1, { type: 'fire' }), 1);
});

// ---------------- datos: passives.js ----------------
function data() { return world('js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passives.js'); }

test('all Pokémon have a passive', () => {
  const G = data();
  assert.equal(G.DEX.length, 966);
  for (const p of G.DEX) {
    const e = G.PASSIVES[p.dex];
    assert.ok(e && e.n && e.fx.length >= 1 && e.fx.length <= 3, 'dex ' + p.dex);
  }
});
test('names are unique', () => {
  const G = data(), seen = new Map();
  for (const p of G.DEX) {
    const n = G.PASSIVES[p.dex].n.toLowerCase();
    assert.ok(!seen.has(n), `${n}: dex ${seen.get(n)} and ${p.dex}`);
    seen.set(n, p.dex);
  }
});
test('rarity 4-5 signatures are unique', () => {
  const G = data(), seen = new Map();
  for (const p of G.DEX.filter(p => p.rarity >= 4)) {
    const s = G.PassiveFX.signature(G.PASSIVES[p.dex].fx);
    assert.ok(!seen.has(s), `${s}: dex ${seen.get(s)} and ${p.dex}`);
    seen.set(s, p.dex);
  }
});
test('power is inside the band of its rarity (including unevolved rarity 5)', () => {
  const G = data();
  for (const p of G.DEX) {
    const [lo, hi] = G.PassiveFX.BANDS[p.rarity], w = G.PassiveFX.power(G.PASSIVES[p.dex].fx);
    assert.ok(w >= lo && w <= hi, `dex ${p.dex} rarity ${p.rarity} power ${w} not in ${lo}-${hi}`);
  }
  assert.equal(G.DEX_BY[789].rarity, 5);          // Cosmog: rareza 5 en primera etapa
});
test('every effect id exists and its value is in range', () => {
  const G = data();
  for (const p of G.DEX) for (const [id, v] of G.PASSIVES[p.dex].fx) {
    const t = G.PassiveFX.TEMPLATES[id];
    assert.ok(t, `dex ${p.dex}: ${id}`);
    assert.ok(Number.isInteger(v) && v >= t.min && v <= t.max, `dex ${p.dex}: ${id}=${v}`);
  }
});
test('rarity 1-3 use no conditional templates; rarity 5 may', () => {
  const G = data();
  for (const p of G.DEX.filter(p => p.rarity <= 3)) {
    for (const [id] of G.PASSIVES[p.dex].fx) assert.ok(!G.PassiveFX.TEMPLATES[id].cond, `dex ${p.dex}: ${id}`);
  }
  assert.ok(G.DEX.some(p => p.rarity === 5 && G.PASSIVES[p.dex].fx.some(([id]) => G.PassiveFX.TEMPLATES[id].cond)));
});
test('higher rarity never has a weaker passive', () => {
  const G = data(), top = {};
  for (const p of G.DEX) {
    const w = G.PassiveFX.power(G.PASSIVES[p.dex].fx);
    top[p.rarity] = top[p.rarity] ? { lo: Math.min(top[p.rarity].lo, w), hi: Math.max(top[p.rarity].hi, w) } : { lo: w, hi: w };
  }
  for (let r = 2; r <= 5; r++) assert.ok(top[r].lo > top[r - 1].hi, `rarity ${r} min ${top[r].lo} vs ${r - 1} max ${top[r - 1].hi}`);
});

// ---------------- motor: AbilityFX.of(mon), Mons.abilityOf ----------------
function engine(db) {
  const G = world('js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passives.js', 'js/data/ability-fx.js');
  G.DB = { save: db || {} };
  new Function('G', source('js/systems/mons.js'))(G);
  return G;
}
test('AbilityFX.of(mon) returns the passive built from PASSIVES', () => {
  const G = engine(), mon = G.DEX_BY[6];
  const fx = G.AbilityFX.of(mon);
  assert.equal(fx.d, G.PassiveFX.build(G.PASSIVES[6], mon).d);
  assert.equal(fx.name, G.PASSIVES[6].n);
  assert.ok(!fx.generic);
});
test('AbilityFX.of falls back to the generic passive when the dex has no entry', () => {
  const G = engine();
  assert.equal(G.AbilityFX.of({ dex: 99999, types: ['fire'] }).generic, true);
});
test('old save with pabil and capsule counts is ignored', () => {
  const G = engine({ pabil: { 1: [2, 0] }, shop: { cap: 3, caph: 1 } });
  const a = G.Mons.abilityOf(1);
  assert.equal(a.name, G.PASSIVES[1].n);
  assert.equal(a.slot, 0);
  assert.equal(G.Mons.abilityChoices, undefined);
  assert.equal(G.Mons.setAbility, undefined);
});
test('passive description is English text for every Pokémon', () => {
  const G = engine();
  for (const p of G.DEX) {
    const a = G.Mons.abilityOf(p.dex);
    assert.ok(a.desc.length > 5 && !/[áéíóúñ¿¡]/.test(a.desc) && !/NaN|undefined/.test(a.desc), `dex ${p.dex}: ${a.desc}`);
  }
});
test('new scripts load before ability-fx.js and PassiveFX is required at boot', () => {
  const html = source('dev.html'), at = f => html.indexOf(`src="js/data/${f}"`);
  assert.ok(at('passive-fx.js') > 0 && at('passives.js') > at('passive-fx.js') && at('ability-fx.js') > at('passives.js'));
  assert.match(source('js/main.js'), /const NEED = \[[^\]]*'PassiveFX'/);
});

// ---------------- interfaz y tienda ----------------
test('shop no longer sells capsules and old bag counts are not items', () => {
  const G = { DB: { save: { bag: { mint: 1, cap: 4, caph: 2 } } }, TM_PRICE: { a: 100 }, Mons: { canLearn: () => true, learnable: () => [] } };
  new Function('G', source('js/data/shop.js'))(G);
  assert.deepEqual(G.Shop.ORDER, ['mint']);
  assert.equal(G.Shop.ITEMS.cap, undefined);
  assert.equal(G.Shop.ITEMS.caph, undefined);
  assert.deepEqual(G.Shop.buy('cap'), { ok: false });
});
test('no UI or system file references the removed ability APIs', () => {
  const removed = /abilityChoices\(|Mons\.setAbility|abilityName\(|Mons\.slots\(|AbilityFX\.of\([^)]*,/;
  for (const dir of ['js/ui', 'js/systems', 'js/entities']) {
    for (const f of fs.readdirSync(path.join(__dirname, '..', dir)).filter(f => f.endsWith('.js'))) {
      assert.doesNotMatch(source(`${dir}/${f}`), removed, `${dir}/${f}`);
    }
  }
  assert.doesNotMatch(source('js/game.js'), removed);
});

test('critDmg is never alone: every passive that has it also has critChance', () => {
  const G = data();
  for (const p of G.DEX) {
    const ids = G.PASSIVES[p.dex].fx.map(f => f[0]);
    if (ids.includes('critDmg')) assert.ok(ids.includes('critChance'), `dex ${p.dex} (${p.name}): ${ids}`);
  }
});
test('critDmg text states the real multiplier', () => {
  const { PassiveFX: P } = world('js/data/passive-fx.js');
  assert.match(P.build({ n: 'X', fx: [['critDmg', 30]] }, MONS[0]).d, /x1\.8/);
});

// ---------------- common por tipo, scale y catálogo unique (tarea 6) ----------------
const TYPES18 = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
const uworld = () => world('js/data/passive-fx.js', 'js/data/passive-unique-fx.js', 'js/data/passives-common.js');
const BAD_TEXT = /[áéíóúñ¿¡]|NaN|undefined/;

test('PASSIVES_COMMON has a themed passive for each of the 18 types', () => {
  const G = uworld(), names = new Set();
  assert.deepEqual(Object.keys(G.PASSIVES_COMMON).sort(), [...TYPES18].sort());
  for (const t of TYPES18) {
    const p = G.PASSIVES_COMMON[t];
    assert.ok(typeof p.n === 'string' && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(p.n), t + ': ' + p.n);
    assert.ok(!names.has(p.n.toLowerCase()), 'duplicate name ' + p.n);
    names.add(p.n.toLowerCase());
    assert.ok(p.fx.length >= 2 && p.fx.length <= 3, t);
    for (const [id, v] of p.fx) {
      const tp = G.PassiveFX.TEMPLATES[id];
      assert.ok(tp, `${t}: ${id}`);
      assert.ok(!tp.cond, `${t}: ${id} is conditional`);
      assert.ok(Number.isInteger(v) && v >= tp.min && v <= tp.max, `${t}: ${id}=${v}`);
    }
    const d = G.PassiveFX.build(G.PASSIVES_COMMON[t], { types: [t] }).d;
    assert.ok(d.length > 5 && !BAD_TEXT.test(d), t + ': ' + d);
  }
});

test('scale multiplies, rounds, clamps to max x1.6 and never mutates its input', () => {
  const G = uworld(), P = G.PassiveFX;
  for (const t of TYPES18) {
    const fx = G.PASSIVES_COMMON[t].fx, copy = JSON.stringify(fx);
    assert.deepEqual(P.scale(fx, 1), fx);
    assert.notEqual(P.scale(fx, 1), fx);
    for (const k of [1.3, 1.6, 1.6 * 1.5]) {
      const out = P.scale(fx, k);
      out.forEach(([id, v], i) => {
        const tp = P.TEMPLATES[id];
        assert.equal(id, fx[i][0]);
        assert.ok(Number.isInteger(v), `${id}=${v}`);
        assert.ok(v >= tp.min && v <= tp.max * 1.6 + 1e-9, `${t}: ${id}=${v} over ${tp.max * 1.6}`);
        assert.equal(v, Math.min(Math.floor(tp.max * 1.6), Math.max(tp.min, Math.round(fx[i][1] * k))));
      });
    }
    assert.equal(JSON.stringify(fx), copy);
  }
  assert.deepEqual(P.scale([['typeDmg', 15]], 1.3), [['typeDmg', 20]]);      // 19,5 → 20
  assert.deepEqual(P.scale([['dodge', 15]], 2.4), [['dodge', 24]]);          // tope 15 × 1,6
  assert.deepEqual(P.scale([['reviveOnce', 50]], 2), [['reviveOnce', 96]]);  // también los unique
});

test('UniqueFX has >= 30 templates in three tiers of 12/10/8, consistent both ways', () => {
  const { UniqueFX: U } = uworld();
  const ids = Object.keys(U.TEMPLATES);
  assert.ok(ids.length >= 30);
  assert.deepEqual(U.TIERS.basic, ['deathBurst', 'lifeSteal', 'thornAura', 'speedOnKill', 'startShield', 'coinBonus',
    'xpBurst', 'slowAura', 'critStreak', 'burnTouch', 'rangedBonus', 'comebackHeal']);
  assert.deepEqual(U.TIERS.adv, ['reviveOnce', 'killNova', 'hurtNova', 'orbitGuard', 'chainSpark', 'dashOnHurt',
    'executeLow', 'comboCharge', 'killHealPulse', 'barrier']);
  assert.deepEqual(U.TIERS.supreme, ['moveStorm', 'slowDomain', 'timeWarp', 'mirrorHit', 'lastStand', 'apexAura',
    'spectralClone', 'rageEngine']);
  const listed = [...U.TIERS.basic, ...U.TIERS.adv, ...U.TIERS.supreme];
  for (const id of listed) assert.equal(U.TEMPLATES[id].tier, Object.keys(U.TIERS).find(t => U.TIERS[t].includes(id)), id);
  assert.deepEqual([...ids].sort(), [...listed].sort());
  for (const [id, t] of Object.entries(U.TEMPLATES)) {
    assert.ok(t.cost > 0 && t.min > 0 && t.max >= t.min, id);
    assert.equal(typeof t.text, 'function', id); assert.equal(typeof t.hooks, 'function', id);
  }
  const budget = tier => U.TIERS[tier].reduce((s, id) => s + U.TEMPLATES[id].cost * U.TEMPLATES[id].max, 0) / U.TIERS[tier].length;
  const r = budget('supreme') / budget('basic');
  assert.ok(r >= 1.4 && r <= 1.6, 'supreme/basic budget ' + r);
});

test('every unique template builds an English description for 1-type and 2-type mons', () => {
  const G = uworld();
  for (const [id, t] of Object.entries(G.UniqueFX.TEMPLATES)) {
    for (const v of [t.min, Math.round((t.min + t.max) / 2), t.max, Math.floor(t.max * 1.6)]) {
      for (const mon of MONS) {
        const d = G.PassiveFX.build({ n: 'X', fx: [[id, v]] }, mon).d;
        assert.ok(typeof d === 'string' && d.length > 5, id);
        assert.ok(!BAD_TEXT.test(d), id + ': ' + d);
      }
    }
  }
});

test('PassiveFX.build and power accept a unique id next to a common one', () => {
  const G = uworld(), P = G.PassiveFX;
  const a = P.build({ n: 'X', fx: [['typeDmg', 10], ['executeLow', 40]] }, MONS[0]);
  assert.match(a.d, /Fire moves/); assert.match(a.d, /40%/);
  assert.ok(Math.abs(a.out(fresh(), { type: 'fire' }, { hp: 10, maxHp: 100 }) - 1.1 * 1.4) < 1e-9);
  assert.equal(a.out(fresh(), { type: 'water' }, { hp: 90, maxHp: 100 }), 1);
  assert.equal(P.power([['executeLow', 40]]), G.UniqueFX.TEMPLATES.executeLow.cost * 40);
  // sin el catálogo unique, build sigue funcionando con las plantillas comunes
  const bare = world('js/data/passive-fx.js');
  assert.match(bare.PassiveFX.build({ n: 'X', fx: [['typeDmg', 10]] }, MONS[0]).d, /\+10%/);
});

test('unique hooks keep their state on the player object', () => {
  const G = uworld(), P = G.PassiveFX;
  const foes = [];
  G.EnemyMgr = { queryCircle: () => foes };
  G.FX = { ring() {}, dmgText() {} };
  const foe = () => { const e = { x: 0, y: 0, hp: 100, maxHp: 100, dead: false, slow: 0, slowT: 0, burn: 0 };
    e.hurt = d => { e.hp -= d; }; e.applySlow = (f, t) => { e.slow = f; e.slowT = t; }; e.applyBurn = () => { e.burn++; }; return e; };
  foes.push(foe(), foe());
  const add = pl => Object.assign(pl, { x: 0, y: 0, bodyH: 20, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); } });
  // combo: sube con cada golpe y se pierde al recibir uno
  const c = P.build({ n: 'X', fx: [['comboCharge', 20]] }, MONS[0]), p1 = add(fresh()), p2 = add(fresh());
  for (let i = 0; i < 5; i++) c.hit(p1, foes[0], {});
  assert.ok(c.out(p1, {}) > 1); assert.equal(c.out(p2, {}), 1);
  c.hurt(p1); assert.equal(c.out(p1, {}), 1);
  // aura de frenado: frena a los cercanos cada medio segundo
  const s = P.build({ n: 'X', fx: [['slowAura', 30]] }, MONS[0]), p3 = add(fresh());
  s.tick(p3, 1);
  assert.ok(foes.every(e => Math.abs(e.slow - 0.3) < 1e-9));
  // nova al matar: cada 10 derrotas daña a los de alrededor
  const n = P.build({ n: 'X', fx: [['killNova', 100]] }, MONS[0]), p4 = add(fresh());
  for (let i = 0; i < 9; i++) n.kill(p4, foes[0]);
  assert.equal(foes[1].hp, 100);
  n.kill(p4, foes[0]);
  assert.ok(foes[1].hp < 100);
  // escudo inicial: bloquea los primeros v golpes
  const b = P.build({ n: 'X', fx: [['startShield', 2]] }, MONS[0]), p5 = add(fresh());
  b.start(p5);
  assert.equal(b.dodge(p5), 1); assert.equal(b.dodge(p5), 1); assert.equal(b.dodge(p5), 0);
});

test('reviveOnce revives exactly once per player', () => {
  const G = uworld();
  const a = G.PassiveFX.build({ n: 'X', fx: [['reviveOnce', 40]] }, MONS[0]);
  const pl = Object.assign(fresh(), { x: 0, y: 0, bodyH: 20 }), other = Object.assign(fresh(), { x: 0, y: 0, bodyH: 20 });
  pl.hp = 0;
  assert.equal(a.revive(pl), true);
  assert.equal(pl.hp, 40);
  assert.equal(pl.reviveUsed, true);
  pl.hp = 0;
  assert.equal(a.revive(pl), false);
  assert.equal(pl.hp, 0);
  other.hp = 0;
  assert.equal(a.revive(other), true);                 // otro jugador (otra run) tiene la suya
});

test('Player death path asks abil.revive and cancels the death once', () => {
  const G = { U: { TYPE_NAME: {}, TYPE_COLOR: {} }, Types: { mult: () => 1, label: () => null }, Weather: { mult: () => 1, current: null } };
  for (const f of ['js/data/pokedex.js', 'js/data/passive-fx.js', 'js/data/passive-unique-fx.js', 'js/data/passives.js', 'js/data/ability-fx.js']) new Function('G', source(f))(G);
  G.Sprites = { hasShiny: () => false, playerScale: () => 1, playerRadius: () => 10, bodyHeight: () => 30, Animator: class { play() {} } };
  G.Mons = { monFor: dex => G.DEX_BY[dex] }; G.Coop = { active: false }; G.Stats = { taken: () => 1 };
  G.Audio = { sfx() {} }; G.Camera = { kick() {} }; G.Pad = { rumble() {} };
  G.FX = { dmgText() {}, burst() {}, ring() {} }; G.Projectiles = { clearOrbs() {} };
  new Function('G', source('js/entities/player.js'))(G);
  const pl = new G.Player(G.DEX_BY[4]); pl.activeGroup = () => []; pl.x = 0; pl.y = 0;
  pl.abil = G.PassiveFX.build({ n: 'X', fx: [['reviveOnce', 50]] }, G.DEX_BY[4]);
  pl.hurt(99999);
  assert.equal(pl.dead, false);
  assert.ok(Math.abs(pl.hp - pl.maxHp * 0.5) < 1e-9);
  assert.ok(pl.invuln > 0);
  pl.invuln = 0;
  pl.hurt(99999);
  assert.equal(pl.dead, true);
  assert.equal(pl.hp, 0);
});

test('dev.html loads the common and unique catalogs before passives.js; NEED has UniqueFX and Rank', () => {
  const html = source('dev.html'), at = f => html.indexOf(`src="js/data/${f}"`);
  assert.ok(at('passive-fx.js') > 0);
  for (const f of ['passives-common.js', 'passive-unique-fx.js']) {
    assert.ok(at(f) > at('passive-fx.js') && at(f) < at('passives.js'), f);
  }
  const need = source('js/main.js').match(/const NEED = \[([^\]]*)\]/)[1];
  assert.match(need, /'UniqueFX'/);
  assert.match(need, /'Rank'/);
});
