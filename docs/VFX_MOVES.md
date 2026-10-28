# Aspecto de los movimientos (VFX)

Generado por `node tools/vfx-table.js` — no se edita a mano. Fuente: `js/entities/vfx.js`, `vfx-shapes-1.js`, `vfx-shapes-2.js`.
Vista animada: abrir `tools/vfx-preview.html`.

`proj` = proyectil/partícula · `beam` = lo que viaja por el rayo · `melee` = golpe · `aura`/`buff` = partículas · `trail` = estela · `hit` = efecto al impactar.

## normal

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| tackle | melee | `star` |  | `impact` |  |  | `pop` |  |
| quick-attack | dash | `norm_streak` |  |  |  |  | `pop` |  |
| swords-dance | buff | `star` |  |  | `arrow` |  | `pop` | `fighting` |
| nasty-plot | buff | `star` |  |  | `arrow` |  | `pop` | `psychic` |
| agility | buff | `star` |  |  | `arrow` |  | `pop` | `flying` |
| harden | buff | `star` |  |  | `arrow` |  | `pop` | `steel` |
| body-slam | melee | `star` |  | `impact` |  |  | `punch` |  |
| hyper-voice | nova | `note` |  |  |  |  | `pop` |  |
| substitute | turret | `norm_swirl` |  |  |  |  | `pop` |  |
| hyper-beam | charge | `norm_star` | `star` |  |  |  | `blaze` |  |
| rapid-spin | spin | `norm_swirl` |  | `impact` |  |  | `pop` |  |

## fire

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| ember | projectile | `fire` |  |  |  | `ember` | `burn` |  |
| flamethrower | cone | `fire_comet` | `fire` |  |  | `ember` | `blaze` |  |
| fire-spin | orbit | `fire_ring` |  |  |  | `ember` | `burn` |  |
| heat-wave | nova | `fire_pillar` |  |  |  | `ember` | `burn` |  |
| will-o-wisp | turret | `ball` |  |  |  | `wisp` | `burn` |  |
| flame-wheel | trail | `fire_ring` |  |  | `fire` |  | `blaze` |  |
| flame-charge | dash | `fire_comet` |  |  |  | `ember` | `burn` |  |

## water

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| water-gun | projectile | `drop` |  |  |  | `drip` | `splash` |  |
| bubble | nova | `water_wave` |  |  |  |  | `splash` |  |
| hydro-pump | beam | `water_wave` | `water_jet` |  |  |  | `geyser` |  |
| aqua-ring | buff | `bubble` |  |  | `water_swirl` | `bubbles` | `splash` |  |
| bubble-beam | cone | `bubble` |  |  |  | `bubbles` | `bubblepop` |  |
| whirlpool | vortex | `water_swirl` |  |  |  | `drip` | `splash` |  |

## grass

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| vine-whip | melee | `leaf` |  | `vine` |  |  | `leaf` |  |
| razor-leaf | boomerang | `leaf` |  |  |  |  | `leaf` |  |
| leaf-storm | orbit | `grass_petal` |  |  |  |  | `leaf` |  |
| giga-drain | aura | `leaf` |  |  | `heart` |  | `leaf` |  |
| seed-bomb | bounce | `grass_seed` |  |  |  |  | `leaf` |  |
| energy-ball | homing | `ball` |  |  |  | `spark` | `leaf` |  |
| solar-beam | charge | `grass_thorn` | `star` |  |  |  | `blaze` |  |

## electric

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| thunder-shock | projectile | `bolt` |  |  |  | `spark` | `zap` |  |
| discharge | aura | `bolt` |  |  | `elec_spark` |  | `shock` |  |
| thunderbolt | chain | `bolt` | `lightning` |  |  |  | `shock` |  |
| thunder-wave | stun | `elec_arc` |  |  |  |  | `zap` |  |
| electro-ball | bounce | `elec_orb` |  |  |  | `spark` | `zap` |  |

## psychic

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| confusion | projectile | `ring` |  |  |  |  | `psy` |  |
| psybeam | beam | `ring` | `psy_wave` |  |  |  | `psy` |  |
| psychic | nova | `psy_orb` |  |  |  |  | `psy` |  |
| psycho-cut | boomerang | `crescent` |  |  |  |  | `slash` |  |
| extrasensory | shove | `psy_eye` |  |  |  |  | `psy` |  |
| mist-ball | homing | `ring` |  |  |  | `wisp` | `psy` |  |

## poison

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| sludge | projectile | `blob` |  |  |  | `bubbles` | `venom` |  |
| poison-sting | projectile | `poison_fang` |  |  |  |  | `venom` |  |
| toxic | trail | `blob` |  |  | `poison_skull` |  | `venom` |  |
| toxic-spikes | mine | `needle` |  |  |  |  | `venom` |  |
| acid-spray | bounce | `poison_glob` |  |  |  | `bubbles` | `venom` |  |

