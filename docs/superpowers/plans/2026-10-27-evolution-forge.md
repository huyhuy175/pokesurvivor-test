# Forja Evolutiva y Fragmentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fragmento Evolutivo (nueva moneda en la libreta), Forja Evolutiva (tienda que desbloquea formas evolucionadas), gacha sin formas evolucionadas y compañero solo en formas base.

**Architecture:** `save.shards` entra en la libreta de `db.js` como la clave `sh`. `G.Forge` (systems/forge.js) tiene la lógica pura (precio, ofertas, compra); `G.ForgeUI` (ui/forge-ui.js) la pantalla. `G.Mons.isBase(dex)` es la única definición de "forma base" (`!G.EVO_FROM[dex]`) y la usan gacha, ficha de colección y migración del compañero.

**Tech Stack:** JS sin módulos (objeto global `G`), tests con `node --test tests/*.cjs` (Node 24: hace falta el glob).

**Spec:** `docs/superpowers/specs/2026-10-27-evolution-forge-design.md`

## Global Constraints
- Se edita `dev.html`, nunca los generados (`index.html`, `js/app.min.js`, `js/lang/`, `version.json`). Los archivos son CRLF: reemplazos con regex y `\n` fallan en silencio; verifica cada edición con grep. No hay git: no se commitea (los pasos "Commit" del patrón habitual se omiten; el propietario pide el commit).
- Un archivo nuevo de `js/` va en el bloque `scripts:begin/end` de `dev.html` en orden de carga; si es imprescindible, también en `NEED` de `js/main.js`.
- Textos nuevos de UI: español en el código, y filas de 5 idiomas (fr, it, pt-BR, zh-Hans, zh-Hant) en `js/data/lang-updates.js` + inglés en `js/data/lang-en.js`; `tests/i18n.test.cjs` lo comprueba. Changelog es/en en `js/data/changelog.js` bajo la fecha 2026-10-27.
- Nombres: moneda **Fragmento Evolutivo** (EN "Evolution Shard"), tienda **Forja Evolutiva** (EN "Evolution Forge").
- Precios por rareza de la forma de destino: `{1:20, 2:40, 3:80, 4:160, 5:300}`. Recompensas: jefe +3, cofre grande +1; misiones diarias +2, semanales +8; logros por `tier`: 1→5, 2→15, 3→40.
- No añadir nada de pago (Firebase Identity Platform, Cloudflare). `firestore.rules` no cambia (el mapa `save` no se valida por campos).
- Los tests cargan archivos con `new Function('G', src)(G)` y un `G` de pega (ver `tests/evolution.test.cjs`).

## Review Focus
1. Guardado manipulado: `shards` negativo/NaN/string/enorme → `sanitize` lo deja en entero ≥ 0.
2. Comprar con exactamente el precio deja 0 y no negativo; dos compras seguidas de la misma forma cobran una vez.
3. Compañero evolucionado cuya base NO se posee: migra a la base más temprana igual (y `owned` gana?) — decisión: se mantiene la regla del spec (sube por `EVO_FROM`, prefiere poseída, si no la primera) y la base se concede con `G.DB.grant(base,'migration')` para que `partner` siempre esté en `owned`.
4. Formas con varios orígenes (Eevee→Vaporeon, etc.) aparecen una vez en `offers()`.
5. Todo banner (gen 1–9) tiene pool no vacío tras excluir evolucionados, en todas las rarezas o cae a `poolNear`.
6. Cooperativo: los fragmentos son locales (como la piedra); un cliente no necesita evento de red.

---

### Task 1: `isBase` y gacha sin formas evolucionadas

**Files:**
- Modify: `js/systems/mons.js` (añadir y exportar `isBase`)
- Modify: `js/systems/gacha.js:52-66,88-91` (`inBanner`)
- Test: `tests/forge.test.cjs` (nuevo; se amplía en tareas siguientes)

**Interfaces:**
- Produces: `G.Mons.isBase(dex: number): boolean` — `true` si `!(G.EVO_FROM && G.EVO_FROM[dex])`.

