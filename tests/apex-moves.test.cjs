const { test } = require('node:test');
const assert = require('node:assert/strict');
const { world } = require('./helpers/apex-world.cjs');

Math.random = () => 0.37;                       // azar fijo: las pruebas de geometría son reproducibles

const fresh = (o, bo) => { const w = world(o); const b = w.boss(bo); return Object.assign(w, { b, A: w.G.ApexMoves }); };
const dist = (h, a) => Math.hypot(h.x - a.x, h.y - a.y);

// ---------------- contexto y envoltorios ----------------

test('zone/beam wrappers apply cat, type, color and capped damage', () => {
  const w = fresh();
  const ctx = w.A.makeCtx(w.b, w.pl, {});
  const h = ctx.zone(0, 0, 50, 1, 9);
  assert.equal(h.dmg, 60 * 1.5);
  assert.equal(h.cat, w.b.cat);
  assert.equal(h.type, w.b.atkType);
  assert.equal(h.color, '#ff6a1f');
  assert.equal(h.kind, 'zone');
  const e = w.A.makeCtx(w.b, w.pl, {}, { echo: true }).zone(0, 0, 50, 1, 9);
  assert.equal(e.dmg, 60 * 1.5 * 0.7);
  const b = ctx.beam(0, 0, 0, 200, 20, 1, 1);
  assert.equal(b.kind, 'beam');
  assert.equal(b.dmg, 60);
});

test('wrappers refuse too-short delays and more than 40 hazards', () => {
  const w = fresh();
  const ctx = w.A.makeCtx(w.b, w.pl, {});
  assert.equal(ctx.zone(0, 0, 50, 0.3), null);
  assert.equal(ctx.out.length, 0);
  for (let i = 0; i < 45; i++) ctx.zone(0, 0, 20, 1);
  assert.equal(ctx.out.length, 40);
  assert.equal(w.G.Hazards.count, 40);
});

// ---------------- phép dựng ----------------

const P = (w, name, opts, ctxOpts) => w.A.PRIMS[name](w.A.makeCtx(w.b, w.pl, {}, ctxOpts), opts);

test('every primitive creates the expected hazards and keeps them inside the arena', () => {
  const w = fresh({ players: 2 });
  const cases = [
    ['ring', { n: 8, r: 120, hr: 40, delay: 1 }, 8, 'zone'],
    ['spiral', { n: 8, r0: 40, r1: 250, turns: 1.5, hr: 40, delay: 1, stagger: 0.1 }, 8, 'zone'],
    ['sweep', { nBeams: 3, spacing: 0.5, steps: 3, stepAngle: 0.3, len: 400, w: 26, delay: 1, step: 0.3 }, 9, 'beam'],
    ['rain', { n: 10, hr: 40, delay: 1, stagger: 0.1, around: 'arena' }, 10, 'zone'],
    ['rain', { n: 6, hr: 40, delay: 1, stagger: 0.1, around: 'players' }, 6, 'zone'],
    ['target', { r: 60, delay: 1.0 }, 2, 'zone'],
    ['lanes', { n: 5, width: 40, axis: 'x', gapIndex: 2, delay: 1, step: 0.2 }, 4, 'beam'],
    ['lanes', { n: 5, width: 40, axis: 'y', gapIndex: 2, delay: 1, step: 0.2 }, 4, 'beam'],
    ['converge', { rings: 3, r0: 220, r1: 60, n: 6, hr: 40, delay: 1, stagger: 0.4 }, 18, 'zone']
  ];
  for (const [name, opts, n, kind] of cases) {
    const hs = P(w, name, opts);
    assert.equal(hs.length, n, name + ' ' + JSON.stringify(opts.axis || opts.around || ''));
    for (const h of hs) {
      assert.equal(h.kind, kind, name);
      assert.ok(dist(h, w.arena) <= w.arena.r + 0.01, `${name}: origin outside the arena (${h.x}, ${h.y})`);
    }
  }
});

test('ring leaves a gap and echo rotates the pattern', () => {
  const w = fresh();
  const open = P(w, 'ring', { n: 8, r: 120, hr: 40, delay: 1 });
  const gap = P(w, 'ring', { n: 8, r: 120, hr: 40, delay: 1, gap: 0 });
  assert.ok(gap.length < open.length, 'the gap removes at least one zone');
  const echo = P(w, 'ring', { n: 8, r: 120, hr: 40, delay: 1 }, { echo: true });
  const key = hs => hs.map(h => [Math.round(h.x), Math.round(h.y)]);
  assert.notDeepEqual(key(echo), key(open));
});

