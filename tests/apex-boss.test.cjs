const { test } = require('node:test');
const assert = require('node:assert/strict');
const { world } = require('./helpers/enemy-world.cjs');
const { source } = require('./helpers/apex-world.cjs');

// Azar reproducible (LCG) que se restaura al terminar cada prueba.
function seeded(fn) {
  const random = Math.random;
  let s = 12345;
  Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  try { return fn(); } finally { Math.random = random; }
}

function boss(opts = {}, o = {}) {
  const w = world(opts);
  w.G.U.pick = a => a[Math.floor(Math.random() * a.length)];      // el de verdad escoge al azar
  const e = w.enemy(o);
  e.bossInit();
  return Object.assign(w, { e });
}

/** Avanza bossCast hasta que acaba el lanzamiento (o se pasa el tiempo). Devuelve los segundos que duró. */
function runCast(w, maxT = 12, dt = 0.05) {
  let t = 0;
  while (w.e.ai.cast && t < maxT) { w.e.bossCast(dt, w.pl); t += dt; }
  return t;
}

test('an Apex gets the sig move in its ranged list and a normal legend does not', () => {
  const a = boss({}, { apex: true });
  assert.ok(a.e.ai.ranged.includes('sig'));
  assert.equal(a.e.ai.sig.id, a.G.ApexMoves.MOVES.psychic.id);
  const n = boss({}, { apex: false });
  assert.ok(!n.e.ai.ranged.includes('sig'));
  assert.equal(n.e.ai.sig, undefined);
});

test('an Apex whose type has no move behaves like a normal legend', () => {
  const w = boss({}, { apex: true, dex: 999 });
  assert.ok(!w.e.ai.ranged.includes('sig'));
  assert.equal(w.e.ai.sig, undefined);
  w.e.ai.fury = true;
  seeded(() => { for (let i = 0; i < 100; i++) assert.notEqual(w.e.pickRanged(), 'sig'); });
});

test('bossStart sig creates hazards and bossCast ends the cast normally', () => {
  const w = boss({ players: 2 }, { apex: true });
  w.e.bossStart('sig', w.pl);
  assert.equal(w.e.ai.cast.id, 'sig');
  assert.ok(w.G.Hazards.count > 0);
  assert.ok(w.e.ai.cast.wind > 0 && w.e.ai.cast.sig);
  const t = runCast(w);
  assert.equal(w.e.ai.cast, null, 'the cast ended');
  assert.ok(t < 5, 'it does not hang the boss: ' + t + ' s');
});

test('a volley move fires its shot when the wind-up ends', () => {
  const w = boss({}, { apex: true, dex: 4 });          // fuego: Inferno Spiral, sin disparo
  w.G.ApexMoves.MOVES.fire.build = ctx => { ctx.zone(0, 0, 40, 1); ctx.shot = { spread: 1, n: 5, k: 0.8 }; };
  w.e.bossStart('sig', w.pl);
  runCast(w);
  assert.equal(w.calls.shotsSpawned, 5);
});

test('overdrive: with fury sig is picked half the time, without it as one of three', () => {
  const w = boss({}, { apex: true });
  seeded(() => {
    const count = () => { let n = 0; for (let i = 0; i < 600; i++) if (w.e.pickRanged() === 'sig') n++; return n / 600; };
    w.e.ai.fury = false;
    const calm = count();
    assert.ok(calm > 0.25 && calm < 0.42, 'calm ' + calm);
    w.e.ai.fury = true;
    const mad = count();
    assert.ok(mad > 0.42 && mad < 0.58, 'fury ' + mad);
  });
});

test('overdrive: an echo follows 1.2 s after the wind-up, exactly once', () => {
  const w = boss({ players: 2 }, { apex: true });
  w.e.ai.fury = true;
  w.e.bossStart('sig', w.pl);
  const first = w.G.Hazards.count, c = w.e.ai.cast, L = w.G.ApexMoves.LIMITS.ECHO.delay;
  let t = 0;
  const step = to => { while (t < to && w.e.ai.cast) { w.e.bossCast(0.05, w.pl); t += 0.05; } };
  step(c.wind + L - 0.2);
  assert.equal(w.G.Hazards.count, first, 'not yet');
  step(c.wind + L + 0.3);
  const after = w.G.Hazards.count;
  assert.ok(after > first, 'the echo arrived');
  runCast(w);
  assert.equal(w.G.Hazards.count, after, 'no second echo');
  assert.equal(w.e.ai.cast, null);
});