- [ ] **Step 1: Failing tests** en `tests/forge.test.cjs` (helper `world()` como en evolution.test.cjs; carga `pokedex.js`, `evolutions.js`, `mons.js`, `gacha.js` con los stubs que falten en `G`): `isBase(4)` true (Charmander), `isBase(5)` false (Charmeleon), `isBase(6)` false; para cada gen 1–9, `G.Gacha.pool(r, gen)` nunca contiene un dex con `G.EVO_FROM`, y `G.Gacha.pull(...)`/`poolNear(r, gen).list` nunca está vacío para r 1–5; `G.Gacha.featured(gen)` solo devuelve formas base.
- [ ] **Step 2:** `node --test tests/forge.test.cjs` → FAIL (isBase indefinida / pool contiene evolucionados).
- [ ] **Step 3:** `isBase` en `mons.js`; en `gacha.js`, `inBanner(p, gen)` añade `&& G.Mons.isBase(p.dex)` (así `pool`, `poolNear`, `featured` quedan cubiertos; el fallback final de `poolNear` usa `inBanner`). Comenta en español por qué.
- [ ] **Step 4:** `node --test tests/*.cjs` → todo verde. Si algún banner/rareza queda vacío, `poolNear` lo cubre; si un banner entero queda vacío, para y registra un ruling.

### Task 2: Fragmento en guardado, libreta, `grant`, iconos y recompensas

**Files:**
- Modify: `js/core/db.js` (`newSave`: `shards: 0`; `CUR`: `sh`; `sanitize`: `s.shards = n(s.shards)`; `merge`: ya recorre `CUR` vía `curKeys`, verifica)
- Modify: `js/systems/progress.js:112-128` (`grant`, `rewardText`)
- Modify: `js/ui/icons.js` (icono `shard` 12×12, cerca de `evostone`), `js/ui/ui.js:30-35` (`refreshCoins`: mostrar fragmentos en la barra superior)
- Modify: `js/data/missions.js`, `js/data/achievements.js` (recompensa `shards`)
- Test: `tests/forge.test.cjs`

**Interfaces:**
- Produces: `save.shards: number` (entero ≥ 0, en libreta clave `sh`); `Progress.grant({shards:n})` suma a `save.shards`; `rewardText` incluye `icono shard + n` cuando `r.shards`.

- [ ] **Step 1: Failing tests.** Cargar `js/core/db.js` con `global.localStorage` de pega (`getItem(){return null}`, `setItem(){}`, `removeItem(){}`) y un `G` con `DEX_BY:{}`; si faltan más globales, añádelos al helper del test, no a `db.js`. (a) `G.DB.merge(a, b)` con `s0.led = {base:{sh:[10,0]}}`, `a = {...s0, shards:6}` (gastó 4) y `b = {...s0, shards:15}` (ganó 5): resultado `shards === 11`; fusionar dos veces da igual. (b) un guardado sin `shards`/sin clave `sh` en `led` fusiona a 0 sin error. Para `sanitize`, usa `G.DB` solo si exporta algo que lo ejecute; si no, comprueba vía `merge` (que no lo llama) → entonces exporta `sanitize` en el objeto de retorno de `G.DB` y testea `sanitize({shards:-3})`, `'x'`, `NaN`, `1e30`→ entero ≥ 0 (tope razonable 1e9). (c) Con `Progress` cargado y `G.DB.save` de pega, `grant({shards:5})` suma 5 y no toca monedas; `rewardText({shards:5})` contiene el número. (d) Toda `reward` de `G.MissionDefs` y `G.AchDefs.LIST` tiene `shards` entero > 0 y coincide con el esquema: misión diaria 2, semanal 8, logro por `tier` 5/15/40.
- [ ] **Step 2:** ejecutar → FAIL por las razones esperadas.
- [ ] **Step 3:** implementar. `CUR.sh = [s => s.shards, (s, v) => { s.shards = v; }]`; `sanitize` la limpia con `Math.min(1e9, n(...))`; `grant`: `if (r.shards) s.shards = (s.shards || 0) + r.shards`. Icono: cristal con paleta propia (como `evostone`, 12 filas de 12). `refreshCoins`: añadir `G.Icons.html('shard', 18) + ' ' + (s.shards||0)` en `tickets-pill` (no cambia el id). En `missions.js`/`achievements.js`, una pasada tras definir las listas que asigna `reward.shards` según el esquema (no editar las 60 definiciones a mano).
- [ ] **Step 4:** `node --test tests/*.cjs` → verde.

