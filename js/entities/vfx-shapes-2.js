/* ============ vfx-shapes-2.js — formas de ataque: veneno, volador, bicho, fantasma, dragón, siniestro, hada, psíquico, normal ============
 * Igual que vfx-shapes-1.js (mismas letras, reglas y bucle de 4-6 fotogramas) para el resto de tipos,
 * más el aspecto de cada movimiento de estos tipos (G.VFX.addMoves).
 */
(() => {
  const H = (a, b, c) => G.U.hash(a, b, c);
  const TAU = Math.PI * 2;
  const ph = (f, N) => f / N * TAU;
  const ell = (x, y, cx, cy, rx, ry) => Math.hypot((x - cx) / rx, (y - cy) / ry);
  const bitmap = (P, rows, ox, oy, map) => rows.forEach((row, y) => [...row].forEach((c, x) => { if (map[c]) P.set(ox + x, oy + y, map[c]); }));

  G.VFX.add({
    // ---------------- veneno ----------------
    poison_glob: { w: 11, h: 11, frames: 4, gen(P, f) {
      const p = ph(f, 4);
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 4.5, a = Math.atan2(dy, dx), R = 3.6 + Math.sin(a * 3 + p) * 0.5 + Math.cos(a * 2 - p) * 0.3;
        if (Math.hypot(dx, dy) > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.4 ? 'l' : lit > -0.35 ? 'm' : 'd';
      });
      P.set(4, 3, 'w'); P.set(3, 4, 'w');
      const bx = 5 + (f % 2) * 2, by = 5 + Math.round(Math.sin(p) * 1);                                  // burbuja dentro
      P.set(bx, by, 'l'); P.set(bx + 1, by, 'w');
      P.set(6, 9, 'm'); if (f > 1) P.set(6, 10, 'm');                                                    // gota que cuelga
      P.outline();
    } },
    poison_skull: { w: 11, h: 11, frames: 4, gen(P, f) {
      const open = f % 2, bob = f === 1 || f === 2 ? 1 : 0;
      bitmap(P, ['..lllll..', '.lllllll.', 'lldllldll', 'lldllldll', '.lllwlll.', '..lllll..'], 1, bob, { l: 'l', w: 'w', d: 'd' });
      bitmap(P, ['..lwlwl..', '..l.l.l..'], 1, 6 + bob + open, { l: 'l', w: 'w' });                       // la mandíbula se abre
      P.outline();
    } },
    poison_fang: { w: 13, h: 7, frames: 4, dir: true, gen(P, f) {
      for (let x = 1; x <= 12; x++) {
        const th = (12 - x) / 11 * 2.5 + 0.2, yc = 3 - (x > 7 ? (x - 7) * 0.18 : 0);
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - yc); if (d <= th) P.set(x, y, y < yc ? 'w' : 'l'); }
      }
      P.set(1, 3, 'm'); P.set(2, 3, 'm');
      P.set(5, 4 + Math.min(f, 2), 'm'); if (f === 3) P.set(5, 6, 'o');                                  // gota de veneno que cae
      P.outline();
    } },

    // ---------------- volador ----------------
    fly_feather: { w: 11, h: 7, frames: 4, spin: true, gen(P, f) {
      const sh = [0, 0.4, 0, -0.4][f];
      P.fill((x, y) => {
        const dx = Math.abs(x - 5) / 5.2, dy = (y - 3 - sh * (x - 5) / 5) / 2.5;
        return dx + dy * dy <= 1 ? (y < 3 ? 'l' : 'm') : null;
      });
      for (let x = 0; x <= 10; x++) P.set(x, 3 + Math.round(sh * (x - 5) / 5), 'w');                      // raquis
      P.outline();
    } },
    fly_slash: { w: 15, h: 11, frames: 4, dir: true, gen(P, f) {
      const k = 0.7 + (f % 2) * 0.35;
      P.fill((x, y) => {
        const a = Math.hypot(x - 5, y - 5), b = Math.hypot(x - 2.2 - k, y - 5);
        if (a > 9.2 || b < 8.6) return null;
        return b < 9.6 ? 'w' : b < 10.6 ? 'l' : 'm';
      });
      for (let i = 0; i < 3; i++) P.set(1 + ((f * 2 + i * 4) % 8), 5 + (i - 1) * 2, 'L');               // estela de aire
      P.outline();
    } },
    fly_swirl: { w: 13, h: 13, frames: 4, spin: true, gen(P, f) {
      const p = ph(f, 4);
      [[2.2, 'l'], [3.9, 'w'], [5.6, 'l']].forEach(([r, c], i) => P.arc(6, 6, r, p * (i % 2 ? -1 : 1) + i * 2, p * (i % 2 ? -1 : 1) + i * 2 + 3.2, c));
      P.set(6, 6, 'w');
    } },

    // ---------------- bicho ----------------
    bug_stinger: { w: 13, h: 5, frames: 4, dir: true, gen(P, f) {
      for (let x = 0; x <= 4; x++) for (let y = 1; y <= 3; y++) P.set(x, y, y === 2 ? 'l' : 'm');           // bulbo
      for (let x = 5; x <= 11; x++) P.set(x, 2, x < 9 ? 'l' : 'w');                                       // aguijón
      P.set(12, 2, 'w'); P.set(1 + f, 1, 'w');                                                           // brillo que corre
      P.outline();
    } },
    bug_wing: { w: 11, h: 11, frames: 4, spin: true, gen(P, f) {
      const k = [1, 0.6, 0.25, 0.6][f];                                                                   // aleteo
      for (const s of [-1, 1]) P.fill((x, y) => {
        const e = ell(x, y, 5 + s * 3, 5, 2.7, 4.6 * k + 0.4);
        return e <= 1 ? (e > 0.78 ? 'm' : 'L') : null;
      });
      for (let y = 5 - Math.round(2 * k); y <= 5 + Math.round(2 * k); y++) P.set(5, y, 'd');             // cuerpo
      P.set(5, 5, 'w');
      P.outline();
    } },
    bug_swarm: { w: 13, h: 11, frames: 6, gen(P, f) {
      const p = ph(f, 6);
      for (let i = 0; i < 7; i++) {
        const a = i * TAU / 7 + p * (i % 2 ? 1 : -1), r = 2 + (i % 3) * 1.1;
        const x = 6 + Math.cos(a) * r * 1.3 + (H(i, f, 3) - 0.5), y = 5 + Math.sin(a) * r * 0.9;
        P.set(x, y, 'd'); P.set(x + 1, y, 'm'); P.set(x, y - 1, f % 2 ? 'w' : 'l');                      // cuerpo y ala que bate
      }
      P.outline();
    } },

    // ---------------- fantasma ----------------
    ghost_soul: { w: 13, h: 9, frames: 4, dir: true, gen(P, f) {
      const p = ph(f, 4);
      for (let x = 0; x <= 7; x++) {                                                                      // cola ondulante
        const t = x / 7, yc = 4 + Math.sin(p + x * 0.9) * 1.2 * (1 - t), th = 0.4 + t * 2;
        for (let y = 0; y < P.h; y++) if (Math.abs(y - yc) <= th) P.set(x, y, Math.abs(y - yc) < th * 0.5 ? 'l' : 'm');
      }
      P.fill((x, y) => { const e = ell(x, y, 9.5, 4, 3.3, 3.4); return e <= 1 ? (e < 0.55 ? 'w' : 'l') : null; });
      P.set(9, 3, 'd'); P.set(11, 3, 'd'); P.set(10, 5, 'd');
      P.outline();
    } },
    ghost_face: { w: 11, h: 11, frames: 4, gen(P, f) {
      const m = [1, 2, 3, 2][f];                                                                          // la boca se abre y se cierra
      P.fill((x, y) => { const e = ell(x, y, 5, 4.5, 4.2, 4.4); return e <= 1 ? (e < 0.6 ? 'l' : 'm') : null; });
      P.set(3, 3, 'd'); P.set(3, 4, 'd'); P.set(7, 3, 'd'); P.set(7, 4, 'd');
      for (let i = 0; i < m; i++) for (let x = 4; x <= 6; x++) P.set(x, 6 + i, 'd');
      for (let x = 1; x <= 9; x += 2) P.set(x, 9 + (x + f) % 2, 'm');                                    // jirones de abajo
      P.set(4, 1, 'w'); P.set(5, 1, 'w');
      P.outline();
    } },
    ghost_flame: { w: 11, h: 13, frames: 6, gen(P, f) {
      const p = ph(f, 6);
      for (let y = 0; y < P.h; y++) {
        const t = (P.h - 1 - y) / (P.h - 1), half = 0.5 + 3 * Math.pow(1 - t, 0.8) + Math.sin(y * 0.9 - p) * 0.4 * (1 - t);
        const xc = 5 + Math.sin(y * 0.55 - p) * 1.1 * t;
        for (let x = 0; x < P.w; x++) {
          const d = Math.abs(x - xc);
          if (d > half || (t > 0.85 && H(x, y, f) < 0.5)) continue;
          P.set(x, y, d < half * 0.35 ? 'w' : d < half * 0.7 ? 'l' : 'm');
        }
      }
      P.set(4, 8, 'd'); P.set(6, 8, 'd');
      P.outline();
    } },

    // ---------------- dragón ----------------
    dragon_claw: { w: 13, h: 13, frames: 4, gen(P, f) {
      for (let i = 0; i < 3; i++) {
        const x0 = 0.5 + i * 3.2, pts = [[x0, 11.5], [x0 + 1.5, 6], [x0 + 4, 1]];
        P.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 'l', 1, 'm'); P.line(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 'w', 1, 'l');
      }
      const t = f / 4;                                                                                    // brillo que barre las garras
      P.set(2 + t * 9, 10 - t * 9, 'w'); P.set(3 + t * 9, 10 - t * 9, 'w');
      P.outline();
    } },
    dragon_flame: { w: 17, h: 9, frames: 4, dir: true, gen(P, f) {
      const p = ph(f, 4);
      for (let x = 0; x <= 13; x++) {
        const t = x / 13, th = 0.6 + t * 3.2 + Math.sin(p + x * 1.1) * 0.6, yc = 4 + Math.sin(p + x * 0.6) * 0.7 * (1 - t);
        for (let y = 0; y < P.h; y++) {
          const d = Math.abs(y - yc);
          if (d > th || (t < 0.4 && H(x, y, f) < 0.4)) continue;
          P.set(x, y, d < th * 0.3 && t > 0.4 ? 'w' : d < th * 0.6 ? 'l' : 'm');
        }
      }
      P.set(15, 4, 'l'); P.set(16, 4, 'm');
      P.outline();
    } },
    dragon_scale: { w: 9, h: 9, frames: 4, spin: true, gen(P, f) {
      P.fill((x, y) => { const d = Math.abs(x - 4) + Math.abs(y - 4) * 0.9; return d <= 4.2 ? (d > 3.2 ? 'm' : (x + y) % 2 ? 'l' : 'm') : null; });
      for (let i = 0; i < 4; i++) P.set(4, 1 + i * 2, 'd');
      const g = [[3, 3], [5, 3], [5, 5], [3, 5]][f]; P.set(g[0], g[1], 'w');
      P.outline();
    } },

    // ---------------- siniestro ----------------
    dark_claw: { w: 13, h: 9, frames: 4, dir: true, gen(P, f) {
      const s = 0.8 + (f % 2) * 0.3;
      for (const a of [-0.5, 0, 0.5]) {
        const L = (a === 0 ? 11 : 9) * s;
        P.line(1, 4, 1 + Math.cos(a) * L, 4 + Math.sin(a) * L, 'm', 1, 'd');
        P.set(1 + Math.cos(a) * (L + 0.5), 4 + Math.sin(a) * (L + 0.5), 'w');
      }
      P.fill((x, y) => x <= 2 && Math.abs(y - 4) <= 1 ? 'd' : null);
      P.outline();
    } },
    dark_orb: { w: 13, h: 13, frames: 4, gen(P, f) {
      const p = ph(f, 4);
      P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 2.4 ? 'o' : d < 4.2 ? 'd' : null; });
      for (let k = 0; k < 3; k++) { const a = p + k * TAU / 3; P.arc(6, 6, 5, a, a + 1.4, 'm'); P.arc(6, 6, 4.2, a + 0.3, a + 1.1, 'l'); }
      P.set(5, 5, 'w');
      P.outline();
    } },
    dark_slash: { w: 15, h: 11, frames: 4, dir: true, gen(P, f) {
      P.fill((x, y) => {
        const a = Math.hypot(x - 5, y - 5), b = Math.hypot(x - 2.5, y - 5);
        if (a > 9 || b < 8.2) return null;
        return b < 9.3 ? 'l' : 'd';
      });
      for (let i = 0; i < 3; i++) { const y = 2 + i * 3; P.set(1 + ((f + i) % 4), y, 'm'); P.set(2 + ((f + i) % 4), y + 1, 'd'); }   // zarcillos de sombra
      P.outline();
    } },

    // ---------------- hada ----------------
    fairy_sparkle: { w: 11, h: 11, frames: 4, gen(P, f) {
      const L = [4, 3, 4, 2][f];
      for (let i = -L; i <= L; i++) { P.set(5 + i, 5, Math.abs(i) === L ? 'm' : 'l'); P.set(5, 5 + i, Math.abs(i) === L ? 'm' : 'l'); }
      for (const [a, b] of [[2, 2], [8, 2], [2, 8], [8, 8]]) if ((a + b + f) % 3) P.set(a, b, f % 2 ? 'w' : 'l');          // chispitas satélite
      P.set(5, 5, 'w'); P.set(4, 5, 'w'); P.set(6, 5, 'w'); P.set(5, 4, 'w'); P.set(5, 6, 'w');
    } },
    fairy_ribbon: { w: 17, h: 7, frames: 4, dir: true, gen(P, f) {
      const p = ph(f, 4);
      for (let x = 0; x <= 16; x++) {
        const y = 3 + Math.sin(x * 0.7 - p) * 2 * (0.4 + x / 27);
        P.set(x, y - 1, 'm'); P.set(x, y, 'l'); P.set(x, y + 1, 'm');
      }
      P.set(16, 3 + Math.sin(16 * 0.7 - p) * 2.2, 'w');
      P.set(2 + (f * 4) % 12, 0, 'w');
      P.outline();
    } },
    fairy_moon: { w: 11, h: 11, frames: 4, gen(P, f) {
      P.fill((x, y) => {
        const a = Math.hypot(x - 5, y - 5), b = Math.hypot(x - 7.2, y - 4.2);
        if (a > 4.6 || b < 3.8) return null;
        return b < 4.8 ? 'w' : 'l';
      });
      const s = f % 2;                                                                                    // estrellita que titila
      P.set(8, 3, 'w'); if (s) { P.set(7, 3, 'l'); P.set(9, 3, 'l'); P.set(8, 2, 'l'); P.set(8, 4, 'l'); }
      P.outline();
    } },

    // ---------------- psíquico ----------------
    psy_eye: { w: 13, h: 9, frames: 4, gen(P, f) {
      const open = [1, 0.8, 0.45, 0.8][f];                                                                // parpadeo
      P.fill((x, y) => {
        const dx = (x - 6) / 6, dy = (y - 4) / (3.4 * open);
        return dx * dx + dy * dy <= 1 ? (Math.abs(y - 4) < 1 ? 'w' : 'L') : null;
      });
      P.fill((x, y) => { const d = Math.hypot(x - 6, (y - 4) / Math.max(open, 0.5)); return d < 1.3 ? 'd' : d < 2.6 ? 'm' : null; });
      if (open > 0.6) P.set(5, 3, 'w');
      P.outline();
    } },
    psy_wave: { w: 15, h: 11, frames: 4, dir: true, gen(P, f) {
      for (let k = 0; k < 3; k++) {
        const r = 2.5 + ((f / 4 + k / 3) % 1) * 9;
        for (let i = 0; i < 28; i++) {
          const a = -1.1 + i / 27 * 2.2;
          if ((i + k) % 2 === 0) P.set(1 + Math.cos(a) * r, 5 + Math.sin(a) * r, k === 1 ? 'w' : 'l');     // arcos punteados
        }
      }
      P.set(1, 5, 'w'); P.set(2, 5, 'l');
    } },
    psy_orb: { w: 13, h: 13, frames: 6, gen(P, f) {
      const p = ph(f, 6);
      P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 1.5 ? 'w' : d < 2.8 ? 'l' : d < 3.8 ? 'm' : null; });
      for (const o of [0, Math.PI]) {
        const x = 6 + Math.cos(p + o) * 5.2, y = 6 + Math.sin(p + o) * 5.2 * 0.9;
        P.set(x, y, 'w'); P.set(x + 1, y, 'l'); P.set(x, y + 1, 'l');
      }
      P.arc(6, 6, 5.2, p + 1.2, p + 2.4, 'L'); P.arc(6, 6, 5.2, p + 1.2 + Math.PI, p + 2.4 + Math.PI, 'L');
      P.outline();
    } },

    // ---------------- normal ----------------
    norm_swirl: { w: 11, h: 11, frames: 4, spin: true, gen(P, f) {          // aro con un destello que gira
      const p = ph(f, 4);
      P.fill((x, y) => { const d = Math.hypot(x - 5, y - 5); return d > 3.5 && d < 4.8 ? 'm' : d < 1.5 + (f % 2) * 0.6 ? 'w' : null; });
      for (let i = 0; i < 2; i++) {
        const a = p + i * Math.PI, x = 5 + Math.cos(a) * 4.2, y = 5 + Math.sin(a) * 4.2;
        P.set(x, y, 'w'); P.set(x + 1, y, 'l'); P.set(x, y + 1, 'l'); P.set(x - 1, y, 'l'); P.set(x, y - 1, 'l');
      }
      P.outline();
    } },
    norm_streak: { w: 17, h: 5, frames: 4, dir: true, gen(P, f) {
      for (let row = 0; row < 3; row++) {
        const y = 1 + row, off = (f * 3 + row * 5) % 9;
        for (let x = off; x < off + 6 && x < 15; x++) P.set(x, y, x - off < 2 ? 'm' : x - off < 4 ? 'l' : 'w');
      }
      P.set(15, 2, 'w'); P.set(16, 2, 'l');
    } },
    norm_star: { w: 11, h: 11, frames: 4, spin: true, gen(P, f) {
      const k = 1 + [0, 0.12, 0, -0.12][f];
      P.fill((x, y) => {
        const dx = x - 5, dy = y - 5, a = Math.atan2(dy, dx) + Math.PI / 2, d = Math.hypot(dx, dy);
        const R = (2.2 + 3 * Math.pow((1 + Math.cos(5 * a)) / 2, 1.4)) * k;
        return d <= R ? (d < 1.8 ? 'w' : d < R * 0.7 ? 'l' : 'm') : null;
      });
      P.outline();
    } }
  });

  // ---------------- cómo se ve cada movimiento ----------------
  G.VFX.addMoves({
    // veneno
    'sludge':        { proj: 'blob', trail: 'bubbles' },
    'poison-sting':  { proj: 'poison_fang' },
    'toxic':         { aura: 'poison_skull', rise: true },
    'toxic-spikes':  { proj: 'needle' },
    'acid-spray':    { proj: 'poison_glob', trail: 'bubbles', hit: 'venom' },
    // volador
    'gust':          { proj: 'fly_swirl' },
    'wing-attack':   { melee: 'feather' },
    'aerial-ace':    { proj: 'fly_slash' },
    'whirlwind':     { proj: 'wind' },
    'air-slash':     { proj: 'fly_slash', hit: 'slash' },
    // bicho
    'bug-bite':      { melee: 'jaws' },
    'string-shot':   { proj: 'web' },
    'bug-buzz':      { aura: 'bug_swarm' },
    'signal-beam':   { proj: 'bug_stinger', trail: 'spark' },
    'u-turn':        { proj: 'bug_wing' },
    // fantasma
    'lick':          { melee: 'impact', hit: 'soul' },
    'shadow-ball':   { proj: 'shadow', trail: 'wisp' },
    'hex':           { beam: 'ghost_face', proj: 'ghost_soul' },
    'shadow-sneak':  { proj: 'ghost_soul', trail: 'wisp' },
    'ominous-wind':  { proj: 'ghost_flame', trail: 'wisp' },
    // dragón
    'dragon-rage':   { beam: 'dragon_flame' },
    'dragon-dance':  { buff: 'dragon_scale' },
    'dragon-breath': { proj: 'dragon_flame', trail: 'ember' },
    'dragon-claw':   { melee: 'dragon_claw', hit: 'slash' },
    'outrage':       { melee: 'claw', hit: 'slash' },
    // siniestro
    'bite':          { melee: 'jaws' },
    'dark-pulse':    { proj: 'dark_orb' },
    'night-shade':   { aura: 'shadow', rise: true },
    'sucker-punch':  { proj: 'dark_claw' },
    'night-slash':   { melee: 'dark_slash', hit: 'slash' },
    // hada
    'fairy-wind':    { proj: 'fairy_sparkle' },
    'dazzling-gleam': { aura: 'fairy_moon' },
    'draining-kiss': { proj: 'heart' },
    'play-rough':    { melee: 'fairy_ribbon' },
    'disarming-voice': { proj: 'note' },
    // psíquico
    'confusion':     { proj: 'ring' },
    'psybeam':       { beam: 'psy_wave' },
    'psychic':       { proj: 'psy_orb' },
    'psycho-cut':    { proj: 'crescent', hit: 'slash' },
    'extrasensory':  { proj: 'psy_eye' },
    'mist-ball':     { proj: 'ring', trail: 'wisp', hit: 'bubblepop' },
    // normal
    'tackle':        { melee: 'impact' },
    'quick-attack':  { proj: 'norm_streak' },
    'swords-dance':  { buff: 'steel_blade', pal: 'fighting' },
    'nasty-plot':    { buff: 'psy_orb', pal: 'psychic' },
    'agility':       { buff: 'fly_swirl', pal: 'flying' },
    'harden':        { buff: 'steel_gear', pal: 'steel' },
    'body-slam':     { melee: 'norm_star', hit: 'punch' },
    'hyper-voice':   { proj: 'note' },
    'substitute':    { proj: 'norm_swirl' },
    'hyper-beam':    { beam: 'star', proj: 'norm_star', hit: 'shock' },
    'rapid-spin':    { melee: 'impact', proj: 'norm_swirl' },
    // potenciadores (28-10-2026)
    'calm-mind':     { buff: 'psy_orb' },
    'hone-claws':    { buff: 'dark_orb' },
    'focus-energy':  { buff: 'bug_wing' },
    'laser-focus':   { buff: 'ghost_flame' },
    'life-dew':      { buff: 'fairy_sparkle' }
  });
  // Aspecto de los movimientos especiales de cada especie (generado en js/data/signature-moves.js).
  if (G.SIG_VFX) G.VFX.addMoves(G.SIG_VFX);
})();
