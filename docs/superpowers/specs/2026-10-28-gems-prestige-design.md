# Gemas y Prestigio de Pokémon — diseño

Fecha: 2026-10-28

## Objetivo

Añadir una moneda nueva (gemas) y un nivel permanente por Pokémon. El Pokémon gana EXP al
jugar. Al llegar a su límite de nivel se puede hacer Prestigio con gemas: vuelve a Nv.1, gana
una estrella (bonus permanente de daño y vida) y sube su límite de nivel.

## Decisiones acordadas

- Nivel permanente por Pokémon, fuera de la partida, que sube con EXP ganada al jugar.
- Límite de nivel inicial 30; cada estrella de Prestigio lo sube 10.
- Prestigio: cuesta gemas, reinicia a Nv.1, da una estrella permanente.
- Bonus: nivel pequeño y constante + estrella grande (nivel pequeño, prestigio grande).
- Las gemas salen de misiones, logros, jefes y, con poca probabilidad, de enemigos normales. No se compran con Pokémonedas.
- El nivel se guarda por línea evolutiva (como `pupg`): evolucionar o megaevolucionar no lo pierde.
- No se tocan: mejoras actuales (`pupg`), Mega, protocolo cooperativo.

## Datos y guardado

- `save.gems`: entero, tope 1e9. Clave nueva `g` en la libreta de `core/db.js` (como `sh`), con su saneado y su fusión entre aparatos.
- `save.plv[raíz] = { xp, star }`. El nivel se calcula a partir de `xp` con una curva fija; no se guarda.
  - Límite de nivel = `LV_BASE + LV_STEP × star` (30 y 10).
  - Con el límite alcanzado, la EXP deja de acumularse.
  - Estrellas máximas `MAX_STAR` = 5.
- Migración de forma a línea: igual que `pupg` en `db.js` (tomar el mayor `star` y `xp` al unir).
- Saneado: `star` entre 0 y `MAX_STAR`; `xp` entre 0 y la EXP del límite; Pokémon inexistentes se eliminan.
- Fusión entre aparatos: máximo de `star` y, a igualdad, máximo de `xp`.

## Fórmulas (constantes ajustables en `systems/prestige.js`)

- Bonus: `dmgMul = 1 + 0,005 × nivel + 0,10 × star`; `hpMul`, igual.
- Coste de Prestigio: `GEMS_BASE × (star + 1)`, con `GEMS_BASE = 50`.
- EXP al acabar la partida: `time/10 + kills/20 + bosses×15 + level`.
- Gemas: jefe 1–2 (guardadas al instante); enemigo normal 0,03 %; misiones y logros según su `reward.gems`.

## Módulo `G.Prestige` (`js/systems/prestige.js`)

`LV_BASE`, `LV_STEP`, `MAX_STAR`, `levelOf(raíz)`, `limitOf(raíz)`, `bonus(dex)` → `{ dmgMul, hpMul }`,
`grantXp(dex, run)`, `canPrestige(dex)`, `cost(dex)`, `prestige(dex)` → `{ ok, reason }`
(`'unknown'|'maxed'|'level'|'gems'`), `onKill(pl, e)`. Va en `dev.html` dentro del bloque `scripts` en el orden de carga correcto.

## Integración

- `game.js` (`startRun`): `Prestige.apply(perks, mon)` ajusta `perks` antes de crear `G.Player`: `atkMul *= dmgMul` y `hp = (mon.hp + hp) × hpMul − mon.hp` (porque `Player.maxHp = mon.hp + perks.hp`). `Player` no cambia.
- `game.js` (`endRun`): `grantXp(pl.startDex, {...})` junto a la suma de monedas; la pantalla final muestra EXP, gemas y si se alcanzó el límite.
- `systems/evolution.js`: `Prestige.onKill(pl, e)` junto a `Mega.onKill`; guarda con `DB.commit('run')`.
- `Progress.grant` admite `gems`; se añade `gems` a `reward` de misiones y logros elegidos.
- `ui.js`: `refreshCoins` muestra las gemas en la barra superior.
- Cooperativo: cada ordenador aplica el bonus de su propio jugador; el protocolo no cambia (a confirmar al planificar que `js/net/` no depende de `perks`).
- Ranking: sin cambios. Las mejoras actuales ya influyen en las marcas.

## Interfaz (`js/ui/prestige-ui.js`, `ui/menu.js`)

- Ficha del Pokémon: `Nv. X / límite`, barra de EXP y estrellas.
- Botón Prestigio al alcanzar el límite: confirma con el coste y el efecto (Nv.1, +1 estrella, límite +10). Deshabilitado si faltan gemas.

## Textos y novedades

El juego sale sólo en inglés (desde el 28-10-2026; `lang-updates.js` ya no existe): las cadenas
nuevas se escriben directamente en inglés en el código. Entrada en `js/data/changelog.js`
(par es / en) en `new`, con la fecha del día.

## Pruebas (`tests/prestige.test.cjs`)

- Curva de nivel y límite por estrella.
- `grantXp` se detiene en el límite.
- `prestige` sin gemas no cambia nada; con gemas descuenta, reinicia EXP y suma una estrella; no pasa de `MAX_STAR`.
- `bonus` coincide con la fórmula.
- Fusión de libretas de dos aparatos no duplica gemas.
- `sanitize` limita `star`, `xp` y `gems`.
- Suite completa (`node --test tests/`) en verde, incluida la de i18n.

## Verificación manual

Abrir `dev.html`: jugar una partida y comprobar la EXP; forzar el límite, hacer Prestigio y ver el bonus en la siguiente partida; matar un jefe y comprobar las gemas.
