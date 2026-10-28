# Materiales Mega Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 18 materiales Mega (uno por tipo) guardados en la Mochila, que caen en las partidas o se compran en la tienda Kecleon, y que la Forja exige además de Fragmentos y Cristales para desbloquear una Mega.

**Architecture:** Los materiales son entradas de `save.bag` con id `mat<tipo>`, así que ya viajan por la libreta anti-duplicados de `core/db.js`. Un módulo de datos nuevo (`G.MegaMats`) los define; `Shop` los vende y los guarda, `Mega` los suelta, `Forge` los cobra y las pantallas los pintan.

**Tech Stack:** JavaScript sin módulos (objeto global `G`, orden de carga de `dev.html`), tests con `node --test` (`new Function('G', source)`).

**Spec:** `docs/superpowers/specs/2026-10-28-mega-materials-design.md`

## Global Constraints

- Ids de material: `mat` + tipo en minúsculas (`matfire`, `matfighting`): la libreta sólo acepta `^b:[a-z0-9]{1,12}$`.
- El juego sale sólo en inglés: los textos nuevos se escriben en inglés directamente en el código (como `systems/mega.js`); no hay `lang-updates.js`.
- Un archivo nuevo de `js/` se añade al bloque `<!-- scripts:begin -->` de `dev.html` en su orden de carga. `data/mega-mats.js` va **antes** de `data/shop.js`; no se editan `index.html`, `js/app.min.js` ni `version.json`.
- Constantes iniciales: `MEGA_MATS = { one: 5, two: 3 }`; tienda `MAT_PRICE = 600`, `DAILY_MATS = 5`; botín: enemigo 0,4 % (1 unidad), jefe 2–3, cofre grande 1–2.
- La mochila llega a 999 por objeto (tope ya impuesto por `db.js`).
- Cada cambio de juego va en `js/data/changelog.js` (par es / en, fecha de hoy).
- No hacer `git commit` ni `git push` salvo que el dueño lo pida (hay cambios ajenos sin commitear en el árbol).
- Los tests existentes (`tests/forge.test.cjs`, `tests/mega.test.cjs`) construyen `G` sin `MegaMats` ni `Shop`: el código nuevo de `Forge`/`Mega` debe tolerar su ausencia.

## Review Focus

- Mochila ya en 999 al recibir más: no pasa de 999 (Task 3).
- Jefe sin `types` o con `mon === null`: no revienta y reparte un tipo válido (Task 3).
- `buyMega` con Fragmentos y Cristales suficientes pero materiales a medias: no descuenta nada (Task 2).
- Dos aparatos gastan el mismo material sin conexión y se fusionan: no se duplica (Task 1).
- `Shop.buy('mat:foo')` con tipo inexistente o que no está hoy a la venta: `ok:false` sin cobrar (Task 4).
- Sin compañero (`save.partner` vacío): `dailyMats()` no revienta (Task 4).

---

### Task 1: Módulo de datos `G.MegaMats` y almacén en la Mochila

**Files:**
- Create: `js/data/mega-mats.js`
- Modify: `js/data/shop.js` (ITEMS, `give`), `dev.html` (línea 651, antes de `data/shop.js`)
- Test: `tests/mega-materials.test.cjs` (nuevo)

**Interfaces:**
- Produces: `G.MegaMats = { TYPES: string[], id(type): string, typeOf(id): string|null, name(type): string, color(type): string, dot(type, px = 14): string }`; `G.Shop.give(id: string, n: number): void` (suma a `save.bag`, tope 999); `G.Shop.ITEMS['mat<tipo>'] = { name, icon: 'evostone', price: MAT_PRICE, desc }`; `G.Shop.MAT_PRICE`.

