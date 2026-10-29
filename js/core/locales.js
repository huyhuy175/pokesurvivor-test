/* ============ locales.js — idioma del jugador (antes que nada) ============
 * Lo usan la pantalla de carga (boot.js) y el juego (i18n.js). No guarda nada del jugador.
 * El código está escrito en español: el inglés lo traduce lang-en.js (incluido en el juego)
 * y el vietnamita js/lang/vi.js, que se pide aquí mismo, antes que el juego, para que sólo lo
 * descargue quien lo usa. Si no llega, el juego sale en inglés.
 * Idioma: el elegido en Ajustes; si no, el del navegador (vietnamita) o inglés.
 * La huella ?v= de este script (la pone build.js) va también al diccionario.
 */
window.PS_LOCALES = (() => {
  const choices = [['en', 'English', 'en-GB'], ['vi', 'Tiếng Việt', 'vi-VN']];
  function normalize(value) {
    const s = String(value || '').toLowerCase().replace(/_/g, '-');
    return choices.find(([id]) => s === id || s.startsWith(id + '-'))?.[0] || null;
  }
  let saved;
  try { saved = localStorage.getItem('ps.lang'); } catch (e) { /* storage can be blocked */ }
  const lang = normalize(saved) || normalize((navigator.languages && navigator.languages[0]) || navigator.language) || 'en';
  document.documentElement.lang = lang;
  if (lang !== 'en') {
    const me = document.currentScript, v = me && /[?&]v=([\w-]+)/.exec(me.src);
    // Mientras se lee la página: se ejecuta antes que los scripts del juego (defer).
    document.write(`<script src="js/lang/${lang}.js${v ? '?v=' + v[1] : ''}"><\/script>`);
  }
  return { choices, normalize, lang, locale: choices.find(([id]) => id === lang)[2] };
})();
