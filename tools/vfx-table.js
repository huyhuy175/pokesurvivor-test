/* Genera docs/VFX_MOVES.md: aspecto de cada movimiento (proyectil, rayo, golpe, aura, estela y efecto al impactar)
 * para que el dueño del proyecto lo revise.   Uso: node tools/vfx-table.js */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

const hash = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const G = {
  Sprites: { PX: 2 }, U: { hash, rand: (a, b) => (a + b) / 2, lerp: (a, b, t) => a + (b - a) * t, TYPE_COLOR: {}, TYPE_NAME: {} },
  I18n: { add() {}, f: s => s }, Settings: { fx: 2, get: () => true }, Camera: { sees: () => true }, LIFT: 12
};
const document = { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) };
for (const f of ['js/data/moves.js', 'js/entities/vfx.js', 'js/entities/vfx-shapes-1.js', 'js/entities/vfx-shapes-2.js', 'js/entities/fx.js']) {
  new Function('G', 'document', fs.readFileSync(path.join(root, f), 'utf8'))(G, document);
}

const byType = {};
for (const m of G.Moves.ALL) (byType[m.type] = byType[m.type] || []).push(m);

// Solo se muestran los campos que cada kind dibuja de verdad (combat.js); el resto es el valor por defecto sin uso.
const SHOWN = {
  melee: ['melee'], spin: ['melee'], beam: ['beam'], chain: ['beam'], charge: ['beam', 'proj'], aura: ['aura'], buff: ['buff']
};
const SHOWN_DEFAULT = ['proj', 'trail', 'aura'];

const cell = v => (v == null || v === false ? '' : `\`${v}\``);
const lines = [
  '# Aspecto de los movimientos (VFX)',
  '',
  'Generado por `node tools/vfx-table.js` — no se edita a mano. Fuente: `js/entities/vfx.js`, `vfx-shapes-1.js`, `vfx-shapes-2.js`.',
  'Vista animada: abrir `tools/vfx-preview.html`.',
  '',
  '`proj` = proyectil/partícula · `beam` = lo que viaja por el rayo · `melee` = golpe · `aura`/`buff` = partículas · `trail` = estela · `hit` = efecto al impactar.',
  ''
];
let rows = 0;
for (const [type, moves] of Object.entries(byType)) {
  lines.push(`## ${type}`, '', '| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |', '|---|---|---|---|---|---|---|---|---|');
  for (const m of moves) {
    const v0 = G.VFX.forMove(m), shown = SHOWN[m.kind] || SHOWN_DEFAULT;
    const v = {}; for (const k of ['proj', 'beam', 'melee', 'aura', 'buff', 'trail']) v[k] = shown.includes(k) ? v0[k] : null;
    v.hit = m.kind === 'buff' ? null : v0.hit; v.pal = v0.pal;
    lines.push(`| ${m.id} | ${m.kind} | ${cell(v.proj)} | ${cell(v.beam)} | ${cell(v.melee)} | ${cell(v.aura || v.buff)} | ${cell(v.trail)} | ${cell(v.hit)} | ${v.pal === m.type ? '' : cell(v.pal)} |`);
    rows++;
  }
  lines.push('');
}
fs.writeFileSync(path.join(root, 'docs', 'VFX_MOVES.md'), lines.join('\n'));
console.log('docs/VFX_MOVES.md:', rows, 'movimientos');
