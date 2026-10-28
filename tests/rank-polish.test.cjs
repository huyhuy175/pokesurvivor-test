const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('updater does not reload while the wish-pick panel is open', () => {
  const src = source('js/core/updater.js');
  assert.match(src, /getElementById\('wish-pick'\)/);
  const safe = src.slice(src.indexOf('function safe()'), src.indexOf('async function reload'));
  assert.match(safe, /wish-pick[\s\S]*return false/);
});

test('Escape closes the wish-pick panel', () => {
  const src = source('js/ui/gacha-ui.js');
  assert.match(src, /e\.key === 'Escape' && !\$\('wish-pick'\)\.classList\.contains\('hidden'\)\) closePick\(\)/);
});

test('Free Pick draws its cards in chunks, not in one go', () => {
  const src = source('js/ui/gacha-ui.js');
  const render = src.slice(src.indexOf('function renderPick'), src.indexOf('function choose'));
  assert.match(render, /CHUNK/);
  assert.match(render, /requestAnimationFrame/);
  assert.match(render, /token !== pickToken/);
});

test('Pokédex cells get a rarity class from 4★ and an always-present rank row', () => {
  const src = source('js/ui/menu.js');
  assert.match(src, /p\.rarity >= 4 \? ' r' \+ p\.rarity/);
  assert.match(src, /<div class="rank-stars">\$\{rs > 0/);
  const css = source('css/style.css');
  assert.match(css, /\.cell\.r4\s*\{/);
  assert.match(css, /\.cell\.r5\s*\{/);
  assert.match(css, /\.cell \.rank-stars\s*\{/);
  assert.match(css, /b\.u5\s*\{/);
});

test('the unique name of a 5-star Pokémon is gold, others are not', () => {
  const G = { Mons: {}, Rank: {}, UI: { rankStars: () => '' }, DEX_BY: { 1: { rarity: 5 }, 2: { rarity: 3 }, 3: { rarity: 5 } } };
  const ab = { 1: { name: 'A', desc: 'd', unique: { name: 'UNI1', desc: 'x', locked: false } },
               2: { name: 'B', desc: 'd', unique: { name: 'UNI2', desc: 'x', locked: true } },
               3: { name: 'C', desc: 'd', unique: { name: 'UNI3', desc: 'x', locked: true } } };
  G.Mons.abilityOf = d => ab[d];
  G.Rank.progress = () => ({ stars: 0, next: 1, missing: 1 });
  G.T = s => s; G.UI.isOpen = () => false;
  const src = source('js/ui/menu.js');
  const start = src.indexOf('function rankHtml'), end = src.indexOf('function monExtras');
  const rankHtml = new Function('G', src.slice(start, end) + '; return rankHtml;')(G);
  assert.match(rankHtml(1), /<b class="u5" translate="no">UNI1<\/b>/);
  assert.doesNotMatch(rankHtml(2), /u5/);
  assert.match(rankHtml(3), /mx-locked"><span>Unique<\/span><b class="u5"/);
});

test('lifeSteal heals without a floating number and spectralClone describes what it does', () => {
  const G = { U: {}, EnemyMgr: { queryCircle: () => [] } };
  new Function('G', source('js/data/passive-unique-fx.js'))(G);
  const T = G.UniqueFX.TEMPLATES;
  const calls = [];
  const pl = { maxHp: 200, heal: (n, quiet) => calls.push([n, quiet]) };
  const rnd = Math.random; Math.random = () => 0;
  try { T.lifeSteal.hooks(10).hit(pl); } finally { Math.random = rnd; }
  assert.deepEqual(calls, [[2, true]]);
  assert.match(T.spectralClone.text(100), /followed by a spectral echo that deals extra damage/);
  assert.doesNotMatch(T.spectralClone.text(100), /repeats/);
});

test('Player.heal shows the number unless asked to stay quiet', () => {
  const src = source('js/entities/player.js');
  assert.match(src, /heal\(amount, quiet = false\)/);
  assert.match(src, /got >= 1 && !quiet/);
});