test('target creates one zone per living player, flagged, and nothing without players', () => {
  const w = fresh({ players: 3 });
  w.players[1].dead = true;
  const hs = P(w, 'target', { r: 60, delay: 1.0 });
  assert.equal(hs.length, 2);
  assert.ok(hs.every(h => h.target === true));
  assert.equal(hs[0].x, w.players[0].x);
  const none = fresh({ players: 0 });
  assert.deepEqual(P(none, 'target', { r: 60, delay: 1.0 }), []);
  assert.deepEqual(P(w, 'target', { r: 60, delay: 0.5 }), [], 'a warning too short to outrun is refused');
  assert.doesNotThrow(() => P(none, 'rain', { n: 4, hr: 40, delay: 1, stagger: 0.1, around: 'players' }));
});

test('primitives are deterministic with a fixed Math.random', () => {
  const a = fresh({ players: 2 }), b = fresh({ players: 2 });
  const opts = { n: 10, hr: 40, delay: 1, stagger: 0.1, around: 'arena' };
  const key = hs => hs.map(h => [h.x, h.y, h.delay].join(','));
  assert.deepEqual(key(P(a, 'rain', opts)), key(P(b, 'rain', opts)));
});

// ---------------- Task 2: las 18 habilidades ----------------

const { coverage } = require('./helpers/apex-world.cjs');
const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy', 'psychic'];

test('every one of the 18 types has a move with English name and description', () => {
  const w = fresh();
  assert.deepEqual(Object.keys(w.A.MOVES).sort(), [...TYPES].sort());
  const ids = new Set();
  for (const t of TYPES) {
    const m = w.A.MOVES[t];
    assert.ok(m.name.length > 3 && m.desc.length > 10, t);
    assert.ok(!/[áéíóúñ¿¡]/.test(m.name + m.desc), t);
    assert.ok(typeof m.build === 'function' && m.wind > 0 && m.after > 0, t);
    assert.ok(!ids.has(m.id), 'duplicate id ' + m.id);
    ids.add(m.id);
  }
});

test('of picks the first type and handles bad input', () => {
  const w = fresh();
  assert.equal(w.A.of(['fire', 'flying']).id, w.A.MOVES.fire.id);
  assert.equal(w.A.of([]), null);
  assert.equal(w.A.of(undefined), null);
  assert.equal(w.A.of(['nope']), null);
});

/** Agrupa hazards que estallan casi a la vez (un jugador no puede esquivar dos de ellos por separado). */
function groups(hs) {
  const sorted = [...hs].sort((a, b) => a.delay - b.delay), out = [];
  for (const h of sorted) {
    const g = out[out.length - 1];
    if (g && h.delay - g[0].delay < 0.25) g.push(h); else out.push([h]);
  }
  return out;
}

function checkLimits(w, hs, label, dmgCap) {
  const L = w.A.LIMITS;
  assert.ok(hs.length > 0 && hs.length <= L.MAX_HAZARDS, `${label}: ${hs.length} hazards`);
  for (const h of hs) {
    assert.ok(h.dmg <= 60 * dmgCap + 1e-9, `${label}: dmg ${h.dmg}`);
    assert.ok(h.delay >= (h.target ? L.MIN_TARGET_DELAY : L.MIN_DELAY), `${label}: delay ${h.delay}`);
  }
  assert.ok(coverage(w.G, hs, w.arena).depth <= L.MAX_OVERLAP + 1, `${label}: overall overlap`);
  for (const g of groups(hs)) {
    const c = coverage(w.G, g, w.arena);
    assert.ok(c.depth <= L.MAX_OVERLAP, `${label}: overlap ${c.depth} in a group of ${g.length} (delay ${g[0].delay})`);
    assert.ok(1 - c.frac >= L.MIN_SAFE, `${label}: only ${(1 - c.frac).toFixed(2)} safe in a group of ${g.length} (delay ${g[0].delay})`);
  }
}

test('every move respects the difficulty limits for 1, 2 and 4 players, with and without fury, over several seeds', () => {
  const random = Math.random;
  try { for (const seed of [0.1, 0.37, 0.61]) { Math.random = () => seed; limitsFor(seed); } } finally { Math.random = random; }
});

