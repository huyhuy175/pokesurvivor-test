# Gemas y Prestigio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una moneda nueva (gemas) y un nivel permanente por Pokémon: gana EXP al jugar, al llegar a su límite se hace Prestigio con gemas (vuelve a Nv.1, +1 estrella de bonus permanente, límite +10).

**Architecture:** `save.gems` entra en la libreta anti-duplicados de `core/db.js` (clave `g`); `save.plv[raíz] = { xp, star }` guarda el progreso por forma base. Un módulo nuevo `G.Prestige` concentra fórmulas y operaciones (puro, testeable); `game.js` lo llama al empezar y acabar la partida, y una pantalla nueva `G.PrestigeUI` se cuelga de la pantalla de Mejoras.

**Tech Stack:** JavaScript sin módulos (objeto global `G`, orden de carga de `dev.html`), tests con `node --test` (`new Function('G', source)`).

**Spec:** `docs/superpowers/specs/2026-10-28-gems-prestige-design.md`

## Global Constraints

- El juego sale sólo en inglés: los textos nuevos se escriben en inglés directamente en el código; no hay `lang-updates.js`.
- Un archivo nuevo de `js/` se añade al bloque `<!-- scripts:begin -->` de `dev.html` en su orden de carga; `Prestige` también va a `NEED` en `js/main.js`. No se editan `index.html`, `js/app.min.js` ni `version.json`.
- Constantes iniciales: `LV_BASE = 30`, `LV_STEP = 10`, `MAX_STAR = 5`, `XP_K = 6` (EXP acumulada para el nivel L: `XP_K × (L−1) × L`), `LV_BONUS = 0.005`, `STAR_BONUS = 0.10`, `GEMS_BASE = 50`.
- Bonus: `dmgMul = hpMul = 1 + LV_BONUS × nivel + STAR_BONUS × star`. Coste de Prestigio: `GEMS_BASE × (star + 1)`. EXP de partida: `time/10 + kills/20 + bosses×15 + level` (redondeada hacia abajo).
- Gemas: jefe 1–2 (al instante, `DB.commit('run')`), enemigo normal 0,03 %; misiones y logros por `reward.gems`. Tope 1e9.
- El progreso se guarda por **forma base** (`G.Mons.lineage(dex)[0]`), como `pupg`.
- Cada cambio de juego va en `js/data/changelog.js` (par es / en, fecha de hoy).
- No hacer `git commit` ni `git push` salvo que el dueño lo pida (hay cambios ajenos sin commitear en el árbol).
- Los tests existentes (`tests/forge.test.cjs`, `tests/mega.test.cjs`, `tests/evolution.test.cjs`) no cargan `Prestige`: el código nuevo fuera de `game.js` debe tolerar su ausencia.

## Review Focus

- Prestigio con las gemas justas funciona; con una menos no cambia nada (Task 2).
- EXP que sobrepasa el límite se recorta; con el límite alcanzado `grantXp` no cambia nada (Task 2).
- Guardado editado a mano (`star` > `MAX_STAR`, `xp` > tope, `gems` negativas/enormes, Pokémon inexistente) queda saneado (Task 1/2).
- Un dex evolucionado, una Mega o un dex desconocido: resuelven a su forma base o devuelven valores neutros (Nv.1, bonus ×1) sin lanzar (Task 2).
- Dos aparatos con distinto progreso se fusionan sin retroceder tras un Prestigio (Task 2).
- Gastar gemas en dos aparatos sin conexión no las duplica al fusionar (Task 1).
- `apply` deja la vida máxima redondeada y no toca `perks` cuando el bonus es ×1 (Task 3).

---

### Task 1: Gemas como moneda

**Files:**
- Modify: `js/core/db.js` (save nueva ~l.94, `sanitize` ~l.192, `CUR` ~l.299), `js/systems/progress.js` (`grant`, ~l.115), `js/ui/ui.js` (`refreshCoins`, l.30), `js/ui/icons.js` (icono `gem`), `js/ui/run-ui.js` (~l.138)
- Test: `tests/prestige.test.cjs` (nuevo)