## ground

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| mud-shot | nova | `blob` |  |  |  | `dirt` | `dust` |  |
| bulldoze | aura | `blob` |  |  | `ground_wave` |  | `dust` |  |
| bonemerang | boomerang | `ground_spike` |  |  |  |  | `dust` |  |
| spikes | mine | `ground_spike` |  |  |  | `dirt` | `dust` |  |
| sand-tomb | vortex | `ground_clod` |  |  |  |  | `dust` |  |
| magnitude | quake | `ground_wave` |  |  |  | `dirt` | `dust` |  |

## flying

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| gust | orbit | `fly_swirl` |  |  |  |  | `feather` |  |
| wing-attack | melee | `wind` |  | `feather` |  |  | `feather` |  |
| aerial-ace | dash | `fly_slash` |  |  |  |  | `feather` |  |
| whirlwind | shove | `wind` |  |  |  |  | `feather` |  |
| air-slash | homing | `fly_slash` |  |  |  |  | `slash` |  |

## bug

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| bug-bite | melee | `needle` |  | `jaws` |  |  | `sting` |  |
| string-shot | mine | `web` |  |  |  |  | `sting` |  |
| bug-buzz | aura | `needle` |  |  | `bug_swarm` |  | `sting` |  |
| signal-beam | bounce | `bug_stinger` |  |  |  | `spark` | `sting` |  |
| u-turn | dash | `bug_wing` |  |  |  |  | `sting` |  |

## rock

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| rock-throw | projectile | `rock_boulder` |  |  |  | `dirt` | `pebble` |  |
| rock-slide | meteor | `rock_chip` |  |  |  | `dirt` | `pebble` |  |
| rock-tomb | stun | `rock_boulder` |  |  |  |  | `pebble` |  |
| ancient-power | orbit | `rock` |  |  |  |  | `pebble` |  |
| power-gem | bounce | `shard` |  |  |  | `spark` | `pebble` |  |

## ice

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| ice-beam | beam | `shard` | `ice_spike` |  |  |  | `shatter` |  |
| powder-snow | aura | `shard` |  |  | `ice_flake` |  | `frost` |  |
| hail | meteor | `ice_crystal` |  |  |  |  | `frost` |  |
| ice-shard | homing | `shard` |  |  |  |  | `frost` |  |
| freeze-dry | stun | `ice_spike` |  |  |  |  | `shatter` |  |

## fighting

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| karate-chop | melee | `ball` |  | `impact` |  |  | `punch` |  |
| aura-sphere | projectile | `ball` |  |  |  | `spark` | `punch` | `aura` |
| rolling-kick | spin | `ball` |  | `fight_fist` |  |  | `punch` |  |
| vacuum-wave | shove | `fight_wave` |  |  |  |  | `punch` | `aura` |
| dynamic-punch | stun | `fight_shock` |  |  |  |  | `punch` |  |

## ghost

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| lick | melee | `shadow` |  | `impact` |  |  | `soul` |  |
| shadow-ball | projectile | `shadow` |  |  |  | `wisp` | `soul` |  |
| hex | chain | `ghost_soul` | `ghost_face` |  |  |  | `soul` |  |
| shadow-sneak | homing | `ghost_soul` |  |  |  | `wisp` | `soul` |  |
| ominous-wind | vortex | `ghost_flame` |  |  |  | `wisp` | `soul` |  |

## dragon

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| dragon-rage | beam | `fire` | `dragon_flame` |  |  |  | `roar` |  |
| dragon-dance | buff | `fire` |  |  | `dragon_scale` |  | `roar` |  |
| dragon-breath | cone | `dragon_flame` |  |  |  | `ember` | `roar` |  |
| dragon-claw | melee | `fire` |  | `dragon_claw` |  |  | `roar` |  |
| outrage | spin | `fire` |  | `claw` |  |  | `roar` |  |

## fairy

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| fairy-wind | nova | `fairy_sparkle` |  |  |  |  | `glitter` |  |
| dazzling-gleam | aura | `star` |  |  | `fairy_moon` |  | `glitter` |  |
| draining-kiss | homing | `heart` |  |  |  |  | `glitter` |  |
| play-rough | melee | `star` |  | `fairy_ribbon` |  |  | `glitter` |  |
| disarming-voice | shove | `note` |  |  |  |  | `glitter` |  |

## steel

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| metal-claw | melee | `shard` |  | `claw` |  |  | `clang` |  |
| flash-cannon | beam | `steel_bolt` | `steel_bolt` |  |  |  | `clang` |  |
| meteor-mash | meteor | `rock` |  |  |  | `spark` | `clang` |  |
| mirror-shot | bounce | `steel_blade` |  |  |  | `spark` | `clang` |  |
| gyro-ball | spin | `shard` |  | `steel_gear` |  |  | `clang` |  |

## dark

| move | kind | proj | beam | melee | aura / buff | trail | hit | paleta |
|---|---|---|---|---|---|---|---|---|
| bite | melee | `crescent` |  | `jaws` |  |  | `shade` |  |
| dark-pulse | nova | `dark_orb` |  |  |  |  | `shade` |  |
| night-shade | aura | `crescent` |  |  | `shadow` |  | `shade` |  |
| sucker-punch | homing | `dark_claw` |  |  |  |  | `shade` |  |
| night-slash | spin | `crescent` |  | `dark_slash` |  |  | `shade` |  |
