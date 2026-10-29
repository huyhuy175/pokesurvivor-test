const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function load(hc) {
  const G = {}; new Function('G', source('js/systems/modes.js'))(G);
  G.Modes.begin({ type: 'normal', hc }, []);
  return G.Modes;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);
// Cuerpo de una función por su cabecera (hasta la primera línea con la misma sangría + "}").
function body(src, head) {
  const i = src.indexOf(head); assert.ok(i >= 0, 'missing ' + head);
  const indent = /^[ \t]*/.exec(src.slice(src.lastIndexOf('\n', i) + 1))[0];
  const end = src.indexOf('\n' + indent + '}', i);
  return src.slice(i, end);
}

test('scaleEnemy multiplies only under hardcore', () => {
  const sc = { hp: 100, dmg: 10, spd: 1 };
  assert.deepEqual(load(false).scaleEnemy(sc), sc);
  const r = load(true).scaleEnemy(sc);
  near(r.hp, 150); near(r.dmg, 14); near(r.spd, 1.1);
  assert.deepEqual(sc, { hp: 100, dmg: 10, spd: 1 }, 'input is not mutated');
});

test('rateK/healK/noReroll/noRevive follow the flag', () => {
  const on = load(true), off = load(false);
  assert.deepEqual([on.rateK(), on.healK(), on.noReroll(), on.noRevive()], [1.25, 0.5, true, true]);
  assert.deepEqual([off.rateK(), off.healK(), off.noReroll(), off.noRevive()], [1, 1, false, false]);
});

test('rand biases drops up under hardcore', () => {
  const real = Math.random; Math.random = () => 0.6;
  try {
    near(load(true).rand()(), 0.4);
    near(load(false).rand()(), 0.6);
  } finally { Math.random = real; }
});

test('rewardMul applies the hardcore reward factor', () => {
  near(load(true).rewardMul(), 1.75);
  near(load(false).rewardMul(), 1);
});

test('rules are wired into the game sources', () => {
  assert.match(body(source('js/ui/run-ui.js'), 'function rerollsLeft()'), /G\.Modes\.noReroll\(\)/);
  assert.match(body(source('js/entities/player.js'), '  heal(amount, quiet = false) {'), /G\.Modes\.healK\(\)/);
  assert.match(source('js/entities/player.js'), /this\.regen \* G\.Modes\.healK\(\) \* dt/);
  assert.match(source('js/entities/player.js'), /ab\.revive && !G\.Modes\.noRevive\(\) && ab\.revive\(this\)/);
  assert.match(body(source('js/systems/interact.js'), 'function spring('), /G\.Modes\.healK\(\)/);
  assert.match(body(source('js/game.js'), 'function reviveTick(dt)'), /G\.Modes\.noRevive\(\)/);
  assert.match(body(source('js/systems/evolution.js'), 'function onKill(pl, e, rand)'), /G\.Modes\.rand\(\)/);
  const sp = source('js/systems/spawner.js');
  assert.equal(sp.split('G.Modes.scaleEnemy(').length - 1, 2, 'spawnOne and spawnBoss');
  assert.match(sp, /G\.Modes\.rateK\(\)/);
});

test('passive heals that skip Player.heal also feel hardcore', () => {
  assert.match(source('js/data/ability-fx.js'), /pl\.maxHp \* k \* G\.Modes\.healK\(\)/);
  assert.match(source('js/data/passive-fx.js'), /v \/ 1000 \* G\.Modes\.healK\(\)/);
  assert.match(source('js/entities/player.js'), /this\.hp \+ h \* G\.Modes\.healK\(\)/);
});
