// Cliente mínimo de la API de ComfyUI (http://127.0.0.1:8188). Sin dependencias.
const fs = require('fs');
const path = require('path');

const HOST = process.env.COMFY_URL || 'http://127.0.0.1:8188';

// Workflow SDXL + LoRA Pixel Art XL (texto -> imagen).
// Con `image` (nombre ya subido a ComfyUI) y `denoise` < 1 es imagen -> imagen: conserva la silueta de la referencia.
function workflow({ prompt, negative, width, height, seed, steps, cfg, lora, loraStrength, image, denoise }) {
  const latent = image
    ? { 9: { class_type: 'LoadImage', inputs: { image } }, 10: { class_type: 'VAEEncode', inputs: { pixels: ['9', 0], vae: ['1', 2] } } }
    : { 5: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } } };
  return Object.assign({}, latent, {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
    2: { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['1', 1], lora_name: lora, strength_model: loraStrength, strength_clip: loraStrength } },
    3: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: prompt } },
    4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 1], text: negative } },
    6: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: image ? ['10', 0] : ['5', 0], seed, steps, cfg, sampler_name: 'euler', scheduler: 'normal', denoise: image ? denoise : 1 } },
    7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] } },
    8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: 'pokesurvivor' } },
  });
}

/** Sube una imagen local a la carpeta input de ComfyUI y devuelve el nombre para LoadImage. */
async function upload(file) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('overwrite', 'true');
  const r = await fetch(HOST + '/upload/image', { method: 'POST', body: form });
  if (!r.ok) throw new Error('No se pudo subir la imagen: ' + await r.text());
  return (await r.json()).name;
}

async function generate(opts, outFile) {
  const o = Object.assign({
    negative: 'blurry, antialiased, smooth gradient, photo, text, watermark, signature, 3d render',
    width: 1024, height: 1024, steps: 25, cfg: 7,
    seed: Math.floor(Math.random() * 2 ** 32),
    lora: 'pixel-art-xl.safetensors', loraStrength: 1.0, denoise: 0.65,
  }, opts);
  if (o.refFile) o.image = await upload(o.refFile);
  const r = await fetch(HOST + '/prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow(o) }),
  });
  if (!r.ok) throw new Error('ComfyUI rechazó el workflow: ' + await r.text());
  const { prompt_id } = await r.json();
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    const h = await (await fetch(HOST + '/history/' + prompt_id)).json();
    const e = h[prompt_id];
    if (!e) continue;
    if (e.status && e.status.status_str === 'error') throw new Error('Fallo al generar: ' + JSON.stringify(e.status.messages));
    const img = e.outputs && e.outputs[8] && e.outputs[8].images && e.outputs[8].images[0];
    if (!img) continue;
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const buf = Buffer.from(await (await fetch(HOST + '/view?' + q)).arrayBuffer());
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, buf);
    return { file: outFile, seed: o.seed };
  }
}

module.exports = { generate };
