const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');
const dictionaries = [...source('dev.html').matchAll(/src="(js\/data\/lang-[^"]+\.js)"/g)].map(m => m[1]);
function boot(saved = null, nav = 'es-ES', pathname = '/', blocked = false) {
  const storage = { 'ps.lang': saved }, calls = [], written = [];
  class Canvas {
    constructor() { this.font = '16px Pixelify,sans-serif'; }
    get font() { return this._font; }
    set font(v) { this._font = v; }
    fillText(s) { calls.push([s, this.font]); }
    strokeText(s) { calls.push([s, this.font]); }
    measureText(s) { calls.push([s, this.font]); return { width: s.length }; }
  }
  const ctx = { G: {}, navigator: { language: nav, languages: [nav] },
    location: { pathname, reload: () => calls.push('reload') },
    localStorage: { getItem: k => { if (blocked) throw Error('blocked'); return storage[k]; }, setItem: (k, v) => { storage[k] = v; } },
    document: { documentElement: {}, write: html => written.push(html) }, CanvasRenderingContext2D: Canvas,
    confirm: s => { calls.push(s); return true; }, alert: s => calls.push(s), console };
  ctx.window = ctx;
  vm.createContext(ctx);
  const load = f => vm.runInContext(source(f), ctx, { filename: f });
  load('js/core/locales.js');
  if (ctx.PS_LOCALES.lang !== 'en') load(`js/lang/${ctx.PS_LOCALES.lang}.js`);   // dictionary the page would request
  load('js/core/i18n.js');
  dictionaries.forEach(load);
  return { ctx, G: ctx.G, storage, calls, Canvas, load, written };
}

test('language: English by default, Vietnamese when saved or when the browser is Vietnamese', () => {
  for (const [saved, nav, want] of [[null, 'es-MX', 'en'], [null, 'fr-FR', 'en'], ['es', 'es-ES', 'en'], ['zh-Hant', 'zh-TW', 'en'],
    ['unknown', 'it-IT', 'en'], [null, 'vi-VN', 'vi'], ['vi', 'en-US', 'vi'], ['en', 'vi-VN', 'en']]) {
    const b = boot(saved, nav);
    assert.equal(b.G.I18n.lang, want, `${saved}/${nav}`);
    assert.equal(b.ctx.document.documentElement.lang, want);
    assert.deepEqual(Array.from(b.G.I18n.choices, c => c[0]), ['en', 'vi']);
    assert.equal(b.written.length, want === 'en' ? 0 : 1);   // only Vietnamese downloads an extra dictionary
  }
  assert.equal(boot(null, 'es-ES', '/', true).G.I18n.lang, 'en');   // blocked storage
});

test('Vietnamese covers every English key with the same placeholders', () => {
  const en = boot().G.I18n, vi = boot('vi').G.I18n;
  const keys = [];
  const probe = { I18n: { add: d => keys.push(...Object.keys(d)) } };
  for (const f of dictionaries) vm.runInNewContext(source(f), { G: probe });
  assert.ok(keys.length > 1000);
  const slots = s => (String(s).match(/\{(?:x|name)\}/g) || []).length;
  for (const k of keys) {
    if (/\{(?:x|name)\}/.test(k)) assert.equal(slots(vi.t(k)), slots(k), k);
  }
  assert.equal(vi.t('Guardar'), 'Lưu');
  assert.equal(vi.t('Volver'), 'Quay lại');
  assert.ok(vi.f('Esperando a {x}…', 'Pikachu').includes('Pikachu'));
  assert.equal(en.t('Guardar'), 'Save');
});

test('Vietnamese translates texts the code writes in English, sentence by sentence', () => {
  const vi = boot('vi').G.I18n;
  assert.equal(vi.t('Rank'), 'Hạng');
  assert.equal(vi.t('3 more duplicates to the next star'), 'Cần thêm 3 bản trùng để lên sao tiếp theo');
  assert.equal(vi.t('Unlocks at 5★ · on Charizard'), 'Mở khóa ở 5★ · trên Charizard');
  assert.equal(vi.t('Lv 3 / 30'), 'Cấp 3 / 30');
  assert.equal(vi.t('+15% damage with Lửa moves. +30% damage when below 1/3 health.'),
    '+15% sát thương với chiêu hệ Lửa. +30% sát thương khi dưới 1/3 máu.');
  assert.equal(vi.t('A wide blast in front of you. Burns foes (2 stacks).'), 'Vụ nổ rộng ngay phía trước bạn. Thiêu đốt kẻ địch (2 lớp).');
  assert.equal(vi.tc('Timid', 'nature'), 'Nhút nhát');
  assert.equal(vi.tc('Blazing Heart', 'passive'), 'Trái tim rực lửa');
  assert.equal(vi.tc('Tail Flame Fury', 'passive'), 'Tail Flame Fury');   // unique names stay in English
  assert.equal(vi.t('Normal'), 'Thường');
  assert.equal(boot().G.I18n.tc('Timid', 'nature'), 'Timid');            // English keeps its own names
});