function limitsFor(seed) {
  for (const type of TYPES) for (const players of [1, 2, 4]) for (const fury of [false, true]) {
    const w = world({ players });
    const b = w.boss({ types: [type], atkType: type, ai: { fury } });
    const cast = {};
    const hs = w.G.ApexMoves.start(b, w.pl, cast);
    w.A = w.G.ApexMoves;
    const label = `seed ${seed} ${type} x${players}${fury ? ' fury' : ''}`;
    checkLimits(w, hs, label, 1.5);
    if (fury) {
      w.G.Hazards.clear();
      checkLimits(w, w.A.echo(b, w.pl, cast), label + ' echo', 1.05);
    }
  }
}

test('start sets the cast fields and says the move name once on the host', () => {
  const w = fresh({ host: true }, { types: ['ice'], atkType: 'ice' });
  const cast = {};
  const hs = w.A.start(w.b, w.pl, cast);
  assert.ok(hs.length > 0 && cast.wind > 0 && cast.after > 0);
  assert.equal(cast.sig, w.A.MOVES.ice);
  assert.equal(w.calls.say.length, 1);
  assert.ok(w.calls.say[0].includes(w.A.MOVES.ice.name));
  const g = fresh({ active: true, host: false }, { types: ['ice'], atkType: 'ice' });
  g.A.start(g.b, g.pl, {});
  assert.equal(g.calls.say.length, 0, 'a guest does not announce');
});

test('start on an unknown type does nothing', () => {
  const w = fresh({}, { types: ['nope'], atkType: 'nope' });
  const cast = {};
  assert.deepEqual(w.A.start(w.b, w.pl, cast), []);
  assert.equal(cast.sig, undefined);
  assert.equal(w.G.Hazards.count, 0);
});

test('with fury the cast is long enough for the echo', () => {
  const w = fresh({}, { ai: { fury: true } });
  const cast = {};
  w.A.start(w.b, w.pl, cast);
  assert.ok(cast.after >= w.A.LIMITS.ECHO.delay);
});

test('echo runs once, is weaker and rotated, and never after the boss died', () => {
  const w = fresh({ players: 2 }, { types: ['fire'], atkType: 'fire' });
  const cast = {};
  const first = w.A.start(w.b, w.pl, cast);
  const e1 = w.A.echo(w.b, w.pl, cast);
  assert.equal(e1.length, first.length);
  assert.ok(e1[0].dmg < first[0].dmg && Math.abs(e1[0].dmg - first[0].dmg * 0.7) < 1e-9);
  assert.notEqual(Math.round(e1[0].x) + ',' + Math.round(e1[0].y), Math.round(first[0].x) + ',' + Math.round(first[0].y));
  assert.deepEqual(w.A.echo(w.b, w.pl, cast), [], 'only once');
  const c2 = {}; w.A.start(w.b, w.pl, c2);
  w.b.dead = true;
  assert.deepEqual(w.A.echo(w.b, w.pl, c2), []);
});

test('flying, bug and fairy moves fire a volley; the shot is part of the cast', () => {
  for (const t of ['flying', 'bug', 'fairy']) {
    const w = fresh({}, { types: [t], atkType: t });
    const cast = {};
    w.A.start(w.b, w.pl, cast);
    assert.ok(cast.shot && cast.shot.n >= 7, t);
  }
});

test('only hz is broadcast when a move runs on the host', () => {
  for (const t of TYPES) {
    const w = fresh({ host: true, players: 2 }, { types: [t], atkType: t });
    w.A.start(w.b, w.pl, {});
    assert.ok(w.calls.broadcast.length > 0, t);
    assert.ok(w.calls.broadcast.every(m => m[0] === 'hz'), t);
  }
});

// ---------------- lượt sửa sau review ----------------

test('target zones can be outrun: the warning is long enough for the radius', () => {
  for (const type of TYPES) for (const players of [1, 4]) {
    const w = world({ players });
    const b = w.boss({ types: [type], atkType: type, ai: { fury: true } });
    const cast = {};
    const hs = w.G.ApexMoves.start(b, w.pl, cast).concat(w.G.ApexMoves.echo(b, w.pl, cast));
    for (const h of hs.filter(x => x.target)) {
      const need = (h.r + 11) / 100 + 0.25;                       // salir del círculo a ~100 px/s tras 0,25 s de reacción
      assert.ok(h.delay >= need - 1e-9, `${type}: target r${h.r} warns ${h.delay} s, needs ${need.toFixed(2)}`);
    }
  }
});

