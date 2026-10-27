# Passives únicos por Pokémon — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada uno de los 966 Pokémon tiene una pasiva propia (nombre propio, solo inglés) cuya fuerza depende de la rareza; en rareza 4-5 la combinación de efectos no se repite.

**Architecture:** Un catálogo cerrado de plantillas de efecto (`js/data/passive-fx.js`) construye los ganchos que ya entiende `G.AbilityFX` desde datos puros (`js/data/passives.js`, generado por `tools/gen_passives.js`). `G.AbilityFX.of(mon)` lee esos datos en vez de la habilidad de PokeAPI. Se quitan los selectores de habilidad y las Cápsulas.

**Tech Stack:** JS sin módulos (objeto global `G`), tests con `node --test` cargando archivos con `new Function('G', …)`.

**Spec:** `docs/superpowers/specs/2026-10-27-unique-passives-design.md`

## Global Constraints

- Se edita `dev.html`, nunca `index.html`, `js/app.min.js`, `js/lang/` ni `version.json` (generados).
- Un archivo nuevo de `js/` se añade al bloque `<!-- scripts:begin -->…<!-- scripts:end -->` de `dev.html` en su orden de carga; si es imprescindible, también a `NEED` en `js/main.js:5`.
- Nombres y descripciones de pasivos solo en inglés. No se tocan `lang-*.js` ni `lang-updates.js`.
- Presupuesto de poder por rareza: R1 2-3 (1 efecto) · R2 4-5 (1) · R3 6-8 (1-2) · R4 10-13 (2) · R5 16-20 (2-3, puede llevar un condicional). Bandas sin solape.
- Nombre `n` único entre los 966; firma `fx` única entre los de rareza 4 y 5.
- `G.ABIL`, `G.DEX_ABIL` y `AbilityFX.FX` se conservan sin tocar.
- Cápsulas `cap` y `caph` se quitan sin reembolso; `save.pabil` se ignora.
- Cooperativo: sin cambios de protocolo.
- Entrada en `js/data/changelog.js` (español e inglés, `new` y `chg` de la fecha de hoy, 2026-10-27).
- Sin commit ni push: el dueño no lo ha pedido y el directorio no es un repositorio git. Cada tarea termina ejecutando `node --test tests/`.

## Review Focus

- Pokémon con un solo tipo (`types[1]` indefinido): las plantillas por tipo secundario no deben fallar ni dar `NaN`. Test en Tarea 2.
- Partida nueva tras una con pasiva condicional/acumulativa (`moxie`, rachas): el estado vive en `pl`, que se recrea por run; no debe filtrarse entre runs. Test en Tarea 1.
- Save antiguo con `pabil` y cantidades `cap`/`caph`: el juego arranca y muestra el pasivo nuevo sin errores. Test en Tarea 3.
- Texto en idioma no inglés: la descripción nueva no pasa por una clave de traducción inexistente y se ve en inglés, no vacía. Test en Tarea 3.
- Pokémon de rareza alta en primera etapa evolutiva (p. ej. un legendario sin evolución): la banda manda por rareza, no por etapa. Test en Tarea 2.

---

### Task 1: Catálogo de plantillas (`js/data/passive-fx.js`)

**Files:**
- Create: `js/data/passive-fx.js`
- Test: `tests/passives.test.cjs`

**Interfaces:**
- Produces: `G.PassiveFX` con
  - `TEMPLATES: { [id: string]: { cost: number /* poder por unidad de valor */, min: number, max: number, cond?: true, text: (v: number[], mon) => string, hooks: (v: number[], mon) => object } }`
  - `BANDS: { 1: [2,3], 2: [4,5], 3: [6,8], 4: [10,13], 5: [16,20] }` (rareza → [mín, máx] de poder)
  - `power(fx: Array<[string, ...number[]]>): number`: suma de `cost × valor` de cada efecto
  - `signature(fx): string`: JSON canónico de plantillas y valores
  - `build(p: { n: string, fx: Array<[string, ...number[]]> }, mon): object`: devuelve `{ d: string /* inglés */, ...ganchos }` con los mismos ganchos que documenta `js/data/ability-fx.js:8-24`
- Plantillas mínimas (ids): `typeDmg`, `classDmg`, `lowHpDmg`, `multiHitDmg`, `critChance`, `critDmg`, `dmgTaken`, `typeTaken`, `dodge`, `startShield`, `reflect`, `killHeal`, `regen`, `healMul`, `speed`, `magnet`, `cdMul`, `xp`, y condicionales (`cond: true`) `streakDmg`, `pulseEvery`, `hurtBoost`.

- [ ] **Step 1: Write the failing tests** en `tests/passives.test.cjs`, cargando el archivo con `new Function('G', src)(G)` sobre un `G` de pruebas con `U.TYPE_NAME`, `Types.mult` y `Weather.current` simulados:
  - `test('power sums cost × value')`: `power([['critChance', 4]])` es `TEMPLATES.critChance.cost * 4`.
  - `test('every template builds a non-empty English description for 1-type and 2-type mons')`: para cada plantilla y valor intermedio de `[min,max]`, con `{types:['fire']}` y `{types:['fire','flying']}`, `build(...).d` es string no vacío sin caracteres españoles (`/[áéíóúñ¿¡]/` no coincide) y sin `NaN`.
  - `test('typeDmg multiplies only matching moves')`: el gancho `out(pl, {type:'fire'})` es mayor que 1 y con `{type:'water'}` es 1.
  - `test('conditional state lives on the player object')`: dos objetos `pl` distintos con `streakDmg` no comparten racha tras `kill`.
