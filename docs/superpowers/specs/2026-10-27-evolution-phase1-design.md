# Evolución en la partida (fase 1 de 3) — diseño

Fecha: 2026-10-27 · Estado: pendiente de revisión del dueño

## Contexto y fases

El dueño quiere evolución y Mega. Es demasiado para un solo plan, así que se hace en tres fases, cada una con su spec y su plan:

1. **Esta: evolución dentro de la partida** (cadenas, objeto, cambio de Pokémon a mitad de run, sincronía cooperativa).
2. Tienda y moneda nuevas para conseguir formas evolucionadas fuera de la partida (la moneda va a la libreta de `core/db.js`; se gana con jefes/cofres, misiones y logros).
3. Mega: ≈48 formas con datos, pasiva (misma tubería de `tools/gen_passives.js`), sprites (los 37 con hoja completa en SpriteCollab se bajan; el resto con tinte/aura) y guía de generación de assets.

Hoy no hay evolución de Pokémon (solo de movimientos, GDD 7.2c) ni datos de cadenas.

## Decisiones del dueño

- La evolución ocurre en la partida cuando se cumple **nivel + objeto** (el objeto cae de cofres/jefes; de los enemigos normales con probabilidad muy baja, como red de seguridad).
- Solo se puede evolucionar a una forma **que el jugador ya tiene** en su colección (`G.DB.owns`).
- Mega será permanente y es el último paso de la cadena (fase 3).

## Datos: `js/data/evolutions.js` (nuevo, generado)

`G.EVO[dex] = [dexDestino, ...]` — evoluciones directas (puede haber varias: Eevee, Gloom…).
Lo genera `tools/fetch_evolutions.py` desde las cadenas de PokeAPI (como `fetch_pokedex.py`). Se filtran destinos que no existan en `G.DEX_BY`.

El nivel exigido no sale de los juegos (nivel 36 es inalcanzable en muchas runs). Se usa la **profundidad** en la cadena, con constantes ajustables en un único sitio (`G.Evo.LEVELS = [12, 24]`: primera y segunda evolución). Un Pokémon sin pre-evolución exige el primer nivel; uno con una pre-evolución, el segundo.

## Sistema: `js/systems/evolution.js` (nuevo) — `G.Evo`

- `G.Evo.LEVELS: [number, number]`
- `G.Evo.options(pl): number[]` — destinos de `G.EVO[pl.dex]` que el jugador posee y para los que `pl.level` alcanza el nivel exigido.
- `G.Evo.ready(pl): boolean` — hay opciones **y** `pl.evoStone > 0`.
- `G.Evo.tryEvolve(pl): void` — si `ready`: con 1 opción evoluciona sola; con varias, abre la pantalla de cartas de subida de nivel con una carta por destino (se reutiliza `systems/levelup.js`). Se llama al subir de nivel y al recoger el objeto.
- `G.Evo.lootFor(pl, kind): boolean` — decide si cae la piedra: de **jefe** y **cofre grande**, siempre si `options(pl)` no está vacío y `pl.evoStone` es 0; de **enemigo normal**, `P = 0,0005` en las mismas condiciones. Nunca se tiene más de una a la vez.

### Objeto «Piedra Evolutiva»

- Nuevo tipo de pickup `evostone` en `entities/pickup.js`, con icono propio en `ui/icons.js`.
- `pl.evoStone` (0/1) vive en el jugador; no se guarda en la partida ni en la nube.
- Los ganchos de soltar están en `entities/enemy.js` (jefe y enemigo normal, cerca de la línea 226) y en `systems/interact.js` (`bigchest`).
- En cooperativo cada jugador recibe la suya (la decisión se toma en el ordenador del dueño del jugador).

## Cambio de Pokémon: `Player.evolve(toDex)`

Se cambia **en el sitio** (mismo objeto `Player`): conserva nivel, experiencia, movimientos aprendidos, vetos, atajos y todo lo ganado en la run.

Actualiza `mon` (con `G.Mons.monFor(toDex)`), `dex`, `scale`, `r`, `bodyH`, `anim` (nuevo `Animator`; antes `G.Sprites.preload`), `baseSpd`, `baseAtk` y `maxHp` (suma la diferencia de vida base; `hp` conserva su proporción).

### Pasiva reversible

`start()` de la pasiva toca `critChance`, `magnet`, `xpMul`, `coinMul`, `regenFlat`, `cdMul` y `maxHp` de forma irreversible. Para poder cambiar de pasiva sin duplicar efectos:

- `Player.setAbility()` mide cada campo antes y después de `start` y guarda `this.passiveDelta` (diferencia en los aditivos, cociente en los multiplicativos).
- `Player.clearAbility()` deshace `passiveDelta` y borra el estado condicional (`streakN`, `streakT`, `pulseT`, `hurtBoostT`).
- `evolve` llama a `clearAbility()`, cambia el Pokémon y llama a `setAbility()`.

### Movimientos

Se conservan todos los aprendidos. Las cartas futuras salen de `G.Moves.poolFor(pl.mon)`, así que los tipos nuevos aportan movimientos nuevos sin código extra.

### Presentación

Destello, anillo y sonido (`G.FX`, `G.Audio`), aviso «¡{x} ha evolucionado a {x}!» (`G.UI.toast`), y el HUD toma el sprite nuevo. La partida no se pausa salvo que haya que elegir entre varios destinos.

## Cooperativo

Cada ordenador ejecuta a su jugador. Los demás lo ven por su `dex`, que ahora puede cambiar:

- Evento nuevo `['ev', uid, dex]` (anfitrión a todos; un cliente lo manda al anfitrión, que lo reenvía). Se añade a `docs/MULTIPLAYER_PROTOCOL.md` y a `js/net/codec.js` solo si el formato binario lo necesita (el test de `tests/net.test.cjs` lo comprueba).
- Al recibirlo se actualiza `mon`, `anim`, `r` y `bodyH` del jugador remoto, con `G.Sprites.preload` previo.

## Registro de la run

El resumen y el ranking siguen anotando el Pokémon con el que **empezó** la run (sin cambios de formato); la evolución final se muestra solo en pantalla.

## Textos

Los textos nuevos de la interfaz (aviso de evolución, nombre de la piedra, su descripción) van en `lang-updates.js` en los cinco idiomas, como pide `tests/i18n.test.cjs`. Cambios en `dev.html` (orden de scripts: `evolutions.js` antes de `evolution.js`), `NEED` de `js/main.js` (`'Evo'`) y `js/data/changelog.js`.

## Pruebas (`tests/evolution.test.cjs`, nuevo)

1. Todo destino de `G.EVO` existe en `G.DEX_BY`, y no hay ciclos.
2. `options` solo devuelve formas poseídas y con el nivel exigido (primera vs. segunda evolución).
3. `lootFor` es siempre verdadero para jefe y cofre con opciones y sin piedra, nunca con piedra en mano, y nunca sin opciones.
4. `Player.evolve` conserva nivel y movimientos, mantiene la proporción de vida y deja los campos de la pasiva igual que un Pokémon nuevo (sin acumular efectos tras varias evoluciones).
5. `clearAbility` + `setAbility` es idempotente: dos evoluciones seguidas no cambian `critChance`, `magnet`, `xpMul` ni `maxHp` respecto a una sola.
6. Formas con varios destinos: se ofrecen solo los poseídos.
7. El evento `ev` hace ida y vuelta por el códec.

## Fuera de alcance

Tienda/moneda nuevas (fase 2), Mega y sus assets (fase 3), evolución por objeto específico de la saga (Piedra Fuego, etc.), y reembolsos o migraciones de saves.