const LAYOUTS = {
  center: () => {},
  east: w => { w.b.x = 250; w.b.y = 0; },
  north: w => { w.b.x = 0; w.b.y = -250; },
  stacked: w => { w.players[0].x = w.b.x; w.players[0].y = w.b.y; },
  rim: w => { w.players[0].x = 318; w.players[0].y = 0; }
};

test('limits hold with the boss against a wall, a player on the boss and a player on the rim', () => {
  const random = Math.random;
  try {
    for (const seed of [0.1, 0.61]) { Math.random = () => seed; for (const [name, put] of Object.entries(LAYOUTS)) for (const type of TYPES) for (const players of [1, 4]) {
      const w = world({ players });
      w.b = w.boss({ types: [type], atkType: type, ai: { fury: false } });
      put(w);
      w.A = w.G.ApexMoves;
      checkLimits(w, w.A.start(w.b, w.pl, {}), `seed ${seed} ${name} ${type} x${players}`, 1.5);
    } }
  } finally { Math.random = random; }
});

test('start and echo together stay inside 40 hazards and keep every simultaneous group dodgeable', () => {
  const random = Math.random;
  try {
    for (const seed of [0.1, 0.37, 0.61]) { Math.random = () => seed; for (const type of TYPES) for (const players of [1, 2, 4]) {
      const w = world({ players });
      const b = w.boss({ types: [type], atkType: type, ai: { fury: true } });
      const A = w.G.ApexMoves, cast = {};
      const first = A.start(b, w.pl, cast);
      const at = cast.wind + A.LIMITS.ECHO.delay;                 // cuándo se crea el eco, en tiempo de la tirada
      const echo = A.echo(b, w.pl, cast).map(h => Object.assign({}, h, { delay: h.delay + at }));
      const label = `seed ${seed} ${type} x${players}`;
      assert.ok(first.length + echo.length <= A.LIMITS.MAX_HAZARDS, `${label}: ${first.length + echo.length} hazards`);
      for (const g of groups(first.concat(echo))) {
        const c = coverage(w.G, g, w.arena);
        assert.ok(c.depth <= A.LIMITS.MAX_OVERLAP, `${label}: overlap ${c.depth} at t=${g[0].delay.toFixed(2)}`);
        assert.ok(1 - c.frac >= A.LIMITS.MIN_SAFE, `${label}: ${(1 - c.frac).toFixed(2)} safe at t=${g[0].delay.toFixed(2)}`);
      }
    } }
  } finally { Math.random = random; }
});

test('start records when its last hazard goes off, and the echo extends it', () => {
  const w = fresh({ players: 2 }, { types: ['steel'], atkType: 'steel', ai: { fury: true } });
  const cast = { t: 0 };
  const hs = w.A.start(w.b, w.pl, cast);
  assert.equal(cast.span, Math.max(...hs.map(h => h.delay)));
  cast.t = 2;
  const e = w.A.echo(w.b, w.pl, cast);
  assert.equal(cast.span, 2 + Math.max(...e.map(h => h.delay)));
});

test('sweeps and rings aim at the player the boss is hunting, not at the host', () => {
  const w = world({ players: 2 });
  const b = w.boss({ types: ['ground'], atkType: 'ground' });
  const guest = w.players[1];
  const ctx = w.G.ApexMoves.makeCtx(b, guest, {});
  const hs = w.G.ApexMoves.PRIMS.sweep(ctx, { nBeams: 1, spacing: 0, steps: 1, stepAngle: 0, len: 300, w: 20, delay: 1, step: 0 });
  assert.ok(Math.abs(hs[0].angle - Math.atan2(guest.y - b.y, guest.x - b.x)) < 1e-9);
  const dead = w.G.ApexMoves.makeCtx(b, guest, {});
  guest.dead = true;
  const ctx2 = w.G.ApexMoves.makeCtx(b, guest, {});
  assert.equal(ctx2.focus, w.players[0], 'a dead hunted player falls back to a living one');
  assert.equal(dead.focus, guest);
});
