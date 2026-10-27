# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PokéSurvivor — cómo se trabaja y se publica

Normas fijas del dueño del proyecto. Se aplican SIEMPRE.

## Comandos

- Jugar/depurar: abrir `dev.html` (carga cada script por separado, sin build). No hay servidor ni dependencias en el repo; `tools/build.js` descarga terser y javascript-obfuscator con `npx`.
- `node tools/build.js` — genera `index.html`, `js/app.min.js`, `js/lang/*.js` y `version.json`. `--expose` deja `G` accesible y sin ofuscar (para pruebas automáticas); `--sin-seo` omite el SEO.
- Tests (runner nativo de Node): `node --test tests/` · uno solo: `node --test tests/net.test.cjs` · por nombre: `node --test --test-name-pattern="texto" tests/i18n.test.cjs`.
- `node tools/build_langs.js --faltan --todo` — lista textos sin traducir.
- `node tools/export_data.js` vuelca los datos a `tools/cache/gamedata.json`, que lee `tools/make_seo_pages.py` (páginas SEO de `pokedex/`, `movimientos/`, `en/`…).

## Arquitectura

- **Sin módulos ni bundler**: cada archivo de `js/` cuelga de un único objeto global `G` (`G.Combat`, `G.Net`, `G.Flow`…). El orden de las etiquetas `<script defer>` entre `<!-- scripts:begin -->` y `<!-- scripts:end -->` de `dev.html` ES el orden de carga, y `build.js` concatena justo esos archivos en ese orden. Un archivo nuevo debe añadirse a ese bloque; si añade un módulo imprescindible, también a `NEED` en `js/main.js`.
- En `index.html` publicado todo va dentro de una función (G no existe en `window`, anti-trampas): `build.js` depende de que `util.js` contenga exactamente `window.G = window.G || {};`.
- Carpetas: `core/` (audio, input, db/Firebase, i18n, ajustes, updater), `data/` (tablas de Pokémon, movimientos, enemigos, mejoras, textos), `systems/` (combate, spawner, gacha, rift/legendarios, clima…), `entities/`, `world/`, `net/` (cooperativo, ranking, social), `ui/`. `js/game.js` contiene el bucle de partida y `G.Flow` (flujo menú → run → menú); `js/main.js` arranca y comprueba que están todos los módulos.
- **Cooperativo**: P2P directo por WebRTC; cada ordenador ejecuta los ataques de SU jugador. Formato binario en `js/net/codec.js` (protocolo en `docs/MULTIPLAYER_PROTOCOL.md`); los tests de `tests/net.test.cjs` cargan `codec.js` con `new Function('G', …)`.
- **i18n**: español e inglés van dentro del bundle (`js/data/lang-en.js`); fr/it/pt/zh se generan en `js/lang/` por `build_langs.js` desde `js/data/lang-*.js` + `lang-updates.js` y los descarga `locales.js` sólo para el idioma del jugador. Un texto nuevo va en `lang-updates.js` en los cinco idiomas (detalle en `docs/LOCALIZATION.md`); `tests/i18n.test.cjs` falla si falta alguno. Lo que falta cae a inglés.
- `sw.js` (service worker): red primero para código, caché para sprites/iconos/fuentes. `tools/trailer/` genera el tráiler; `.github/workflows/live.yml` sólo vigila si el canal de YouTube está en directo.
- Ver también `docs/` (FIREBASE, PUBLICAR, DOMINIO, SEO) y `GDD.md`. `index.html`, `js/app.min.js`, `js/lang/` y `version.json` son generados: no se editan a mano.

## Publicar una versión
1. Se edita `dev.html` (nunca `index.html`, que se genera).
2. `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py`
   - `build.js` genera `index.html`, `js/app.min.js` y **`version.json`** (la huella de esta versión).
3. Commit (sin "Co-Authored-By" ni ninguna firma de IA) y `git push origin main` sólo cuando el dueño lo pida.

## Actualización automática de los jugadores (obligatorio)
Al publicar, todos los jugadores deben pasar a la versión nueva sin perder nada
(`js/core/updater.js`, mira `version.json` cada 5 min):
- **Fuera de partida** (menú, sala de cooperativo incluida): aviso de 5 s y la página se recarga.
  Si está en el gacha, la tienda de mejoras, los ajustes o escribiendo en un campo, espera a que termine.
- **En partida**: no se toca. Al acabar, la run se guarda como siempre y, al volver al menú, se recarga.
- Antes de recargar se sube a la nube lo pendiente.
No quitar `updater.js` ni la escritura de `version.json` en `tools/build.js`.

## Novedades (changelog)
Cada cambio de juego o arreglo de fallos va también en `js/data/changelog.js`
(español e inglés, en `new` / `chg` / `fix` de la fecha de hoy). Los cambios de
servidores, base de datos o costes NO van ahí.

## Servidores
- Firebase: proyecto **pokesurvivor-free** (autenticación normal: cuentas gratis sin límite).
  **Nunca** activar "Identity Platform" ni nada que lo active (funciones de bloqueo, MFA,
  "Actualizar para habilitar"): cobra por usuario. El proyecto viejo pokesurvivor-jpter se borró el 13-10-2026 (con su facturación).
- Cloudflare: SÓLO el dominio pokesurvivor.com (comprado allí, DNS gratis). El Worker y el TURN
  (Cloudflare Realtime) se quitaron el 15-10-2026: el cooperativo va sólo con conexión directa
  (STUN gratis de Google). No volver a añadir nada de pago.
- Mantenimiento: `MAINTENANCE` en `js/main.js` (con `?dev` se puede entrar para probar).
