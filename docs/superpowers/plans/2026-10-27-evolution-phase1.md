# Evolución en la partida (fase 1) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un Pokémon evoluciona en plena partida al tener nivel suficiente y una Piedra Evolutiva, pasando a una forma que el jugador ya posee.

**Architecture:** Datos de cadenas generados desde PokeAPI (`js/data/evolutions.js`); un sistema `G.Evo` decide cuándo evoluciona y cuándo cae la piedra; `Player.evolve(toDex)` cambia el Pokémon en el sitio, deshaciendo y rehaciendo la pasiva; en cooperativo un evento `ev` avisa a los demás.

**Tech Stack:** JS sin módulos (`G`), Python 3 para el generador, tests `node --test tests/*.cjs`.

**Spec:** `docs/superpowers/specs/2026-10-27-evolution-phase1-design.md`

## Global Constraints

- Se edita `dev.html`, nunca `index.html`, `js/app.min.js`, `js/lang/` ni `version.json`. Archivos nuevos de `js/` van en el bloque `scripts:begin/end` de `dev.html` y, si son imprescindibles, en `NEED` de `js/main.js:5`.
- Orden de carga: `data/evolutions.js` y `systems/evolution.js` van después de `entities/player.js`, `data/passives.js` y `systems/mons.js`.
- Constantes ajustables en un solo sitio: `G.Evo.LEVELS = [12, 24]` (primera y segunda evolución).
- Piedra: máximo 1 en mano; de jefe y cofre grande cae siempre que `options(pl)` no esté vacío y `pl.evoStone` sea 0; de enemigo normal, `P = 0.0005` en las mismas condiciones.
- Solo se evoluciona a formas con `G.DB.owns(dex)`.
- `pl.evoStone` no se guarda ni se sube a la nube.
- Registro de la run y ranking siguen anotando el Pokémon inicial.
- Textos nuevos de interfaz en los cinco idiomas en `js/data/lang-updates.js` (`tests/i18n.test.cjs` lo exige); entrada de `js/data/changelog.js` en español e inglés (`new`), fecha 2026-10-27.
- Sin commit ni push (no se ha pedido; el directorio no es un repo git). Cada tarea termina con `node --test tests/*.cjs`.
- `build.js --expose` solo para verificar: se hace copia de `index.html`, `version.json`, `js/app.min.js` y `js/lang/` antes y se restauran después.

## Review Focus

- Evolucionar dos veces seguidas no acumula efectos de la pasiva (`critChance`, `magnet`, `xpMul`, `coinMul`, `regenFlat`, `cdMul`, `maxHp`). Test en Tarea 3.
- Pokémon con varios destinos (Eevee) y solo uno poseído: no se ofrece el resto, y con ninguno poseído no cae piedra. Test en Tarea 2.
- Evolucionar con la vida baja o en 0 de vida (jugador caído): no revive ni deja `hp` fuera de rango. Test en Tarea 3.
- Estado de partida: recoger la piedra con el menú de nivel abierto o en pausa no abre dos pantallas a la vez. Test en Tarea 4.
- Compañero cooperativo que evoluciona mientras otro tiene el sprite aún sin cargar: no falla el dibujo. Test en Tarea 5.

---

### Task 1: Datos de cadenas (`js/data/evolutions.js`)

**Files:**
- Create: `tools/fetch_evolutions.py`
- Create (generado): `js/data/evolutions.js`
- Test: `tests/evolution.test.cjs`

**Interfaces:**
- Produces: `G.EVO: { [dex: number]: number[] }` — destinos directos de cada Pokémon; solo dex presentes en `G.DEX_BY`. `G.EVO_FROM: { [dex]: number[] }` — inversa (pre-evoluciones).

