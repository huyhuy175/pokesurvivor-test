/* ============ changelog.js — novedades del juego ============
 * Lo que ve la gente en el botón "Novedades" de la barra de arriba: cambios
 * de juego y fallos arreglados (nada de servidores ni bases de datos).
 * La fecha más nueva, arriba. En cada fecha, por apartados:
 *   new  lo nuevo · chg  cambios y ajustes · fix  fallos arreglados
 * Cada línea en español y en inglés. Una línea con un tercer valor 'en-only' se queda sólo en inglés
 * (sin traducir a fr/it/pt/zh); las novedades ya enseñan el inglés cuando falta la traducción.
 */
G.CHANGELOG = [
  { d: '2026-10-29', title: ['Vietnamita', 'Vietnamese'], new: [
    ["Nuevo idioma: vietnamita (Tiếng Việt). Se elige en Ajustes > Gráficos > Idioma (el juego se recarga) y se activa solo si tu navegador está en vietnamita.", "New language: Vietnamese (Tiếng Việt). Pick it in Settings > Graphics > Language (the game reloads); it is used automatically if your browser is set to Vietnamese."],
    ["Nuevo botón Modes en el menú. Wave: oleadas infinitas con un objetivo opcional en cada una (hacer X bajas, ser rápido, rescatar a un Pokémon, encender farolillos, escoltar a un Pokémon perdido…), un jefe cada 5 oleadas y un legendario Apex cada 25. Premios: monedas, Fragmentos, Gemas y a veces material Mega.", "New Modes button in the menu. Wave: endless waves with an optional objective in each one (defeat enemies, be fast, rescue a Pokémon, light the lamps, escort a lost Pokémon…), a boss every 5 waves and an Apex legendary every 25. Rewards: coins, Shards, Gems and sometimes a Mega Material.", 'en-only'],
    ["Boss Rush: diez jefes seguidos en una sola arena, sin enemigos normales. Empiezas con 3 cartas de nivel seguidas; los 5 primeros son los jefes del mapa, luego 5 legendarios Apex cada vez más fuertes, y el último siempre enfurecido. Ganar da Gemas y Fragmentos.", "Boss Rush: ten bosses in a row in a single arena, with no regular enemies. You start with 3 level-up cards in a row; the first 5 are the map bosses, then 5 Apex legendaries that get stronger each time, and the last one always starts enraged. Winning gives Gems and Shards.", 'en-only'],
    ["Hardcore, para Normal, Wave y Boss Rush: enemigos con más vida, daño y velocidad, más cantidad, sin rerolls, curación a la mitad y sin reanimar a compañeros; a cambio, más Pokémonedas y EXP y más probabilidad de botín. Wave y Boss Rush también funcionan en cooperativo (el anfitrión elige el modo en la sala) y guardan su propio récord en esta máquina.", "Hardcore, for Normal, Wave and Boss Rush: enemies with more health, damage and speed, more of them, no rerolls, half healing and no reviving teammates; in return, more PokéCoins and EXP and a higher loot chance. Wave and Boss Rush also work in co-op (the host picks the mode in the lobby) and keep their own record on this device.", 'en-only']
  ] },
  { d: '2026-10-28', title: ['Forja Evolutiva y Fragmentos Evolutivos', 'Evolution Forge and Evolution Shards'], new: [
    ["40 Megaevoluciones ya tienen sprite propio dibujado (Mega Charizard X, Gengar, Gardevoir, Rayquaza, Lucario y más). Las demás se ven con su forma base y un aura rosa.",
     "40 Mega Evolutions now have their own hand-drawn sprite (Mega Charizard X, Gengar, Gardevoir, Rayquaza, Lucario and more). The rest show their base form with a pink aura."],
    ["Gemas y Prestigio: cada Pokémon tiene ahora nivel y EXP permanentes, y gana EXP al acabar cada partida. Al llegar a su límite de nivel (30) puedes hacer Prestigio en la pantalla de Mejoras: gasta Gemas, vuelve a Nv.1, gana una estrella (+10 % de daño y vida para siempre) y su límite sube 10. Las Gemas salen de misiones, logros, jefes y, rara vez, enemigos normales.",
      "Gems and Prestige: every Pokémon now has a permanent level and EXP, and earns EXP at the end of each run. When it reaches its level limit (30) you can Prestige it in the Upgrades screen: spend Gems, go back to Lv 1, gain a star (+10% damage and HP forever) and raise its limit by 10. Gems come from missions, achievements, bosses and, rarely, normal enemies."],
    ["Materiales Mega: hay uno por cada tipo y se guardan en la Mochila. Los sueltan enemigos, jefes y cofres grandes (los jefes y los cofres, más) y la tienda Kecleon vende 5 tipos distintos cada día. Para desbloquear una Mega en la Forja ahora hacen falta también materiales de sus tipos, además de Fragmentos y Cristales.",
      "Mega Materials: there is one for each type and they are kept in the Bag. Enemies, bosses and big chests drop them (bosses and chests drop more) and the Kecleon shop sells 5 different types every day. Unlocking a Mega in the Forge now also needs materials of its types, on top of Shards and Crystals."],
    ["Megaevoluciones: ya hay 94 formas Mega. Los jefes y los cofres grandes sueltan Cristales Mega de un tipo (las misiones semanales también); en la pestaña Mega de la Forja, con Cristales y Fragmentos, desbloqueas la Mega de un Pokémon final que ya tengas. En la partida, a nivel 36 y con una Piedra Mega (cae de jefes y cofres), te transformas: stats de la Mega más +15 % de daño, +20 % de vida, +8 % de velocidad y +10 % de crítico. Sin sprite propio, la Mega usa el de su forma base con un aura rosa.",
     "Mega Evolution: there are now 94 Mega forms. Bosses and big chests drop Mega Crystals of one type (weekly missions too); in the Mega tab of the Forge, with Crystals and Shards, you unlock the Mega of a fully evolved Pokémon you own. In a run, at level 36 and holding a Mega Stone (dropped by bosses and chests), you transform: the Mega's stats plus +15% damage, +20% health, +8% speed and +10% crit chance. With no sprite of its own, a Mega uses its base form's sprite with a pink aura.", 'en-only'],
    ["Cooperativo: ahora se ve el ping. En la sala, cada tarjeta muestra los ms con el anfitrión; en la partida, el anfitrión ve el ping de cada compañero junto a su barra de vida y los invitados ven el suyo bajo la lista (verde, amarillo o rojo según lo alto que sea).",
     "Co-op: ping is now shown. In the lobby each card shows the ms to the host; in a run the host sees every teammate's ping next to their health bar and guests see their own under the list (green, yellow or red depending on how high it is)."],
    ["Nueva Forja Evolutiva (botón en el menú): gasta Fragmentos Evolutivos para desbloquear la forma evolucionada de los Pokémon que ya tienes (de 20 a 300 fragmentos según su rareza). Esas formas son la meta de la evolución durante la partida. Los fragmentos caen de los jefes (3) y los cofres grandes (1), y se ganan con misiones y logros.",
     "New Evolution Forge (menu button): spend Evolution Shards to unlock the evolved form of the Pokémon you already have (20 to 300 shards depending on rarity). Those forms are the target of evolution during a run. Shards drop from bosses (3) and big chests (1), and are earned from missions and achievements."],
    ["En la ficha de una forma evolucionada ahora se ve de qué Pokémon viene (su línea evolutiva): pulsa en un nombre para ir a su ficha y elegirlo de compañero.",
     "The page of an evolved form now shows which Pokémon it comes from (its evolution line): tap a name to go to its page and pick it as your partner."],
    ["Nuevas mejoras al subir de nivel: Ojo certero (crítico), Golpe certero (daño crítico), Cazajefes, Rematador (enemigos casi vencidos), Esquiva, Curación mejorada y Fortuna (Pokémonedas). Ahora eliges entre 4 cartas en vez de 3 (teclas 1 a 4).",
     "New upgrades when you level up: Keen Eye (crit chance), Deadly Blow (crit damage), Boss Hunter, Finisher (nearly beaten enemies), Evasion, Better Healing and Fortune (PokéCoins). You now choose between 4 cards instead of 3 (keys 1 to 4)."],
    ["Las cartas de mejora de stat tienen rareza, con los colores del gacha: Común, Poco común y Rara dan el mismo stat con números distintos; Épica y Legendaria juntan 2 o 3 stats; y la nueva Mítica sube mucho un stat a costa de otro, o junta 3 stats y sube un nivel a uno de tus movimientos.",
     "Stat upgrade cards now have rarity, using the gacha colours: Common, Uncommon and Rare give the same stat with different numbers; Epic and Legendary combine 2 or 3 stats; and the new Mythic raises one stat a lot at the cost of another, or combines 3 stats and levels up one of your moves."],
    ["Estadísticas rápidas sin pausar: mantén la tecla C (o toca el botón de barras junto al de pausa en el móvil) para ver tus estadísticas y el daño de cada ataque mientras sigues jugando. Se actualizan en directo.",
     "Quick stats without pausing: hold the C key (or tap the bars button next to the pause button on mobile) to see your stats and each move's damage while you keep playing. They update live."],
    ["Rango por línea evolutiva: las copias repetidas del gacha ya no dan monedas al principio. Cada copia sube el Rango de toda la línea (5 estrellas doradas y luego 5 rojas; 15 copias para el máximo). Las estrellas dan un pequeño extra de vida y daño (hasta ≈+15 %, se suma al Prestigio). Desde la copia 16 vuelve el reembolso en monedas. El Pokédex y las cartas del gacha muestran las estrellas.",
     "Rank per evolution line: duplicate gacha pulls no longer pay coins at first. Each duplicate raises the Rank of the whole line (5 gold stars, then 5 red ones; 15 duplicates for the max). Stars give a small bonus to HP and damage (up to about +15%, stacking with Prestige). From the 16th duplicate the coin refund comes back. The Pokédex and gacha cards show the stars."],
    ["Pasivas en dos partes: una pasiva común según el tipo principal (crece con la etapa de evolución) y una pasiva única por línea evolutiva, que se desbloquea con 3 estrellas de Rango. Las líneas más raras tienen mecánicas más potentes; las más débiles, números algo mayores. La estrella 6 refuerza la pasiva común, la 8 la única y la 10 las dos. La ficha del Pokédex muestra la pasiva única (en gris hasta las 3 estrellas) y cuántas copias faltan para la siguiente estrella.",
     "Passives in two parts: a common passive based on the main type (it grows with the evolution stage) and a unique passive for each evolution line, unlocked at 3 Rank stars. Rarer lines get more powerful mechanics; weaker lines get slightly higher numbers. Star 6 strengthens the common passive, star 8 the unique one and star 10 both. The Pokédex page shows the unique passive (greyed out until 3 stars) and how many duplicates are left for the next star."],
    ["Vales Wish (3 objetos raros, en la Mochila): el Vale de Garantía hace que el último resultado de una tirada ×10 sea un Pokémon que aún no tienes (casilla en la pantalla del gacha); el Vale de Elección por Tipo sortea un tipo y eliges un Pokémon de ese tipo que no tengas; el Vale de Elección Libre te deja elegir cualquier Pokémon que no tengas.",
     "Wish tickets (3 rare items, kept in the Bag): the Guarantee Ticket makes the last result of a ×10 pull a Pokémon you don't own yet (tick box on the gacha screen); the Type Pick Ticket draws a random type and you choose an unowned Pokémon of it; the Free Pick Ticket lets you choose any Pokémon you don't own."],
    ["Grieta especial en el minuto 25 (una vez por partida): un portal a una arena con un legendario Apex, mucho más fuerte y de disparos más rápidos, al que hay que vencer en 2 minutos. Al ganar suelta un Vale Wish (80 % Garantía, 15 % Tipo, 5 % Libre; cada jugador tira el suyo). Perder no cuesta nada.",
     "Special rift at minute 25 (once per run): a portal to an arena with an Apex legendary, much stronger and with faster shots, that must be beaten within 2 minutes. Winning drops a wish ticket (80% Guarantee, 15% Type Pick, 5% Free Pick; each player rolls their own). Losing costs nothing."],
    ["Los Apex tienen ahora una habilidad propia según su tipo (18 en total: Inferno Spiral, Tidal Wave, Frost Cross...) y, por debajo de la mitad de vida, la repiten como un eco más débil (Overdrive). Se esquivan viendo los avisos del suelo; sin Rango ni Prestigio altos siguen siendo casi imposibles.",
     "Apex bosses now have a signature move for their type (18 in all: Inferno Spiral, Tidal Wave, Frost Cross...) and, below half health, repeat it as a weaker echo (Overdrive). They can be dodged by reading the warnings on the ground; without high Rank or Prestige they are still almost impossible."],
    ["Diez potenciadores nuevos (no hacen daño y se acumulan): Corpulencia, Paz Mental, Defensa Férrea, Pulido Roca, Arraigo, Afilagarras, y cuatro con estadísticas nuevas: Foco Energía (más probabilidad de crítico), Enfoque Láser (más daño crítico), Rocío Vital (más vida máxima) y Carga Voltio (ataca más rápido). Los aprenden los Pokémon de su tipo al subir de nivel.",
     "Ten new buff moves (no damage, they stack): Bulk Up, Calm Mind, Iron Defense, Rock Polish, Ingrain, Hone Claws, plus four with new stats: Focus Energy (more crit chance), Laser Focus (more crit damage), Life Dew (more max health) and Volt Charge (faster attacks). Pokémon of their type learn them when levelling up."],
    ["Cada Pokémon raro (legendarios, los que tienen Mega y los pseudolegendarios: 171 especies) tiene un movimiento especial propio. Se desbloquea al llegar a Rank 5★ y va en un quinto hueco (tecla 0), aparte de los cuatro normales. Es tan fuerte como un grupo de cuatro movimientos fusionados y se puede fusionar con hasta 2 potenciadores. Cada movimiento tiene su propia mecánica (salpicadura, encadenado, robo de vida, aturdimiento...). Si evolucionas durante la partida, lo recibes al llegar a esa especie.",
     "Every rare Pokémon (legendaries, those with a Mega form and the pseudo-legendaries: 171 species) has a signature move of its own. It unlocks at Rank 5★ and sits in a fifth slot (key 0), apart from the four normal ones. It is as strong as a fused group of four moves and can be fused with up to 2 buff moves. Each move has its own mechanic (splash, chaining, life drain, stun...). If you evolve during a run, you get it when you reach that species."],
  ], chg: [
    ["Los Materiales Mega tienen un icono nuevo: una gema pixelada con los colores de su tipo, en lugar de un simple punto de color.",
     "Mega Materials have a new icon: a pixel-art gem in the colours of their type, instead of a plain coloured dot."],
    ["Los ataques tienen efectos visuales nuevos: casi 55 formas animadas (fuego, agua, planta, eléctrico, hielo, tierra, roca, acero, lucha, veneno, volador, bicho, fantasma, dragón, siniestro, hada, psíquico y normal), y cada tipo suelta su propio efecto al golpear a un enemigo. No cambia el daño ni el equilibrio.",
     "Attacks have new visual effects: over 50 animated shapes across all 18 types, and each type now has its own effect when it hits an enemy. Damage and balance are unchanged."],
    ["Evolución y Megaevolución ya no ocurren solas: con la Piedra, el nivel exigido y la forma desbloqueada, en la siguiente subida de nivel sale una carta por cada forma a la que puedes ir (siempre, junto a las demás). Si eliges otra carta, la piedra se queda y la carta vuelve a salir en la siguiente subida. Las cartas de evolución ya no impiden cambiar de cartas.",
     "Evolution and Mega Evolution no longer happen on their own: with the Stone, the required level and the form unlocked, the next level-up offers one card for each form you can go to (always, next to the usual ones). If you pick another card the stone is kept and the card comes back on the next level-up. Evolution cards no longer stop you from rerolling."],
    ["El juego ahora sale siempre en inglés (se quita la selección de idioma). Faltaban algunos textos sin traducir: rasgos de personalidad, ayuda de la pantalla de entrada y otros.",
     "The game is now always in English (the language selector is gone). A few untranslated texts were fixed: personality traits, the login help text and others."],
    ["La pausa enseña ahora todas tus estadísticas: esquiva, daño a jefes y a enemigos débiles, curación, imán, experiencia y Pokémonedas.",
     "The pause screen now shows all your stats: dodge, damage to bosses and to weakened enemies, healing, magnet, experience and PokéCoins."],
    ["Con más cartas y rarezas, las mejoras de stat normales dan algo menos que antes y los enemigos ganan dificultad con el tiempo: al llegar al minuto 30 tienen un 20 % más de vida y un 15 % más de daño (casi no se nota al principio).",
     "With more cards and rarities, plain stat upgrades give a bit less than before and enemies get harder over time: by minute 30 they have 20% more health and 15% more damage (barely noticeable early on)."],
    ["El gacha ya no da formas evolucionadas, solo Pokémon base. Las formas evolucionadas se consiguen en la Forja Evolutiva.",
     "The gacha no longer gives evolved forms, only base Pokémon. Evolved forms are unlocked in the Evolution Forge."],
    ["Las mejoras se comparten por toda la línea evolutiva: la pantalla de Mejoras solo lista formas base, y las mejoras que tuvieras en una forma evolucionada pasan a su forma base (el nivel más alto de cada una). Al evolucionar durante la partida conservas las mejoras de tu Pokémon.",
     "Upgrades are now shared along the whole evolution line: the Upgrades screen only lists base forms, and any upgrades you had on an evolved form move to its base form (the highest level of each). When you evolve during a run you keep your Pokémon's upgrades."],
    ["Solo las formas base se pueden elegir de compañero. Las formas evolucionadas se ven en la colección (vista previa) y se usan evolucionando durante la partida. Si tu compañero era una forma evolucionada, ahora es su forma base (la recibes si no la tenías).",
     "Only base forms can be picked as your partner. Evolved forms can be viewed in the collection (preview only) and are used by evolving during a run. If your partner was an evolved form, it is now its base form (you receive it if you did not have it)."],
    ["Las estrellas de Prestigio ahora se muestran con ♦ en vez de ★, para no confundirlas con las nuevas estrellas de Rango.",
     "Prestige stars are now shown as ♦ instead of ★, so they are not confused with the new Rank stars."],
  ], fix: [
    ["Al tener un vínculo y poder unirlo tanto al movimiento especial como a un grupo normal, ahora eliges a cuál. Antes el especial tapaba siempre al grupo.",
     "When a bond could go either to the signature move or to a normal group, you now choose which. Before, the signature move always hid the group."],
    ["Al evolucionar en la partida, la vida que ganas ahora también lleva el bonus de Prestigio y de Rank de la línea.",
     "When you evolve in a run, the health you gain now also includes the line's Prestige and Rank bonus."],
    ["Los movimientos especiales cuentan su daño extra en las estadísticas de la pausa, y las formas sin movimiento propio (Charmander…) muestran el de su línea en la ficha.",
     "Signature moves now count their extra damage in the pause stats, and forms without a move of their own (Charmander…) show their line's move on the page."],
    ["El texto al recoger la Piedra Mega avisa de que se elige en la próxima subida de nivel. El borde de la arena de los jefes Apex coincide con lo que se puede pisar.",
     "The text when you pick up a Mega Stone now says you choose it at your next level-up. The edge of the Apex boss arena now matches the ground you can walk on."],
    ["La grieta especial del minuto 25 vuelve a abrirse si caduca sin que nadie entre (mientras dé tiempo antes de la Sentencia). La vida que roba un Pokémon con 'Life Steal' ya no llena la pantalla de números, y la lista del vale Free Pick carga sin congelar el juego; con Esc se cierra su panel.",
     "The minute-25 special rift now reopens if it expires with nobody inside (as long as it still fits before the Judgment). Life stolen by a 'Life Steal' passive no longer fills the screen with numbers, and the Free Pick ticket list loads without freezing the game; Esc closes its panel."],
    ["En el Pokédex, las casillas de los Pokémon de 4★ y 5★ llevan un borde de color y los Rank no cambian la altura de las filas.",
     "In the Pokédex, 4★ and 5★ Pokémon now have a coloured border and Rank stars no longer change the height of the rows."],
  ] },
  { d: '2026-10-27', title: ['Pasiva propia para cada Pokémon', 'A passive of its own for every Pokémon'], new: [
    ["Tu Pokémon puede evolucionar durante la partida: al llegar al nivel 12 (o 24 si ya es una evolución) y con una Piedra Evolutiva, cambia a una forma que ya tengas en tu colección. La piedra cae de los jefes y los cofres grandes (y, muy rara vez, de los enemigos). Conserva nivel, movimientos y vida proporcional, y toma la pasiva y las estadísticas de la nueva forma.",
     "Your Pokémon can now evolve during a run: at level 12 (or 24 if it is already an evolution) and with an Evolution Stone, it turns into a form you already have in your collection. The stone drops from bosses and big chests (and, very rarely, from enemies). It keeps its level, moves and proportional health, and takes on the new form's passive and stats."],
    ["Cada Pokémon tiene ahora una pasiva propia, con nombre propio, y cuanto más rara es, más fuerte. Los de rareza 4 y 5 combinan efectos que no se repiten en ningún otro Pokémon (daño, críticos, defensa, curación, velocidad…); los legendarios más raros pueden tener efectos que se activan al encadenar derrotas o al recibir un golpe.",
     "Every Pokémon now has a passive of its own, with its own name, and the rarer it is, the stronger it gets. Rarity 4 and 5 Pokémon combine effects that no other Pokémon repeats (damage, crits, defense, healing, speed…); the rarest legendaries can have effects that trigger on kill streaks or when they are hit."]
    ,["La pantalla de pausa muestra ahora la pasiva del Pokémon que juegas, justo debajo de tus ataques y estadísticas.",
     "The pause screen now shows the passive of the Pokémon you are playing, right below your moves and stats."]
  ], chg: [
    ["Las Cápsulas de Habilidad (normal y oculta) se han quitado de la Tienda Kecleon: la pasiva de cada Pokémon es fija. Las que tuvieras en la Mochila desaparecen. Los nombres y descripciones de las pasivas están sólo en inglés por ahora.",
     "Ability Capsules (normal and hidden) have been removed from Kecleon's Shop: each Pokémon's passive is fixed. Any you had in your Bag are gone. Passive names and descriptions are in English only for now."]
  ] },
  { d: '2026-10-23', title: ['Ranking de daño a Arceus y Tablas', 'Arceus damage ranking and Plates'], new: [
    ["Botón de YouTube arriba, junto a Novedades: lleva al canal del juego y, cuando hay directo, se pone rojo con «EN DIRECTO» y te lleva a verlo.",
     "YouTube button at the top, next to What's new: it takes you to the game's channel and, when there is a live stream, it turns red with \"LIVE\" and takes you to watch it."],
    ["Ranking partido en dos: a la izquierda, el daño que le has hecho a Arceus; a la derecha, el tiempo aguantado, como siempre. Las dos mitades se cargan a la vez. Todas las tablas empiezan de cero.",
     "The ranking is now split in two: on the left, the damage you dealt to Arceus; on the right, the time survived, as always. Both halves load at once. Every board starts from zero."],
    ["Sentencia de Arceus: ahora se le puede pegar. Es invencible y sólo recibe una pequeña parte del daño (cada vez menos), y los ataques le apuntan cuando no queda ningún legendario.",
     "Arceus's Judgment: you can now hit it. It is invincible and only takes a small part of the damage (less and less over time), and your attacks aim at it when no legendary is left."],
    ["Tablas: en cada partida Arceus lleva una al azar, que le da su tipo (se avisa al entrar en la arena). Ya no hay un tipo de ataque que sea siempre el mejor.",
     "Plates: in every run Arceus holds a random one, which gives it its type (you are told when you enter the arena). No move type is always the best anymore."]
  ], chg: [
    ["En el minuto 35, Arceus rompe el objeto de todos (Banda Focus incluida).",
     "At minute 35, Arceus breaks everyone's item (Focus Sash included)."],
    ["Los legendarios de la Sentencia ya no son el doble de fuertes que el anterior: cada uno tiene un 25 % más de vida y un 15 % más de daño, así que se pueden tumbar. Ya no hay límite de 45 minutos en el ranking.",
     "The Judgment legendaries are no longer twice as strong as the previous one: each one has 25% more HP and 15% more damage, so they can be taken down. There is no 45-minute limit in the ranking anymore."],
    ['Los movimientos evolucionados ya no cambian de nombre: se llaman igual con un «+» (Puño Meteoro pasa a Puño Meteoro +). Hacen lo mismo que antes y se siguen distinguiendo por el borde dorado.',
     'Evolved moves no longer change their name: they keep it with a "+" (Meteor Mash becomes Meteor Mash +). They work just like before and still stand out with their golden border.'],
    ["Puño Meteoro pega menos: 24 de daño en vez de 34 y una zona un poco más pequeña. Al máximo y evolucionado hacía casi el doble que Avalancha; ahora están a la par.",
     "Meteor Mash hits softer: 24 damage instead of 34 and a slightly smaller area. Maxed and evolved it dealt almost twice as much as Rock Slide; now they are on par."],
    ["En la Sentencia de Arceus, el veneno y las quemaduras quitan poco y siempre lo mismo a los legendarios (antes el veneno quitaba un % de su vida): envenenar y huir ya no sirve, hay que pegarles.",
     "In Arceus's Judgment, poison and burns deal a small, fixed amount to the legendaries (poison used to take a % of their HP): poisoning them and running away no longer works, you have to hit them."]
  ] },
  { d: '2026-10-22', title: ['Esferas de Mundo Misterioso, Amuletos Iris y gacha ×100', 'Mystery Dungeon orbs, Shiny Charms and ×100 gacha'], new: [
    ['Esferas de Mundo Misterioso: objetos de un solo uso que se encuentran durante la partida (cofres, jefes y, a veces, al derrotar a un Pokémon). Soporesfera, Ralentosfera y Rafagaesfera duermen, frenan o lanzan lejos a los enemigos; Focosfera, Luminosfera y Rapidosfera te dan crítico, más campo de visión o velocidad a ti y a los compañeros cercanos. Llevas hasta 4 distintas (3 de cada) y se usan con las teclas 5-8, tocando su casilla encima de los ataques o con X / Y en el mando. A los jefes y legendarios les afectan menos.',
     'Mystery Dungeon orbs: single-use items you find during the run (chests, bosses and sometimes when you defeat a Pokémon). Slumber Orb, Slow Orb and Blowback Orb put enemies to sleep, slow them down or blow them away; Focus Orb, Luminous Orb and Quick Orb give critical hits, a wider view or speed to you and nearby teammates. You carry up to 4 different ones (3 of each) and use them with keys 5-8, by tapping their slot above your moves, or with X / Y on a controller. Bosses and legendaries are less affected.'],
    ['Amuletos Iris: uno por región (Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar y Paldea). Al completar la Pokédex de una región (legendarios incluidos) te dan su Amuleto Iris y en su banner del gacha los shiny salen el doble: del 1 % al 2 %. Los tienes en la Mochila, con lo que te falta para cada uno. Si ya habías completado alguna región, el suyo ya es tuyo.',
     'Shiny Charms: one per region (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar and Paldea). Complete a region\'s Pokédex (legendaries included) to get its Shiny Charm, and shinies become twice as likely in its gacha banner: from 1% to 2%. You can find them in your Bag, along with how many you still need for each one. If you had already completed a region, its charm is already yours.'],
    ['Gacha: nueva tirada ×100, con 100 tickets normales o con 10 tickets ×10 (son diez ×10 seguidas, cada una con su Épica asegurada). La tragaperras gira 10 veces enseñando lo mejor de cada ×10 y al final ves un resumen (nuevos, shiny y Pokémonedas) con las cartas de mejor a peor. Para que quepa, ya no está la tirada ×1: se tira de 10 en 10 o de 100 en 100.',
     'Gacha: new ×100 pull, with 100 normal tickets or with 10 ×10 tickets (ten ×10 pulls in a row, each with its guaranteed Epic). The slot machine spins 10 times showing the best of each ×10, and at the end you get a summary (new, shiny and PokéCoins) with the cards sorted from best to worst. To make room, the ×1 pull is gone: you pull 10 or 100 at a time.'],
    ['Gacha: botón Saltar (o Esc) durante la animación: se acaba la tragaperras y salen todas las cartas de golpe.',
     'Gacha: Skip button (or Esc) during the animation: the slot machine ends and all the cards show up at once.']
  ], fix: [
    ['Cooperativo: a los invitados ya no les sale «La sala se ha cerrado» a mitad de partida (a veces a los pocos minutos o al entrar en una grieta) mientras los demás seguían jugando. Pasaba cuando su conexión con el servidor de las salas se cortaba un momento; ahora la partida sigue y la sala se recupera sola.',
     'Co-op: guests no longer get "The room has been closed" in the middle of a run (sometimes after a few minutes or when entering a rift) while the others kept playing. It happened when their connection to the rooms server dropped for a moment; now the run goes on and the room recovers on its own.'],
    ['Cooperativo: si se corta un momento la conexión con el anfitrión (un bache de la wifi o de los datos), el invitado ya no pierde la partida: se queda en pausa hasta 45 segundos mientras se vuelve a conectar y sigue jugando.',
     'Co-op: if the connection with the host drops for a moment (a Wi-Fi or mobile data hiccup), the guest no longer loses the run: it pauses for up to 45 seconds while reconnecting and then keeps playing.'],
    ['Cooperativo: si te quedas fuera de una partida mientras los demás siguen, ya no te sale «La sala se ha cerrado»: esperas en la sala y, cuando acaben, seguís juntos.',
     'Co-op: if you drop out of a run while the others keep playing, you no longer get "The room has been closed": you wait in the room and, when they finish, you play together again.']
  ]},
  { d: '2026-10-21', title: ['La gran actualización: Tienda Kecleon', 'The big update: Kecleon Shop'], new: [
    ['Mejora nueva: Tienda Kecleon (botón en el menú) con Mentas, Cápsulas Habilidad y 8 MT nuevas cada día. Cada Pokémon tiene ahora su naturaleza (±10 % a dos stats) y su habilidad, con efecto en la partida; se ven y se cambian en su ficha de la colección. Las MT enseñan para siempre ataques de fuera de sus tipos, pero sólo si los aprende en los juegos (Mewtwo puede aprender Bola Sombra; Psyduck no puede aprender Lanzallamas). Gracias a TheAdro7 por la idea y el trabajo de base.',
     'New: the Kecleon Shop (button in the menu) with Mints, Ability Capsules and 8 new TMs every day. Every Pokémon now has its own nature (±10% to two stats) and ability, with an effect in the run; you can see and change them on its page in the collection. TMs permanently teach moves outside its types, but only if it learns them in the games (Mewtwo can learn Shadow Ball; Psyduck cannot learn Flamethrower). Thanks to TheAdro7 for the idea and the groundwork.'],
    ['Mejora nueva, Segundo movimiento inicial: con Repertorio, se compra una vez por Pokémon y luego eliges gratis el segundo ataque con el que empiezas (o lo dejas al azar).',
     'New upgrade, Second starting move: with Repertoire, buy it once per Pokémon and then choose for free the second move you start with (or leave it random).'],
    ['Cooperativo: si vuestras redes no dejan conectaros directamente (pasa a veces con datos móviles y algunos routers), la partida ahora pasa por nuestro servidor y podéis jugar igual. Si conectáis directamente, todo sigue como antes. Hace falta haber iniciado sesión con una cuenta.',
     'Co-op: if your networks cannot connect to each other directly (it sometimes happens on mobile data and with some routers), the match now goes through our server and you can still play together. If you can connect directly, nothing changes. You need to be signed in with an account.'],
    ['Cooperativo: si caes, puedes mirar a un compañero que siga en pie mientras esperas a que te levanten. Pulsa el botón que sale debajo del aviso (o Q / E, o LB / RB en el mando) para pasar de uno a otro y volver a ti. Sólo cambia la cámara: no gasta más conexión.',
     'Co-op: if you go down, you can watch a teammate who is still standing while you wait to be revived. Press the button under the message (or Q / E, or LB / RB on a controller) to switch between them and back to yourself. Only the camera changes: it uses no extra connection.']
  ], fix: [
    ['Guardado en la nube: si jugabas en un aparato y guardabas, otro aparato con el juego abierto desde antes podía subir su copia vieja encima (al guardar o al actualizarse el juego) y en el otro no aparecían tus tickets ni tus Pokémon nuevos. Ahora, si la nube tiene algo más nuevo, se junta con lo tuyo antes de guardar y no se pierde nada.',
     'Cloud save: if you played and saved on one device, another device that still had the game open could upload its old copy over it (when saving or when the game updated), and your new tickets and Pokémon did not show up on the other one. Now, if the cloud has something newer, it is merged with yours before saving and nothing is lost.']
  ] },
  { d: '2026-10-20', title: ['Cooperativo más seguro y arreglos de ataques', 'Safer co-op and move fixes'], fix: [
    ['Cooperativo: un jugador con el juego trucado ya no puede colgar la partida de los demás mandando números imposibles (una experiencia infinita dejaba congelado al anfitrión y un efecto gigante, a los invitados).',
     'Co-op: a player with a tampered game can no longer freeze the others by sending impossible numbers (infinite experience froze the host and a giant effect froze the guests).'],
    ['Mejoras: al cambiar de compañero, la pantalla de mejoras se abre ya con el nuevo y no con el último que habías mirado.',
     'Upgrades: after changing your partner, the upgrades screen now opens on the new one instead of the last one you had looked at.'],
    ['Cooperativo: Viento Aciago, Bucle Arena y Torbellino de un invitado ya atraen a los enemigos (sólo atraían los del anfitrión).',
     'Co-op: a guest\'s Ominous Wind, Sand Tomb and Whirlpool now pull enemies in (only the host\'s did).'],
    ['Cooperativo: el Infortunio de un invitado ya hace su daño extra a los enemigos quemados, envenenados o frenados.',
     'Co-op: a guest\'s Hex now deals its extra damage to burned, poisoned or slowed enemies.'],
    ['Bomba Ácida, Bola Voltio, Bomba Germen, Rayo Señal, Joya de Luz, Bola Neblina, Energibola, Canto Helado, Sombra Vil y Beso Drenaje: al evolucionar, los disparos salían hacia los lados y no daban a nadie. Ahora salen hacia delante, y la mejora «+1 proyectil» ya añade uno (antes no añadía ninguno).',
     'Acid Spray, Electro Ball, Seed Bomb, Signal Beam, Power Gem, Mist Ball, Energy Ball, Ice Shard, Shadow Sneak and Draining Kiss: once evolved, the shots flew off to the sides and hit nothing. Now they go forward, and the "+1 projectile" upgrade really adds one (it added none before).'],
    ['Cooperativo: si a alguien se le cerraban las cartas de subida de nivel sin haber elegido (podía pasar eligiendo muy deprisa), ahora se le vuelven a abrir y los demás ya no se quedan esperándole.',
     'Co-op: if someone\'s level-up cards closed before they had picked (it could happen when picking very fast), they now open again and the others are no longer left waiting for them.']
  ], chg: [
    ['En el móvil ya no está la opción «Apuntar a mano» (no funcionaba con la pantalla táctil): los ataques siempre apuntan solos.',
     'On mobile the "Manual aim" option is gone (it did not work with the touch screen): moves always aim on their own.'],
    ['Ranking por Pokémon: ahora cuentan las partidas de 5 minutos o más (los demás rankings siguen desde 2 minutos).',
     'Per-Pokémon leaderboard: runs now count from 5 minutes on (the other leaderboards still from 2 minutes).'],
    ['Amigos: ya no se ve quién está en línea, y puedes invitar a una sala a cualquier amigo (si no entra, la invitación caduca sola a los 3 minutos).',
     'Friends: you no longer see who is online, and you can invite any friend to a room (if they do not join, the invite expires on its own after 3 minutes).'],
    ['Guardado en la nube: ahora la partida sólo se sube a la nube cuando pulsas el botón Guardar de arriba (y antes de una actualización del juego). En este navegador se sigue guardando todo al momento. Si juegas en otro aparato o vas a borrar los datos del navegador, pulsa Guardar antes.',
     'Cloud save: your game is now only uploaded to the cloud when you press the Save button at the top (and before a game update). Everything is still saved instantly in this browser. If you play on another device or are about to clear your browser data, press Save first.'],
    ['Las solicitudes de amistad nuevas se ven al abrir Amigos.',
     'New friend requests show up when you open Friends.']
  ] },
  { d: '2026-10-19', title: ['38 ataques nuevos', '38 new moves'], new: [
    ['38 ataques nuevos: ahora todos los tipos tienen 5 o más (Roca, Lucha, Dragón y Hada tenían sólo 2). Entre ellos Hiperrayo, Rayo Solar, Magnitud, Torbellino, Onda Trueno, Enfado, Carantoña, Golpe Bajo... cada uno con su evolución.',
     '38 new moves: every type now has 5 or more (Rock, Fighting, Dragon and Fairy had only 2). Among them Hyper Beam, Solar Beam, Magnitude, Whirlpool, Thunder Wave, Outrage, Play Rough, Sucker Punch... each with its evolution.'],
    ['Formas nuevas de atacar: disparos que persiguen al enemigo o rebotan entre ellos, rayos que se cargan, giros que golpean todo alrededor, ondas que avanzan por el suelo, remolinos que atraen a los enemigos, ondas que los apartan y zonas que los dejan aturdidos.',
     'New ways to attack: shots that chase enemies or bounce between them, beams you charge up, spins that hit everything around you, shockwaves that travel along the ground, vortexes that pull enemies in, waves that push them away and zones that stun them.'],
    ['Mejora nueva, Movimiento inicial: se compra una vez por Pokémon y luego eliges gratis con qué ataque empieza la partida.',
     'New upgrade, Starting move: buy it once per Pokémon and then choose for free which move it starts the run with.'],
    ['Idiomas nuevos: francés, italiano, portugués de Brasil, chino simplificado y chino tradicional, en Ajustes > Gráficos > Idioma. Gracias a quienes los tradujeron.',
     'New languages: French, Italian, Brazilian Portuguese, Simplified Chinese and Traditional Chinese, in Settings > Graphics > Language. Thanks to everyone who translated them.'],
    ['Una frase de broma en el título del menú principal, como las de Minecraft.',
     'A joke line on the main menu title, like the ones in Minecraft.']
  ], chg: [
    ['Los Pokémon de un solo tipo pegan un 20 % más con los ataques de su tipo, para compensar que tienen menos variedad.',
     'Single-type Pokémon deal 20% more damage with moves of their type, to make up for having less variety.'],
    ['Al aprender un ataque nuevo ya no se cambia solo a él: sigues con el que estabas usando y cambias cuando tú quieras.',
     'Learning a new move no longer switches to it on its own: you keep the one you were using and switch whenever you want.'],
    ['El juego sólo se puede jugar en su web oficial, pokesurvivor.com: si otra web lo mete dentro de la suya (por ejemplo, para ponerle anuncios alrededor), sale un aviso con un botón para ir a la oficial.',
     'The game can only be played on its official website, pokesurvivor.com: if another site embeds it in its own page (for example, to put ads around it), a notice appears with a button to go to the official one.']
  ], fix: [
    ['Movimiento inicial: ya se puede volver al ataque de serie aunque no sea de su tipo (por ejemplo Confusión en Psyduck).',
     'Starting move: you can now go back to the default move even if it is not of its type (for example Confusion on Psyduck).'],
    ['Cooperativo: el jefe que tocaba al volver de una grieta podía salir a miles de metros, donde nadie lo encontraba, y la partida se quedaba sin más grietas. Ahora sale cerca, y si un jefe se queda lejísimos de todos, vuelve a aparecer cerca a los pocos segundos.',
     'Co-op: the boss due when coming back from a rift could appear thousands of metres away, where nobody could find it, and the run got no more rifts. Now it appears nearby, and if a boss ends up very far from everyone, it shows up close again after a few seconds.'],
    ['Al recargar, a veces la página nueva se juntaba con los estilos viejos guardados en el navegador (por ejemplo, la frase del título salía en grande pegada a «PokéSurvivor»). Ya no pasa.',
     'When reloading, the new page sometimes got mixed with the old styles saved in the browser (for example, the title line showed up big and stuck to "PokéSurvivor"). That no longer happens.']
  ] },
  { d: '2026-10-18', title: ['Físico y especial, mando, botón Guardar y rankings desde cero', 'Physical and special, controller, Save button and fresh leaderboards'], new: [
    ['Ataques físicos y especiales, como en los juegos: cada Pokémon tiene su Ataque, Ataque Especial, Defensa y Defensa Especial. Los ataques físicos pegan con su Ataque y los especiales con su Ataque Especial: Machamp pega fuerte con Golpe Kárate y flojo con Bola Sombra. Con los de su lado bueno pega lo mismo que antes. Al subir de nivel, cada carta dice si el ataque es físico o especial y cuánto rinde con tu Pokémon, y en la colección se ven todas sus estadísticas.',
     'Physical and special moves, like in the games: every Pokémon has its Attack, Special Attack, Defense and Special Defense. Physical moves use its Attack and special moves its Special Attack: Machamp hits hard with Karate Chop and weakly with Shadow Ball. With moves on its strong side it hits as hard as before. When leveling up, each card says whether the move is physical or special and how well it works with your Pokémon, and the collection shows all its stats.'],
    ['Danza Espada y Danza Dragón suben sólo el Ataque (físico), como en los juegos, y llega Maquinación, que sube el Ataque Especial y la puede aprender cualquier Pokémon. Al subir de nivel, los ataques del lado bueno de tu Pokémon salen el doble de a menudo.',
     'Swords Dance and Dragon Dance now raise only (physical) Attack, like in the games, and Nasty Plot arrives, raising Special Attack, learnable by any Pokémon. When leveling up, moves on your Pokémon’s strong side show up twice as often.'],
    ['Resumen de la partida en la pausa: cada ataque con su categoría, el daño que lleva hecho y su daño por segundo; tus estadísticas con todo lo que has subido; y el objeto y las cartas de mejora que llevas.',
     'Run summary in the pause screen: each move with its category, the damage it has dealt and its damage per second; your stats with everything you have raised; and your item and the upgrade cards you have.'],
    ['Las defensas también cuentan (un poco): los enemigos se defienden de tus ataques físicos con su Defensa y de los especiales con su Defensa Especial, y cada enemigo te pega con su lado fuerte, que paras con tu Defensa o tu Defensa Especial.',
     'Defenses count too (a little): enemies resist your physical moves with their Defense and special moves with their Special Defense, and each enemy hits you with its strong side, which you block with your Defense or Special Defense.'],
    ['Ya se puede jugar con mando (Xbox, PlayStation, Switch y la mayoría de mandos USB o Bluetooth): moverte, cambiar de ataque, pausar, elegir cartas y manejar todos los menús, con vibración al recibir daño. Se configura en Ajustes > Controles.',
     'You can now play with a controller (Xbox, PlayStation, Switch and most USB or Bluetooth controllers): move, switch attacks, pause, pick cards and use every menu, with vibration when you take damage. Set it up in Settings > Controls.'],
    ['Colección: buscador por nombre o número, pestaña con todas las generaciones, filtros que se combinan (tengo / me faltan, varias rarezas a la vez, shiny, favoritos y tipo) y orden por número, nombre, rareza, recién conseguidos o más usados. Y favoritos: márcalos en la ficha de cada Pokémon; van con tu cuenta, en todos tus aparatos.',
     'Collection: search by name or number, a tab with every generation, filters that combine (owned / missing, several rarities at once, shiny, favorites and type) and sorting by number, name, rarity, recently caught or most played. Plus favorites: mark them on each Pokémon’s page; they go with your account, on all your devices.'],
    ['Nueva pestaña Accesibilidad en Ajustes con «Apuntar a mano»: tus ataques van hacia el ratón o hacia donde empujes el stick derecho del mando, en vez de al enemigo más cercano. Viene desactivado.',
     'New Accessibility tab in Settings with “Manual aim”: your attacks go towards the mouse or wherever you push the controller’s right stick, instead of the nearest enemy. It is off by default.'],
    ['Botón Guardar arriba a la derecha: sube tu partida a la nube al momento. Úsalo antes de cerrar el juego o de cambiar de aparato.',
     'Save button at the top right: it uploads your game to the cloud right away. Use it before closing the game or switching devices.']
  ], chg: [
    ['Las cartas de nivel, de vínculo y de objeto no se pueden elegir durante un momento al aparecer (se ven apagadas): pulsar 1-4 o tocar la pantalla para cambiar de ataque en plena pelea ya no elige una carta sin querer.',
     'Level-up, bond and item cards can’t be picked for a moment after they appear (they look dimmed): pressing 1-4 or tapping to switch attacks mid-fight no longer picks a card by accident.'],
    ['Con mando ya se pueden elegir en la colección los Pokémon que aún no tienes, y en el móvil las pestañas de Ajustes caben en una fila que se desliza.',
     'With a controller you can now select the Pokémon you don’t have yet in the collection, and on mobile the Settings tabs fit in one row that scrolls sideways.'],
    ['La partida se guarda en la nube automáticamente cada 10 minutos.',
     'Your game is saved to the cloud automatically every 10 minutes.'],
    ['Ranking histórico: si estás por debajo del puesto 1.000, sale «#1000+» en vez del número exacto.',
     'All-time leaderboard: if you are below rank 1,000, it shows “#1000+” instead of the exact number.'],
    ['Los Pokémon grandes (Onix, Gyarados, Wailord, Eternatus, los legendarios...) ya se pueden jugar bien: se ven algo más pequeños, aunque siguen siendo de los más grandes, y chocan como uno normal, así que caben por todos los pasillos y no reciben más golpes por su tamaño.',
     'Big Pokémon (Onix, Gyarados, Wailord, Eternatus, the legendaries...) are now properly playable: they look a bit smaller, while still being among the biggest, and collide like a normal one, so they fit through every corridor and don’t take extra hits because of their size.'],
    ['Como mucho hay 3 curanderos, 3 escuderos y 3 invocadores a la vez.',
     'There are at most 3 healers, 3 shielders and 3 summoners at a time.'],
    ['Los curanderos y escuderos ya no hacen inmatable a un jefe: lo que le curan y el escudo que le ponen van con el daño que le estás haciendo, y sólo recibe un escudo cada 6 segundos.',
     'Healers and shielders no longer make a boss unkillable: their healing and shields scale with the damage you are dealing to it, and it only gets one shield every 6 seconds.'],
    ['Sentencia de Arceus: la velocidad tiene un tope suave (lo que pase de cierto punto cuenta mucho menos) y los legendarios corren casi tanto como tú. Desde los 5 minutos de Sentencia Arceus acelera sin parar, y desde los 7 su toque quita cada vez más vida, hasta dejarte KO de un golpe hacia el minuto 40.',
     'Judgment of Arceus: speed has a soft cap (anything above a certain point counts much less) and legendaries run almost as fast as you. After 5 minutes of Judgment, Arceus keeps speeding up, and after 7 its touch takes more and more HP, until it knocks you out in one hit around minute 40.'],
    ['El veneno sigue quitando un porcentaje de la vida, pero contra enemigos con muchísima vida (los legendarios de la Sentencia) ese porcentaje es menor.',
     'Poison still takes a percentage of HP, but against enemies with huge HP (the Judgment legendaries) that percentage is smaller.'],
    ['Todos los rankings empiezan de cero (hoy, semana, mes, año e histórico): las marcas de huir de Arceus ya no se podrían alcanzar.',
     'All leaderboards start from scratch (daily, weekly, monthly, yearly and all-time): records from running away from Arceus could no longer be reached.']
  ], fix: [
    ['Seguridad: se ha cerrado un agujero por el que alguien podía meter código en su fila del ranking o en su perfil y hacer que se ejecutara en el navegador de quien los abría (a algunos les llevaba a un vídeo). Ahora todo lo que viene de otros jugadores se limpia, el servidor sólo deja guardar lo que debe, y el navegador no ejecuta nada que no sea del juego.',
     'Security: we closed a hole that let someone put code in their leaderboard row or profile and make it run in the browser of whoever opened them (some people were sent to a video). Now everything coming from other players is cleaned, the server only accepts what it should, and the browser runs nothing that isn’t part of the game.'],
    ['En el ranking ya salen en shiny los Pokémon de quien jugó con su shiny.',
     'The leaderboard now shows Pokémon in shiny form for players who played with their shiny.']
  ] },
  { d: '2026-10-15', title: ['Actualizaciones obligatorias', 'Required updates'], chg: [
    ['Cuando una actualización sea obligatoria (por ejemplo, para arreglar un fallo importante), la partida en curso se termina tras un aviso de 10 s y el juego se recarga. No pierdes nada: las monedas, los tickets, los récords y el ranking de esa partida se guardan como al abandonarla.',
     'When an update is required (for example, to fix an important bug), your current run ends after a 10 s notice and the game reloads. You lose nothing: that run’s coins, tickets, records and leaderboard entry are saved as if you had quit.']
  ] },
  { d: '2026-10-14', title: ['Recupera tu cuenta con Gmail', 'Recover your account with Gmail'], new: [
    ['Si juegas con nombre y contraseña, puedes vincular tu Gmail: si un día olvidas la contraseña, entras con Google y es tu misma cuenta. Te lo ofrecemos al entrar.',
     'If you play with a name and password, you can link your Gmail: if you ever forget your password, sign in with Google and it is the same account. We offer it when you sign in.'],
    ['Móvil: ya puedes colocar los botones donde quieras. En Ajustes > Controles > Colocar los botones arrastras los ataques (con el objeto), la pausa y el joystick, que ahora también puede ser fijo en vez de aparecer donde pones el dedo.',
     'Mobile: you can now place the buttons wherever you want. In Settings > Controls > Place the buttons, drag the attacks (with the item), the pause button and the joystick, which can now also be fixed instead of appearing where you put your finger.']
  ], chg: [
    ['Las tablas de la semana y del mes del ranking empiezan de cero, como el histórico: ahora sólo cuentan partidas con la Sentencia de Arceus y todas las tablas cuadran entre sí.',
     'The weekly and monthly leaderboards start from scratch, like the all-time one: now only runs with the Judgment of Arceus count, and all boards match each other.'],
    ['Aviso importante: la única web oficial de PokéSurvivor es pokesurvivor.com. El juego es y será gratis: si alguna otra web te pide pagar (por tickets, monedas o lo que sea), no somos nosotros. Lo verás también al entrar y en el Aviso legal.',
     'Important: the only official PokéSurvivor website is pokesurvivor.com. The game is and always will be free: if any other website asks you to pay (for tickets, coins or anything else), it isn’t us. You will also see this when signing in and in the Legal notice.'],
    ['El código del juego pasa a una licencia no comercial (PolyForm Noncommercial 1.0.0): se puede seguir estudiando y modificando, pero nadie puede cobrar por él.',
     'The game’s code moves to a non-commercial license (PolyForm Noncommercial 1.0.0): you can still study and modify it, but nobody may charge for it.']
  ], fix: [
    ['Cooperativo: la partida ya no se queda parada con cada uno esperando a que el otro elija. Un objeto y las cartas de nivel ya no se tapan, y si la conexión pierde un aviso se arregla solo.',
     'Co-op: the game no longer freezes with each player waiting for the other to choose. An item and the level-up cards no longer cover each other, and if the connection drops a message it fixes itself.'],
    ['Cooperativo: al volver de una grieta, quien no era el anfitrión ya ve a todos los enemigos (antes algunos eran invisibles y sólo se veían sus ataques).',
     'Co-op: after coming back from a rift, players who are not the host can see every enemy again (some used to be invisible, with only their attacks showing).'],
    ['Amigos: si tu móvil u ordenador tiene la hora (o la zona horaria) mal puesta, tus amigos ya no salen siempre desconectados y sus invitaciones te llegan.',
     'Friends: if your phone or computer has the wrong time (or time zone), your friends no longer always show as offline and their invitations reach you.'],
    ['Jugar en dos aparatos (PC y móvil) ya no hace perder monedas ni tickets: antes, si uno tenía la partida abierta con datos viejos y guardaba, borraba lo ganado en el otro. Ahora se suma lo de los dos. Y al volver al juego tras un rato fuera, se trae lo conseguido en el otro aparato (Pokémon, shinies...) sin recargar.',
     'Playing on two devices (PC and phone) no longer loses coins or tickets: before, if one had the game open with old data and saved, it erased what you earned on the other. Now both are added up. And when you come back to the game after a while away, it brings in what you got on the other device (Pokémon, shinies...) without reloading.'],
    ['Los avisos grandes de la partida (un Gholdengo cerca, una marea...) ya salen siempre centrados.',
     'Big in-game announcements (a nearby Gholdengo, a swarm...) are always centered now.']
  ] },
  { d: '2026-10-13', title: ['La Sentencia de Arceus', 'The Judgment of Arceus'], new: [
    ['La Sentencia de Arceus: al llegar al minuto 30, Arceus baja del cielo y te lleva a las Ruinas del Juicio. Es invencible, te persigue cada vez más deprisa y lanza pilares de luz, rayos y ondas; si te toca, te quita casi media vida. Cada 5 segundos acude un legendario con el doble de vida y de daño que el anterior. ¿Cuánto aguantarás?',
     'The Judgment of Arceus: at minute 30, Arceus descends from the sky and takes you to the Ruins of Judgment. It is invincible, chases you faster and faster and casts pillars of light, beams and shockwaves; if it touches you, you lose almost half your HP. Every 5 seconds a legendary joins, each with twice the HP and damage of the previous one. How long can you last?'],
    ['Tres logros nuevos: La Sentencia (llega al minuto 30), Ante el Creador (aguanta 1 minuto ante Arceus) y Desafío divino (derrota a 3 legendarios ante Arceus en una partida).',
     'Three new achievements: The Judgment (reach minute 30), Before the Creator (survive 1 minute against Arceus) and Divine challenge (defeat 3 legendaries against Arceus in a single run).'],
    ['Música nueva para la pelea contra Arceus.', 'New music for the fight against Arceus.'],
    ['Botón para reportar marcas sospechosas en el ranking (la banderita de cada fila).',
     'A button to report suspicious records on the leaderboard (the little flag on each row).']
  ], chg: [
    ['El ranking histórico empieza de cero: ahora que las partidas acaban ante Arceus, las marcas de antes ya no se podrían alcanzar. Las tablas de hoy, de la semana y del mes siguen igual.',
     'The all-time leaderboard starts from scratch: now that runs end against Arceus, older records could no longer be reached. The daily, weekly and monthly boards are unchanged.'],
    ['Se quita el tiempo extra del minuto 60 (ya no se llega hasta ahí).',
     'Overtime from minute 60 is removed (runs no longer get that far).'],
    ['Desde el minuto 28 ya no se abren grietas, para que la Sentencia no te pille dentro de una.',
     'Rifts no longer open from minute 28 on, so the Judgment does not catch you inside one.'],
    ['Ranking protegido contra trampas: el servidor comprueba que cada marca se ha jugado de verdad. Nunca se pierde nada de lo que ganas jugando.',
     'Leaderboard protected against cheating: the server checks that every record was really played. You never lose anything you earn by playing.'],
    ['Se han quitado del ranking las marcas de más de 35 minutos: con la Sentencia de Arceus ya no son posibles.',
     'Records over 35 minutes have been removed from the leaderboard: with the Judgment of Arceus they are no longer possible.']
  ], fix: [
    ['Las tiradas del gacha, los Pokémon nuevos y los premios se guardan en la nube al momento. Si abriste el juego en otro aparato o navegador y te faltaba algo, vuelve a abrirlo donde lo conseguiste: se recupera solo.',
     'Gacha pulls, new Pokémon and rewards are saved to the cloud right away. If you opened the game on another device or browser and something was missing, open it again where you got it: it comes back on its own.']
  ] },
  { d: '2026-10-12', title: ['Tiempo extra y grietas con menos azar', 'Overtime and less random rifts'], new: [
    ['Tiempo extra: desde el minuto 60 los Pokémon salvajes se vuelven cada vez más fuertes (más vida y más daño), y cada vez más deprisa. Antes, con las mejoras al máximo, algunas partidas no acababan nunca; ahora las mejores rondarán la hora y media.',
     'Overtime: from minute 60 on, wild Pokémon keep getting stronger (more HP and more damage), faster and faster. Before, with maxed upgrades, some runs never ended; now the best ones will last about an hour and a half.'],
    ['El juego se actualiza solo cuando sale una versión nueva: si estás en el menú, a los 5 segundos; si estás jugando, al acabar la partida (sin perder nada).',
     'The game now updates itself when a new version is out: within 5 seconds if you are in the menu, or after your run if you are playing (without losing anything).'],
    ['Botón de Novedades (esta ventana) con todos los cambios del juego.',
     'A "What\'s new" button (this window) with every change to the game.'],
    ['Números más fáciles de leer: el 2, el 5 y el 8 ya no se confunden.',
     'Easier to read numbers: 2, 5 and 8 no longer look alike.'],
    ['Elige la versión normal o shiny de tu compañero desde el menú principal, debajo de él.',
     'Pick the normal or shiny version of your partner right from the main menu, under it.'],
    ['Mejoras nuevas para cada Pokémon: Golpe Crítico (+3 % de críticos por nivel, que hacen x1,5 de daño), Cambio de cartas (+1 cambio de las cartas de nivel por run) y Veto (bloquea movimientos para que no te salgan en las cartas; se eligen en Mejoras).',
     'New upgrades for each Pokémon: Critical Hit (+3% critical chance per level, crits deal x1.5 damage), Card reroll (+1 level-up card reroll per run) and Ban (block moves so they never show up in your cards; pick them in Upgrades).'],
    ['Atajos de movimientos (en Mejoras, para cada Pokémon): elige qué movimiento va siempre en cada hueco, por ejemplo Confusión siempre en el 1, para la memoria muscular.',
     'Move shortcuts (in Upgrades, for each Pokémon): choose which move always goes in each slot, for example Confusion always on 1, for muscle memory.']
  ], chg: [
    ['Avalancha hace menos daño (21 en vez de 26): derrotaba casi el doble que la media de los movimientos.',
     'Rock Slide deals less damage (21 instead of 26): it defeated almost twice as many as the average move.'],
    ['Los cambios de cartas de nivel ya no se ganan venciendo jefes: tienes 1 gratis por run y el resto se compra en Mejoras.',
     'Level-up card rerolls are no longer earned by defeating bosses: you get 1 free per run and can buy more in Upgrades.'],
    ['Los legendarios de grieta ya no dan siempre tickets x10: dan uno la mitad de las veces (antes daban 2 siempre y salían demasiados).',
     'Rift legendaries no longer always drop x10 tickets: they drop one half of the time (they used to always drop 2, which was too many).'],
    ['Cooperativo: si vuestras redes no consiguen conectar entre sí, la sala lo avisa y lo reintenta sola, en vez de jugar a tirones por un servidor lento.',
     'Co-op: if your networks cannot connect to each other, the room says so and keeps retrying, instead of playing laggy through a slow server.'],
    ['Hemos cambiado de servidores para que el juego siga siendo gratis: puede que tengas que volver a iniciar sesión (con la misma cuenta y contraseña, o con Google). Tu partida y tus Pokémon siguen igual.',
     'We moved to new servers so the game can stay free: you may need to sign in again (with the same account and password, or with Google). Your save and your Pokémon are unchanged.'],
    ['Gacha: los shiny ya no salen repetidos. Si te toca uno que ya tienes, sale otro de la misma rareza que te falte.',
     'Gacha: shinies no longer come out as duplicates. If you roll one you already have, you get another of the same rarity that you are missing.'],
    ['Grietas con menos azar: cada vez que no sale una, la siguiente es más probable (como mucho 2,5 minutos sin grieta).',
     'Less random rifts: every time one does not show up, the next one is more likely (at most 2.5 minutes without a rift).'],
    ['Los legendarios que aún no has vencido salen 4 veces más en las grietas.',
     'Legendaries you have not beaten yet show up 4 times as often in rifts.'],
    ['Los curanderos curan más cuanto más fuerte pegas, pero cada vez menos y con un tope (como mucho el 2,5x).',
     'Healers heal more the harder you hit, but with diminishing returns and a cap (2.5x at most).'],
    ['Ataques cuerpo a cuerpo más fuertes: mientras llevas uno activo recibes un 25 % menos de daño, llegan un 25 % más lejos y hacen un 20 % más de daño.',
     'Stronger melee attacks: while one is active you take 25% less damage, and they reach 25% further and deal 20% more damage.'],
    ['Cooperativo: al elegir con qué objeto quedarte, la partida se para para todos (antes seguía y te pegaban mientras elegías).',
     'Co-op: choosing which held item to keep now pauses the run for everyone (it used to keep going and you got hit while choosing).'],
    ['Cooperativo: mientras alguien elige una fusión, la partida se para para todos.',
     'Co-op: while someone is choosing a fusion, the run pauses for everyone.'],
    ['Cooperativo: si el anfitrión cambia de pestaña o se le para el juego, la partida se pausa para todos hasta que vuelva.',
     'Co-op: if the host switches tabs or their game stalls, the run pauses for everyone until they are back.'],
    ['Las runs de menos de 1 minuto ya no cuentan para el ranking.',
     'Runs shorter than 1 minute no longer count for the leaderboard.']
  ], fix: [
    ['Quitadas del ranking las marcas rotas por el fallo del minuto 84 (el reloj seguía corriendo con el juego parado) y alguna imposible. Si tenías una, tu próxima partida vuelve a contar.',
     'Removed broken records from the leaderboard caused by the minute 84 bug (the clock kept running while the game was frozen) and a few impossible ones. If you had one, your next run counts again.'],
    ['iPhone (Safari y Chrome): a veces no se podía cambiar de movimiento tocando los iconos, sobre todo con el otro dedo en el joystick. Además los botones quedan por encima de la barra de inicio.',
     'iPhone (Safari and Chrome): sometimes you could not switch moves by tapping the icons, especially with your other finger on the joystick. Buttons also sit above the home bar now.'],
    ['En las partidas de más de 84 minutos la pantalla se quedaba en negro, el juego se paraba o empezabas a subir de nivel sin fin. Ya puedes jugar todo lo que aguantes.',
     'In runs longer than 84 minutes the screen went black, the game froze or you kept levelling up forever. Now you can play for as long as you survive.'],
    ['Si el juego fallara, la partida se cierra sola y se guarda (tiempo, derrotados, récords y ranking) en vez de perderse.',
     'If the game ever crashes, the run ends by itself and is saved (time, defeated, records and leaderboard) instead of being lost.'],
    ['Las partidas muy largas a veces se tomaban por trampas y no contaban para el ranking.',
     'Very long runs were sometimes flagged as cheating and did not count for the leaderboard.'],
    ['Cooperativo: si el anfitrión cambiaba de pestaña, los enemigos se quedaban quietos y los demás jugaban con ventaja.',
     'Co-op: if the host switched tabs, enemies stood still and everyone else got a free advantage.'],
    ['iPhone: mantener el dedo en el joystick sacaba "Copiar / Seleccionar todo".',
     'iPhone: holding your finger on the joystick brought up "Copy / Select all".'],
    ['iPhone: a veces no salía la pantalla completa. Ahora el botón explica cómo tenerla (Compartir y "Añadir a pantalla de inicio").',
     'iPhone: fullscreen sometimes did not show up. Now the button explains how to get it (Share and "Add to Home Screen").']
  ] },
  { d: '2026-10-11', title: ['Vínculos', 'Bonds'], new: [
    ['Vínculos: al vencer a un legendario fusionas movimientos que se lanzan a la vez desde un solo hueco (hasta 4).',
     'Bonds: defeating a legendary lets you fuse moves that fire at the same time from a single slot (up to 4).'],
    ['Botón para cambiar las cartas de subir de nivel.',
     'A button to reroll the level-up cards.']
  ], chg: [
    ['Más grietas.', 'More rifts.'],
    ['Movimientos psíquicos y curanderos más flojos.', 'Weaker psychic moves and healers.'],
    ['Las mejoras de las cartas de nivel (velocidad, recarga, experiencia, imán, coraza y potencia) tienen un tope de veces.',
     'Level-up card upgrades (speed, cooldown, experience, magnet, armor and power) can only be taken a limited number of times.'],
    ['En el móvil, la ficha del Pokémon sale al lado; entrar es más rápido y el gacha x10 se puede cerrar.',
     'On mobile, the Pokémon details show alongside; logging in is faster and the x10 gacha can be closed.']
  ], fix: [
    ['Pantalla negra en partidas de más de una hora por llenarse la memoria de imágenes.',
     'Black screen in runs longer than an hour because image memory filled up.'],
    ['Los tickets se perdían si se cerraba la pestaña antes de acabar la partida: ahora se guardan al cogerlos.',
     'Tickets were lost if the tab closed before the run ended: now they are saved as soon as you pick them up.'],
    ['Una mejora comprada justo después de guardar se cobraba y no se apuntaba.',
     'An upgrade bought right after saving was charged but not applied.'],
    ['El juego se quedaba congelado para siempre si algo fallaba a mitad de partida.',
     'The game froze forever if something went wrong mid-run.']
  ] },
  { d: '2026-10-10', title: ['Más reto', 'More challenge'], new: [
    ['Jefes y legendarios con 4 ataques avisados que se enfurecen a media vida.',
     'Bosses and legendaries with 4 telegraphed attacks that get enraged at half health.'],
    ['12 movimientos nuevos y 8 formas de atacar nuevas: bumerán, cadena, minas, meteoros, torreta, embestida, rastro y abanico.',
     '12 new moves and 8 new ways to attack: boomerang, chain, mines, meteors, turret, dash, trail and spray.'],
    ['Eventos a mitad de partida (hordas de un tipo, hora dorada, Pokémon perdidos) y Meowth y Gholdengo que huyen cargados de monedas.',
     'Mid-run events (single-type hordes, golden hour, lost Pokémon) and Meowth and Gholdengo running away loaded with coins.'],
    ['Estatuas para los Pokémon grandes.', 'Statues for big Pokémon.']
  ], chg: [
    ['Más difícil: menos enemigos pero más duros.', 'Harder: fewer but tougher enemies.'],
    ['Subir de nivel es más lento, los tickets son más raros y los jefes dan ticket x10 una de cada tres veces.',
     'Levelling up is slower, tickets are rarer and bosses drop a x10 ticket one time in three.'],
    ['Carga más rápida.', 'Faster loading.']
  ], fix: [
    ['Los enemigos rezagados desaparecían delante de ti: ahora sólo fuera de la vista.',
     'Straggling enemies vanished in front of you: now only off-screen.'],
    ['Los menús y pantallas se montaban encima de la barra de arriba.',
     'Menus and screens overlapped the top bar.']
  ] },
  { d: '2026-10-09', title: ['Móvil e inglés', 'Mobile and English'], new: [
    ['Se puede jugar en móvil y tablet con joystick táctil, e instalar como app.',
     'Play on phones and tablets with a touch joystick, and install it as an app.'],
    ['El juego, en español y en inglés.', 'The game in English and Spanish.'],
    ['Pantalla de ajustes con calidad gráfica automática.', 'Settings screen with automatic graphics quality.']
  ], chg: [
    ['Menos enemigos en pantalla pero más fuertes.', 'Fewer but stronger enemies on screen.'],
    ['Gigadrenado pasa a ser Hierba Lazo (ya no cura).', 'Giga Drain becomes Grass Knot (no more healing).']
  ] },
  { d: '2026-10-08', title: ['Misiones, grietas y cooperativo', 'Missions, rifts and co-op'], new: [
    ['Misiones diarias y semanales, logros con medallas y títulos, y perfil público.',
     'Daily and weekly missions, achievements with medals and titles, and a public profile.'],
    ['Objetos equipables, evoluciones de movimientos y enemigos que curan, protegen, invocan o explotan.',
     'Held items, move evolutions and enemies that heal, shield, summon or explode.'],
    ['Grietas que llevan a 18 arenas legendarias, una por tipo, y clima que cambia la batalla.',
     'Rifts leading to 18 legendary arenas, one per type, and weather that changes the fight.'],
    ['Cooperativo con tu lista de amigos y ranking.', 'Co-op with your friends list and leaderboards.'],
    ['Mejoras para cada Pokémon, gacha tragaperras con tickets y tabla de tipos.',
     'Upgrades for each Pokémon, a slot-machine ticket gacha and a type chart.']
  ], chg: [
    ['Cámara más lejos y enemigos que rodean los obstáculos.', 'Camera further out and enemies that walk around obstacles.']
  ] },
  { d: '2026-10-07', title: ['Primera versión', 'First version'], new: [
    ['Primera versión pública de PokéSurvivor.', 'First public version of PokéSurvivor.']
  ] }
];
