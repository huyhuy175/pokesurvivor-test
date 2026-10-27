# Passives únicos por Pokémon — diseño

Fecha: 2026-10-27 · Estado: pendiente de revisión del dueño

## Objetivo

Cada Pokémon (966) tiene **una** pasiva propia, con nombre propio, diseñada según
su carácter. Su fuerza depende de la rareza (1-5). Las pasivas de rareza 4 y 5
(≈314 Pokémon) son combinaciones de efectos que no repite ningún otro Pokémon.
Las de rareza 1-3 comparten familia de efecto (por tipo) pero con números distintos.

Hoy la pasiva es la habilidad de PokeAPI (`G.DEX_ABIL` → `G.AbilityFX.of`): solo
136 habilidades tienen efecto propio, el resto da "+8 % de daño del tipo principal",
y las líneas evolutivas la comparten.

## Decisiones del dueño

- La pasiva la diseña la IA según las características del Pokémon.
- Solo inglés (nombre y descripción). Los demás idiomas muestran el inglés.
- Únicos de verdad en rareza 4 y 5; en 1-3 basta con que cambien los números.
- Se quitan las Cápsulas de Habilidad **sin reembolso**.
- Va primero esto; la diversificación de movimientos es otro diseño posterior.

## Datos: `js/data/passives.js` (nuevo)

`G.PASSIVES[dex] = { n: 'Nombre', fx: [[plantilla, valor, ...], ...] }`

- `n`: nombre en inglés, único en todo el juego (lo comprueba un test).
- `fx`: 1 a 3 efectos tomados de un catálogo cerrado de plantillas. La
  descripción se genera a partir de las plantillas y sus números, así que no
  hay textos sueltos que mantener.
- Se añade a `dev.html` en el bloque `scripts:begin/end`, antes de `ability-fx.js`,
  y a `NEED` de `js/main.js`.
- El fichero lo genera `tools/gen_passives.js` a partir de una tabla de diseño
  (arquetipo por Pokémon + rareza + etapa evolutiva). Se ejecuta a mano y su
  salida se revisa; no forma parte de `build.js`.

### Catálogo de plantillas

Se reutilizan los ganchos existentes de `ability-fx.js` (`out`, `hit`, `inMul`,
`dodge`, `hurt`, `kill`, `tick`, `start`, `speed`, `healMul`, `cdMul`, `critMul`,
`contact`). No se añaden ganchos nuevos salvo que una plantilla lo exija.

| Familia | Plantillas (valor numérico entre paréntesis) |
|---|---|
| Daño | por tipo (%), por clase física/especial (%), con poca vida (%), contra enemigo con estado (%), movimientos de varios golpes (%) |
| Crítico | probabilidad (+pp), daño del crítico (×) |
| Defensa | daño recibido (−%), por tipo recibido (−%), esquiva (%), escudo al empezar (% vida), reflejo de contacto (daño) |
| Recuperación | cura al derrotar (% vida), regeneración (% vida/s), cura recibida (×) |
| Movilidad / utilidad | velocidad (%), imán (%), recarga de movimientos (−%), XP (%) |
| Condicionales (solo rareza 5) | con vida baja, tras N derrotas seguidas, cada X s, al recibir un golpe |

Cada plantilla tiene un **coste de poder** por unidad de valor, definido en una
tabla en `passives.js`.

## Fuerza según rareza

Presupuesto de poder total de la pasiva (suma de coste de sus efectos):

| Rareza | Efectos | Presupuesto |
|---|---|---|
| 1 | 1 | 2-3 |
| 2 | 1 | 4-5 |
| 3 | 1-2 | 6-8 |
| 4 | 2 | 10-13 |
| 5 | 2-3 (puede incluir un condicional) | 16-20 |

Las bandas no se solapan, así que una rareza superior siempre es más fuerte.
Dentro de una banda, la etapa evolutiva (primera < segunda < final) y el BST
fijan el valor exacto. Los Pokémon de rareza 1-3 usan plantillas de su tipo
principal (y, en rareza 3, del secundario); los números son lo que los distingue.

## Unicidad

- Rareza 4-5: la firma `fx` (plantillas + valores) no se repite en ningún otro
  Pokémon. Se elige el arquetipo por el carácter del Pokémon (p. ej. un legendario
  de tormenta combina daño Eléctrico, esquiva y velocidad con clima).
- Todas las rarezas: el nombre `n` no se repite.

## Cambios en el código

- `js/data/ability-fx.js`: `of(id, mon)` pasa a `of(mon)`; construye el efecto
  desde `G.PASSIVES[mon.dex]`. Se conservan `FX`, `G.ABIL` y `G.DEX_ABIL`
  sin usar, para no tocar datos generados ni el trabajo de terceros.
- `js/entities/player.js:84-90` (`setAbility`) y `js/game.js:134`: llaman con
  el Pokémon, no con el id de habilidad.
- `js/systems/mons.js`: `abilityOf` devuelve el pasivo del Pokémon; se eliminan
  `abilityChoices`, `setAbility`, `rolledSlot` (ya no hay huecos ni oculta).
- `js/ui/menu.js:365-410`: se quitan los selectores de Cápsula; la fila
  "Habilidad" muestra nombre y descripción del pasivo.
- `js/ui/gacha-ui.js:133-134`: muestra el nombre del pasivo.
- `js/data/shop.js` (`cap`, `caph`, `ORDER`) y `js/ui/shop-ui.js:525`: se quitan.
  Las cantidades guardadas en el save se ignoran; `pabil` se ignora.
- Cooperativo: sin cambios de protocolo; cada máquina ejecuta el pasivo de su jugador.

## Textos

Nombres y descripciones solo en inglés. Los demás idiomas caen al inglés, como
ya hace el juego con lo que falta. `tests/i18n.test.cjs` exige las cinco lenguas
para textos nuevos de `lang-updates.js`; los pasivos no pasan por ahí, así que
el test no cambia. Si el catálogo de plantillas necesita textos en
`lang-updates.js`, se añaden solo en inglés y se anota la excepción en el test.

## Pruebas (`tests/passives.test.cjs`, nuevo)

1. Los 966 Pokémon tienen pasivo.
2. Los nombres son únicos.
3. Las firmas de rareza 4-5 son únicas.
4. El poder de cada pasivo cae dentro de la banda de su rareza.
5. Cada plantilla referenciada existe y su valor está en rango.
6. `AbilityFX.of(mon)` devuelve un efecto con descripción no vacía para todos.

Además, abrir `dev.html` y comprobar a mano: menú de personaje, gacha, y una
partida con un pasivo de rareza 1 y otro de rareza 5.

## Publicación y cambios obligatorios

- Editar `dev.html`, no `index.html`.
- Añadir entrada en `js/data/changelog.js` (`new` y `chg`, español e inglés).
- `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py`
  cuando el dueño pida publicar. No se hace commit ni push sin que lo pida.

## Fuera de alcance

- Diversificar movimientos (escalera propia por movimiento, efectos por tipo):
  diseño aparte, después de esto. Sin kinds nuevos y sin reequilibrar el reparto
  de kinds.
- Reembolso de Cápsulas.
- Traducción a fr/it/pt/zh de los pasivos.
