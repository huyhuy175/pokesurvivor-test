// Genera las hojas de una Mega recoloreando las de su base.
//   node tools/asset-gen/make_mega.js 10001 10016        -> out/megas/{dex}/ (para revisar)
//   node tools/asset-gen/make_mega.js 10001 --install    -> además copia a assets/pokemon/{dex}/ y regenera js/data/mega-sprites.js (vía tools/fetch_mega_sprites.py --regen)
//   node tools/asset-gen/make_mega.js --all --install    -> todas las que tengan paleta en palettes/
// Paleta de cada Mega: tools/asset-gen/palettes/{dexMega}.json (colores exactos del sprite base -> nuevos).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const PY = process.env.COMFY_PY || 'F:/ComfyUI/ComfyUI_windows_portable/python_embeded/python.exe';

global.G = {};
new Function('G', fs.readFileSync(path.join(root, 'js/data/sprites-meta.js'), 'utf8'))(G);
const megaTxt = fs.readFileSync(path.join(root, 'js/data/mega.js'), 'utf8');
const baseOf = {};
for (const m of megaTxt.matchAll(/"dex":(\d+),"name":"[^"]+","slug":"[^"]+","mega":(\d+)/g)) baseOf[m[1]] = m[2];

const args = process.argv.slice(2);
const install = args.includes('--install');
let megas = args.filter(a => /^\d+$/.test(a));
if (args.includes('--all')) megas = fs.readdirSync(path.join(__dirname, 'palettes')).map(f => f.replace('.json', '')).filter(f => /^\d+$/.test(f));

for (const mega of megas) {
  const base = baseOf[mega];
  if (!base) { console.error('No es una Mega conocida:', mega); continue; }
  const pal = path.join(__dirname, 'palettes', mega + '.json');
  if (!fs.existsSync(pal)) { console.error('Sin paleta, se omite:', mega); continue; }
  const out = install ? path.join(root, 'assets/pokemon', mega) : path.join(__dirname, 'out', 'megas', mega);
  fs.mkdirSync(out, { recursive: true });
  const meta = G.SPRITE_META[base].a;
  for (const anim of Object.keys(meta)) {
    execFileSync(PY, ['-W', 'ignore', '-I', path.join(__dirname, 'recolor_sheet.py'),
      path.join(root, 'assets/pokemon', base, anim + '.png'), String(meta[anim].h), pal, path.join(out, anim + '.png')]);
  }
  console.log(`Mega ${mega} (base ${base}):`, Object.keys(meta).length, 'hojas ->', out);
}

if (install) {
  // mega-sprites.js lo genera tools/fetch_mega_sprites.py (junto con los sprites reales de SpriteCollab).
  execFileSync(PY, ['-W', 'ignore', '-I', path.join(root, 'tools', 'fetch_mega_sprites.py'), '--regen'], { stdio: 'inherit' });
}
