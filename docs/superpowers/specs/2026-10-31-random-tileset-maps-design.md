# Mapas aleatorios con tilesets del itch-bundle — diseño

Fecha: 2026-10-31

## Objetivo

Cada run empieza en un mapa con aspecto distinto, sacado de una lista de 10
tilesets del `itch-bundle`, y durante la run el bioma cambia (cada 4 min, con el
fundido que ya existe) a otro tileset de la lista. Sólo cambia el aspecto: el
terreno, las colisiones y el pathing no se tocan.

## Decisiones ya tomadas con el dueño

- El cambio de "zona" dentro de la run es el actual: por tiempo, con fundido
  (`G.World.setBiome`, `game.js:~730`). No hay zonas por posición ni portales.
- Lista curada de 10 packs, aprobada por el dueño (se puede cambiar en la
  configuración sin tocar código):
  Meadow Wildflower Field · Autumn Forest · Fairy Forest Village ·
  Moonlight Meadow · Crystal Cave · Frozen Tundra · Red Rock Canyon ·
  Cursed Swamp Village · Volcanic Zone · Sky Islands.
- Enfoque: autotiles reales de RPG Maker, preparados en tiempo de build.
- Las arenas de la Grieta y la de Arceus (`ARENA_THEMES`) siguen pintadas por
  código en esta entrega.
- No se mete el bundle (8 GB) en el repo: sólo los atlas generados.
  Licencias de los 10 packs: las comprueba el dueño (repo público).

## 1. Herramienta de build: `tools/make_tilesets.js`

Entrada: `tools/tilesets.config.json` con, por pack, `id`, carpeta en
`itch-bundle/`, y qué hoja/celda usar para: suelo, suelo secundario (manchas),
pared (cara superior y frontal), líquido y 4–6 props (de las hojas B).
Formato RPG Maker: tile 48 px; A2 = autotiles de 2×3 tiles; A4 = paredes;
B = objetos 16×16 tiles.

Salida por pack: `assets/tilesets/<id>.png` (atlas con los trozos a 32 px,
reducidos con suavizado desde 48) y `assets/tilesets/<id>.json` (posición de
cada trozo, tipo de líquido, colores dominantes para partículas, nombre de
zona es/en).

`tools/tilesets_preview.html`: página de vista previa de los 10 atlas para que
el dueño descarte los que no queden bien antes de dar por bueno el manifiesto.
Un pack con distribución no estándar se descarta o se declara a mano en la
config; no se ensucia el código común.

## 2. Pintado en ejecución (`js/world/tiles.js`, `js/world/world.js`)

- Cada bioma de skin lleva `skin: '<id>'`. Si su atlas está cargado,
  `paintChunk` pinta con los trozos de autotile según los 8 vecinos (misma
  lógica de vecinos que el autotiling actual). Si no está cargado o falló,
  pinta el bioma de código de siempre: nunca pantalla negra.
- Terreno (`floor/wall/liquid`), `walkable`, `liquidEffect` no cambian.
  El tipo de líquido de cada pack (water/lava/ice/swamp…) sale del `.json` y
  se usa en `liquidKind()`.
- Props (`tree/rock/grass/…`) se dibujan con los trozos del atlas; los colores de
  partículas (`B.grass`, `B.rock`) salen del `.json`.
- `biomeName()` devuelve el nombre de zona del pack (en `G.I18n`).

## 3. Flujo de run y cooperativo

- Función pura `G.Tiles.skinOrder(seed)`: devuelve los 10 packs en orden
  barajado por semilla, sin repetir el mismo dos veces seguidas al dar la vuelta.
- Bioma `b` de la run = `skinOrder(seed)[b % 10]`. `game.js` sustituye el
  `b = floor(time/240)` plano por esta cadena; el menú (`game.js:~950`, rota cada
  30 s) hace lo mismo con una semilla local.
- Precarga: sólo el pack actual y el siguiente (`Image` asíncrona). Si el siguiente
  no ha cargado al llegar el momento, se mantiene el actual unos segundos.
- Cooperativo: `coop.seed` ya se envía en `start` y todas las máquinas llaman a
  `World.reset(seed)`, así que todas obtienen la misma cadena. No hace falta un
  mensaje nuevo ni tocar `codec.js`; se verificará con un test.
- Arenas de Grieta/Arceus: `setBiome(arenaBiome(...))` sigue usando los biomas de
  código. Al volver de la arena se restaura el bioma de la cadena.

## 4. Pruebas y cierre

- Tests (`node --test`): `skinOrder` (determinista, contiene los 10, sin
  repetidos contiguos), lectura/validación de los `.json`, y que los tests de
  red existentes sigan pasando.
- Pruebas visuales en `dev.html`: cada pack, los fundidos, colisiones con
  pared y líquido, y una partida cooperativa (mismo mapa en ambos).
- Cierre: añadir atlas a la caché de `sw.js`; `js/data/changelog.js`
  (es/en, `new` de hoy); nombres de zona y textos nuevos en `lang-en.js` **y**
  `js/lang/vi.js`. Publicar (`build.js` etc.) sólo cuando el dueño lo pida.

## Riesgos

- Arte de 48 px reducido a 32 px queda más suave que los Pokémon de 16 px ×2.
  Si choca, se prueba otro tamaño o un afilado leve en el build.
- Estética de los packs desigual: el preview permite descartar y sustituir.
- Tamaño: 10 atlas (unos cientos de KB cada uno); se cargan bajo demanda.

## Fuera de alcance

Arenas de la Grieta/Arceus con tilesets, zonas por posición, portales, nuevas
mecánicas de terreno por pack, usar más de 10 packs.
