// Prueba rápida: node tools/asset-gen/test.js ["prompt"]
const path = require('path');
const { generate } = require('./comfy');

const prompt = process.argv[2] || 'pixel art, a small fire-type fox creature, front view, game sprite, simple flat background';
const out = path.join(__dirname, 'out', 'test.png');
const t = Date.now();
generate({ prompt }, out)
  .then(r => console.log('OK', r.file, 'seed', r.seed, ((Date.now() - t) / 1000).toFixed(1) + 's'))
  .catch(e => { console.error(e.message); process.exit(1); });