- [ ] **Step 1: Write the failing tests** en `tests/evolution.test.cjs` (carga `js/data/pokedex.js` y `js/data/evolutions.js`): `test('every EVO target exists in the pokedex and never points to itself')`; `test('chains have no cycles')` (seguir cada cadena hasta 6 pasos sin repetir dex); `test('known chains')`: `G.EVO[4]` es `[5]`, `G.EVO[133]` incluye 134, 135, 136 y 196 y 197, y `G.EVO[6]` es `undefined` o `[]`; `test('EVO_FROM is the inverse of EVO')`.
- [ ] **Step 2: Run** `node --test tests/evolution.test.cjs` → FAIL (falta el archivo).
- [ ] **Step 3: Implement** `tools/fetch_evolutions.py` con el mismo estilo de caché que `fetch_pokedex.py` (`tools/cache/`): lee `pokemon-species/{dex}` → `evolution_chain.url`, recorre `chain.evolves_to` recursivamente, convierte el nombre de especie a dex, filtra los inexistentes en el Pokédex del juego (`js/data/pokedex.js`) y escribe `js/data/evolutions.js` con cabecera «GENERADO». Ejecutarlo.
- [ ] **Step 4: Run** `node --test tests/*.cjs` → PASS.

---

### Task 2: Sistema `G.Evo` (`js/systems/evolution.js`)

**Files:**
- Create: `js/systems/evolution.js`
- Modify: `dev.html` (scripts, tras `systems/mons.js` y `data/evolutions.js`), `js/main.js:5` (`'Evo'`)
- Test: `tests/evolution.test.cjs`

**Interfaces:**
- Consumes: `G.EVO`, `G.EVO_FROM` (Tarea 1), `G.DB.owns(dex): boolean`.
- Produces:
  - `G.Evo.LEVELS: [number, number]` = `[12, 24]`
  - `G.Evo.levelFor(dex): number` — `LEVELS[0]` si `EVO_FROM[dex]` está vacío; `LEVELS[1]` si no.
  - `G.Evo.options(pl): number[]` — destinos de `G.EVO[pl.dex]` poseídos y con `pl.level >= levelFor(pl.dex)`.
  - `G.Evo.ready(pl): boolean` — `options(pl).length > 0 && pl.evoStone > 0`.
  - `G.Evo.lootFor(pl, kind: 'boss' | 'chest' | 'enemy', rand?: () => number): boolean`.
  - `G.Evo.cards(pl): Array<{ type: 'mevo', key: string, dex: number, icon: string, color: string, title: string, tag: string, desc: string, apply: (pl) => void }>` — una carta por destino; `apply` llama `pl.evolve(dex)` y deja `pl.evoStone = 0`.

- [ ] **Step 1: Write the failing tests** (con `G.DB.owns` simulado): `options` devuelve `[]` si el nivel es 11 y `[5]` si es 12 para Charmander con Charmeleon poseído; con Charmeleon no poseído devuelve `[]`; Charmeleon (pre-evolución existente) exige 24; Eevee poseyendo solo Vaporeon devuelve `[134]`; `ready` falso sin piedra; `lootFor` con `kind:'boss'` es verdadero con opciones y sin piedra, falso con piedra en mano y falso sin opciones; `lootFor(pl,'enemy', () => 0.0004)` verdadero y `() => 0.0006` falso; `cards` devuelve una carta por destino poseído y `apply` llama a un `pl.evolve` simulado con el dex correcto y pone `evoStone` en 0.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `G.Evo` en `js/systems/evolution.js` (IIFE como `systems/mons.js`). Texto de carta: título «Evolución», `tag` con el nombre de destino, `desc` «Evoluciona a {x}» (cadena con `G.I18n.f`, ver `systems/mons.js` para el patrón). Añadir script a `dev.html` y `'Evo'` a `NEED`.
- [ ] **Step 4: Run** `node --test tests/*.cjs` → PASS.

---

### Task 3: `Player.evolve` y pasiva reversible

**Files:**
- Modify: `js/entities/player.js:84-92` (`setAbility`) y añadir `clearAbility()`, `evolve(toDex)`
- Test: `tests/evolution.test.cjs`