**Interfaces:**
- Produces: `save.gems: number` (0..1e9); clave de libreta `g`; `G.Progress.grant({ gems: n })` suma con tope 1e9; icono `G.Icons.html('gem', size)`.

- [ ] **Step 1: Write the failing tests** en `tests/prestige.test.cjs` (cabecera con `source`, `world`, `dbWorld`, `saveWith` como `tests/forge.test.cjs`; `saveWith` gana `gems` y `led.base.g = [base, 0]`):
  - `gems: spending on one device and earning on another both survive a merge`: gemas 6 y 15 con base 10 → `merge` da 11; idempotente y conmutativo.
  - `gems: a save without the field merges as zero`.
  - `sanitize clamps gems`: `-5` → 0, `1e12` → `1e9`, `'x'` → 0.
  - `Progress.grant adds gems and caps at 1e9` (mundo con `systems/progress.js` y `G.DB.save`).

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/prestige.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Implement**: en `db.js` añadir `gems: 0` a la partida nueva, `s.gems = Math.min(1e9, n(s.gems))` en `sanitize` y `g: [s => s.gems, (s, v) => { s.gems = v; }]` en `CUR` (comentario con la fecha 28-10-2026). En `Progress.grant`: `if (r.gems) s.gems = Math.min(1e9, (s.gems || 0) + r.gems)`. Icono `gem` en `icons.js` (paleta `{ c: '#7dffb0', w: '#e8fff2', d: '#2fbf74' }`, filas: `'............'`, `'...kkkkkk...'`, `'..kwwcccdk..'`, `'.kwwccccddk.'`, `'kkkkkkkkkkkk'`, `'.kwcccccddk.'`, `'..kwccccdk..'`, `'...kwcccdk..'`, `'....kwcdk...'`, `'.....kdk....'`, `'......k.....'`, `'............'`). `refreshCoins`: añadir `&nbsp;${G.Icons.html('gem', 18)} ${(s && s.gems) || 0}` a `tickets-pill`. `run-ui.js`: fila «Gems» `+N` si `r.gems`.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/`
Expected: PASS.

---

### Task 2: Módulo `G.Prestige` y progreso por Pokémon

**Files:**
- Create: `js/systems/prestige.js`
- Modify: `js/core/db.js` (`plv: {}` en partida nueva, `sanitize` junto a `pupg` ~l.265, `merge` junto a `pupg` ~l.397), `dev.html` (tras `systems/forge.js`), `js/main.js` (`NEED` añade `'Prestige'`)
- Test: `tests/prestige.test.cjs`

**Interfaces:**
- Consumes: `G.Mons.lineage(dex)`, `G.DB.save`, `G.DB.commit`, `G.DEX_BY`.
- Produces: `G.Prestige` con las constantes de Global Constraints y:
  `rootOf(dex): number` · `xpTo(level): number` · `limitOf(dex): number` · `levelOf(dex): number` · `bonus(dex): { dmgMul, hpMul }` · `apply(perks, mon): perks` (ver Task 3) · `runXp(run): number` · `grantXp(dex, run): { gained, level, capped }` · `canPrestige(dex): boolean` · `cost(dex): number` · `prestige(dex): { ok: true } | { ok: false, reason: 'unknown'|'maxed'|'level'|'gems' }` · `rollGems(kind: 'boss'|'enemy', rand?): number` · `onKill(pl, e, rand?)`.
  `save.plv[raíz] = { xp: number, star: number }`.

- [ ] **Step 1: Write the failing tests** (mundo: `DATA` de `tests/mega.test.cjs` + `js/systems/mons.js` + `js/systems/prestige.js`; `G.DB = { save: { gems, plv: {}, ... }, commit() {} }`):
  - `xpTo is 0 at level 1 and grows`: `xpTo(1) === 0`, `xpTo(30) === 5220`.
  - `limit grows 10 per star from 30`: `limitOf(4)` 30 → 40 tras `star = 1`.
  - `levelOf follows xp and never exceeds the limit`: xp 0 → 1; `xpTo(10)` → 10; `1e9` → 30.
  - `a Mega or an evolved form resolves to the base form`: `levelOf(6) === levelOf(4)`; con la Mega de Charizard igual.
  - `unknown dex: level 1, bonus x1, no throw`.
  - `bonus matches the formula`: nivel 10, star 2 → `1 + 0.05 + 0.2`.
  - `grantXp adds xp, clamps at the limit and then stops`: tras capar, un segundo `grantXp` devuelve `{ gained: 0, capped: true }`.
  - `runXp`: `{ time: 600, level: 15, kills: 500, bosses: 2 }` → 130.
  - `prestige: one gem short changes nothing`; `exact gems`: resta `GEMS_BASE × (star+1)`, `xp = 0`, `star + 1`, `commit(true)` llamado.
  - `prestige: below the limit → 'level'; at MAX_STAR → 'maxed'`.
  - `plv sanitize/merge`: `star: 99` → `MAX_STAR`, `xp` > tope se recorta, dex inexistente se elimina; `merge` entre `{star:1,xp:5}` y `{star:2,xp:0}` conserva `star:2`; a igual `star`, el mayor `xp`; idempotente.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/prestige.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Implement `js/systems/prestige.js`** como `G.Prestige = (() => { … })()` con la API de arriba. `levelOf` = mayor `L ≤ limitOf` con `xpTo(L) ≤ xp`. `grantXp` suma `runXp`, recorta a `xpTo(limitOf)`, guarda con `G.DB.commit('run')` solo si cambió. `rollGems`: jefe `1 + floor(rand()*2)`, enemigo `rand() < 0.0003 ? 1 : 0`. `onKill(pl, e, rand)`: si `e.judge` nada; suma con `G.Progress.grant({ gems: n })`, `pl.gemsFound`, `G.DB.commit('run')` y un `G.FX.dmgText` `'+N Gems'` color `#7dffb0`. `prestige` valida en el orden `unknown`, `maxed`, `level`, `gems`.