- [ ] **Step 1: Write the failing tests** en `tests/mega-materials.test.cjs`. Cabecera con el patrón de `tests/forge.test.cjs` (`source`, `world(files, extra)`, `dbWorld`, `saveWith`). `world` debe llevar `U: { TYPE_NAME: <los 18 tipos>, TYPE_COLOR: <color por tipo> }`. Tests:
  - `MegaMats has one unique id per type, and every id fits the ledger pattern`: `TYPES.length === 18`, ids únicos, cada `id` cumple `/^b:[a-z0-9]{1,12}$/` con prefijo `b:`; `typeOf(id(t)) === t`; `typeOf('mint') === null`.
  - `Shop.ITEMS includes every material`: tras cargar `mega-mats.js` y `shop.js`, `G.Shop.ITEMS[G.MegaMats.id(t)].price === 600`, `ORDER` sigue siendo `['mint']`.
  - `Shop.give caps the bag at 999`: con `G.DB = { save: { bag: {} }, commit() {} }`, `give('matfire', 1000)` → `bag.matfire === 999`.
  - `sanitize keeps materials and drops unknown ids`: con `dbWorld()` más `mega-mats.js` y `shop.js` cargados antes de `db.js`, `G.DB.sanitize(save)` con `bag: { matfire: 5, matzzz: 3 }` deja `matfire: 5` y quita `matzzz`.
  - `materials: spending on one device and earning on another both survive a merge`: igual que el test de `shards` pero con `led.base['b:matfire'] = [10, 0]`, saldo `bag.matfire` 6 y 15 → `merge` da 11, idempotente y conmutativo.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern="MegaMats|materials" tests/mega-materials.test.cjs`
Expected: FAIL (`mega-mats.js` no existe).

- [ ] **Step 3: Implement `js/data/mega-mats.js`** con `G.MegaMats` (firma arriba). `TYPES = Object.keys(G.U.TYPE_NAME)`; `name(type)` = `'<Tipo en inglés> Core'` con el nombre inglés del tipo (capitalizar la clave: `fire` → `Fire Core`); `color` desde `G.U.TYPE_COLOR`; `dot` devuelve `<span class="mat-dot" style="display:inline-block;width:Npx;height:Npx;border-radius:50%;background:COLOR"></span>`.

- [ ] **Step 4: Implement en `js/data/shop.js`**: `const MAT_PRICE = 600`; tras `ITEMS`, un bucle `if (G.MegaMats)` que añade `ITEMS[G.MegaMats.id(t)] = { name: G.MegaMats.name(t), icon: 'evostone', price: MAT_PRICE, desc: 'Used to unlock Mega Evolutions in the Forge.' }`; `ORDER` no cambia. Añadir `give(id, n)` y exportar `give` y `MAT_PRICE`. Añadir `<script defer src="js/data/mega-mats.js"></script>` en `dev.html` justo antes de la línea de `data/shop.js`.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/mega-materials.test.cjs`
Expected: PASS.

---

### Task 2: Coste de materiales en la Forja

**Files:**
- Modify: `js/systems/forge.js` (`MEGA_MATS`, `megaCost`, `buyMega`, export), `js/ui/forge-ui.js` (`megaRows`, `megaCard`, `buyMega`)
- Test: `tests/mega-materials.test.cjs`

**Interfaces:**
- Consumes: `G.MegaMats.id(type)`, `G.Shop.count(id)`, `G.Shop.take(id)`.
- Produces: `G.Forge.MEGA_MATS = { one: 5, two: 3 }`; `megaCost(to)` devuelve además `mats: { [tipo]: n }` (vacío si no existe `G.MegaMats`); `buyMega(to)` devuelve `{ ok:false, reason:'mats' }` cuando faltan materiales. Las filas de `ForgeUI.megaRows()` llevan `mats: [{ type, need, have }]` y `affordable` también las exige.

- [ ] **Step 1: Write the failing tests** (mundo con `pokedex`, `evolutions`, `mega`, `mega-mats`, `shop`, `forge`, y `G.DB` mínimo con `save`, `owns`, `crystals`, `grant`, `commit`):
  - `megaCost: one type needs 5 materials, two types need 3 each`: tomar una Mega de un tipo y otra de dos de `G.MEGA_DEX`; `mats` coincide con `{ tipo: 5 }` y `{ t1: 3, t2: 3 }`.
  - `buyMega: missing materials takes nothing`: Fragmentos y Cristales de sobra, bag con 1 material de menos → `reason === 'mats'`, `shards`, `cry` y `bag` intactos, Mega no concedida.
  - `buyMega: with everything, spends exactly the cost`: `shards`, `cry` y `bag` quedan en `inicial − coste`; `G.DB.grant` llamado con la Mega.
  - `buyMega: without G.MegaMats behaves as before`: mundo sin `mega-mats.js`/`shop.js`; `megaCost(to).mats` es `{}` y la compra funciona.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern="megaCost|buyMega" tests/mega-materials.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Implement `forge.js`**: constante `MEGA_MATS = { one: 5, two: 3 }` junto a `MEGA_CRYSTALS`; `megaCost` añade `mats` con el mismo reparto por tipos que `crystals`; `buyMega` comprueba materiales **después** de Cristales y devuelve `'mats'`, y sólo descuenta (Fragmentos, Cristales y `Shop.take` repetido `n` veces por tipo) cuando todo se cumple. Exportar `MEGA_MATS`.