**Interfaces:**
- Consumes: `G.Mons.monFor(dex)`, `G.Sprites.preload(dexList, ms, shiny)`, `G.Sprites.Animator`, `playerScale`, `playerRadius`, `bodyHeight`, `G.AbilityFX.of(mon)`.
- Produces:
  - `Player.setAbility(): void` — igual que hoy pero guarda `this.passiveDelta` con la diferencia (aditivos `critChance`, `regenFlat`, `maxHp`) y el cociente (multiplicativos `magnet`, `xpMul`, `coinMul`, `cdMul`) que causó `start`.
  - `Player.clearAbility(): void` — deshace `passiveDelta` (resta/divide) y borra `streakN`, `streakT`, `pulseT`, `hurtBoostT`, `moxie`; deja `this.abil = null`.
  - `Player.evolve(toDex: number): void` — llama `clearAbility()`, cambia `mon`, `dex`, `scale`, `r`, `bodyH`, `anim`, `baseSpd`, `baseAtk`, suma a `maxHp` la diferencia entre la vida base nueva y la anterior (conservando `hp / maxHp`), y llama `setAbility()`. No toca nivel, experiencia, `moves`, `slots`, `banned`, `bind`, `coins`, ni `invuln`; un jugador con `dead === true` sigue muerto.

- [ ] **Step 1: Write the failing tests** (harness: cargar `js/entities/player.js` con `G` simulado: `Sprites` con `Animator` vacío, `playerScale/playerRadius/bodyHeight/preload` triviales, `Stats`, `AbilityFX` real con `passives.js`, `PassiveFX`, `Mons.monFor` devuelve `DEX_BY[dex]`, `U`, etc.):
  - `test('evolve keeps level, xp, moves and hp ratio')`: nivel 15, 3 movimientos, `hp = 0.5 * maxHp` → tras `evolve(5)`: `level`, `xp`, `moves.length` iguales y `hp / maxHp` ≈ 0.5.
  - `test('two evolutions leave passive fields the same as a fresh player of that Pokémon')`: evolucionar 4→5→6 y comparar `critChance`, `magnet`, `xpMul`, `coinMul`, `regenFlat`, `cdMul`, `maxHp` con `new Player(DEX_BY[6])` tras `setAbility()`.
  - `test('clearAbility removes conditional state')`.
  - `test('evolving while dead does not revive')`.
  - `test('hp is clamped into 0..maxHp')`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** los tres métodos en `Player`. Para medir `passiveDelta`: copiar los siete campos antes de `start`, comparar después.
- [ ] **Step 4: Run** `node --test tests/*.cjs` → PASS.

---

### Task 4: Piedra Evolutiva, cartas y presentación en partida

**Files:**
- Modify: `js/entities/pickup.js` (tipo `evostone`: icono, dibujo, recogida); `js/ui/icons.js` (icono `evostone`)
- Modify: `js/entities/enemy.js` (~línea 226: jefe y enemigo normal), `js/world/world.js:401-415` (`bigchest`)
- Modify: `js/game.js` — `PICK_SFX` (línea 454) y `onCollect` (línea 508): `evostone` pone `pl.evoStone = 1`, avisa y llama a `G.Evo.tryEvolve(pl)`; `maybeLevelUp` (línea 400): tras cada subida llama a `G.Evo.tryEvolve(pl)`
- Modify: `js/ui/run-ui.js:54-75` (`renderCards`: tratar `type === 'mevo'` como `evo`, con la misma clase dorada)
- Modify: `js/data/lang-updates.js`, `js/data/changelog.js`
- Test: `tests/evolution.test.cjs`

**Interfaces:**
- Consumes: `G.Evo.ready/lootFor/cards` (Tarea 2), `Player.evolve` (Tarea 3), `G.RunUI.showLevelUp(level, cards, cb)`.
- Produces: `G.Evo.tryEvolve(pl): void` — si `ready(pl)`: con una sola opción evoluciona al instante (destello `G.FX.ring`, `G.Audio.sfx('levelup')`, aviso con `G.UI.toast`); con varias abre `G.RunUI.showLevelUp(pl.level, G.Evo.cards(pl), card => card.apply(pl))` poniendo el estado de partida como en `maybeLevelUp`. No hace nada si `G.Game` ya está en estado `levelup` o en pausa.