### Task 3: Fragmentos en la partida (jefe y cofre)

**Files:**
- Modify: `js/systems/evolution.js` (`grantShards`, `onKill`, `onChest`)
- Test: `tests/evolution.test.cjs` (ampliar)

**Interfaces:**
- Consumes: `Progress.grant`, `G.DB.commit('run')`.
- Produces: `G.Evo.SHARDS = { boss: 3, chest: 1 }`; `G.Evo.grantShards(pl, n)`: `Progress.grant({shards:n})`, texto flotante `+n` y `G.DB.commit('run')`. **Ruling (desvía el spec):** se guardan al instante, no al final de la partida, como los tickets (así no se pierden si se cierra la pestaña y mueren o no da igual).

- [ ] **Step 1: Failing tests** (con `G.Progress`, `G.DB`, `G.FX`, `G.Audio`, `G.T` de pega ya usados en el test): `onKill(pl, {boss:true})` suma 3 fragmentos **aunque `options(pl)` esté vacío** (sin formas a las que evolucionar); `{boss:true, judge:true}` no suma; enemigo normal no suma; `onChest` suma 1 siempre; y la piedra sigue sin cambiar su comportamiento.
- [ ] **Step 2:** FAIL. **Step 3:** implementar sin alterar `lootFor`. **Step 4:** suite verde.

### Task 4: Lógica de la Forja

**Files:**
- Create: `js/systems/forge.js` (`G.Forge`)
- Modify: `dev.html` (script tras `evolution.js`), `js/main.js` (`NEED` + `'Forge'`)
- Test: `tests/forge.test.cjs`

**Interfaces:**
- Produces: `G.Forge.PRICE = {1:20,2:40,3:80,4:160,5:300}`; `price(dex): number`; `offers(): Array<{from:number,to:number,price:number}>` (formas `to ∈ G.EVO[from]` con `from` poseída y `to` no poseída; una entrada por `to` aunque haya varios `from`; ordenadas por `price` y luego dex); `buy(to): {ok:true}|{ok:false, reason:'unknown'|'owned'|'locked'|'shards'}`.

- [ ] **Step 1: Failing tests** (con `G.DB` de pega que implementa `save`, `owns`, `grant`, `commit`): `price` por rareza; `offers` vacía sin Pokémon; con Charmander poseído ofrece Charmeleon (precio de su rareza) y no Charizard; Eevee ofrece sus ramas, cada una una vez; un `to` con dos `from` poseídos aparece una vez; `buy` con fragmentos justos deja `shards === 0`, `owns(to)` y `commit` llamado; no deja shiny; comprar de nuevo → `{ok:false, reason:'owned'}` sin cobrar; sin fragmentos → `reason:'shards'` sin cambiar nada; sin la base → `reason:'locked'`; dex inexistente → `'unknown'`; `buy` no modifica `save.shards` por debajo de 0.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (orden de comprobación: unknown → owned → locked → shards; al comprar: restar, `G.DB.grant(to,'forge')`, `G.DB.commit(true)`). **Step 4:** suite verde.

### Task 5: Compañero solo en formas base

**Files:**
- Modify: `js/core/db.js` (`sanitize` y `merge`: `fixPartner(s)`; exportarla si el test la necesita)
- Modify: `js/ui/menu.js:332-334` (botón de elegir)
- Test: `tests/forge.test.cjs`

**Interfaces:**
- Produces: `fixPartner(s)`: si `s.partner`/`s.starter` no es forma base, lo cambia por la forma base más temprana (subir por `G.EVO_FROM` hasta una sin origen, prefiriendo ramas poseídas; si ninguna se posee, la primera), concede esa base con `s.owned[base] = { at: Date.now(), from: 'migration' }` si falta, y deja `partnerShiny = false` salvo que `s.shiny[nuevo]` exista y `partnerShiny` fuera true. Usa `G.EVO_FROM` con guardas (puede no estar cargado). `G.MenuUI` no exporta nada nuevo: la decisión se toma con `G.Mons.isBase`.

