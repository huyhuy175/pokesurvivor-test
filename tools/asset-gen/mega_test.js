// Prueba: refina la Mega de un Pokémon a partir de su sprite ya recoloreado. node tools/asset-gen/mega_test.js
const path = require('path');
const { generate } = require('./comfy');
const ref = path.join(__dirname, 'out', 'ref_charizard_x.png');
const prompt = 'pixel art, Mega Charizard X, black armored dragon with blue flames, spiked horns, red eyes, blue wings, front view, game sprite, flat background';
(async () => {
  for (const denoise of [0.4, 0.5, 0.6]) {
    const r = await generate({ prompt, refFile: ref, denoise, seed: 777, steps: 30, cfg: 6 }, path.join(__dirname, 'out', `megaX_d${denoise}.png`));
    console.log('OK', r.file);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
