/* ============ locales.js — idioma del jugador (antes que nada) ============
 * Lo usan la pantalla de carga (boot.js) y el juego (i18n.js). No guarda nada del jugador.
 * El juego sólo sale en inglés: el código está escrito en español y lang-en.js
 * lo traduce. Si se añade otro idioma (p. ej. vietnamita), va en `choices` y
 * su diccionario se carga aquí antes que el juego.
 */
window.PS_LOCALES = (() => {
  const choices = [['en', 'English', 'en-GB']];
  document.documentElement.lang = 'en';
  return { choices, normalize: () => 'en', lang: 'en', locale: 'en-GB' };
})();