- [ ] **Step 1: Failing tests:** compañero 5 (Charmeleon) con 4 poseído → 4; con 4 sin poseer → 4 y `owned[4]` creado; compañero 6 → 4; ya base → intacto; `starter` evolucionado → base; `partnerShiny` solo se conserva si procede; `merge(a,b)` cuyo ganador (más reciente) trae compañero evolucionado devuelve compañero base; idempotente; `pupg` del compañero antiguo no se toca.
- [ ] **Step 2:** FAIL. **Step 3:** implementar y llamar `fixPartner` al final de `sanitize` y de `merge`. En `menu.js`, en `showDetail`, si `!G.Mons.isBase(dex)`: no mostrar `dex-pick` ni "Es tu compañero" y mostrar `<p class="sub center">Forma evolucionada: solo vista previa. Elige su forma base y evoluciónala durante la partida.</p>` (traducible). **Step 4:** suite verde. Verifica con grep que no queda otro punto que asigne `partner`/`starter` (`menu.js:349` es el botón; `test.js:86` elige entre iniciales: comprobar que son bases).

### Task 6: Pantalla Forja Evolutiva

**Files:**
- Create: `js/ui/forge-ui.js` (`G.ForgeUI.open()`)
- Modify: `dev.html` (sección `scr-forge`, botón de menú `data-go="forge"`, script), `js/ui/menu.js:13-29` (icono y rama `forge`), `js/ui/ui.js:11` (`SCREENS`), `js/game.js:620` (lista de Escape)
- Test: `tests/forge.test.cjs` (solo el HTML/orden: ver step 1)

**Interfaces:**
- Consumes: `G.Forge.offers/price/buy`, `G.DB.save.shards`, `G.UI.show`, `G.UI.sprite`, `G.UI.toast`, `G.Icons.html('shard', n)`.
- Produces: `G.ForgeUI.open()`.

- [ ] **Step 1: Test** (estático): `dev.html` contiene `id="scr-forge"`, `data-go="forge"` y `forge-ui.js` después de `ui.js`; `ui.js` lista `'scr-forge'` en `SCREENS`; `menu.js` tiene la rama `go === 'forge'`; `main.js` `NEED` contiene `'Forge'`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Pantalla: título "Forja Evolutiva", línea explicativa, saldo de fragmentos, filtros por rareza (chips, mismo estilo que la colección), lista de tarjetas (sprite de la forma de destino, nombre, "desde {base}", rareza, precio, botón Comprar deshabilitado si faltan fragmentos). Comprar → `G.Forge.buy` → toast "¡{x} desbloqueado!" + sonido `confirm`, `G.UI.refreshCoins()`, re-render. Estado vacío: "Nada que forjar por ahora. Consigue Pokémon con evolución." Botón Volver (`data-back`). Móvil: una columna, sin scroll horizontal.
- [ ] **Step 4:** suite verde y abrir `dev.html?dev` comprobando a mano (concede con `G.DB.grant(4,'gacha')` y `G.DB.save.shards=200`).

### Task 7: Textos, changelog, docs, limpieza y verificación final

**Files:**
- Modify: `js/data/lang-en.js`, `js/data/lang-updates.js`, `js/data/changelog.js`, `dev.html` (texto del menú Kecleon y `shop-hello`), `docs/` (nota en `docs/LOCALIZATION.md` no hace falta; añadir sección breve a `GDD.md` solo si ya habla de gacha/economía)

- [ ] **Step 1:** todos los textos nuevos de las tareas 2–6 con 5 idiomas + inglés; cambiar "Mentas, Cápsulas y MT" → "Mentas y MT" (menú `data-go="shop"` y `shop-hello`, ya sin cápsulas) con sus traducciones.
- [ ] **Step 2:** changelog 2026-10-27: `new`: Forja Evolutiva + Fragmentos Evolutivos; `chg`: el gacha ya no da formas evolucionadas; solo las formas base se eligen de compañero (las evolucionadas se ven en la colección y se consiguen evolucionando en la partida); compañero evolucionado antiguo pasa a su forma base.
- [ ] **Step 3:** `node --test tests/*.cjs` y `node tools/build_langs.js --faltan --todo` → 0 faltan.
- [ ] **Step 4:** copia de seguridad de `index.html`, `js/app.min.js`, `js/lang/`, `version.json`; `node tools/build.js --expose` para comprobar que construye y que no falta ningún módulo (`NEED`); restaurar los generados originales. No publicar.