- [ ] **Step 4: Implement en `db.js`**: `plv: {}` en la partida nueva; en `sanitize`, tras el bloque `pupg`, normalizar `plv` (objeto; clave existente en `G.DEX_BY`; `star` entero 0..`G.Prestige ? MAX_STAR : 5`; `xp` entero ≥ 0 recortado a `K·(L−1)·L` con `L = 30 + 10·star`, usando constantes de `G.Prestige` si existe); en `merge`, tras `pupg`, quedarse con el de mayor `star` y, a igual `star`, el de mayor `xp`.

- [ ] **Step 5: Wire**: `<script defer src="js/systems/prestige.js"></script>` tras `systems/forge.js` en `dev.html`; `'Prestige'` en `NEED` de `js/main.js`.

- [ ] **Step 6: Run to verify it passes**

Run: `node --test tests/`
Expected: PASS.

---

### Task 3: Integración en la partida y en las recompensas

**Files:**
- Modify: `js/systems/prestige.js` (`apply`), `js/game.js` (l.110 y `endRun` ~l.343 y l.372), `js/systems/evolution.js` (`onKill`, l.71), `js/data/missions.js`, `js/data/achievements.js`, `js/ui/run-ui.js`
- Test: `tests/prestige.test.cjs`

**Interfaces:**
- Consumes: `Prestige.bonus`, `grantXp`, `onKill`.
- Produces: `Prestige.apply(perks, mon)` devuelve el mismo `perks` con `atkMul *= dmgMul` y `hp = Math.round((mon.hp + hp) × hpMul − mon.hp)`; `showOver(r)` recibe `xp: { gained, level, capped }` y `gems: number`.

