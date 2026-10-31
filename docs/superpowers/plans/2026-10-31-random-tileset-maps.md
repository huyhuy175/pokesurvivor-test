# Mapas aleatorios con tilesets del itch-bundle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada run empieza con un tileset aleatorio de 10 packs del `itch-bundle` y cambia a otro cada 4 min (con el fundido actual), sin tocar terreno ni colisiones.

**Architecture:** Una herramienta Python recorta autotiles RPG Maker (A2/A4/B) de cada pack y genera un atlas PNG a 32 px/tile más `js/data/tilesets.js`. En ejecución, `G.Skins` (nuevo) carga el atlas, ordena los packs por semilla y pinta los chunks con autotiling de cuartos de tile (`G.Autotile`); `G.Tiles.paintChunk` delega en él y, si el atlas no está cargado, pinta el bioma de código de siempre.

**Tech Stack:** JS sin módulos (objeto global `G`), tests con `node --test` (`*.test.cjs`, carga con `new Function('G', src)`), Python 3 + Pillow (sólo herramienta de desarrollo).

**Spec:** `docs/superpowers/specs/2026-10-31-random-tileset-maps-design.md`

## Global Constraints

- Se edita `dev.html`, nunca `index.html`/`js/app.min.js`/`version.json` (generados). Los archivos JS nuevos van entre `<!-- scripts:begin -->` y `<!-- scripts:end -->`, en orden de carga.
- Código y comentarios en español, con el estilo de `js/world/*.js`.
- Texto nuevo visible: en `js/data/lang-en.js` **y** `js/lang/vi.js` (la clave es el texto en español).
- Cada cambio de juego va en `js/data/changelog.js` (es/en, `new`, fecha `2026-10-31`).
- No commit, no push, no build de publicación: sólo cuando el dueño lo pida (CLAUDE.md). Sin "Co-Authored-By". Por eso este plan no tiene pasos de commit.
- `itch-bundle/` no se toca ni se copia entero al repo; sólo se versionan `assets/tilesets/*.png`, `js/data/tilesets.js` y la config.
- Terreno, `walkable`, `liquidEffect` y pathing no cambian. Arenas de Grieta/Arceus siguen en código.
- Lista de packs aprobada: Meadow Wildflower Field · Autumn Forest · Fairy Forest Village · Moonlight Meadow · Crystal Cave · Frozen Tundra · Red Rock Canyon · Cursed Swamp Village · Volcanic Zone · Sky Islands.

## Review Focus

- Atlas que falla al cargar (404, sin red): el mapa debe seguir viéndose con el bioma de código, nunca negro. (Task 5)
- Chunks pintados con el bioma de código mientras el atlas aún cargaba no deben quedarse así para siempre. (Task 5)
- `skinOrder` con semilla 0, negativa o no entera: sigue devolviendo los 10 sin repetir contiguos. (Task 2)
- Cooperativo: dos máquinas con la misma semilla obtienen la misma cadena. (Task 2)
- Entrar y salir de una arena de Grieta restaura el skin que había (el índice se guarda en `arena.biome`). (Task 6)
- Un pack cuyo atlas no tenga una pieza (p. ej. sin `grass`) cae al sprite de código para ese tipo, sin lanzar excepción. (Task 5)

---

### Task 1: Autotile de cuartos de tile (`G.Autotile`)

**Files:**
- Create: `js/world/autotile.js`
- Test: `tests/autotile.test.cjs`