- [ ] **Step 4: Implement `forge-ui.js`**: `megaRows()` rellena `mats` (con `G.Shop.count(G.MegaMats.id(type))`) y exige `mats.every(have >= need)` en `affordable`; `megaCard` pinta una línea de materiales (`G.MegaMats.dot(type)` + `<Name> have/need`, rojo `#ff8a8a` si faltan, mismo estilo que los Cristales); en `buyMega` el aviso para `reason === 'mats'` es `'Not enough Mega Materials'`.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/mega-materials.test.cjs tests/forge.test.cjs tests/mega.test.cjs`
Expected: PASS (los tests antiguos siguen en verde).

---

### Task 3: Botín de materiales en la partida

**Files:**
- Modify: `js/systems/mega.js` (constantes, `grantMats`, `onKill`, `onChest`, export), `js/game.js:372` (pasar `mats: pl.matsFound || 0`), `js/ui/run-ui.js:138` (fila nueva)
- Test: `tests/mega-materials.test.cjs`

**Interfaces:**
- Consumes: `G.MegaMats.id/name/color`, `G.Shop.give`.
- Produces: `G.Mega.MAT_DROP = { enemy: 0.004, boss: [2, 3], chest: [1, 2] }`; `G.Mega.grantMats(pl, type, n)` (guarda al instante con `G.DB.commit('run')`, suma `pl.matsFound`); `onKill`/`onChest` llaman a `grantMats`.

- [ ] **Step 1: Write the failing tests** (mundo con `mega`, `mega-mats`, `shop`, `systems/mega.js`; `G.FX`, `G.Audio`, `G.Progress`, `G.DB` simulados; `pl` mínimo `{ x:0, y:0, bodyH:1, mon:{ types:['fire'] }, level:40, dex:6, megaStone:0 }`):
  - `onKill: a normal enemy drops one material of its first type when rand is low`: `rand = () => 0` → `bag.matwater === 1`; `rand = () => 0.9` → no cae nada.
  - `onKill: an enemy without types drops nothing`.
  - `onKill: a boss drops 2-3 materials of its first type`: `rand = () => 0` → 2, `rand = () => 0.99` → 3.
  - `onKill: a boss with mon === null uses a random valid type and does not throw`.
  - `onKill: judge enemies drop nothing`.
  - `onChest: drops 1-2 materials of one of the player's types`.
  - `grantMats caps the bag at 999 and counts matsFound`: bag en 998, `grantMats(pl,'fire',3)` → 999 y `pl.matsFound === 3`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern="onKill|onChest|grantMats" tests/mega-materials.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Implement `mega.js`**: constantes `MAT_DROP`; `grantMats(pl, type, n)` = `G.Shop.give(...)`, `pl.matsFound += n`, `G.DB.commit('run')` y un `G.FX.dmgText` `'+N <Name>'` en el color del tipo, siguiendo `grantCrystal`; en `onKill` (tras el Cristal del jefe y fuera del `judge`) soltar según `e.boss` o `rand() < MAT_DROP.enemy`, con el tipo `e.types[0]` (jefe con `e.mon === null`: `randomType(rand)`); en `onChest`, un tipo de `pl.mon.types` al azar. Cantidad entre `[lo, hi]` con `rand`. Todo bajo `if (G.MegaMats && G.Shop)`.