- [ ] **Step 1: Write the failing tests**:
  - `apply: multiplies atkMul and scales total hp`: `perks = { atkMul: 1.4, hp: 16 }`, `mon.hp = 100`, bonus ×1.1 → `atkMul ≈ 1.54`, `hp === 109`.
  - `apply: empty perks and an unknown dex do not throw`: `apply({}, { dex: 99999, hp: 100 })` devuelve un objeto con `atkMul` y `hp` numéricos; el bonus de un Pokémon recién conseguido (Nv.1, 0 estrellas) es `1 + LV_BONUS`.
  - `rewards: boss, survive and level missions give gems, and higher-tier achievements carry gems`: cargar `missions.js`/`achievements.js` con los mocks de `tests/mega.test.cjs` y comprobar `reward.gems > 0` en esos ids / `tier ≥ 2`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --test-name-pattern="apply|rewards" tests/prestige.test.cjs`
Expected: FAIL.

- [ ] **Step 3: Implement**: `apply` en `prestige.js`; `game.js:110` → `const perks = G.Prestige.apply(G.Upgrades.perks(G.DB.upgradesOf(mon.dex)), mon);`; en `endRun`, justo tras `save.coins += coins;`: `const xp = G.Prestige.grantXp(pl.startDex, { time, level: pl.level, kills: pl.kills, bosses: pl.bosses });` y añadir `xp` y `gems: pl.gemsFound || 0` al objeto de `showOver` (l.372); `run-ui.js` muestra «EXP +N (Lv X)» (y «Level limit reached» si `capped`). `evolution.js:71`: `if (G.Prestige) G.Prestige.onKill(pl, e, rand);`. `missions.js`: `gems: 1` en el `reward` de `boss`, `survive` y `level`. `achievements.js`: al final de la lista, un bloque que da `reward.gems` 1 a los de `tier === 2` y 3 a los de `tier >= 3` (`Object.assign({ gems }, a.reward)`).

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/`
Expected: PASS.

---

### Task 4: Pantalla de Prestigio

**Files:**
- Create: `js/ui/prestige-ui.js`
- Modify: `js/ui/menu.js` (`renderUpgrades`, ~l.468), `dev.html` (tras `ui/menu.js`)

**Interfaces:**
- Consumes: `Prestige.levelOf/limitOf/xpTo/cost/canPrestige/prestige/bonus`, `G.DB.save.plv`, `G.UI.refreshCoins`, `G.UI.toast`, `G.Audio.sfx`.
- Produces: `G.PrestigeUI.panel(dex: number, rerender: () => void): HTMLElement`.

- [ ] **Step 1: Implement `G.PrestigeUI.panel`**: un `div.panel` con «Lv X / límite», barra de EXP (`xp − xpTo(L)` sobre `xpTo(L+1) − xpTo(L)`, llena si está en el límite), estrellas `★` según `star`/`MAX_STAR`, el bonus total («+X % damage and HP») y el botón **Prestige** (icono `gem` + coste), visible y habilitado sólo si `canPrestige` y hay gemas; en `MAX_STAR` el botón muestra «Max». Al pulsar: `confirm('Prestige <nombre>? Back to Lv 1, +1 star (+10% damage and HP), level limit +10. Costs N gems.')`; si acepta, `Prestige.prestige(dex)`, sonido `buy`, `G.UI.refreshCoins()`, toast, `rerender()`; si falla por `gems`, toast «Not enough gems» y sonido `error`.

- [ ] **Step 2: Wire**: `<script defer src="js/ui/prestige-ui.js"></script>` tras `ui/menu.js`; en `renderUpgrades`, justo después de `box.innerHTML = '';` añadir `box.appendChild(G.PrestigeUI.panel(upgDex, renderUpgrades));`.

- [ ] **Step 3: Verificación manual en `dev.html`** (con `?dev`; dar EXP y gemas desde la consola con `G` accesible, o editando el guardado): abrir Mejoras, comprobar Lv, barra, estrellas; al límite, que el botón se habilite y haga Prestigio; empezar una partida y comprobar vida y daño; acabar una partida y ver EXP y gemas en la pantalla final. Anotar lo que no se pueda probar.

---

### Task 5: Novedades y comprobación final

**Files:**
- Modify: `js/data/changelog.js` (entrada `d: '2026-10-28'`, apartado `new`)

- [ ] **Step 1: Añadir un par `[español, inglés]`** al array `new` explicando: gemas, nivel y EXP permanentes por Pokémon, Prestigio con estrellas (+10 % de daño y vida, límite +10) y de dónde salen las gemas (misiones, logros, jefes y, rara vez, enemigos).

- [ ] **Step 2: Run the full suite**

Run: `node --test tests/`
Expected: todo PASS, incluido `i18n.test.cjs`.

- [ ] **Step 3: Resumen**: indicar al dueño qué se verificó en `dev.html` y qué no; la publicación (`node tools/build.js`, etc.) queda para cuando la pida.