**Interfaces:**
- Produces:
  - `G.Autotile.FLOOR_TABLE`: 48 entradas, cada una `[[qx,qy]×4]` (cuartos TL,TR,BL,BR en una rejilla de 4×6 cuartos).
  - `G.Autotile.WALL_TABLE`: 16 entradas, cada una `[[qx,qy]×4]` en una rejilla de 4×4 cuartos.
  - `G.Autotile.floorShape(n,e,s,w,ne,se,sw,nw: boolean) -> 0..47` (true = vecino del mismo tipo).
  - `G.Autotile.wallShape(n,e,s,w: boolean) -> 0..15`.
  - `G.Autotile.draw(ctx, img, bx, by, table, shape, dx, dy, tile = 32)`: dibuja los 4 cuartos de `table[shape]` desde el bloque cuyo origen en `img` es `(bx,by)`, en `(dx,dy)`; cada cuarto mide `tile/2`.

- [ ] **Step 1: Write the failing tests** in `tests/autotile.test.cjs` (cargar el archivo con `new Function('G', src)(G)`):
  - `FLOOR_TABLE.length === 48`, `WALL_TABLE.length === 16`; cada entrada tiene 4 pares con `0<=qx<4` y `0<=qy<6` (suelo) / `qy<4` (pared).
  - `floorShape(true×8) === 0` (interior) y `floorShape(false×8) === 47` (aislado), según la numeración de `Tilemap.FLOOR_AUTOTILE_TABLE` de RPG Maker MV.
  - Para los 256 combinaciones de vecinos, `floorShape` devuelve un entero 0..47 y las esquinas diagonales sólo cuentan cuando sus dos lados contiguos son true (inventar una diagonal con un lado false no cambia el resultado).
  - `draw` con un `ctx` falso que registra `drawImage` llama exactamente 4 veces, con tamaño `tile/2`.

- [ ] **Step 2: Run** `node --test tests/autotile.test.cjs` → FAIL (archivo inexistente).

