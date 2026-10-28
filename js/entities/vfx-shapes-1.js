/* ============ vfx-shapes-1.js — formas de ataque: fuego, agua, planta, eléctrico, hielo, tierra, roca, acero, lucha ============
 * Se suman a G.VFX (ver vfx.js): mismas letras (o d m l w, L = claro semitransparente),
 * mismas reglas (miran a la DERECHA; `dir` rota, `spin` gira) y todas con 4-6 fotogramas
 * que enlazan en bucle (la fase sale de f / frames, nada dibujado a mano por fotograma).
 * También asigna a cada movimiento de estos tipos su aspecto (G.VFX.addMoves).
 */
(() => {
  const H = (a, b, c) => G.U.hash(a, b, c);
  const TAU = Math.PI * 2;
  const ph = (f, N) => f / N * TAU;
  const ell = (x, y, cx, cy, rx, ry) => Math.hypot((x - cx) / rx, (y - cy) / ry);

  G.VFX.add({
    // ---------------- fuego ----------------
    fire_comet: { w: 17, h: 9, frames: 4, dir: true, gen(P, f) {
      const p = ph(f, 4);
      for (let x = 0; x <= 11; x++) {                               // cola larga que ondula
        const t = x / 11, th = 0.4 + t * 2.6 + Math.sin(p + x * 0.9) * 0.5;
        const yc = 4 + Math.sin(p + x * 0.7) * 0.6 * (1 - t);
        for (let y = 0; y < P.h; y++) {
          const d = Math.abs(y - yc);
          if (d > th || (t < 0.35 && H(x, y, f) < 0.45)) continue;
          P.set(x, y, d < th * 0.45 && t > 0.35 ? 'l' : 'm');
        }
      }
      P.fill((x, y) => { const d = Math.hypot(x - 13, y - 4); return d < 1.4 ? 'w' : d < 2.6 ? 'l' : d < 3.6 ? 'm' : null; });
      P.outline();
    } },
    fire_ring: { w: 15, h: 15, frames: 6, gen(P, f) {
      const p = ph(f, 6), c = 7;
      for (let i = 0; i < 56; i++) {                                 // lenguas que giran por el aro
        const a = i / 56 * TAU, L = 1.3 + 1.2 * Math.sin(a * 3 - p) + 0.5 * Math.sin(a * 5 + p);
        for (let r = 3.6; r <= 4.6 + L; r += 0.5) P.set(c + Math.cos(a) * r, c + Math.sin(a) * r, r < 4.3 ? 'w' : r < 4.6 + L * 0.5 ? 'l' : 'm');
      }
      P.outline();
    } },
    fire_pillar: { w: 9, h: 17, frames: 6, gen(P, f) {
      const p = ph(f, 6);
      for (let y = 0; y < P.h; y++) {
        const t = (P.h - 1 - y) / (P.h - 1);                          // 0 abajo, 1 en la punta
        const half = 0.6 + 3.4 * Math.pow(1 - t, 0.7) + Math.sin(y * 0.8 - p) * 0.5 * (1 - t) * 1.4;
        const xc = 4 + Math.sin(y * 0.5 - p) * 0.9 * t;
        for (let x = 0; x < P.w; x++) {
          const d = Math.abs(x - xc);
          if (d > half || (t > 0.85 && H(x, y, f) < 0.5)) continue;
          P.set(x, y, d < half * 0.3 && t < 0.8 ? 'w' : d < half * 0.6 ? 'l' : 'm');
        }
      }
      P.outline();
    } },

    // ---------------- agua ----------------
    water_wave: { w: 15, h: 11, frames: 4, dir: true, gen(P, f) {
      const p = ph(f, 4);
      P.fill((x, y) => {
        const dx = x - 3, dy = (y - 5) * 0.95, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
        if (Math.abs(a) > 1.3) return null;
        const R = 8 + Math.sin(a * 4 - p) * 0.5;
        if (r > R || r < R - 4.6) return null;
        return r > R - 0.9 ? 'w' : r > R - 1.9 ? 'l' : 'm';
      });
      P.outline();
    } },
    water_swirl: { w: 13, h: 13, frames: 6, gen(P, f) {
      const p = ph(f, 6), c = 6;
      for (let arm = 0; arm < 2; arm++) for (let t = 0.5; t <= 12; t += 0.25) {
        const r = 0.8 + t * 0.42, a = t * 0.8 + p + arm * Math.PI;
        P.set(c + Math.cos(a) * r, c + Math.sin(a) * r * 0.95, t > 8 ? 'l' : 'm');
        if (t < 10) P.set(c + Math.cos(a) * (r - 1), c + Math.sin(a) * (r - 1) * 0.95, 'L');
      }
      P.set(6, 6, 'w'); P.set(5, 6, 'l'); P.set(7, 6, 'l'); P.set(6, 5, 'l'); P.set(6, 7, 'l');
      P.outline();
    } },
    water_jet: { w: 17, h: 7, frames: 4, dir: true, gen(P, f) {
      for (let x = 0; x <= 13; x++) {
        const wob = Math.round(Math.sin(x * 0.7 - ph(f, 4)) * 0.5);
        for (let y = 2; y <= 4; y++) P.set(x, y + wob, y === 3 ? 'l' : 'm');
        if ((x + f * 4) % 6 < 2) P.set(x, 3 + wob, 'w');            // burbujas de luz que corren
      }
      P.fill((x, y) => x >= 13 && ell(x, y, 15, 3, 2.6, 2.6) <= 1 ? (x < 15 ? 'l' : 'm') : null);
      P.set(15, 2, 'w'); P.set(14, 3, 'w');
      P.outline();
    } },

    // ---------------- planta ----------------
    grass_petal: { w: 11, h: 11, frames: 4, spin: true, gen(P, f) {
      const p = ph(f, 4);
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5 + Math.sin(p) * 0.18, len = 4.4 + Math.cos(p + k) * 0.5;
        P.line(5, 5, 5 + Math.cos(a) * len, 5 + Math.sin(a) * len, 'm', 1, 'l');
        P.set(5 + Math.cos(a) * (len + 0.4), 5 + Math.sin(a) * (len + 0.4), 'w');
      }
      P.set(5, 5, 'w'); P.set(4, 5, 'l'); P.set(6, 5, 'l');
      P.outline();
    } },
    grass_thorn: { w: 13, h: 7, frames: 4, dir: true, gen(P, f) {
      for (let x = 2; x <= 12; x++) {
        const th = (12 - x) / 10 * 2.6 + 0.2;
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 3); if (d <= th) P.set(x, y, y < 3 ? 'l' : 'm'); }
      }
      for (let x = 0; x <= 3; x++) P.set(x, 3 + Math.round(Math.sin(ph(f, 4) + x) * 1), 'd');   // tallo que ondula
      P.set(10, 3, 'w'); P.set(11, 3, 'w');
      P.outline();
    } },
    grass_seed: { w: 9, h: 9, frames: 4, gen(P, f) {
      P.fill((x, y) => { const e = ell(x, y, 4, 5, 3.1, 2.4); return e <= 1 ? (y < 5 ? 'l' : 'm') : null; });
      P.set(2 + f, 5, 'd'); P.set(2 + f, 6, 'd'); P.set(3, 4, 'w');                              // la raya gira
      const s = f % 2;                                                                            // brote que late
      P.set(4, 2, 'm'); P.set(4, 1, 'l'); P.set(3 - s, 1, 'l'); P.set(5 + s, 1, 'l');
      P.outline();
    } },

    // ---------------- eléctrico ----------------
    elec_orb: { w: 13, h: 13, frames: 4, gen(P, f) {
      const p = ph(f, 4);
      P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 1.6 ? 'w' : d < 3 ? 'l' : d < 4 + (f % 2) * 0.4 ? 'm' : null; });
      for (let k = 0; k < 4; k++) {                                                               // chispas que giran
        const a = k * TAU / 4 + p * 0.5;
        let px = 6 + Math.cos(a) * 4, py = 6 + Math.sin(a) * 4;
        for (let s = 0; s < 3; s++) {
          const na = a + (H(k, s, f) - 0.5) * 0.9, nr = 4.6 + s * 0.9;
          const nx = 6 + Math.cos(na) * nr, ny = 6 + Math.sin(na) * nr;
          P.line(px, py, nx, ny, 'w'); px = nx; py = ny;
        }
      }
      P.outline();
    } },
    elec_arc: { w: 17, h: 9, frames: 4, dir: true, gen(P, f) {
      const p = ph(f, 4);
      for (const o of [0, Math.PI]) {
        let px = 0, py = 4 + Math.round(Math.sin(o + p) * 3);
        for (let x = 2; x <= 16; x += 2) {
          const py2 = 4 + Math.round(Math.sin(x * 0.7 + o + p) * 3);
          P.line(px, py, x, py2, o ? 'l' : 'w'); px = x; py = py2;
        }
      }
      P.outline();
    } },
    elec_spark: { w: 9, h: 9, frames: 4, spin: true, gen(P, f) {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, L = k % 2 ? 1.5 + H(k, f, 2) * 1.6 : 3 + (f % 2);
        P.line(4, 4, 4 + Math.cos(a) * L, 4 + Math.sin(a) * L, k % 2 ? 'l' : 'w');
      }
      P.set(4, 4, 'w');
    } },

    // ---------------- hielo ----------------
    ice_crystal: { w: 11, h: 11, frames: 4, spin: true, gen(P, f) {
      P.fill((x, y) => {
        const dx = x - 5, dy = y - 5;
        if (Math.abs(dx) + Math.abs(dy) * 0.9 > 4.6) return null;
        return dx < 0 && dy < 0 ? 'w' : dx >= 0 && dy < 0 ? 'l' : dx < 0 ? 'm' : 'd';
      });
      for (let i = -3; i <= 3; i++) P.set(5, 5 + i, 'l');
      const g = [[3, 6], [4, 7], [6, 6], [7, 5]][f];                                              // destello que recorre
      P.set(g[0], g[1], 'w');
      P.outline();
    } },
    ice_flake: { w: 13, h: 13, frames: 6, spin: true, gen(P, f) {
      const rot = f * (TAU / 6) / 6;
      for (let k = 0; k < 6; k++) {
        const a = k * TAU / 6 + rot, ca = Math.cos(a), sa = Math.sin(a);
        P.line(6, 6, 6 + ca * 5.5, 6 + sa * 5.5, 'l');
        for (const s of [-1, 1]) {
          const b = a + s * 0.9;
          P.line(6 + ca * 3.2, 6 + sa * 3.2, 6 + ca * 3.2 + Math.cos(b) * 2, 6 + sa * 3.2 + Math.sin(b) * 2, 'm');
        }
        P.set(6 + ca * 5.8, 6 + sa * 5.8, 'w');
      }
      P.set(6, 6, 'w');
    } },
    ice_spike: { w: 17, h: 7, frames: 4, dir: true, gen(P, f) {
      for (let x = 1; x <= 16; x++) {
        const th = x < 4 ? 1.5 + (x % 2) : (16 - x) / 12 * 2.8 + 0.2;                            // base dentada y punta fina
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 3); if (d <= th) P.set(x, y, y < 3 ? 'l' : 'm'); }
      }
      for (let x = 4; x <= 14; x++) P.set(x, 3, 'w');
      P.set(3 + f * 3, 2, 'w'); P.set(4 + f * 3, 2, 'w');                                       // brillo que corre
      P.outline();
    } },

    // ---------------- tierra ----------------
    ground_clod: { w: 11, h: 11, frames: 4, gen(P, f) {
      const r = [0, 1, 2, 3, 4, 5].map(i => 3.3 + H(i, 7, 1) * 1.3 + (H(i, f, 6) - 0.5) * 0.5);
      P.fill((x, y) => {
        const dx = x - 5, dy = y - 4.5, a = (Math.atan2(dy, dx) + Math.PI) / TAU * 6, i = Math.floor(a) % 6, t = a - Math.floor(a);
        const R = r[i] * (1 - t) + r[(i + 1) % 6] * t, d = Math.hypot(dx, dy);
        if (d > R) return null;
        return (-dx * 0.6 - dy * 0.8) / R > 0.3 ? 'l' : 'm';
      });
      P.set(5, 4, 'd'); P.set(6, 5, 'd'); P.set(4, 6, 'd');
      P.set(2 + (f % 2) * 6, 9 + (f > 1 ? 1 : 0), 'm');                                           // migas que caen
      P.outline();
    } },
    ground_spike: { w: 15, h: 9, frames: 4, dir: true, gen(P, f) {
      for (let x = 0; x <= 14; x++) {                                                              // taladro de tierra
        const th = (14 - x) / 14 * 3.6 + 0.3;
        for (let y = 0; y < P.h; y++) {
          const d = Math.abs(y - 4);
          if (d > th) continue;
          P.set(x, y, (x + f * 3) % 5 === 0 ? 'd' : y < 4 ? 'l' : 'm');
        }
      }
      P.set(12, 4, 'w'); P.set(13, 4, 'w');
      P.outline();
    } },
    ground_wave: { w: 15, h: 9, frames: 4, gen(P, f) {
      const p = ph(f, 4);
      let py = 6;
      for (let x = 0; x < 15; x++) {                                                               // grieta en zigzag
        const ny = 6 + Math.round(Math.sin(x * 1.3) * 1);
        P.set(x, ny, 'd'); P.set(x, ny + 1, 'o');
        py = ny;
      }
      for (let k = 0; k < 4; k++) {                                                                // rocas que saltan
        const x = 2 + k * 3.6, h = Math.abs(Math.sin(p + k * 1.6)) * 4;
        const y = 5 - h;
        P.set(x, y, 'l'); P.set(x + 1, y, 'm'); P.set(x, y + 1, 'm'); P.set(x + 1, y + 1, 'd');
      }
      P.outline();
    } },

    // ---------------- roca ----------------
    rock_boulder: { w: 15, h: 15, frames: 4, spin: true, gen(P, f) {
      const r = [0, 1, 2, 3, 4, 5, 6, 7].map(i => 5.3 + H(i, 3, 5) * 1.8 + (H(i, f, 8) - 0.5) * 0.4);
      P.fill((x, y) => {
        const dx = x - 7, dy = y - 7, a = (Math.atan2(dy, dx) + Math.PI) / TAU * 8, i = Math.floor(a) % 8, t = a - Math.floor(a);
        const R = r[i] * (1 - t) + r[(i + 1) % 8] * t, d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.35 ? 'l' : lit > -0.25 ? 'm' : 'd';
      });
      P.line(6, 5, 8, 8, 'd'); P.line(8, 8, 7, 10, 'd'); P.line(8, 8, 10, 8, 'd');
      P.set(4, 4, 'w'); P.set(5, 4, 'w'); P.set(4, 5, 'w');
      P.outline();
    } },
    rock_chip: { w: 9, h: 9, frames: 4, spin: true, gen(P, f) {
      const tri = (cx, cy, s, c) => { for (let i = 0; i < s; i++) for (let j = -i; j <= i; j++) P.set(cx + j, cy + i, c); };
      tri(4, 1, 4, 'm'); tri(2 + (f % 2), 4, 3, 'l'); tri(6 - (f % 2), 5, 3, 'd');
      P.set(4, 2, 'w');
      P.outline();
    } },

    // ---------------- acero ----------------
    steel_blade: { w: 17, h: 7, frames: 4, dir: true, gen(P, f) {
      for (let x = 3; x <= 16; x++) {
        const th = x > 12 ? (16 - x) / 4 * 2.2 + 0.3 : 2.2;
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 3); if (d <= th) P.set(x, y, y < 3 ? 'l' : y === 3 ? 'm' : 'd'); }
      }
      for (let y = 0; y <= 6; y++) P.set(2, y, y === 3 ? 'w' : 'm');                               // guarda
      P.set(0, 3, 'd'); P.set(1, 3, 'd');
      P.set(4 + f * 3, 2, 'w'); P.set(5 + f * 3, 2, 'w');                                         // destello en el filo
      P.outline();
    } },
    steel_gear: { w: 13, h: 13, frames: 4, spin: true, gen(P, f) {
      const rot = f * (TAU / 8) / 4;
      P.fill((x, y) => {
        const dx = x - 6, dy = y - 6, d = Math.hypot(dx, dy);
        if (d < 1.7) return null;                                                                  // agujero
        const a = Math.atan2(dy, dx) - rot, tooth = Math.cos(a * 8) > 0.2 ? 5.7 : 4.5;
        if (d > tooth) return null;
        return d < 3 ? 'd' : (-dx * 0.6 - dy * 0.8) / d > 0.2 ? 'l' : 'm';
      });
      P.set(4, 4, 'w');
      P.outline();
    } },
    steel_bolt: { w: 15, h: 7, frames: 4, dir: true, gen(P, f) {
      const w = 1.6 + (f % 2) * 0.5;
      P.fill((x, y) => {
        const e = ell(x, y, 9, 3, 5.5, w + 1);
        return e <= 1 ? (e < 0.45 ? 'w' : e < 0.8 ? 'l' : 'm') : null;
      });
      for (let x = 0; x < 4; x++) P.set(x + (f % 2), 3, x < 2 ? 'm' : 'l');                       // estela
      P.set(13, 3, 'w'); P.set(12, 3, 'w');
      P.outline();
    } },

    // ---------------- lucha ----------------
    fight_fist: { w: 13, h: 13, frames: 4, gen(P, f) {
      const ox = [0, 1, 0, -1][f];                                                                 // tiembla al golpear
      P.fill((x, y) => {
        const dx = x - 6 - ox, dy = y - 6;
        if (Math.abs(dx) > 3.4 || dy < -3.3 || dy > 3.2) return null;
        if (Math.abs(dx) > 2.6 && Math.abs(dy) > 2.4) return null;
        return dy < -1 ? 'l' : dy < 1.5 ? 'm' : 'd';
      });
      for (const dx of [-1, 1]) for (let y = -3; y <= -1; y++) P.set(6 + ox + dx, 6 + y, 'd');      // dedos
      P.set(4 + ox, 4, 'w'); P.set(5 + ox, 4, 'w'); P.set(7 + ox, 4, 'w'); P.set(8 + ox, 4, 'w');
      for (const [a, b] of [[0, 1], [12, 1], [0, 11], [12, 11]]) P.set(a + (f % 2) * (a ? -1 : 1), b, 'm');
      P.outline();
    } },
    fight_wave: { w: 13, h: 13, frames: 4, dir: true, gen(P, f) {
      for (const o of [0, 0.5]) {                                                                  // dos ondas que se expanden
        const r = 2 + ((f / 4 + o) % 1) * 7;
        P.arc(1, 6, r, -1, 1, o ? 'm' : 'l');
        P.arc(1, 6, r + 0.8, -0.9, 0.9, o ? 'd' : 'm');
      }
      P.set(1, 6, 'w'); P.set(2, 6, 'w');
      P.outline();
    } },
    fight_shock: { w: 15, h: 15, frames: 4, gen(P, f) {
      for (let k = 0; k < 12; k++) {
        const a = k * TAU / 12 + (f % 2) * TAU / 24, L = (k % 2 ? 3 : 6) * (0.8 + (f % 2) * 0.3);
        P.line(7 + Math.cos(a) * 2, 7 + Math.sin(a) * 2, 7 + Math.cos(a) * L, 7 + Math.sin(a) * L, k % 2 ? 'm' : 'l');
      }
      P.fill((x, y) => { const d = Math.hypot(x - 7, y - 7); return d < 2.4 + (f % 2) * 0.4 ? 'w' : null; });
    } }
  });

  // ---------------- cómo se ve cada movimiento ----------------
  // (cada mueve se distingue de los demás de su tipo en forma, estela o golpe: lo vigila tests/vfx.test.cjs)
  G.VFX.addMoves({
    // fuego
    'ember':         { proj: 'fire', trail: 'ember' },
    'flamethrower':  { proj: 'fire_comet', beam: 'fire', trail: 'ember', hit: 'blaze' },
    'fire-spin':     { proj: 'fire_ring', trail: 'ember' },
    'heat-wave':     { proj: 'fire_pillar', trail: 'ember' },
    'will-o-wisp':   { proj: 'ball', trail: 'wisp' },
    'flame-wheel':   { proj: 'fire_ring', aura: 'fire', hit: 'blaze' },
    'flame-charge':  { proj: 'fire_comet', trail: 'ember' },
    // agua
    'water-gun':     { proj: 'drop', trail: 'drip' },
    'bubble':        { proj: 'water_wave' },
    'hydro-pump':    { beam: 'water_jet', proj: 'water_wave', hit: 'geyser' },
    'aqua-ring':     { buff: 'water_swirl', proj: 'bubble', trail: 'bubbles' },
    'bubble-beam':   { proj: 'bubble', trail: 'bubbles', hit: 'bubblepop' },
    'whirlpool':     { proj: 'water_swirl', trail: 'drip' },
    // planta
    'vine-whip':     { melee: 'vine' },
    'razor-leaf':    { proj: 'leaf' },
    'leaf-storm':    { proj: 'grass_petal' },
    'giga-drain':    { aura: 'heart', inward: true },
    'seed-bomb':     { proj: 'grass_seed' },
    'energy-ball':   { proj: 'ball', trail: 'spark' },
    'solar-beam':    { beam: 'star', proj: 'grass_thorn', hit: 'blaze' },
    // eléctrico
    'thunder-shock': { proj: 'bolt', trail: 'spark' },
    'discharge':     { aura: 'elec_spark', hit: 'shock' },
    'thunderbolt':   { beam: 'lightning', hit: 'shock' },
    'thunder-wave':  { proj: 'elec_arc' },
    'electro-ball':  { proj: 'elec_orb', trail: 'spark' },
    // hielo
    'ice-beam':      { beam: 'ice_spike', hit: 'shatter' },
    'powder-snow':   { aura: 'ice_flake' },
    'hail':          { proj: 'ice_crystal' },
    'ice-shard':     { proj: 'shard' },
    'freeze-dry':    { proj: 'ice_spike', hit: 'shatter' },
    // tierra
    'mud-shot':      { proj: 'blob', trail: 'dirt' },
    'bulldoze':      { aura: 'ground_wave', rise: true },
    'bonemerang':    { proj: 'ground_spike' },
    'spikes':        { proj: 'ground_spike', trail: 'dirt' },
    'sand-tomb':     { proj: 'ground_clod' },
    'magnitude':     { proj: 'ground_wave', trail: 'dirt' },
    // roca
    'rock-throw':    { proj: 'rock_boulder', trail: 'dirt' },
    'rock-slide':    { proj: 'rock_chip', trail: 'dirt' },
    'rock-tomb':     { proj: 'rock_boulder' },
    'ancient-power': { proj: 'rock' },
    'power-gem':     { proj: 'shard', trail: 'spark' },
    // acero
    'metal-claw':    { melee: 'claw' },
    'flash-cannon':  { beam: 'steel_bolt', proj: 'steel_bolt' },
    'meteor-mash':   { proj: 'rock', trail: 'spark' },
    'mirror-shot':   { proj: 'steel_blade', trail: 'spark' },
    'gyro-ball':     { melee: 'steel_gear' },
    // lucha
    'karate-chop':   { melee: 'impact' },
    'aura-sphere':   { proj: 'ball', pal: 'aura', trail: 'spark' },
    'rolling-kick':  { melee: 'fight_fist' },
    'vacuum-wave':   { proj: 'fight_wave', pal: 'aura' },
    'dynamic-punch': { proj: 'fight_shock' }
  });
})();