- [ ] **Step 1: Write the failing tests**: `tryEvolve` no hace nada sin piedra; con una opción llama a `pl.evolve` una vez y deja `evoStone` en 0; con dos opciones llama a `showLevelUp` con 2 cartas (simulado); con el estado de partida en `levelup` no abre una segunda pantalla; fuente: `world.js` y `enemy.js` contienen una llamada a `G.Evo.lootFor`; `dev.html` carga `systems/evolution.js` antes de `game.js`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** los cambios de la lista de archivos. Los drops usan `G.Pickups.drop('evostone', x, y, 1)`. En los tres puntos de caída: `if (G.Evo.lootFor(G.Game.player, kind)) …` (solo el jugador local; en cooperativo cada ordenador decide para su jugador).
- [ ] **Step 4: Run** `node --test tests/*.cjs` → PASS. Textos nuevos en los cinco idiomas, comprobar `node tools/build_langs.js --faltan --todo` → 0 por idioma.

---

### Task 5: Cooperativo — evento `ev`

**Files:**
- Modify: `js/net/coop.js` (emitir al evolucionar; recibir en `applyHostEvent` y en el camino cliente→anfitrión, siguiendo el evento `sh` de las líneas 449 y 502)
- Modify: `js/net/codec.js` solo si el formato binario no admite el evento tal cual
- Modify: `docs/MULTIPLAYER_PROTOCOL.md`
- Test: `tests/net.test.cjs`

**Interfaces:**
- Consumes: `Player.evolve` (Tarea 3), `G.Sprites.preload`.
- Produces: evento `['ev', uid: string, dex: number]` y `G.Coop.evolved(dex: number): void` (lo llama `Player.evolve` cuando `G.Coop.active`).

- [ ] **Step 1: Write the failing test** en `tests/net.test.cjs`: `C.decode(C.encode(['ev','u1',6]))` es igual; un frame con eventos que incluya `ev` hace ida y vuelta.
- [ ] **Step 2: Run** `node --test tests/net.test.cjs` → FAIL o PASS; si pasa sin cambios, anotarlo en el libro y pasar al paso 3.
- [ ] **Step 3: Implement** la emisión y la recepción: al recibir, buscar al compañero por `uid`, hacer `G.Sprites.preload([dex], 8000, shiny)` y actualizar su `mon`, `anim`, `r`, `bodyH` cuando termine la precarga (mientras tanto conserva el sprite anterior). Documentar el evento.
- [ ] **Step 4: Run** `node --test tests/*.cjs` → PASS.

---

### Task 6: Verificación final

- [ ] **Step 1:** `node tools/build.js --expose` (con copia previa de los archivos generados) → termina sin errores; restaurar los archivos generados.
- [ ] **Step 2:** `node --test tests/*.cjs` → todo PASS.
- [ ] **Step 3:** Prueba manual en `dev.html?dev`: iniciar con Charmander (con Charmeleon poseído; se puede conceder con `G.DB.grant(5, 'gacha')` desde la consola), subir a nivel 12 con `G.Game.debugLevelUp()`, comprobar que cae la piedra de un jefe o cofre y que la evolución cambia sprite, vida, pasiva y el efecto de destello. Anotar el resultado; no publicar.

## Self-review

- Cobertura del spec: datos (T1), `G.Evo` y reglas de caída (T2), `Player.evolve` y pasiva reversible (T3), objeto, cartas, presentación, textos y changelog (T4), cooperativo (T5), pruebas y verificación (T1-T6). Registro de la run sin cambios (no hay tarea: es una no-modificación, comprobada en la revisión).
- Consistencia: `G.Evo.options/ready/lootFor/cards/tryEvolve`, `Player.evolve/clearAbility/setAbility`, evento `ev` iguales en todas las tareas.
- Riesgo a vigilar en T4: `tryEvolve` se llama desde dos sitios (subir nivel y recoger piedra); la guardia contra pantallas simultáneas está en el propio `tryEvolve`.