test('Spanish source keys are translated: exact, templates, canvas, alert/confirm', () => {
  const b = boot(), I = b.G.I18n;
  assert.equal(b.G.T('Guardar'), 'Save');
  assert.equal(I.f('Se guarda en la nube en {x} s.', 17).includes('17'), true);
  const c = new b.Canvas(); c.fillText('Guardar');
  assert.equal(b.calls.at(-1)[0], 'Save');
  assert.equal(c.font, '16px Pixelify,sans-serif');
  I.rawCanvas(c, 'fillText', 'Pikachu'); assert.equal(b.calls.at(-1)[0], 'Pikachu');
  assert.ok(b.G.T('Solicitud enviada a Pikachu').includes('Pikachu'));
  assert.ok(I.f('Esperando a {x}…', 'Pikachu').includes('Pikachu'));
  b.ctx.alert('Guardar'); assert.equal(b.calls.at(-1), 'Save');
});

test('save notice is shown in English with its bold text', () => {
  const b = boot(), nodes = {};
  const node = id => nodes[id] ||= { children: [], classList: { add() {}, remove() {} }, attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, replaceChildren() { this.children = []; }, appendChild(n) { this.children.push(n); } };
  b.G.UI = { $: node }; b.G.DB = { mode: 'cloud', guest: false, save: { stats: {} } };
  b.ctx.document.createElement = () => ({});
  b.load('js/ui/login.js');
  assert.equal(b.G.LoginUI.updateNotices(), true);
  const body = node('savenote-body');
  assert.ok(body.innerHTML.includes('10') && !body.innerHTML.includes('30'));
  assert.equal((body.innerHTML.match(/<b[ >]/g) || []).length, 3);
  assert.ok(!body.innerHTML.includes('Debido a problemas'));
  assert.equal(node('savenote-title').textContent, 'Important: save your game');
  assert.equal(b.G.LoginUI.updateNotices(), false);
  b.G.DB.save.stats.runs = 1;
  assert.equal(b.G.LoginUI.updateNotices(), true);
  assert.ok(/rankings|leaderboards/.test(b.G.T(node('savenote-title').textContent)));
  assert.equal((node('savenote-body').innerHTML.match(/<p>/g) || []).length, 2);
  assert.equal(b.G.LoginUI.updateNotices(), false);
});

test('every changelog entry has English text', () => {
  const { G, load } = boot();
  load('js/data/changelog.js');
  for (const entry of G.CHANGELOG) {
    for (const pair of [entry.title, ...(entry.new || []), ...(entry.chg || []), ...(entry.fix || [])]) {
      assert.ok(pair[1] && /[a-z]/i.test(pair[1]), String(pair[0]));
    }
  }
});

test('switching language is not possible: only the stored preference is validated', () => {
  const b = boot('es'); b.storage['ps.cloud.fake'] = '{"coins":42}';
  b.G.I18n.set('es'); b.G.I18n.set('invalid');
  assert.equal(b.storage['ps.lang'], 'es'); assert.deepEqual(b.calls, []);
  assert.equal(b.storage['ps.cloud.fake'], '{"coins":42}');
});

test('specific templates and later overrides beat generic patterns', () => {
  const { G } = boot();
  G.I18n.add({ 'Hola {x}': 'Old {x}', '{x}).': '{x}!' }, 'en');
  G.I18n.add({ 'Hola {x}': 'New {x}', 'El resultado ({x}).': 'Result: {x}' }, 'en');
  assert.equal(G.T('Hola 5'), 'New 5');
  assert.equal(G.T('El resultado (42).'), 'Result: 42');
});

test('external boot follows the shared locale without inline executable scripts', () => {
  const html = source('dev.html');
  assert.ok(html.indexOf('src="js/core/locales.js"') < html.indexOf('src="js/boot.js"'));
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.ok(/src=/.test(match[1]) || /application\/ld\+json/.test(match[1]), 'Executable inline script');
  }
  assert.ok(html.includes("script-src 'self'"));
  const b = boot(), paragraphs = [{}, {}];
  b.ctx.document.querySelector = () => ({});
  b.ctx.document.querySelectorAll = () => paragraphs;
  b.load('js/boot.js');
  assert.equal(b.ctx.PS_PAGES, true);
  assert.equal(b.ctx.document.documentElement.lang, 'en');
  assert.ok(paragraphs.every(p => typeof p.textContent === 'string' && p.textContent.length));
  assert.notEqual(paragraphs[1].textContent, 'Cargando…');
});
