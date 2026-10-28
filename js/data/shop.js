/* ============ shop.js — Tienda Kecleon y Mochila ============
 * (20-10-2026, del PR #236 de TheAdro7, adaptado: sin niveles ni caramelos.)
 *
 * Se compra con Pokémonedas y lo comprado va a la Mochila:
 *   save.bag[id]     Menta
 *   save.tms[move]   MT sin usar (cada una se gasta al enseñarla: G.Mons.teach)
 * Las dos van en la libreta de las monedas (core/db.js): lo gastado en un
 * aparato no reaparece al fusionar con otro.
 *
 * MT a la venta: 8 cada día, iguales para todos (semilla: la fecha en España).
 * Si ninguna sirve a tu compañero, la última se cambia por una que sí aprenda.
 * (Las Cápsulas de Habilidad se quitaron el 27-10-2026: cada Pokémon tiene una
 * pasiva propia y fija, ver data/passives.js.)
 */
G.Shop = (() => {
  const ITEMS = {
    mint: { name: 'Menta', icon: 'mint', price: 1500,
            desc: 'Cambia la naturaleza de un Pokémon por la que tú elijas.' }
  };
  const ORDER = ['mint'];
  const DAILY = 8;
  /** Materiales Mega (data/mega-mats.js): van a la Mochila, pero tienen su propia sección en la tienda. */
  const MAT_PRICE = 600;
  if (G.MegaMats) {
    for (const t of G.MegaMats.TYPES) {
      ITEMS[G.MegaMats.id(t)] = { name: G.MegaMats.name(t), icon: 'evostone', price: MAT_PRICE,
                                  desc: 'Used to unlock Mega Evolutions in the Forge.' };
    }
  }

  const save = () => G.DB.save;
  const count = id => { const s = save(); return (s && s.bag && s.bag[id]) || 0; };
  const tmCount = id => { const s = save(); return (s && s.tms && s.tms[id]) || 0; };

  function take(id) {
    const s = save();
    if (!count(id)) return false;
    if (--s.bag[id] <= 0) delete s.bag[id];
    return true;
  }
  /** Suma `n` a la Mochila (tope 999). → cuántas se añadieron de verdad. */
  function give(id, n) {
    const s = save();
    if (!s || !(n > 0)) return 0;
    s.bag = s.bag || {};
    const had = s.bag[id] || 0;
    s.bag[id] = Math.min(999, had + n);
    return s.bag[id] - had;
  }
  function takeTm(id) {
    const s = save();
    if (!tmCount(id)) return false;
    if (--s.tms[id] <= 0) delete s.tms[id];
    return true;
  }

  // ---------------- MT del día ----------------

  /** Fecha de hoy en España (AAAAMMDD): la misma para todos los jugadores. */
  function today() {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value;
    return p.year + p.month + p.day;
  }
  /** Generador pseudoaleatorio con semilla de texto (FNV-1a + mulberry32). */
  function rng(seed) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x1000193); }
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ t >>> 15, 1 | t);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function dailyTms() {
    const ids = Object.keys(G.TM_PRICE).sort(), r = rng('kecleon:' + today());
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const list = ids.slice(0, DAILY), s = save(), dex = s && s.partner;
    if (dex && !list.some(id => G.Mons.canLearn(dex, id))) {
      const mine = G.Mons.learnable(dex).sort();
      if (mine.length) list[DAILY - 1] = mine[Math.floor(rng('kecleon:' + today() + ':' + dex)() * mine.length)];
    }
    return list;
  }
  const tmPrice = id => G.TM_PRICE[id] || 400;

  // ---------------- materiales Mega del día ----------------

  const DAILY_MATS = 5;
  /** 5 tipos al día, iguales para todos; el tipo principal del compañero siempre está. */
  function dailyMats() {
    if (!G.MegaMats) return [];
    const types = G.MegaMats.TYPES.slice().sort(), r = rng('kecleon:mats:' + today());
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    const list = types.slice(0, DAILY_MATS), s = save(), mon = s && G.DEX_BY && G.DEX_BY[s.partner];
    if (mon && mon.types[0] && G.MegaMats.TYPES.includes(mon.types[0]) && !list.includes(mon.types[0])) list[DAILY_MATS - 1] = mon.types[0];
    return list;
  }

  // ---------------- comprar ----------------

  /** Compra un objeto ('mint'), una MT ('tm:flamethrower') o un material Mega ('mat:fire'). → { ok, error? } */
  function buy(key) {
    const s = save();
    if (!s) return { ok: false };
    if (G.MegaMats && G.MegaMats.typeOf(key)) return { ok: false };          // los materiales sólo se compran con 'mat:<tipo>'
    if (key.startsWith('mat:')) {
      const type = key.slice(4);
      if (!G.MegaMats || !dailyMats().includes(type)) return { ok: false, error: 'That material is not on sale today.' };
      if (count(G.MegaMats.id(type)) >= 999) return { ok: false, error: 'Your Bag is full of that material.' };
      if (s.coins < MAT_PRICE) return { ok: false, error: 'No tienes Pokémonedas suficientes.' };
      s.coins -= MAT_PRICE;
      give(G.MegaMats.id(type), 1);
      G.DB.commit();
      return { ok: true };
    }
    const tm = key.startsWith('tm:') ? key.slice(3) : null;
    if (tm && !dailyTms().includes(tm)) return { ok: false, error: 'Esa MT ya no está a la venta.' };
    if (!tm && !ITEMS[key]) return { ok: false };
    const price = tm ? tmPrice(tm) : ITEMS[key].price;
    if ((tm ? tmCount(tm) : count(key)) >= 999) return { ok: false, error: 'Your Bag is full of that.' };
    if (s.coins < price) return { ok: false, error: 'No tienes Pokémonedas suficientes.' };
    s.coins -= price;
    if (tm) { s.tms = s.tms || {}; s.tms[tm] = Math.min(999, (s.tms[tm] || 0) + 1); }
    else { s.bag = s.bag || {}; s.bag[key] = Math.min(999, (s.bag[key] || 0) + 1); }
    G.DB.commit();
    return { ok: true };
  }

  return { ITEMS, ORDER, MAT_PRICE, DAILY_MATS, count, take, give, tmCount, takeTm, dailyTms, dailyMats, tmPrice, buy, today };
})();
