# Materiales Mega — diseño

Fecha: 2026-10-28

## Objetivo

Añadir materiales de Mega (uno por tipo, 18 en total) que se guardan en la Mochila,
se consiguen en las partidas o se compran en la tienda Kecleon, y se exigen además de
Fragmentos y Cristales al desbloquear una Mega en la Forja.

## Decisiones acordadas

- Uso: sólo desbloqueo en la Forja (`Forge.buyMega`). La Piedra Mega y el nivel 36 en la run no cambian.
- Tipos: 18 materiales, uno por tipo (`G.U.TYPE_NAME`).
- Relación con los Cristales: se mantienen. La Forja pasa a costar Fragmentos + Cristales + materiales del mismo tipo.
- Fuentes: enemigos, jefes y cofres grandes sueltan materiales; la tienda vende una selección diaria.
- Almacén: `save.bag` con ids `mat_<tipo>`. Sin migración de saves, sin protocolo de red nuevo.

## Alcance excluido

Piedra Mega de la run, fórmula de Cristales, migración de saves, protocolo cooperativo.

## Datos

- Archivo nuevo `js/data/mega-mats.js` (módulo `G.MegaMats`), cargado en `dev.html` **antes** de `data/shop.js` (que se carga antes que `data/mega.js`). Define, por cada tipo de `G.U.TYPE_NAME`, el id `mat<tipo>` (sin guion bajo: la libreta sólo acepta `^b:[a-z0-9]{1,12}$`, y `matfighting` mide 11), su nombre inglés (`Fire Core`…) y su color (`G.U.TYPE_COLOR`).
- `G.Shop.ITEMS` incorpora esos ids (con `price` y `desc`) para que el whitelist de `db.js` (sanitize de `bag`, tope 999) y la libreta (`b:<id>`) los acepten sin tocar `db.js`.
- `G.Shop.ORDER` sigue listando sólo los objetos fijos (Menta); los materiales tienen su propia sección.
- Sin icono nuevo: se pintan con un punto del color del tipo.

## Forja

- `MEGA_MATS = { one, two }` junto a `MEGA_CRYSTALS` (valores iniciales: 5 y 3).
- `megaCost(to)` devuelve además `mats: { tipo: n }` con el mismo reparto por tipos que los Cristales.
- `buyMega(to)` comprueba materiales (`reason: 'mats'`) tras Fragmentos y Cristales, y sólo descuenta cuando todo se cumple. El descuento se hace sobre `save.bag`.
- `ui/forge-ui.js` muestra los materiales junto a los Cristales (encendido si alcanza, atenuado si no) y el mensaje del nuevo error.

## Botín en la run (`systems/mega.js`)

Constantes ajustables al inicio del módulo:

- Enemigo normal: 0,4 % de soltar 1 material de su primer tipo. Sin tipos, nada.
- Jefe: 2–3 materiales de su primer tipo; si `e.mon === null`, tipo al azar (igual que los Cristales). Los de `e.judge` no sueltan nada.
- Cofre grande: 1–2 materiales de un tipo de tu Pokémon.
- Se guardan al instante (`G.DB.commit('run')`), con texto flotante `+N <Tipo> Core` y contador para la pantalla final.
- `Mega.onKill` y `Mega.onChest` ya se llaman desde `systems/evolution.js`; no hace falta tocar ese archivo. Cada ordenador aplica el botín de su propio jugador.

## Tienda Kecleon (`data/shop.js`, `ui/shop-ui.js`)

- `dailyMats()`: 5 tipos al día con la misma semilla por fecha que `dailyTms` (`kecleon:mats:<fecha>`). Si el tipo principal del compañero no sale, sustituye al último.
- `Shop.buy('mat:<tipo>')`: valida que el tipo esté a la venta hoy, cobra `MAT_PRICE` (600 al inicio) y suma a `save.bag`.
- La sección «Materiales Mega» se añade a la pantalla de compra; la Mochila lista los materiales junto a la Menta.

## Textos y novedades

- El juego sale sólo en inglés (desde el 28-10-2026; `lang-updates.js` ya no existe): los textos nuevos se escriben directamente en inglés en el código, como ya hace `systems/mega.js`. No hay diccionario que tocar.
- Entrada en `js/data/changelog.js` (par es / en) en `new`, con la fecha del día; `tests/i18n.test.cjs` exige el texto inglés.

## Pruebas (`tests/mega-materials.test.cjs`)

- Los 18 ids existen y son únicos; el sanitize de la Mochila los conserva y respeta el tope 999.
- `megaCost` incluye `mats` con las cantidades correctas para Megas de uno y dos tipos.
- `buyMega` con materiales insuficientes no descuenta nada; con todo suficiente descuenta exactamente lo debido.
- `dailyMats` es determinista en el mismo día y contiene el tipo del compañero.
- `Shop.buy('mat:x')` falla si el tipo no está hoy y cobra el precio si lo está.
- Suite completa (`node --test tests/`) en verde, incluida la de i18n.

## Verificación manual

Abrir `dev.html`: derrotar un jefe y abrir un cofre, comprobar el botín y la Mochila; comprar en Kecleon; desbloquear una Mega en la Forja con los tres recursos.