- [ ] **Step 2: Run** `node --test tests/passives.test.cjs` → FAIL (`G.PassiveFX` no definido).
- [ ] **Step 3: Implement** `G.PassiveFX` en `js/data/passive-fx.js` con la misma forma de IIFE que `js/data/ability-fx.js` (reutiliza los helpers `low`, `heal`, `cls` del mismo estilo, sin importarlos). Costes y rangos: elegirlos para que una plantilla de coste bajo al máximo quepa en R1 y las bandas de R4-R5 exijan 2-3 efectos; documentarlos en una tabla comentada al inicio del archivo. Texto en inglés tipo `"+12% fire damage."`.
- [ ] **Step 4: Run** `node --test tests/passives.test.cjs` → PASS.
- [ ] **Step 5: Checkpoint** `node --test tests/` → todo PASS.

---

### Task 2: Datos y generador (`js/data/passives.js`, `tools/gen_passives.js`)

**Files:**
- Create: `tools/passive_design.json` — diseño de rareza 4-5: `{ "<dex>": { "n": string, "fx": [[id, ...valores]] } }` escrito a mano por Pokémon (314 entradas) según su carácter.
- Create: `tools/gen_passives.js`
- Create (generado): `js/data/passives.js`
- Test: `tests/passives.test.cjs`

**Interfaces:**
- Consumes: `G.PassiveFX.TEMPLATES/BANDS/power/signature` (Tarea 1), `G.DEX` / `G.DEX_BY` de `js/data/pokedex.js` (campos `dex`, `name`, `types`, `rarity`, `bst`, `gen`).
- Produces: `G.PASSIVES: { [dex: number]: { n: string, fx: Array<[string, ...number[]]> } }` para los 966 dex.

- [ ] **Step 1: Write the failing tests** (cargan `pokedex.js`, `passive-fx.js` y `passives.js` en un `G` de pruebas):
  - `test('all Pokémon have a passive')`: cada `dex` de `G.DEX` tiene entrada con `n` no vacío y `fx` de 1-3 elementos.
  - `test('names are unique')`.
  - `test('rarity 4-5 signatures are unique')` usando `signature`.
  - `test('power is inside the band of its rarity')` con `BANDS[rarity]`; incluye un caso de rareza 5 sin evolución (primera etapa).
  - `test('every effect id exists and value is in [min,max]')`.
  - `test('rarity 1-3 effects only use type/stat templates, never cond')`.
- [ ] **Step 2: Run** → FAIL (no existe `passives.js`).
- [ ] **Step 3: Implement** `tools/gen_passives.js` (Node, sin dependencias): lee `js/data/pokedex.js` y `tools/passive_design.json`; para rareza 4-5 toma el diseño manual y falla con lista de errores si cae fuera de banda o repite firma; para rareza 1-3 construye la pasiva con una plantilla del tipo principal (y el secundario en R3), valor proporcional a la posición del `bst` dentro de su banda, nombre = `<palabra de tipo> <palabra de rol>` con sufijo del propio nombre del Pokémon si hay colisión. Escribe `js/data/passives.js` con cabecera "GENERADO, no editar a mano". Orden de trabajo: generar R1-R3, luego escribir `passive_design.json` por bloques de generación (`gen` 1…9), regenerando tras cada bloque.
- [ ] **Step 4: Run** `node tools/gen_passives.js && node --test tests/passives.test.cjs` → PASS.
- [ ] **Step 5: Checkpoint** `node --test tests/` → todo PASS.

---

### Task 3: Conectar el motor (`AbilityFX.of(mon)`, jugador, Pokémon)

**Files:**
- Modify: `js/data/ability-fx.js:264-273` (`of`)
- Modify: `js/entities/player.js:84-90` (`setAbility`) y `:81` (comentario de `abil`)
- Modify: `js/game.js:134`
- Modify: `js/systems/mons.js:71-99` y la lista exportada en `:122`
- Modify: `dev.html` (añadir `passive-fx.js` y `passives.js` justo antes de `ability-fx.js`, línea 657)
- Modify: `js/main.js:5` (`NEED` incluye `'PassiveFX'`)
- Test: `tests/passives.test.cjs`

**Interfaces:**
- Consumes: `G.PassiveFX.build`, `G.PASSIVES`.
- Produces:
  - `G.AbilityFX.of(mon: object): object` — efecto construido desde `G.PASSIVES[mon.dex]`; si falta la entrada, cae a la pasiva genérica actual (`generic(mon)`) para no romper datos futuros. `FX` y `generic` se conservan.
  - `Player.setAbility(): void` — sin argumento; asigna `this.abil = G.AbilityFX.of(this.mon)`, `this.abilId = String(this.mon.dex)`, y mantiene `cdMul` y `start`.
  - `G.Mons.abilityOf(dex): { id: string /* String(dex) */, name: string /* G.PASSIVES[dex].n */, desc: string, slot: 0 }` y se eliminan `rolledSlot`, `abilityChoices`, `setAbility`, `slots`, `abilityName`. `game.js:134` pasa a `pl.setAbility()`.

