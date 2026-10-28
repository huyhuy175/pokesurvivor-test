const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// Net con un WebRTC falso: el canal de datos apunta a un "otro extremo" que contesta a mano.
const nets = [];
after(() => nets.forEach(G => G.Net.close()));   // el intervalo de ping mantendría vivo el proceso

function setup() {
  const G = { DB: { fb: { rtdb: { ref: () => ({ on() {}, off() {}, push: () => Promise.resolve() }) }, uid: 'host' } } };
  new Function('G', source('js/net/codec.js'))(G);
  let dc = null;
  global.RTCPeerConnection = class {
    createDataChannel() {
      dc = { readyState: 'open', sent: [], send(x) { this.sent.push(x); }, close() { this.readyState = 'closed'; } };
      return dc;
    }
    async createOffer() { return {}; }
    async setLocalDescription() {}
    get localDescription() { return { toJSON: () => ({ type: 'offer' }) }; }
    close() {}
  };
  new Function('G', source('js/net/net.js'))(G);
  nets.push(G);
  return { G, dc: () => dc };
}
const tick = () => new Promise(r => setImmediate(r));

async function connected() {
  const t = setup(), got = [];
  t.G.Net.open('room', true, 'host');
  t.G.Net.on((from, msg) => got.push(msg));
  t.G.Net.syncMembers(['guest']);
  await tick(); await tick();
  const dc = t.dc();
  dc.onopen();
  return { ...t, dc, got };
}
const jsons = dc => dc.sent.filter(x => typeof x === 'string').map(x => JSON.parse(x));

test('ping is null until a pong arrives, and never for an unknown peer', async () => {
  const { G, dc } = await connected();
  assert.equal(G.Net.ping('guest'), null);
  assert.equal(G.Net.ping('nobody'), null);
  assert.ok(jsons(dc).some(m => m.k === 'ping' && typeof m.t === 'number'), 'sends a ping when the channel opens');
});

test('a pong becomes a rounded ms value and notifies onPing', async () => {
  const { G, dc } = await connected();
  const seen = [];
  G.Net.onPing((u, ms) => seen.push([u, ms]));
  const ping = jsons(dc).find(m => m.k === 'ping');
  dc.onmessage({ data: JSON.stringify({ k: 'pong', t: ping.t }) });
  const ms = G.Net.ping('guest');
  assert.ok(Number.isInteger(ms) && ms >= 0 && ms < 1000);
  assert.deepEqual(seen, [['guest', ms]]);
});

test('an incoming ping is answered with the same timestamp and is not delivered to the game', async () => {
  const { dc, got } = await connected();
  dc.sent.length = 0;
  dc.onmessage({ data: JSON.stringify({ k: 'ping', t: 1234 }) });
  assert.deepEqual(jsons(dc), [{ k: 'pong', t: 1234 }]);
  dc.onmessage({ data: JSON.stringify({ k: 'pong', t: 1 }) });
  assert.deepEqual(got, [], 'ping/pong never reach the handlers');
});

test('garbage or absurd pongs are ignored', async () => {
  const { G, dc } = await connected();
  for (const t of ['x', null, -5, 1e12, NaN]) dc.onmessage({ data: JSON.stringify({ k: 'pong', t }) });
  assert.equal(G.Net.ping('guest'), null);
});

test('the value is smoothed and goes back to null when the channel closes', async () => {
  const { G, dc } = await connected();
  const now = performance.now() + 1000;
  const real = performance.now;
  try {
    performance.now = () => now + 100;
    dc.onmessage({ data: JSON.stringify({ k: 'pong', t: now }) });
    assert.equal(G.Net.ping('guest'), 100);
    dc.onmessage({ data: JSON.stringify({ k: 'pong', t: now + 100 - 200 }) });   // 200 ms → 0,7·100 + 0,3·200 = 130
    assert.equal(G.Net.ping('guest'), 130);
    performance.now = () => now + 100 + 9000;                                    // sin pongs hace > 8 s
    assert.equal(G.Net.ping('guest'), null);
  } finally { performance.now = real; }
  G.Net.close();
  assert.equal(G.Net.ping('guest'), null);
});

test('pingColor: green under 80 ms, yellow under 160 ms, red above', () => {
  const { G } = setup();
  assert.equal(G.Net.pingColor(0), '#5fe08a');
  assert.equal(G.Net.pingColor(79), '#5fe08a');
  assert.equal(G.Net.pingColor(80), '#ffd34d');
  assert.equal(G.Net.pingColor(159), '#ffd34d');
  assert.equal(G.Net.pingColor(160), '#ff5f6d');
});
