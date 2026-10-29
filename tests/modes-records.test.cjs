const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const KEYS = ['bestWave', 'bestWaveHc', 'bestStage', 'bestStageHc', 'rushClears', 'rushClearsHc'];

function modes(save) {
  const G = { DB: { save } };
  new Function('G', source('js/systems/modes.js'))(G);
  G.Modes.register('wave', { id: 'wave', name: 'Wave', classic: false });
  G.Modes.register('bossrush', { id: 'bossrush', name: 'Boss Rush', classic: false, arena: true });
  return G;
}
const fresh = () => ({ stats: Object.fromEntries(KEYS.map(k => [k, 0])) });

test('stats defaults include the six record keys at 0', () => {
  const db = source('js/core/db.js');
  const block = db.slice(db.indexOf('stats: {'), db.indexOf('stats: {') + 600);
  for (const k of KEYS) assert.match(block, new RegExp(k + ': 0'), k);
});

test('record keeps the max and routes hc to the Hc key', () => {
  const G = modes(fresh()), M = G.Modes, S = G.DB.save.stats;
  M.begin({ type: 'wave', hc: false }, []);
  M.record(7); M.record(3);
  assert.equal(S.bestWave, 7); assert.equal(S.bestWaveHc, 0);
  M.end();
  M.begin({ type: 'wave', hc: true }, []);
  M.record(4);
  assert.equal(S.bestWaveHc, 4); assert.equal(S.bestWave, 7);
  M.end();
  M.begin({ type: 'bossrush', hc: false }, []);
  M.record(6); M.recordClear(); M.recordClear();
  assert.equal(S.bestStage, 6); assert.equal(S.rushClears, 2); assert.equal(S.rushClearsHc, 0);
  M.end();
  M.begin({ type: 'bossrush', hc: true }, []);
  M.record(2); M.recordClear();
  assert.equal(S.bestStageHc, 2); assert.equal(S.rushClearsHc, 1); assert.equal(S.bestStage, 6);
  assert.deepEqual(M.recordKeys(), { best: 'bestStageHc', clears: 'rushClearsHc' });
});

test('record ignores garbage numbers and modes without records', () => {
  const G = modes(fresh()), M = G.Modes, S = G.DB.save.stats;
  M.record(5);                       // Normal: nothing to record
  assert.deepEqual(Object.values(S), [0, 0, 0, 0, 0, 0]);
  M.begin({ type: 'wave' }, []);
  M.record(NaN); M.record(-3); M.record('x');
  assert.equal(S.bestWave, 0);
});

test('endRun keeps Normal-only data away from other modes', () => {
  const src = source('js/game.js');
  assert.match(src, /if \(G\.Modes\.classic\(\)\) \{[^\n]*\n\s*save\.stats\.bestTime = /);
  assert.match(src, /G\.Modes\.classic\(\) && \(!coop \|\| G\.Coop\.isHost\)/);
  assert.match(src, /time: G\.Modes\.classic\(\) \? time : 0/);
  assert.match(src, /const ok = G\.Modes\.classic\(\) && clean\(\)/);
  assert.match(src, /G\.Modes\.rewardMul\(\)/);
  assert.match(src, /const modeResult = G\.Modes\.result\(\)/);
  assert.match(src, /mode: modeInfo/);
  assert.match(src, /const record = G\.Modes\.classic\(\) && time > save\.stats\.bestTime/);
});

test('Prestige XP takes the mode multiplier', () => {
  const G = { DB: {}, DEX_BY: {} };
  const src = source('js/systems/prestige.js');
  assert.match(src, /\* \(r\.mul \|\| 1\)/);
  assert.match(source('js/game.js'), /mul: G\.Modes\.rewardMul\(\)/);
});

test('sanitize caps the record keys', () => {
  assert.match(source('js/core/db.js'), /for \(const k of \['bestWave'/);
});

function progress(classic, inArena) {
  const G = { Icons: { html: () => '' }, T: s => s, UI: { toast() {} }, Audio: { sfx() {} }, DEX: [], SPRITE_META: {}, Moves: { EVO: {} }, U: { TYPE_NAME: { fire: 'Fire' } }, Rift: { inArena }, Judgment: { active: false }, Modes: { classic: () => classic },
    Ranking: { periodIds: () => ({ d: 'd', w: 'w', m: 'm' }) } };
  for (const f of ['js/data/missions.js', 'js/data/achievements.js']) new Function('G', source(f))(G);
  const el = { classList: { contains: () => true, remove() {}, add() {} }, style: {}, querySelector: () => el, addEventListener() {} };
  global.document = { getElementById: () => el };
  const save = { created: 1, legends: {}, stats: { bossesTotal: 0 }, missions: {}, ach: {} };
  G.DB = { save };
  new Function('G', source('js/systems/progress.js'))(G);
  return { G, save };
}

test('Progress.kill passes legend 0 outside Normal but still counts the boss', () => {
  const a = progress(false, true);
  a.G.Progress.kill({ boss: true, dex: 150, types: [] });
  assert.deepEqual(a.save.legends, {});
  assert.equal(a.save.stats.bossesTotal, 1);
  const b = progress(true, true);
  b.G.Progress.kill({ boss: true, dex: 150, types: [] });
  assert.ok(b.save.legends[150], 'Normal keeps the old behaviour');
});