- [ ] **Step 1: Write the failing tests**:
  - `test('AbilityFX.of(mon) returns the passive built from PASSIVES')`: `of({dex:1,types:['grass','poison']}).d === build(G.PASSIVES[1], mon).d`.
  - `test('of falls back to generic when the dex has no entry')`.
  - `test('old save with pabil and capsule counts is ignored')`: `Mons.abilityOf(1)` con `save = { pabil: {1:[2,0]}, shop: { cap: 3 } }` devuelve el nombre de `PASSIVES[1].n`.
  - `test('description is English text even when the language is not')`: con `G.T = s => s` y con un `G.T` que devuelva `''` para claves desconocidas el menú no se queda sin texto (usa la cadena original como respaldo).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** los cambios de la lista de archivos. `abilityOf` no depende ya de `save()`.
- [ ] **Step 4: Run** `node --test tests/passives.test.cjs` → PASS.
- [ ] **Step 5: Smoke manual** abrir `dev.html` (con `?dev`), empezar una partida con un Pokémon de rareza 1 y otro de rareza 5: sin errores en consola y el pasivo hace efecto (p. ej. `critChance` visible en las estadísticas). Anotar el resultado.
- [ ] **Step 6: Checkpoint** `node --test tests/` → todo PASS.

---

### Task 4: Interfaz y tienda

**Files:**
- Modify: `js/ui/menu.js:365-410` — quitar `capN`, `caphN` y los selectores de habilidad (`abilityChoices`); la fila "Habilidad" muestra `ab.name` y debajo `ab.desc` (con `translate="no"`).
- Modify: `js/ui/gacha-ui.js:133-134` — usar `ab.name`.
- Modify: `js/data/shop.js:17-22` — quitar `cap`, `caph` de `ITEMS` y de `ORDER`.
- Modify: `js/ui/shop-ui.js:525` — quitar `cap` y `caph` de `SHELF_ICON`; revisar cualquier otra referencia con `grep -n "cap\b\|caph" js/ui/*.js js/data/*.js`.
- Modify: `js/data/changelog.js` — entrada de hoy (es/en): `new` "Cada Pokémon tiene una pasiva propia, más fuerte cuanto más rara" y `chg` "Las Cápsulas de Habilidad desaparecen de la tienda".
- Test: `tests/passives.test.cjs`

**Interfaces:**
- Consumes: `G.Mons.abilityOf(dex)` (Tarea 3).
- Produces: sin API nueva.

- [ ] **Step 1: Write the failing tests**: `test('shop no longer sells capsules')`: cargar `js/data/shop.js` y comprobar que `G.Shop` no ofrece `cap` ni `caph`; `test('no UI file references removed APIs')`: recorrer `js/ui/*.js` y `js/systems/*.js` y comprobar que no aparecen `abilityChoices(`, `G.Mons.setAbility` ni `abilityName(`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** los cambios de la lista de archivos.
- [ ] **Step 4: Run** `node --test tests/passives.test.cjs` → PASS.
- [ ] **Step 5: Smoke manual** en `dev.html`: ficha del Pokémon (nombre y descripción del pasivo, sin botones de Cápsula), pestaña de tienda (solo Menta y MT), tirada de gacha (nombre del pasivo).
- [ ] **Step 6: Checkpoint** `node --test tests/` → todo PASS (incluido `tests/i18n.test.cjs`).

---

### Task 5: Verificación de publicación

**Files:**
- Ninguno nuevo.

- [ ] **Step 1: Run** `node tools/build.js --expose` → termina sin errores, `index.html` incluye los dos archivos nuevos en el bloque concatenado.
- [ ] **Step 2: Run** `node --test tests/` → todo PASS.
- [ ] **Step 3: Informar** al dueño del resultado y de la distribución de poder por rareza (mín, media, máx) que imprime `tools/gen_passives.js`. No publicar (`export_data.js`, `make_seo_pages.py`, commit, push) hasta que el dueño lo pida.

## Self-review

- Cobertura del spec: datos y plantillas (T1-T2), fuerza por rareza (T1 `BANDS`, T2 tests), unicidad (T2), cambios de código (T3-T4), textos en inglés (T3 test), pruebas (T1-T4), publicación y changelog (T4-T5), Cápsulas fuera sin reembolso (T4).
- Desviación respecto al spec: las plantillas, costes y bandas van en `passive-fx.js` (código) y `passives.js` queda solo con datos generados, para que regenerar no pise el catálogo.
- Consistencia de nombres: `G.PassiveFX`, `G.PASSIVES`, `AbilityFX.of(mon)`, `Player.setAbility()`, `Mons.abilityOf(dex)` iguales en todas las tareas.