test('fury switched on in the middle of a sig cast adds one echo and the cast waits for it', () => {
  const w = boss({}, { apex: true });
  w.e.bossStart('sig', w.pl);
  const first = w.G.Hazards.count;
  let t = 0;
  while (t < w.e.ai.cast.wind + 0.3) { w.e.bossCast(0.05, w.pl); t += 0.05; }
  w.e.ai.fury = true;
  runCast(w);
  assert.ok(w.G.Hazards.count > first, 'echo created');
  assert.equal(w.e.ai.cast, null);
  const n = w.G.Hazards.count;
  w.e.bossStart('sig', w.pl);                           // otra tirada, ya con fury: su propio eco
  runCast(w);
  assert.ok(w.G.Hazards.count > n);
});

test('no hazards are created by an echo after the boss died', () => {
  const w = boss({}, { apex: true });
  w.e.ai.fury = true;
  w.e.bossStart('sig', w.pl);
  const first = w.G.Hazards.count, c = w.e.ai.cast;
  let t = 0;
  while (t < c.wind + 0.3) { w.e.bossCast(0.05, w.pl); t += 0.05; }
  w.e.dead = true;
  runCast(w);
  assert.equal(w.G.Hazards.count, first);
});

test('a normal legend never picks or starts sig, even enraged', () => {
  const w = boss({}, { apex: false });
  w.e.ai.fury = true;
  let calls = 0;
  const start = w.G.ApexMoves.start;
  w.G.ApexMoves.start = (...a) => { calls++; return start(...a); };
  seeded(() => { for (let i = 0; i < 300; i++) assert.notEqual(w.e.pickRanged(), 'sig'); });
  for (const id of [...w.e.ai.melee, ...w.e.ai.ranged]) { w.e.bossStart(id, w.pl); runCast(w); }
  assert.equal(calls, 0);
});

test('clearing the hazards (rift ends) leaves nothing pending', () => {
  const w = boss({ players: 4 }, { apex: true });
  w.e.bossStart('sig', w.pl);
  assert.ok(w.G.Hazards.count > 0);
  w.G.Hazards.clear();
  assert.equal(w.G.Hazards.count, 0);
});

test('dev.html loads apex-moves.js before enemy.js', () => {
  const html = source('dev.html');
  const a = html.indexOf('js/data/apex-moves.js'), b = html.indexOf('js/entities/enemy.js');
  assert.ok(a > 0 && b > 0 && a < b);
});

test('the boss waits for its pending hazards before starting another attack', () => {
  const w = boss({ players: 2 }, { apex: true, dex: 4 });             // fuego: Inferno Spiral (hasta ~2,3 s)
  w.e.bossStart('sig', w.pl);
  const span = w.e.ai.cast.span;
  assert.ok(span > w.e.ai.cast.wind + w.e.ai.cast.after, 'the hazards outlive the cast');
  let t = 0;
  while (w.e.ai.cast && t < 12) { w.e.bossCast(0.05, w.pl); t += 0.05; }
  assert.ok(w.e.ai.cd >= span - t - 0.01, `cd ${w.e.ai.cd} must cover the ${(span - t).toFixed(2)} s still pending`);
});

test('a chained cast in fury still waits for the pending hazards', () => {
  const w = boss({ players: 2 }, { apex: true, dex: 4 });
  w.e.ai.fury = true;
  const random = Math.random;
  Math.random = () => 0.01;                                          // 0,35 de encadenar: sale seguro
  try {
    w.e.bossStart('sig', w.pl);
    const span = w.e.ai.cast.span;
    let t = 0;
    while (w.e.ai.cast && t < 12) { w.e.bossCast(0.05, w.pl); t += 0.05; }
    assert.ok(w.e.ai.cd > 0.3, 'chain did not shorten the wait: ' + w.e.ai.cd);
    assert.ok(w.e.ai.cast === null && w.e.ai.cd >= (w.e.ai.cast ? 0 : 0.3));
    assert.ok(span > 0);
  } finally { Math.random = random; }
});