- [ ] **Step 4: Implement UI de fin de partida**: `game.js:372` añade `mats: pl.matsFound || 0`; `run-ui.js:138` añade, junto a «Mega Crystals», `r.mats ? <div ...><span>Mega Materials</span><b>+N</b></div> : ''`.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/`
Expected: PASS.

---

### Task 4: Tienda Kecleon y Mochila

**Files:**
- Modify: `js/data/shop.js` (`DAILY_MATS`, `dailyMats`, `buy`, export), `js/ui/shop-ui.js` (`buyHtml`, `render`, `bagHtml`)
- Test: `tests/mega-materials.test.cjs`

**Interfaces:**
- Consumes: `G.MegaMats.TYPES/id/name/dot`, `rng`, `today()` ya existentes en `shop.js`.
- Produces: `G.Shop.dailyMats(): string[]` (5 tipos, orden estable); `G.Shop.buy('mat:<tipo>')` → `{ ok }` o `{ ok:false, error }`; `G.Shop.DAILY_MATS = 5`.

- [ ] **Step 1: Write the failing tests** (mundo con `pokedex`, `mega-mats`, `shop`; `G.DB = { save: { coins, bag:{}, tms:{}, partner }, commit() {} }`; `G.TM_PRICE = {}`):
  - `dailyMats: five distinct valid types, stable within a day`: dos llamadas iguales, `length === 5`, todos en `TYPES`, sin repetidos.
  - `dailyMats: always includes the partner's main type`: probar con los 18 tipos como compañero (usar un Pokémon por tipo principal o fijar `G.DEX_BY[partner].types`).
  - `dailyMats: works without a partner`.
  - `buy mat: charges 600 and adds one`: coins 1000 → 400, `bag['mat'+t] === 1` para un tipo de `dailyMats()`.
  - `buy mat: a type not on sale today, an unknown type, or too few coins does not charge`: `ok:false`, coins y bag intactos.
  - `buy mat: regular items and TMs still work` (Menta).

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern="dailyMats|buy mat" tests/mega-materials.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Implement `shop.js`**: `dailyMats()` baraja `TYPES` ordenados con `rng('kecleon:mats:' + today())` (mismo algoritmo que `dailyTms`), toma 5, y si el tipo principal del compañero (`G.DEX_BY[s.partner]`, si existe) no está, lo pone en la última posición. `buy(key)`: rama `key.startsWith('mat:')` antes de la comprobación `ITEMS[key]`: valida el tipo contra `dailyMats()`, el saldo contra `MAT_PRICE` y entonces cobra y llama a `give`. Errores: `'That material is not on sale today.'` y el existente `'No tienes Pokémonedas suficientes.'`. Exportar `dailyMats` y `DAILY_MATS`.

- [ ] **Step 4: Implement `shop-ui.js`**: en `buyHtml()` una sección «Mega Materials» (texto de ayuda: «Every day there are 5 different ones. Mega Evolutions in the Forge need them.») con una `row` por tipo de `dailyMats()` usando `G.MegaMats.dot(type, 28)`, nombre, «tienes N» y `buyBtn('mat:' + type, G.Shop.MAT_PRICE)`; en `render`, la animación al comprar trata `mat:` igual que `tm:` (`Scene.cheer('tm')`); en `bagHtml()` listar los materiales con cantidad > 0 junto a los objetos, y contarlos en la comprobación de «Mochila vacía».

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/`
Expected: PASS.

---

### Task 5: Novedades y verificación final

**Files:**
- Modify: `js/data/changelog.js` (entrada del 2026-10-28, apartado `new`)

- [ ] **Step 1: Añadir un par `[español, inglés]`** al array `new` de la entrada `d: '2026-10-28'` describiendo: materiales Mega (uno por tipo), dónde se consiguen (enemigos, jefes, cofres grandes, tienda Kecleon) y que la Forja los pide para desbloquear Megas.

- [ ] **Step 2: Run the full suite**

Run: `node --test tests/`
Expected: todo PASS, incluidos `i18n.test.cjs` (exige el texto inglés del changelog).

- [ ] **Step 3: Verificación manual en `dev.html`** (con `?dev`): derrotar un jefe y abrir un cofre y comprobar el aviso, la pantalla final y la Mochila; comprar en Kecleon y ver el saldo; en la Forja, pestaña Mega, comprobar que una Mega sin materiales aparece atenuada y se desbloquea al reunirlos. Anotar lo que no se haya podido probar.
