/* ============ passives-common.js — pasiva común de cada tipo ============
 * Una por tipo, según el tipo PRINCIPAL del Pokémon (mon.types[0], el mismo que usa
 * la plantilla typeDmg). 2-3 efectos [plantilla, valor] de G.PassiveFX.TEMPLATES, sin
 * condicionales; G.PassiveFX.scale los sube según la forma de evolución y el Rank.
 * Nombres sólo en inglés.
 */
G.PASSIVES_COMMON = {
  normal:   { n: 'Steady Spirit',  fx: [['maxHp', 12], ['regen', 2], ['xp', 10]] },
  fire:     { n: 'Blazing Heart',  fx: [['typeDmg', 15], ['lowHpDmg', 30]] },
  water:    { n: 'Tidal Grace',    fx: [['healMul', 30], ['dmgTaken', 8]] },
  grass:    { n: 'Verdant Bloom',  fx: [['regen', 3], ['maxHp', 10], ['typeDmg', 8]] },
  electric: { n: 'Static Rush',    fx: [['speed', 10], ['cdMul', 5], ['typeDmg', 10]] },
  ice:      { n: 'Frozen Edge',    fx: [['typeDmg', 10], ['critChance', 6], ['critDmg', 20]] },
  fighting: { n: 'Iron Fists',     fx: [['physDmg', 15], ['lowHpDmg', 25]] },
  poison:   { n: 'Toxic Hide',     fx: [['reflect', 100], ['dmgTaken', 6]] },
  ground:   { n: 'Bedrock Guard',  fx: [['maxHp', 15], ['typeTaken', 25]] },
  flying:   { n: 'Swift Gale',     fx: [['speed', 12], ['dodge', 6]] },
  psychic:  { n: 'Mind Focus',     fx: [['specDmg', 15], ['cdMul', 5]] },
  bug:      { n: 'Swarm Instinct', fx: [['multiHitDmg', 25], ['killHeal', 3]] },
  rock:     { n: 'Granite Shell',  fx: [['dmgTaken', 10], ['maxHp', 10]] },
  ghost:    { n: 'Phantom Veil',   fx: [['dodge', 8], ['lowHpDmg', 25]] },
  dragon:   { n: 'Draconic Might', fx: [['typeDmg', 15], ['critChance', 5]] },
  dark:     { n: 'Shadow Hunger',  fx: [['killHeal', 4], ['critChance', 5], ['critDmg', 15]] },
  steel:    { n: 'Forged Plating', fx: [['dmgTaken', 10], ['typeTaken', 20]] },
  fairy:    { n: 'Gentle Charm',   fx: [['healMul', 25], ['regen', 2], ['magnet', 30]] }
};