- [ ] **Step 3: Implement `js/world/autotile.js`** como `G.Autotile = (() => {...})()`. Portar las tablas `FLOOR_AUTOTILE_TABLE` y `WALL_AUTOTILE_TABLE` y el cálculo vecinos→forma de `rpg_core.js` de RPG Maker MV (corescript, licencia MIT: https://github.com/rpgtkoolmv/corescript/blob/master/js/rpg_core.js). Obtener ese archivo con WebFetch; si no hay red, parar y pedírselo al dueño. Cabecera con la referencia a la fuente.

- [ ] **Step 4: Run** `node --test tests/autotile.test.cjs` → PASS.

---

### Task 2: Orden de skins por semilla (`G.Skins.order`, `G.Skins.biomeAt`)

**Files:**
- Create: `js/world/skins.js` (por ahora sólo la parte pura)
- Test: `tests/skins.test.cjs`

**Interfaces:**
- Consumes: `G.Tilesets` (array de `{id, …}`; en el test, un array falso de 10 ids).
- Produces:
  - `G.Skins.order(seed: number) -> string[]`: los ids de `G.Tilesets` en orden barajado de forma determinista por `seed` (PRNG propio; la semilla se normaliza con `seed >>> 0`), de modo que `order[i] !== order[i+1]` siempre y también `order[last] !== order[0]`.
  - `G.Skins.biomeAt(seed: number, b: number) -> number`: índice en `G.Tiles.BIOMES` del skin número `b` de la cadena: `G.Tiles.SKIN0 +` posición en `G.Tilesets` de `order(seed)[b % n]`; si `G.Tilesets` está vacío devuelve `b % G.Tiles.NORMAL`. En el test, `G.Tiles` es un objeto falso con `SKIN0` y `NORMAL` (el real lo define Task 5).

- [ ] **Step 1: Write the failing tests:** (a) `order(7)` contiene los 10 ids una sola vez; (b) `order(7)` deep-equal `order(7)` y distinto de `order(8)`; (c) `order(0)`, `order(-5)`, `order(1.5)`, `order(NaN)` devuelven 10 ids sin repetidos contiguos ni `last===first`; (d) `biomeAt` con `G.Tilesets=[]` devuelve `b % 3`; (e) con 10 skins, `biomeAt(7, b)` es periódico de periodo 10.
- [ ] **Step 2: Run** `node --test tests/skins.test.cjs` → FAIL.
- [ ] **Step 3: Implement** la parte pura en `js/world/skins.js` (`G.Skins = (() => {...})()`); `order` hace un barajado Fisher-Yates con el PRNG y, si el resultado rompe una regla de adyacencia, intercambia el elemento problemático con el siguiente.
- [ ] **Step 4: Run** → PASS.

---

### Task 3: Herramienta de atlas (`tools/make_tilesets.py`) y vista previa

**Files:**
- Create: `tools/make_tilesets.py`, `tools/tilesets.config.json`, `tools/tilesets_preview.html`
- Generates: `assets/tilesets/<id>.png`, `js/data/tilesets.js`

**Interfaces:**
- Config (`tilesets.config.json`): array de packs
  `{ id, folder, name (es), liquid, palette{floor,wall,liq,foam,leaf,trunk,rock,grass,flowers[3]},
     floor, floorAlt, dirt, wallTop, liquidTile: {sheet, bx, by}  // bloque de autotile en la hoja A2/A4: bx 0..7, by 0..3
     wallFace: {sheet, bx, by},   // bloque de pared A4 (2×2 tiles)
     props: { tree|rock|grass: {sheet, tx, ty, tw, th} } }` (tx/ty/tw/th en tiles de 48 px de la hoja B).
- Atlas (convención compartida con `skins.js`): ancho 384 px; en `y=0` los bloques de 64×96 en este orden de `x`: `floor 0 · floorAlt 64 · dirt 128 · wallTop 192 · liquid 256`; `wallFace` (64×64) en `x=320,y=0`; los props debajo desde `y=96` en filas, cada uno reducido a 2/3 (48→32 px por tile, `LANCZOS`), con su rectángulo guardado en `props[tipo] = {x,y,w,h}`.
- `js/data/tilesets.js`: `G.Tilesets = [ { id, name, liquid, palette, prop:'tree', props:{tipo:{x,y,w,h}} }, … ];` generado, con cabecera "generado por tools/make_tilesets.py".

- [ ] **Step 1:** `pip install pillow` (sólo herramienta de desarrollo). Verificar `python -c "import PIL"`.
- [ ] **Step 2: Implement `make_tilesets.py`:** lee la config, valida que cada `sheet` exista en `itch-bundle/<folder>/**` (error claro con el pack y archivo que falta), recorta los bloques (A2: bloque `bx,by` = origen `(bx*96, by*144)` tamaño 96×144 a 48 px; A4 pared: tamaño 96×96), los reduce a 2/3 con `LANCZOS` y compone el atlas. Pasar `--only <id>` para regenerar un pack.
- [ ] **Step 3: Implement `tilesets_preview.html`:** carga `js/data/tilesets.js` y cada atlas; por pack muestra el atlas completo y un parche de 12×8 tiles montado con el propio algoritmo de `js/world/autotile.js` (suelo, un charco, una pared, un par de props), para validar a ojo.
- [ ] **Step 4: Verify** con un solo pack (Meadow Wildflower Field) y la config provisional: `python tools/make_tilesets.py --only meadow` crea `assets/tilesets/meadow.png`; abrir la vista previa y comprobar que se ve suelo, charco, pared con bordes correctos y props sin recortes. Ajustar `bx,by` hasta que sea así.

---

### Task 4: Curar los 10 packs (revisión con el dueño)

**Files:**
- Modify: `tools/tilesets.config.json`
- Generates: los 10 atlas y `js/data/tilesets.js`

- [ ] **Step 1:** Rellenar la config de los 10 packs aprobados (bloques por defecto del tipo "primer autotile de A2 = hierba/suelo", ajustando por pack con la vista previa). `liquid` y `palette` por pack según su aspecto: Volcanic Zone → `lava`; Frozen Tundra → `ice`; Cursed Swamp Village → `swamp`; Red Rock Canyon → `swamp` (arena movediza, lenta); el resto → `water`.
- [ ] **Step 2:** `python tools/make_tilesets.py` → 10 PNG + `js/data/tilesets.js`.
- [ ] **Step 3: Checkpoint humano:** abrir `tools/tilesets_preview.html`, mostrar al dueño los 10 packs (descripción por pack de lo que se ve) y descartar/sustituir los que no queden bien. Repetir Steps 1–2 hasta que el dueño dé el visto bueno. No seguir con Task 5 sin ese visto bueno.

---

### Task 5: Pintado en ejecución y carga de atlas

**Files:**
- Modify: `js/world/skins.js`, `js/world/tiles.js` (`BIOMES` tras la línea 136, `paintChunk` línea 207, `propSprite` línea 362, export línea 629), `js/world/world.js` (`setBiome` ~571, `drawProp` ~495–545), `dev.html` (bloque de scripts)
- Test: `tests/skins.test.cjs` (ampliar)

**Interfaces:**
- Consumes: `G.Autotile` (Task 1), `G.Tilesets` y atlas (Tasks 3–4), `G.Tiles.arenaBiome`-style `arenaBiome(th)` de `tiles.js:121`.
- Produces:
  - `G.Tiles.SKIN0: number` (primer índice de skin en `BIOMES`) y `G.Tiles.BIOMES[SKIN0 + k]`: bioma construido con `arenaBiome({name, floor, wall, liq, foam, prop:'tree', leaf, trunk, rock, grass, flowers, liquid})` a partir de `G.Tilesets[k].palette`, más los campos `skin: id`.
  - `G.Skins.load(id, cb?: () => void)`: carga el atlas (una sola `Image` por id); `cb` se llama al terminar con éxito; un error deja `ready(id)` en `false` y no lanza.
  - `G.Skins.ready(id) -> boolean`.
  - `G.Skins.paintChunk(cx, cy, n, at, dirtField, B, seed) -> HTMLCanvasElement` de `n*32` px: suelo (con `floorAlt` si `H(tx,ty)<0.25` y los 8 vecinos son suelo), manchas `dirt` donde `dirtField(tx*16, ty*16) > 0.64` con autotile entre vecinos, `liquid` y `wallTop` con `FLOOR_TABLE`/`floorShape` por vecinos del mismo tipo, y en las paredes sin pared al sur una franja de 12 px inferior del `wallFace`.
  - `G.Skins.propSprite(id, type) -> canvas|null`: recorte del atlas para `type` ∈ {`tree`,`rock`,`grass`} con la propiedad `canvas.px = 1`; `null` si el pack no la tiene.

- [ ] **Step 1: Write the failing tests** (añadir a `skins.test.cjs`, con `Image`/`document.createElement` falsos): (a) `ready('x')` es `false` hasta que el `Image` falso dispara `onload`; (b) con `onerror`, `ready` sigue `false` y `load` no lanza; (c) `propSprite` devuelve `null` para un tipo ausente y no lanza; (d) `G.Tiles.BIOMES.length` aumenta en `G.Tilesets.length` y cada bioma nuevo tiene `skin` igual al id.
- [ ] **Step 2: Run** `node --test tests/skins.test.cjs` → FAIL.
- [ ] **Step 3: Implement** `load/ready/paintChunk/propSprite` en `skins.js` y añadir los biomas en `tiles.js` (cargar `js/data/tilesets.js` antes de `js/world/tiles.js` en `dev.html`; añadir `js/world/autotile.js` y `js/world/skins.js` justo después de `tiles.js`, antes de `world.js`).
- [ ] **Step 4:** En `G.Tiles.paintChunk`, si `B.skin && G.Skins && G.Skins.ready(B.skin)` devolver `G.Skins.paintChunk(...)`; si no, el camino de código actual. En `G.Tiles.propSprite`, para un bioma de skin usar `G.Skins.propSprite` cuando devuelva canvas (si no, el sprite de código). `propSprite` sigue usando su caché.
- [ ] **Step 5:** En `world.js`: `setBiome` llama a `G.Skins.load(B.skin, () => { if (biome === b) images = new Map(); })` para repintar al terminar la carga (así los chunks pintados con el bioma de código mientras cargaba no se quedan). En `drawProp`, sustituir `P` por `(img.px || P)` en el cálculo de `w`, `h` y en el bloque de `old` del fundido.
- [ ] **Step 6: Run** `node --test tests/skins.test.cjs tests/autotile.test.cjs` → PASS; luego `node --test tests/` completo → sin regresiones (prestar atención a `vfx.test.cjs` y `net.test.cjs`).

---

### Task 6: Cadena de skins en la run y el menú

**Files:**
- Modify: `js/game.js` (~126–128 inicio de run, ~730 cambio de bioma, ~915–995 fondo del menú), `js/world/world.js` (exponer la semilla)
- Test: `tests/skins.test.cjs` (ampliar)

**Interfaces:**
- Consumes: `G.Skins.biomeAt(seed, b)` (Task 2).
- Produces: `G.World.seed` (getter de sólo lectura, valor pasado a `reset`).

- [ ] **Step 1: Write the failing test:** con `G.Tilesets` de 10 ids, `biomeAt(s, 0..9)` cubre los 10 índices `SKIN0..SKIN0+9` sin repetir y `biomeAt(s, 10) === biomeAt(s, 0)`; con la misma semilla en dos instancias separadas de `G.Skins` el resultado es idéntico (equivale al cooperativo).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** el getter `seed` en `world.js` y, en `game.js`, sustituir `G.World.setBiome(0, true)` (inicio de run) y `G.World.setBiome(b)` (cada 4 min) por `G.World.setBiome(G.Skins.biomeAt(G.World.seed, b[, …]))`; la variable local `biome` sigue siendo el contador de la cadena (la música usa `biome % BIOME_MUSIC.length`). Precargar el siguiente: al cambiar al skin `b`, llamar `G.Skins.load` del skin `b+1`. El fondo del menú usa una semilla local aleatoria con `biomeAt(menuSeed, bi)` y `bi` sin el `% 3`.
- [ ] **Step 4: Run** `node --test tests/` → PASS.

---

### Task 7: Cierre — caché, textos, changelog y verificación

**Files:**
- Modify: `sw.js` (línea 25), `js/data/lang-en.js` (~161), `js/lang/vi.js` (~319), `js/data/changelog.js`

- [ ] **Step 1:** En `sw.js`, añadir `tilesets` a la expresión `/\/assets\/(pokemon|icons|fonts)\//` para que los atlas se cacheen con el arte.
- [ ] **Step 2:** Añadir a `lang-en.js` y a `js/lang/vi.js` el nombre de zona de cada uno de los 10 packs (clave = `name` en español de `tilesets.js`). `node --test tests/i18n.test.cjs` debe seguir pasando.
- [ ] **Step 3:** Añadir al principio de `G.CHANGELOG` una entrada `2026-10-31` con `new`: mapas aleatorios con 10 temas distintos que cambian durante la partida (es/en).
- [ ] **Step 4: Verificación visual en `dev.html`** (con la skill `verification-before-completion`): arrancar una run varias veces y comprobar que el primer tema cambia; esperar o forzar el cambio de bioma y ver el fundido; chocar con una pared y entrar en un charco (efecto de `liquid` correcto); renombrar temporalmente un PNG para simular fallo y comprobar que se ve el bioma de código; abrir una Grieta y volver, y ver que regresa el mismo tema. Informar de qué se probó y qué no se pudo probar (p. ej. cooperativo real).
- [ ] **Step 5:** `node --test tests/` completo → todo PASS. No publicar (`build.js`, `git`) hasta que el dueño lo pida.
