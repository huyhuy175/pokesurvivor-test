const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('dev.html has the Modes menu entry, its screen and its script after menu.js', () => {
  const html = source('dev.html');
  assert.match(html, /data-go="modes"/);
  assert.match(html, /id="scr-modes"/);
  assert.ok(html.indexOf('js/ui/modes-ui.js') > html.indexOf('js/ui/menu.js'));
  assert.match(source('js/main.js'), /'ModesUI'/);
});

test('menu.js opens Modes and Play still starts a plain run', () => {
  const m = source('js/ui/menu.js');
  assert.match(m, /go === 'modes'/);
  assert.match(m, /G\.Flow\.play\(\)/);
  assert.match(source('dev.html'), /data-go="play"/);
});

test('Flow.play takes an optional mode and hands it to startRun', () => {
  assert.match(source('js/game.js'), /play\(mode\) \{ G\.Game\.startRun\(null, mode\); \}/);
});

test('modes-ui builds the three cards and a Hardcore switch', () => {
  const u = source('js/ui/modes-ui.js');
  for (const id of ["'normal'", "'wave'", "'bossrush'"]) assert.ok(u.includes(id), id);
  assert.match(u, /hardcore/i);
  assert.match(u, /G\.Flow\.play\(/);
  assert.match(u, /Start the run from the lobby/);
  assert.match(u, /G\.Modes\.normalize/);
});

test('HUD draws the mode line and the HARDCORE badge', () => {
  const h = source('js/ui/hud.js');
  assert.match(h, /G\.Modes\.hudLine\(\)/);
  assert.match(h, /HARDCORE/);
});

test('every screen section of the Modes menu is in the UI screen list, so show/hideAll/Escape handle it', () => {
  assert.match(source('js/ui/ui.js'), /SCREENS = \[[^\]]*'scr-modes'/);
  assert.match(source('js/game.js'), /\['scr-dex'[^\]]*'scr-modes'/);
});
