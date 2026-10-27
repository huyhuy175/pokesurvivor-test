// ==UserScript==
// @name         PokéSurvivor Ultimate Trainer & HUD
// @namespace    local.pokesurvivor.ultimate
// @version      2.6.3
// @description  All-in-one trainer & live HUD for pokesurvivor.com: stat sliders, abilities editor, adjustable currencies, Pokédex lock/unlock, auto-farm, priority-based auto level-up, batch gacha, radar overlay.
// @author       Rekcheli
// @match        *://pokesurvivor.com/*
// @match        *://www.pokesurvivor.com/*
// @icon         https://pokesurvivor.com/assets/icons/icon-96.png
// @run-at       document-end
// @grant        none
// @license      PolyForm-Noncommercial-1.0.0
// @downloadURL https://update.greasyfork.org/scripts/600697/Pok%C3%A9Survivor%20Ultimate%20Trainer%20%20HUD.user.js
// @updateURL https://update.greasyfork.org/scripts/600697/Pok%C3%A9Survivor%20Ultimate%20Trainer%20%20HUD.meta.js
// ==/UserScript==

// =========================================================================
// DISCLAIMER & LICENSE
// =========================================================================
//
// PokéSurvivor Ultimate Trainer & HUD
// Copyright (c) 2026 Rekcheli
//
// This script is provided for educational and personal study purposes only.
// It does not contain any copyrighted assets (sprites, music, character names).
// It is not affiliated with, endorsed by, or sponsored by Nintendo, Creatures Inc.,
// GAME FREAK, or The Pokémon Company.
//
// The game pokesurvivor.com uses Pokémon assets without authorization.
// This script merely modifies the game's client-side behavior.
// The author assumes no responsibility for how the game is used.
//
// LICENSE: PolyForm Noncommercial License 1.0.0
// You are free to use, study, and modify this script for non-commercial purposes.
// You may distribute copies and modified versions, provided you include this
// license and the required notice below.
//
// Required Notice: Copyright (c) 2026 Rekcheli
//
// For full terms, see: https://polyformproject.org/licenses/noncommercial/1.0.0
//
// MAINTENANCE: This script is open for anyone to fork, improve, and maintain.
// If you find this useful, feel free to create your own version.
// =========================================================================

(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (document.getElementById('ps-ultimate-panel')) return;

  // =========================================================================
  // AUTO-REDIRECT & URL MASKING
  // =========================================================================
  if (location.pathname === '/' || location.pathname === '/index.html') {
    location.replace('/dev.html' + location.search + location.hash);
    return;
  }

  if (location.pathname.includes('dev.html')) {
    try {
      history.replaceState(null, '', '/' + location.search + location.hash);
    } catch (e) {}
  }

  // =========================================================================
  // SHARED STATE & CONFIGURATION
  // =========================================================================
  const toggles = {
    // Trainer Sliders
    vitality: false, strength: false, stride: false, reflexes: false,
    armor: false, synthesis: false, magnet: false, wisdom: false,
    fortune: false, critical: false, reroll: false,
    vitalitySlider: 0, strengthSlider: 0, strideSlider: 0, reflexesSlider: 0,
    armorSlider: 0, synthesisSlider: 0, magnetSlider: 0, wisdomSlider: 0,
    fortuneSlider: 0, criticalSlider: 0,

    // Trainer Toggles
    godmode: false, automagnet: false, shinygacha: false, autoRift: false,
    autolevel: false, autolevelAll: false,
    fly: false, autoEvade: false, autoSwarm: false,

    // HUD
    hudPanel: true, hudFov: true, hudHp: true, hudXp: true,
    hudRing: true, hudSupport: true, hudHaz: true,
    hudMagnetCircle: false, hudArrows: true, hudPoi: true, instantChest: false,
    hudAlerts: true,
    hudAtk: true, hudSpd: true, hudRed: true, hudRegen: true, hudCrit: true,
    hudKills: true, hudCoins: true, hudCd: true, hudXpMul: true, hudCoinMul: true, hudMagnet: true
  };

  const HUdCFG_KEY = 'ps_hud_cfg';
  const hudCfg = {
    hpbar: 'big',
    zoom: parseFloat(localStorage.getItem('ps_zoom')) || 1,
    pos: null,
    hiddenStats: {},
    poiRange: 2000
  };

  // inizio funzione loadHudCfg
  function loadHudCfg() {
    try {
      const saved = JSON.parse(localStorage.getItem(HUdCFG_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.assign(hudCfg, saved);
      }
    } catch (_) {}
  }
  // fine funzione loadHudCfg

  // inizio funzione saveHudCfg
  function saveHudCfg() {
    try { localStorage.setItem(HUdCFG_KEY, JSON.stringify(hudCfg)); } catch (_) {}
  }
  // fine funzione saveHudCfg
  loadHudCfg();

  // =========================================================================
  // LAYOUT PERSISTENCE
  // =========================================================================
  try {
    const savedToggles = JSON.parse(localStorage.getItem('ps_ultimate_toggles') || '{}');
    for (const k in savedToggles) {
      if (toggles[k] !== undefined) toggles[k] = savedToggles[k];
    }
  } catch (_) {}

  // inizio funzione saveToggles
  function saveToggles() {
    try { localStorage.setItem('ps_ultimate_toggles', JSON.stringify(toggles)); } catch (_) {}
  }
  // fine funzione saveToggles

  const LAYOUT_KEY = 'ps_ultimate_layout_v1';

  const layout = {
    panel: { left: null, top: null, width: 420, height: null, opacity: 0.96, blur: true },
    hud: { left: null, top: null, width: 220, height: null, opacity: 0.85, blur: true }
  };

  // inizio funzione loadLayout
  function loadLayout() {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        if (saved.panel) Object.assign(layout.panel, saved.panel);
        if (saved.hud) Object.assign(layout.hud, saved.hud);
      }
    } catch (_) {}
  }
  // fine funzione loadLayout

  // inizio funzione saveLayout
  function saveLayout() {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (_) {}
  }
  // fine funzione saveLayout
  loadLayout();

  // inizio funzione clampLayoutRect
  function clampLayoutRect(rect, minW, minH) {
    const w = Math.max(minW, Math.min(window.innerWidth - 20, rect.width || minW));
    const h = rect.height ? Math.max(minH, Math.min(window.innerHeight - 20, rect.height)) : null;
    let left = rect.left;
    let top = rect.top;
    if (left === null || left === undefined) left = Math.max(10, window.innerWidth - w - 16);
    if (top === null || top === undefined) top = Math.max(10, Math.min(80, window.innerHeight - 200));
    left = Math.max(0, Math.min(window.innerWidth - w, left));
    if (h !== null) top = Math.max(0, Math.min(window.innerHeight - h, top));
    return { left, top, width: w, height: h };
  }
  // fine funzione clampLayoutRect

  // inizio funzione applyOpacity
  function applyOpacity(el, opacity, blur) {
    const base = el.dataset.baseBg || 'rgba(10, 15, 29, 0.96)';
    if (!el.dataset.baseBg) el.dataset.baseBg = base;
    if (blur) {
      const m = base.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map(s => s.trim());
        const r = parts[0], g = parts[1], b = parts[2];
        el.style.background = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
      el.style.backdropFilter = 'blur(10px)';
      el.style.webkitBackdropFilter = 'blur(10px)';
    } else {
      el.style.background = 'transparent';
      el.style.backdropFilter = 'none';
      el.style.webkitBackdropFilter = 'none';
    }
  }
  // fine funzione applyOpacity

  const DEFAULT_PRIORITY = ['atk', 'cd', 'def', 'xp', 'spd', 'mag', 'hp', 'rgn', 'heal'];
  let statPriority = JSON.parse(localStorage.getItem('ps_ultimate_priority')) || [...DEFAULT_PRIORITY];
  let levelUpHooked = false;

  const TAG = '[Ultimate]';
  const log = (...a) => console.log(TAG, ...a);

  // =========================================================================
  // GAME ACCESS
  // =========================================================================
  const G = () => window.G;

  // inizio funzione getPlayer
  function getPlayer() {
    const g = G();
    return (g && g.Game && g.Game.player) || null;
  }
  // fine funzione getPlayer

  // inizio funzione modifySave
  function modifySave(callback) {
    const g = G();
    if (g && g.DB && g.DB.save) {
      callback(g.DB.save);
      g.DB.commit();
      if (g.UI && g.UI.refreshCoins) g.UI.refreshCoins();
      return true;
    }
    let updated = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ps.save.') || k.startsWith('ps.cloud.'))) {
        try {
          const data = JSON.parse(localStorage.getItem(k));
          callback(data);
          localStorage.setItem(k, JSON.stringify(data));
          updated = true;
        } catch (e) { console.error(TAG, 'Save error:', e); }
      }
    }
    return updated;
  }
  // fine funzione modifySave

  // inizio funzione addCoins
  const addCoins = n => modifySave(s => { s.coins = Math.max(0, (s.coins || 0) + n); });
  // fine funzione addCoins

  // inizio funzione addGoldTickets
  const addGoldTickets = n => modifySave(s => { s.tickets = s.tickets || { t1: 0, t10: 0 }; s.tickets.t1 = Math.max(0, (s.tickets.t1 || 0) + n); });
  // fine funzione addGoldTickets

  // inizio funzione addPurpleTickets
  const addPurpleTickets = n => modifySave(s => { s.tickets = s.tickets || { t1: 0, t10: 0 }; s.tickets.t10 = Math.max(0, (s.tickets.t10 || 0) + n); });
  // fine funzione addPurpleTickets

  // =========================================================================
  // HOOKS & LOGIC
  // =========================================================================

  // inizio funzione installLevelUpHook
  function installLevelUpHook() {
    if (levelUpHooked) return;
    const g = G();
    if (!g || !g.LevelUp || typeof g.LevelUp.offer !== 'function') return;
    if (!g.RunUI || typeof g.RunUI.pick !== 'function') return;

    const originalOffer = g.LevelUp.offer;
    g.LevelUp.offer = function (...args) {
      const cards = originalOffer.apply(this, args);
      if (!toggles.autolevel && !toggles.autolevelAll) return cards;
      if (!Array.isArray(cards) || !cards.length) return cards;

      let bestIndex = -1, bestRank = Infinity;
      let firstMoveIndex = -1;

      cards.forEach((card, i) => {
        const key = String(card.key || '');
        if (key.startsWith('stat:')) {
          const id = key.slice(5);
          const rank = statPriority.indexOf(id);
          if (rank !== -1 && rank < bestRank) {
            bestRank = rank;
            bestIndex = i;
          }
        } else {
          if (firstMoveIndex === -1) firstMoveIndex = i;
        }
      });

      // NUOVA LOGICA: Se c'è almeno una mossa e siamo in modalità "Stats", lascia scegliere all'utente
      if (toggles.autolevel && !toggles.autolevelAll && firstMoveIndex !== -1) {
        return cards;
      }

      if (bestIndex === -1) {
        if (toggles.autolevelAll && firstMoveIndex !== -1) {
          bestIndex = firstMoveIndex;
        } else {
          return cards;
        }
      }

      setTimeout(() => {
        try {
          g.RunUI.pick(bestIndex);
          log('Auto-pick (delayed)', bestIndex, cards[bestIndex]);
        }
        catch (e) {
          console.error(TAG, 'Auto-pick failed', e);
        }
      }, 1500);
        return cards;
    };

      levelUpHooked = true;
      log('LevelUp.offer hook installed with delay');
  }
    // fine funzione installLevelUpHook

    // inizio funzione unlockAllDex
  function unlockAllDex() {
    return modifySave(save => {
      save.owned = save.owned || {};
      save.shiny = save.shiny || {};
      const g = G();
      const dexList = (g && g.DEX) ? g.DEX : Array.from({ length: 1025 }, (_, i) => ({ dex: i + 1 }));
      for (const p of dexList) {
        save.owned[p.dex] = { at: Date.now(), from: 'gacha' };
        save.shiny[p.dex] = { at: Date.now(), from: 'gacha' };
      }
      save.stats = save.stats || {};
      save.stats.shinies = Object.keys(save.shiny).length;
    });
  }
  // fine funzione unlockAllDex

  // inizio funzione unlockSinglePokemon
  function unlockSinglePokemon(query, isShiny = false) {
    if (!query) return null;
    const q = String(query).trim().toLowerCase();
    let targetDex = parseInt(q, 10);
    let targetName = '';
    const g = G();
    if (isNaN(targetDex) || targetDex <= 0) {
      if (g && g.DEX) {
        const found = g.DEX.find(p => p.name.toLowerCase() === q || p.name.toLowerCase().includes(q));
        if (found) { targetDex = found.dex; targetName = found.name; }
      }
    }
    if (!targetDex || isNaN(targetDex)) return null;
    modifySave(save => {
      save.owned = save.owned || {};
      save.shiny = save.shiny || {};
      save.owned[targetDex] = { at: Date.now(), from: 'gacha' };
      if (isShiny) {
        save.shiny[targetDex] = { at: Date.now(), from: 'gacha' };
        save.stats = save.stats || {};
        save.stats.shinies = Object.keys(save.shiny).length;
      }
    });
    return targetName || '#' + targetDex;
  }
  // fine funzione unlockSinglePokemon

  // inizio funzione lockAllDex
  function lockAllDex() {
    return modifySave(save => {
      save.owned = {};
      save.shiny = {};
      save.stats = save.stats || {};
      save.stats.shinies = 0;
    });
  }
  // fine funzione lockAllDex

  // inizio funzione lockSinglePokemon
  function lockSinglePokemon(query, isShiny = false) {
    if (!query) return null;
    const q = String(query).trim().toLowerCase();
    let targetDex = parseInt(q, 10);
    let targetName = '';
    const g = G();
    if (isNaN(targetDex) || targetDex <= 0) {
      if (g && g.DEX) {
        const found = g.DEX.find(p => p.name.toLowerCase() === q || p.name.toLowerCase().includes(q));
        if (found) { targetDex = found.dex; targetName = found.name; }
      }
    }
    if (!targetDex || isNaN(targetDex)) return null;
    modifySave(save => {
      if (isShiny) {
        if (save.shiny) delete save.shiny[targetDex];
        save.stats = save.stats || {};
        save.stats.shinies = Object.keys(save.shiny || {}).length;
      } else {
        if (save.owned) delete save.owned[targetDex];
      }
    });
    return targetName || '#' + targetDex;
  }
  // fine funzione lockSinglePokemon

  // inizio funzione applyBanLimit
  function applyBanLimit(limit) {
    const g = G();
    if (!g || !g.Upgrades) return false;
    if (g.Upgrades.BY && g.Upgrades.BY.ban) {
      g.Upgrades.BY.ban.max = limit;
    }
    if (Array.isArray(g.Upgrades.LIST)) {
      const u = g.Upgrades.LIST.find(x => x.id === 'ban');
      if (u) u.max = limit;
    }
    return true;
  }
  // fine funzione applyBanLimit

  // inizio funzione getCustomBanLimit
  function getCustomBanLimit() {
    const val = parseInt(localStorage.getItem('ps_custom_ban_limit'), 10);
    if (!Number.isFinite(val) || val < 1) return 10;
    return Math.min(20, val); // Forza il massimo a 20
  }
  // fine funzione getCustomBanLimit

  // inizio funzione Rift Teleport
  let lastRiftTeleport = 0;
  setInterval(() => {
    if (!toggles.autoRift) return;
    const g = G();
    if (!g || !g.Rift) return;

    const rift = g.Rift.rift;
    if (!rift) return;

    const p = getPlayer();
    if (!p || p.dead || g.Rift.inArena) return;

    const now = Date.now();
    if (now - lastRiftTeleport < 1000) return;
    lastRiftTeleport = now;

    p.x = rift.x;
    p.y = rift.y - 10;

    let frames = 0;
    const forceInt = setInterval(() => {
      const pl = getPlayer();
      if (!pl || pl.dead || !g.Rift.rift) { clearInterval(forceInt); return; }
      pl.x = rift.x;
      pl.y = rift.y - 10;
      frames++;
      if (frames > 30) clearInterval(forceInt);
    }, 16);

    log('Rift auto-teleport to', rift.x, rift.y);
  }, 200);
  // fine funzione Rift Teleport

  // inizio funzione Auto-Pick Bonds & Items
  setInterval(() => {
    if (!toggles.autolevelAll) return;
    const g = G();
    if (!g || !g.Game) return;

    const itemScreen = document.getElementById('scr-item') || document.getElementById('scr-item-choice');
    const bondScreen = document.getElementById('scr-bond');

    const isItemVisible = itemScreen && !itemScreen.classList.contains('hidden');
    const isBondVisible = bondScreen && !bondScreen.classList.contains('hidden');

    if (isItemVisible || isBondVisible) {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));

      const ev = new KeyboardEvent('keydown', { key: '1', code: 'Digit1', keyCode: 49, which: 49, bubbles: true });
      document.dispatchEvent(ev);

      if (!window._lastAutoPickLog || Date.now() - window._lastAutoPickLog > 1000) {
        log('Auto-pressing 1 for Item/Bond (Focus Trick)...');
        window._lastAutoPickLog = Date.now();
      }
    }
  }, 500);
  // fine funzione Auto-Pick Bonds & Items

  // inizio funzione Stat Loop
  setInterval(() => {
    const p = getPlayer();
    if (p) {
      // Vitality (HP) - Flat Add
      if (p._psAppliedMaxHp === undefined) p._psAppliedMaxHp = 0;
      const vPct = (toggles.vitalitySlider || 0) / 100;
      const targetAddHp = 5000 * vPct;
      const hpDiff = targetAddHp - p._psAppliedMaxHp;
      if (hpDiff !== 0) {
        p.maxHp += hpDiff;
        if (hpDiff > 0) p.hp += hpDiff;
        if (p.hp > p.maxHp) p.hp = p.maxHp;
        p._psAppliedMaxHp = targetAddHp;
      }

      // Strength (Atk Mul) - Multiplier
      if (p._psAppliedAtkMul === undefined) p._psAppliedAtkMul = 1;
      const atkPct = toggles.strengthSlider || 0;
      const targetAtkMul = atkPct === 100 ? 9999 : Math.round((1 + (9 * (atkPct / 100))) * 10) / 10;
      if (targetAtkMul !== p._psAppliedAtkMul) {
        const baseAtkMul = (p.atkMul || 1) / p._psAppliedAtkMul;
        p.atkMul = baseAtkMul * targetAtkMul;
        p._psAppliedAtkMul = targetAtkMul;
      }

      // Stride (Spd Mul) - Multiplier
      if (p._psAppliedSpdMul === undefined) p._psAppliedSpdMul = 1;
      const targetSpdMul = Math.round((1 + (1.5 * ((toggles.strideSlider || 0) / 100))) * 10) / 10;
      if (targetSpdMul !== p._psAppliedSpdMul) {
        const baseSpdMul = (p.spdMul || 1) / p._psAppliedSpdMul;
        p.spdMul = baseSpdMul * targetSpdMul;
        p._psAppliedSpdMul = targetSpdMul;
      }

      // Reflexes (Cooldown Mul) - Multiplier
      if (p._psAppliedCdMul === undefined) p._psAppliedCdMul = 1;
      const targetCdMul = Math.round((1 - (0.85 * ((toggles.reflexesSlider || 0) / 100))) * 100) / 100;
      if (targetCdMul !== p._psAppliedCdMul) {
        const baseCdMul = (p.cdMul || 1) / p._psAppliedCdMul;
        p.cdMul = baseCdMul * targetCdMul;
        p._psAppliedCdMul = targetCdMul;
      }

      // Armor (Dmg Reduce) - Additive with cap
      if (p._psAppliedDmgReduce === undefined) p._psAppliedDmgReduce = 0;
      const targetDmgReduce = Math.round((0.8 * ((toggles.armorSlider || 0) / 100)) * 10) / 10;
      if (targetDmgReduce !== p._psAppliedDmgReduce) {
        const baseDmgReduce = (p.dmgReduce || 0) - p._psAppliedDmgReduce;
        const newDmgReduce = Math.min(0.95, baseDmgReduce + targetDmgReduce);
        p.dmgReduce = newDmgReduce;
        p._psAppliedDmgReduce = newDmgReduce - baseDmgReduce;
      }

      // Synthesis (Regen) - Additive
      if (p._psAppliedRegenFlat === undefined) p._psAppliedRegenFlat = 0;
      const targetRegenFlat = Math.round((50 * ((toggles.synthesisSlider || 0) / 100)) * 10) / 10;
      if (targetRegenFlat !== p._psAppliedRegenFlat) {
        const baseRegenFlat = (p.regenFlat || 0) - p._psAppliedRegenFlat;
        p.regenFlat = baseRegenFlat + targetRegenFlat;
        p._psAppliedRegenFlat = targetRegenFlat;
      }

      // Magnet Logic
      if (toggles.magnet) {
        if (p._psBaseMagnet === undefined) {
          p._psBaseMagnet = p.magnet || 78;
        }
        const pct = toggles.magnetSlider || 0;
        if (pct <= 0) {
          p.magnet = p._psBaseMagnet;
        } else {
          p.magnet = Math.round(p._psBaseMagnet * (1 + (pct / 100) * 9));
        }
      } else {
        if (p._psBaseMagnet !== undefined) {
          p.magnet = p._psBaseMagnet;
          delete p._psBaseMagnet;
        }
      }

      // Wisdom (XP Mul) - Multiplier
      if (p._psAppliedXpMul === undefined) p._psAppliedXpMul = 1;
      const targetXpMul = Math.round((1 + (9 * ((toggles.wisdomSlider || 0) / 100))) * 10) / 10;
      if (targetXpMul !== p._psAppliedXpMul) {
        const baseXpMul = (p.xpMul || 1) / p._psAppliedXpMul;
        p.xpMul = baseXpMul * targetXpMul;
        p._psAppliedXpMul = targetXpMul;
      }

      // Fortune (Coin Mul) - Multiplier
      if (p._psAppliedCoinMul === undefined) p._psAppliedCoinMul = 1;
      const targetCoinMul = Math.round((1 + (9 * ((toggles.fortuneSlider || 0) / 100))) * 10) / 10;
      if (targetCoinMul !== p._psAppliedCoinMul) {
        const baseCoinMul = (p.coinMul || 1) / p._psAppliedCoinMul;
        p.coinMul = baseCoinMul * targetCoinMul;
        p._psAppliedCoinMul = targetCoinMul;
      }

      // Critical (Crit Chance) - Additive with cap
      if (p._psAppliedCrit === undefined) p._psAppliedCrit = 0;
      const targetCrit = Math.round((1.0 * ((toggles.criticalSlider || 0) / 100)) * 100) / 100;
      if (targetCrit !== p._psAppliedCrit) {
        const baseCrit = (p.critChance || 0) - p._psAppliedCrit;
        const newCrit = Math.min(1.0, baseCrit + targetCrit);
        p.critChance = newCrit;
        p._psAppliedCrit = newCrit - baseCrit;
      }

      const g = G();
      if (toggles.automagnet && g && g.Pickups && g.Pickups.pullAll) g.Pickups.pullAll();
    }
    const g = G();
    if (toggles.shinygacha && g && g.Gacha && g.Gacha.debugForceShiny) g.Gacha.debugForceShiny(9999);
    installLevelUpHook();
    applyBanLimit(getCustomBanLimit());
  }, 1000);
  // fine funzione Stat Loop

  // inizio funzione hookInstantChest
  function hookInstantChest() {
    const g = G();
    if (!g || !g.Interact || g.Interact._psChestHooked) return;
    g.Interact._psChestHooked = true;

    const origUpdate = g.Interact.update;
    g.Interact.update = function(dt, pl) {
      if (toggles.instantChest && pl && g.World && typeof g.World.specialsNear === 'function') {
        const near = g.World.specialsNear(pl.x, pl.y, 90);
        for (const s of near) {
          if (s && s.type === 'bigchest' && !s.used && s.open < 3.5) {
            s.open = 3.5;
          }
        }
      }
      return origUpdate.apply(this, arguments);
    };
    log('Instant Chest hook installed');
  }
  // fine funzione hookInstantChest
  setInterval(hookInstantChest, 1000);

  // inizio funzione Hooks Fly & Swarm & Evade
  setInterval(() => {
    const g = G();
    if (g && g.World && !g.World._psFlyHooked) {
      g.World._psFlyHooked = true;
      const origCollide = g.World.collide;
      g.World.collide = function(entity) {
        if (toggles.fly && entity === getPlayer()) return false;
        return origCollide.apply(this, arguments);
      };
      const origLiquid = g.World.liquidEffect;
      g.World.liquidEffect = function() {
        if (toggles.fly) return {};
        return origLiquid.apply(this, arguments);
      };
    }
  }, 1000);

  setInterval(() => {
    if (!toggles.autoSwarm) return;
    const g = G(), p = getPlayer();
    if (!g || !p || p.dead || !g.Game || g.Game.state !== 'playing' || !g.Spawner || !g.EnemyMgr) return;
    if (g.Rift && g.Rift.inArena) return;

    const alive = g.EnemyMgr.all().filter(e => e && !e.dead).length;
    if (alive < 200) {
      let target = g.EnemyMgr;
      let desc = Object.getOwnPropertyDescriptor(target, 'count');

      // Se non c'è sull'istanza, cerca sul prototipo
      if (!desc) {
        target = Object.getPrototypeOf(g.EnemyMgr);
        desc = Object.getOwnPropertyDescriptor(target, 'count');
      }

      if (desc && desc.configurable) {
        try {
          Object.defineProperty(target, 'count', { get: () => 0, configurable: true });
          g.Spawner.burst(24);
        } finally {
          Object.defineProperty(target, 'count', desc);
        }
      }
    }
  }, 1000);

  setInterval(() => {
    if (!toggles.autoEvade) return;
    const g = G(), p = getPlayer();
    if (!g || !p || p.dead || !g.Game || g.Game.state !== 'playing') return;

    let ex = 0, ey = 0;
    const r = p.r || 12;
    let danger = false;

    // 1. Evita proiettili
    if (g.Projectiles && g.Projectiles.all) {
      for (const proj of g.Projectiles.all()) {
        if (!proj.friendly && proj.vx !== undefined) {
          const speed2 = proj.vx * proj.vx + proj.vy * proj.vy;
          const dx = p.x - proj.x, dy = p.y - proj.y;
          const t = speed2 > 0 ? Math.max(0, Math.min(0.6, (dx * proj.vx + dy * proj.vy) / speed2)) : 0;
          const cx = proj.x + proj.vx * t - p.x;
          const cy = proj.y + proj.vy * t - p.y;
          if (cx*cx + cy*cy < (r + (proj.r || 6) + 10) ** 2) {
            danger = true;
            const len = Math.hypot(dx, dy) || 1;
            ex += dx / len;
            ey += dy / len;
          }
        }
      }
    }

    // 2. Evita nemici vicini (raggio 150px)
    if (g.EnemyMgr && g.EnemyMgr.all) {
      for (const enemy of g.EnemyMgr.all()) {
        if (enemy && !enemy.dead) {
          const dx = p.x - enemy.x, dy = p.y - enemy.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < 150) {
            danger = true;
            // Più è vicino, più la spinta è forte
            const strength = (150 - dist) / 150;
            ex += (dx / dist) * strength;
            ey += (dy / dist) * strength;
          }
        }
      }
    }

    if (danger) {
      const len = Math.hypot(ex, ey) || 1;
      p.x += (ex / len) * 8;
      p.y += (ey / len) * 8;
    }
  }, 50);
  // fine funzione Hooks Fly & Swarm & Evade

  // =========================================================================
  // HUD: ZOOM, CAMERA, HP BAR, HAZARDS, PLAYER PATCH
  // =========================================================================
  const ZMIN = 0.7, ZMAX = 3;
  const clampZ = v => Math.min(ZMAX, Math.max(ZMIN, v));
  let Cam = null, lastCam = null;

  // inizio funzione applyZoom
  function applyZoom() {
    if (Cam && lastCam) Cam.resize(...lastCam);
    localStorage.setItem('ps_zoom', hudCfg.zoom.toFixed(3));
  }
  // fine funzione applyZoom

  // inizio funzione installCamera
  function installCamera(C) {
    if (C._psHooked) return;
    C._psHooked = true; Cam = C;
    const baseW = C.VIEW_W, baseH = C.MIN_VIEW_H, orig = C.resize;
    C.resize = function (w, h, d) {
      lastCam = [w, h, d];
      this.VIEW_W = baseW * hudCfg.zoom;
      this.MIN_VIEW_H = baseH * hudCfg.zoom;
      return orig.call(this, w, h, d);
    };
    if (C.w) { lastCam = [C.w * C.scale, C.h * C.scale, C.dpr]; applyZoom(); }
  }
  // fine funzione installCamera

  // inizio funzione hookCamera
  function hookCamera() {
    const g = G();
    if (g && g.Camera) { installCamera(g.Camera); return true; }
    if (window.G && window.G.Camera) { installCamera(window.G.Camera); return true; }
    return false;
  }
  // fine funzione hookCamera
  hookCamera();

  const HPBAR = { normal: [1, 1], big: [1.5, 2.3], huge: [2, 3.4] };
  let curEnemy = null;
  const nativeFill = CanvasRenderingContext2D.prototype.fillRect;

  // inizio funzione HP Bar Patch
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    if (curEnemy !== null && h === 3.4) {
      const [kw, kh] = HPBAR[hudCfg.hpbar] || HPBAR.normal;
      if (kw !== 1 || kh !== 1) {
        const e = curEnemy, w0 = e.boss ? 90 : Math.max(22, e.r * 2);
        const nh = h * kh, nw = w * kw, nx = e.x - (w0 * kw) / 2, ny = y - (nh - h) / 2;
        if (/^rgba\(0, 0, 0/.test(this.fillStyle)) {
          const f = this.fillStyle;
          this.fillStyle = 'rgba(0,0,0,.9)'; nativeFill.call(this, nx - 1, ny - 1, nw + 2, nh + 2);
          this.fillStyle = '#2b2d3a'; nativeFill.call(this, nx, ny, nw, nh);
          this.fillStyle = f;
          return;
        }
        return nativeFill.call(this, nx, ny, nw, nh);
      }
    }
    return nativeFill.apply(this, arguments);
  };
  // fine funzione HP Bar Patch

  // inizio funzione patchEnemyClass
  function patchEnemyClass(v) {
    if (v._psHpPatched) return;
    v._psHpPatched = true;
    const orig = v.prototype.draw;
    v.prototype.draw = function (ctx) {
      curEnemy = this;
      try { return orig.call(this, ctx); } finally { curEnemy = null; }
    };
  }
  // fine funzione patchEnemyClass

  // inizio funzione hookEnemy
  (function hookEnemy() {
    const g = G();
    const cand = (g && g.Enemy) || (window.G && window.G.Enemy);
    if (cand && typeof cand === 'function' && cand.prototype && typeof cand.prototype.draw === 'function') {
      patchEnemyClass(cand);
    }
  })();
  // fine funzione hookEnemy

  const hazards = [];

  // inizio funzione wrapHazards
  function wrapHazards(H) {
    if (!H || H._psW) return;
    H._psW = true;
    const orig = H.add;
    H.add = function (h) {
      try { hazards.push({ ...h, t0: (getPlayer() && getPlayer()._psTime) || 0 }); if (hazards.length > 200) hazards.shift(); } catch {}
      return orig.apply(this, arguments);
    };
  }
  // fine funzione wrapHazards

  // inizio funzione hookHazards
  (function hookHazards() {
    const g = G();
    const cand = (g && g.Hazards) || (window.G && window.G.Hazards);
    if (cand && typeof cand.add === 'function') wrapHazards(cand);
  })();
  // fine funzione hookHazards

  const instances = [];
  const isPlayerClass = v => typeof v === 'function' && v.prototype &&
    typeof v.prototype.hurt === 'function' && typeof v.prototype.gainXp === 'function';

  // inizio funzione patchPlayerClass
  function patchPlayerClass(v) {
    if (v._psTimePatched) return;
    v._psTimePatched = true;
    const orig = v.prototype.update;
    v.prototype.update = function (dt) {
      this._psTime = (this._psTime || 0) + dt;
      this._psUpd = performance.now();
      return orig.call(this, dt);
    };
  }
  // fine funzione patchPlayerClass

  // inizio funzione wrapPlayerClass
  function wrapPlayerClass(v) {
    return new Proxy(v, {
      construct(t, a, nt) {
        const o = Reflect.construct(t, a, nt);
        instances.push(o); if (instances.length > 12) instances.shift();
        return o;
      }
    });
  }
  // fine funzione wrapPlayerClass

  // inizio funzione hookPlayer
  (function hookPlayer() {
    const g = G();
    const cand = (g && g.Player) || (window.G && window.G.Player);
    if (cand && isPlayerClass(cand)) {
      patchPlayerClass(cand);
      const wrapped = wrapPlayerClass(cand);
      if (g) g.Player = wrapped;
      if (window.G) window.G.Player = wrapped;
    }
  })();
  // fine funzione hookPlayer

  // inizio funzione isPlayer & findPlayer
  const isPlayer = o => o && typeof o === 'object' && typeof o.hp === 'number' && typeof o.maxHp === 'number' &&
    typeof o.x === 'number' && typeof o.y === 'number' && typeof o.gainXp === 'function';

  function findPlayer() {
    for (let i = instances.length - 1; i >= 0; i--) {
      const p = instances[i];
      if (!p.remote && !p.net) return p;
    }
    return null;
  }
  // fine funzione isPlayer & findPlayer

  // inizio funzione Wheel Event (Zoom / Cycle)
  addEventListener('wheel', e => {
    if (!toggles.hudFov) return;
    const path = e.composedPath();
    const ourPanel = document.getElementById('ps-ultimate-panel');
    if (ourPanel && path.includes(ourPanel)) return;
    let el = e.target;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return;
      el = el.parentElement;
    }
    if (e.shiftKey && toggles.hudShiftWheel) {
      e.preventDefault();
      const d = e.deltaY || e.deltaX;
      const p = findPlayer();
      if (d && isPlayer(p) && !p.dead && p.cycle) p.cycle(d > 0 ? 1 : -1);
      return;
    }
    e.preventDefault();
    hudCfg.zoom = clampZ(hudCfg.zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1));
    applyZoom();
  }, { passive: false });
  // fine funzione Wheel Event (Zoom / Cycle)

  // =========================================================================
  // HUD: OVERLAY DRAW
  // =========================================================================
  const overlay = document.createElement('canvas');
  overlay.id = 'ps-ultimate-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99998';
  document.documentElement.appendChild(overlay);
  const octx = overlay.getContext('2d');

  let gc = null;
  const getGC = () => (gc && gc.isConnected) ? gc :
    (gc = [...document.querySelectorAll('canvas')]
      .filter(c => c !== overlay && c.clientWidth > 300)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || null);

  const fmt = v => typeof v === 'number'
    ? (Number.isFinite(v) ? (Number.isInteger(v) ? v : Math.round(v * 100) / 100).toLocaleString('en-US') : '—')
    : String(v);

  let lastOverlayFrame = 0;

  // inizio funzione drawOverlay
  function drawOverlay() {
    requestAnimationFrame(drawOverlay);
    const now = performance.now();
    if (now - lastOverlayFrame < 1000 / 30) return;
    lastOverlayFrame = now;

    const dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    if (overlay.width !== Math.round(W * dpr) || overlay.height !== Math.round(H * dpr)) {
      overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
    }
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);

    const g = G(), p = findPlayer();
    if (!g || !Cam || !Cam.w || !isPlayer(p)) return;

    const gc2 = getGC(); if (!gc2) return;
    const r = gc2.getBoundingClientRect(); if (r.width < 10) return;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const k = r.width / Cam.w, L = Cam.left() - (Cam._sx || 0), T = Cam.top() - (Cam._sy || 0);
    const X = wx => (wx - L) * k + r.left, Y = wy => (wy - T) * k + r.top;

    if (toggles.hudMagnetCircle && p.magnet) {
      octx.save(); octx.setLineDash([7, 7]); octx.globalAlpha = 0.4; octx.strokeStyle = '#7fe0ff'; octx.lineWidth = 2;
      octx.beginPath(); octx.arc(X(p.x), Y(p.y), p.magnet * k, 0, 6.2832); octx.stroke(); octx.restore();
    }

    if (toggles.hudHaz) {
      const clock = p._psTime || 0;
      for (let i = hazards.length - 1; i >= 0; i--) {
        const h = hazards[i], el = clock - h.t0, delay = h.delay || 1;
        if (el > delay + 0.3 || el < -1) { hazards.splice(i, 1); continue; }
        const col = h.color || '#ff5252', prog = Math.max(0, Math.min(1, el / delay));
        octx.save();
        if (h.kind === 'zone') {
          const x = X(h.x), y = Y(h.y), rr = (h.r || 40) * k;
          octx.beginPath(); octx.arc(x, y, rr, 0, 6.2832);
          octx.globalAlpha = 0.1 + 0.14 * prog; octx.fillStyle = col; octx.fill();
          octx.globalAlpha = 0.95; octx.lineWidth = 3; octx.strokeStyle = '#fff'; octx.stroke();
          octx.beginPath(); octx.arc(x, y, Math.max(1, rr * prog), 0, 6.2832);
          octx.lineWidth = 2.5; octx.strokeStyle = col; octx.stroke();
        } else if (h.kind === 'beam') {
          octx.translate(X(h.x), Y(h.y)); octx.rotate(h.angle || 0);
          const len = (h.len || 300) * k, w = (h.w || 20) * k;
          octx.globalAlpha = 0.1 + 0.16 * prog; octx.fillStyle = col; octx.fillRect(0, -w / 2, len, w);
          octx.globalAlpha = 0.95; octx.lineWidth = 2.5; octx.strokeStyle = '#fff'; octx.strokeRect(0, -w / 2, len, w);
        }
        octx.restore();
      }
    }

    const enemies = (g.EnemyMgr && g.EnemyMgr.all()) || [];
    const grp = p.activeGroup ? p.activeGroup() : [];
    const m0 = r.left + 6, m1 = r.right - 6, n0 = r.top + 6, n1 = r.bottom - 6;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, edge = 24;

    const arrowTo = (wx, wy, col, glyph) => {
      const dx = X(wx) - cx, dy = Y(wy) - cy;
      const t = Math.min((cx - r.left - edge) / Math.abs(dx || 1e-6), (cy - r.top - edge) / Math.abs(dy || 1e-6));
      const x = cx + dx * t, y = cy + dy * t, ang = Math.atan2(dy, dx);
      octx.save(); octx.translate(x, y);
      octx.fillStyle = col; octx.strokeStyle = 'rgba(0,0,0,.7)'; octx.lineWidth = 2;
      octx.beginPath(); octx.arc(0, 0, 11, 0, 6.2832); octx.fill(); octx.stroke();
      octx.rotate(ang); octx.beginPath(); octx.moveTo(20, 0); octx.lineTo(11, -6.5); octx.lineTo(11, 6.5); octx.closePath(); octx.fill(); octx.stroke();
      octx.rotate(-ang);
      octx.fillStyle = '#10151f'; octx.font = '700 12px sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText(glyph, 0, 1); octx.restore();
    };

    for (const e of enemies) {
      if (e.dead) continue;
      const x = X(e.x), y = Y(e.y), on = x > m0 && x < m1 && y > n0 && y < n1;
      if (!on) {
        if (toggles.hudArrows) {
          if (e.boss) arrowTo(e.x, e.y, '#ff5252', 'B');
          else if (e.behavior === 'thief') arrowTo(e.x, e.y, '#ffd23f', '$');
        }
        continue;
      }
      const rx = (e.r || 10) * k;
      if (toggles.hudRing && grp.length && g.Types && e.types) {
        let s = 0; for (const m of grp) s += g.Types.mult(m.type, e.types);
        const mul = s / grp.length;
        if (Math.abs(mul - 1) > 0.01) {
          octx.beginPath(); octx.ellipse(x, y, rx * 1.3, rx * 0.55, 0, 0, 6.2832);
          octx.globalAlpha = 0.85; octx.lineWidth = 2;
          octx.strokeStyle = mul >= 2 ? '#46d37a' : mul > 1 ? '#a6e36a' : mul === 0 ? '#9b59d0' : '#ff6b6b';
          octx.stroke(); octx.globalAlpha = 1;
        }
      }
      if (toggles.hudSupport && (e.behavior === 'healer' || e.behavior === 'shielder' || e.behavior === 'summoner')) {
        octx.save(); octx.setLineDash([5, 4]); octx.lineWidth = 2.5;
        octx.globalAlpha = 0.65 + 0.3 * Math.sin(now / 180);
        octx.strokeStyle = e.behavior === 'healer' ? '#5fe08a' : e.behavior === 'shielder' ? '#7fc8ff' : '#c47bff';
        octx.beginPath(); octx.ellipse(x, y, rx * 1.8, rx * 0.8, 0, 0, 6.2832); octx.stroke(); octx.restore();
      }
    }

    // Item Finder (Radar)
    if (toggles.hudPoi && g.World && typeof g.World.specialsNear === 'function') {
      const currentRange = hudCfg.poiRange || 3500;
      const specials = g.World.specialsNear(p.x, p.y, currentRange) || [];

      const validSpecials = specials.filter(s => {
        if (!s) return false;
        if (s.type === 'bigchest' && !s.used && s.open < 3.5) return true;
        if (s.type === 'altar' && !s.used) return true;
        if (s.type === 'spring' && s.charge >= 0.1) return true;
        return false;
      });

      const limitedSpecials = validSpecials.slice(0, 30);

      for (const s of limitedSpecials) {
        let color = null;
        if (s.type === 'bigchest') { color = '#fbbf24'; }
        else if (s.type === 'altar') { color = '#94a3b8'; }
        else if (s.type === 'spring') { color = '#38bdf8'; }

        if (color) {
          const sx = X(s.x);
          const sy = Y(s.y);
          const onScreen = (sx > m0 && sx < m1 && sy > n0 && sy < n1);

          if (!onScreen) {
            const dx = sx - (r.left + r.width / 2);
            const dy = sy - (r.top + r.height / 2);
            const ang = Math.atan2(dy, dx);
            const edge = 30;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const t = Math.min((cx - r.left - edge) / Math.abs(dx || 1e-6), (cy - r.top - edge) / Math.abs(dy || 1e-6));
            const ex = cx + dx * t;
            const ey = cy + dy * t;

            octx.save();
            octx.translate(ex, ey);
            octx.rotate(ang);
            octx.fillStyle = color;
            octx.strokeStyle = 'rgba(0,0,0,0.8)';
            octx.lineWidth = 1.5;
            octx.beginPath();
            octx.moveTo(14, 0);
            octx.lineTo(-6, -9);
            octx.lineTo(-6, 9);
            octx.closePath();
            octx.fill();
            octx.stroke();
            octx.restore();
          }
        }
      }
    }
  }
  // fine funzione drawOverlay
  requestAnimationFrame(drawOverlay);

  // =========================================================================
  // HUD: PLAYER STATS PANEL
  // =========================================================================
  const hudStats = document.createElement('div');
  hudStats.id = 'ps-hud-stats';
  hudStats.style.cssText = `
    position:fixed;right:10px;top:50%;transform:translateY(-50%);
    width:220px;min-width:170px;min-height:120px;
    background:rgba(10,20,48,.85);backdrop-filter:blur(6px);
    border:1px solid rgba(255,255,255,.14);border-radius:10px;
    box-shadow:0 6px 20px rgba(0,0,0,.45);padding:8px 10px 10px;
    font-family:'Pixelify Sans',ui-monospace,Consolas,monospace;font-size:13px;color:#e8eefc;
    z-index:99997;user-select:none;overflow:auto;resize:both;
  `;
  hudStats.dataset.baseBg = 'rgba(10,20,48,.85)';
  document.documentElement.appendChild(hudStats);

  const hudHead = document.createElement('div');
  hudHead.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    gap:6px;margin:-2px -2px 6px;padding:2px 2px 4px;
    border-bottom:1px solid rgba(255,255,255,.1);
    cursor:pointer;user-select:none;font-size:11px;
    letter-spacing:.08em;text-transform:uppercase;color:#8fb3ff;
  `;
  hudHead.innerHTML = `<span>HUD Stats</span><span id="ps-hud-min" style="font-weight:bold;font-size:14px;">−</span>`;
  hudStats.appendChild(hudHead);

  const hudBody = document.createElement('div');
  hudBody.id = 'ps-hud-body';
  hudStats.appendChild(hudBody);

  // inizio funzione addHudOpacitySlider
  (function addHudOpacitySlider() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';
    wrap.innerHTML = `
      <span style="font-size:10px;color:#9fb0d4;white-space:nowrap">Opacity</span>
      <input type="range" min="0.2" max="1" step="0.05" value="${layout.hud.opacity}"
             style="flex:1;accent-color:#8fb3ff">
      <span style="font-size:10px;color:#9fb0d4;min-width:28px;text-align:right" class="ps-op-val">${Math.round(layout.hud.opacity*100)}%</span>
      <button type="button" class="ps-blur-btn" title="Toggle background blur"
              style="border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:5px;padding:1px 6px;font-size:10px;cursor:pointer;min-width:38px">
        ${layout.hud.blur ? 'Blur' : 'None'}
      </button>
    `;
    hudStats.insertBefore(wrap, hudHead.nextSibling);
    const range = wrap.querySelector('input');
    const val = wrap.querySelector('.ps-op-val');
    const btn = wrap.querySelector('.ps-blur-btn');
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      layout.hud.opacity = v;
      applyOpacity(hudStats, v, layout.hud.blur);
      val.textContent = Math.round(v * 100) + '%';
      saveLayout();
    });
    btn.addEventListener('click', () => {
      layout.hud.blur = !layout.hud.blur;
      btn.textContent = layout.hud.blur ? 'Blur' : 'None';
      applyOpacity(hudStats, layout.hud.opacity, layout.hud.blur);
      saveLayout();
    });
  })();
  // fine funzione addHudOpacitySlider

  // inizio funzione HUD Minimize Logic
  let hudMinimized = false;
  const hudMinBtn = document.getElementById('ps-hud-min');

  if (hudMinBtn) {
    hudMinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const body = document.getElementById('ps-hud-body');
      const slider = hudStats.querySelector('input[type=range]')?.parentElement;

      if (!hudMinimized) {
        layout.hud.height = hudStats.offsetHeight;
        saveLayout();
        body.style.display = 'none';
        if (slider) {
          slider.style.display = 'none';
          slider.style.marginBottom = '0';
        }
        hudStats.style.padding = '0';
        hudStats.style.height = 'auto';
        hudStats.style.minHeight = '0';
        hudHead.style.padding = '8px 10px';
        hudHead.style.marginBottom = '0';
        hudHead.style.borderBottom = 'none';
        hudMinBtn.textContent = '+';
        hudMinimized = true;
      } else {
        body.style.display = 'block';
        if (slider) {
          slider.style.display = 'flex';
          slider.style.marginBottom = '6px';
        }
        hudStats.style.padding = '8px 10px 10px';
        hudStats.style.height = layout.hud.height ? layout.hud.height + 'px' : '';
        hudStats.style.minHeight = '120px';
        hudHead.style.padding = '2px 2px 4px';
        hudHead.style.marginBottom = '6px';
        hudHead.style.borderBottom = '1px solid rgba(255,255,255,.1)';
        hudMinBtn.textContent = '−';
        hudMinimized = false;
      }
    });
  }
  // fine funzione HUD Minimize Logic

  // inizio funzione applyHudLayout
  (function applyHudLayout() {
    const r = clampLayoutRect(
      { left: layout.hud.left, top: layout.hud.top, width: layout.hud.width, height: layout.hud.height },
      170, 120
    );
    if (layout.hud.left !== null && layout.hud.top !== null) {
      hudStats.style.left = r.left + 'px';
      hudStats.style.top = r.top + 'px';
      hudStats.style.right = 'auto';
      hudStats.style.transform = 'none';
    }
    hudStats.style.width = r.width + 'px';
    if (r.height) hudStats.style.height = r.height + 'px';
    applyOpacity(hudStats, layout.hud.opacity, layout.hud.blur);
  })();
  // fine funzione applyHudLayout

  // inizio funzione HUD ResizeObserver
  new ResizeObserver(() => {
    if (hudMinimized) return;
    layout.hud.width = hudStats.offsetWidth;
    layout.hud.height = hudStats.offsetHeight;
    saveLayout();
  }).observe(hudStats);
  // fine funzione HUD ResizeObserver

  // inizio funzione HUD Drag
  let hudDrag = null;
  hudHead.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('input') || e.target.closest('button') || e.target.id === 'ps-hud-min') return;
    hudDrag = {
      x: e.clientX, y: e.clientY,
      ox: hudStats.offsetLeft, oy: hudStats.offsetTop
    };
    hudHead.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!hudDrag) return;
    hudStats.style.left = (hudDrag.ox + e.clientX - hudDrag.x) + 'px';
    hudStats.style.top = (hudDrag.oy + e.clientY - hudDrag.y) + 'px';
    hudStats.style.right = 'auto';
    hudStats.style.transform = 'none';
  });
  window.addEventListener('mouseup', () => {
    if (!hudDrag) return;
    hudDrag = null;
    hudHead.style.cursor = 'pointer';
    layout.hud.left = hudStats.offsetLeft;
    layout.hud.top = hudStats.offsetTop;
    saveLayout();
  });
  // fine funzione HUD Drag

  // inizio funzione renderHudStats & FPS Loop
  function row(icon, label, value, cls = '') {
    return `<div style="display:flex;justify-content:space-between;gap:14px;padding:2px 0">
      <span style="color:#9fb0d4">${icon} ${label}</span>
      <b style="color:${cls || '#fff'};font-variant-numeric:tabular-nums">${value}</b>
    </div>`;
  }

  function renderHudStats() {
    if (!toggles.hudPanel) { hudStats.style.display = 'none'; return; }
    const p = findPlayer();
    if (!isPlayer(p)) { hudStats.style.display = 'none'; return; }
    hudStats.style.display = 'block';
    let h = '';

    if (toggles.hudAtk) {
      let pAtk = Math.round(p.atk || 0);
      let sAtk = pAtk;
      if (typeof p.atkFor === 'function') {
        try {
          pAtk = Math.round(p.atkFor({ cat: 'physical' }) || pAtk);
          sAtk = Math.round(p.atkFor({ cat: 'special' }) || sAtk);
        } catch(e) {}
      } else if (p.mon && p.mon.sa) {
        sAtk = Math.round(p.mon.sa * (p.atkMul || 1));
      }
      h += row('⚔️', 'Atk / SpAtk', `${pAtk} / ${sAtk}`);
    }
    if (toggles.hudCoins) h += row('🪙', 'Coins', p.coins);
    if (toggles.hudCoinMul) h += row('💰', 'Coins mult.', '×' + (p.coinMul || 1).toFixed(2));
    if (toggles.hudCd) h += row('⚡', 'Cooldown', p.cdMul ? (p.cdMul * 100).toFixed(0) + '%' : '100%');
    if (toggles.hudCrit) h += row('🎯', 'Crit', Math.round((p.critChance || 0) * 100) + '%');
    if (toggles.hudRed) h += row('🛡️', 'Defense', Math.round((p.reduction || 0) * 100) + '%');
    if (toggles.hudFov) h += row('🔍', 'FOV', hudCfg.zoom.toFixed(2) + '×');
    if (toggles.hudHp) h += row('❤️', 'HP', `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`);
    if (toggles.hudKills) h += row('💀', 'Kills', p.kills);
    if (toggles.hudMagnet) h += row('🧲', 'Magnet', Math.round(p.magnet || 0));
    if (toggles.hudRegen) h += row('🌿', 'Regen', Math.round(p.regen || 0) + '/s');
    if (toggles.hudSpd) h += row('👟', 'Speed', Math.round(p.spd || 0));
    if (toggles.hudXp) h += row('✨', 'XP Bar', `${Math.floor(p.xp || 0)} / ${p.xpNext || 0}`);
    if (toggles.hudXpMul) h += row('📖', 'XP mult.', '×' + (p.xpMul || 1).toFixed(2));

    const body = document.getElementById('ps-hud-body');
    if (body) body.innerHTML = h;
  }
  setInterval(renderHudStats, 250);
  // fine funzione renderHudStats & FPS Loop

  // inizio funzione Title Update
  let baseTitle = '';
  setInterval(() => {
    if (!/^❤/.test(document.title)) baseTitle = document.title;
    const p = findPlayer();
    if (!isPlayer(p) || performance.now() - (p._psUpd || 0) > 1500) {
      if (/^❤/.test(document.title)) document.title = baseTitle;
      return;
    }
    if (toggles.hudTitle) {
      const t = Math.floor((p._psTime || 0));
      const mm = String(Math.floor(t / 60)).padStart(2, '0');
      const ss = String(t % 60).padStart(2, '0');
      document.title = `❤ ${Math.ceil(p.hp)}/${Math.round(p.maxHp)} · ${mm}:${ss} · ${baseTitle || 'PokéSurvivor'}`;
    } else if (/^❤/.test(document.title)) {
      document.title = baseTitle;
    }
  }, 500);
  // fine funzione Title Update

  // =========================================================================
  // BATCH GACHA
  // =========================================================================
  let gachaRunning = false, gachaStop = false, gachaIssued = 0, gachaTotal = 0;
  let gachaResults = [];
  let gachaStatus = null, gachaProgress = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // inizio funzione gachaCompatible
  function gachaCompatible() {
    const g = G();
    return g && typeof g.Gacha?.pull === 'function' && typeof g.Gacha?.costOf === 'function'
      && typeof g.DB?.commit === 'function' && typeof g.GachaUI?.open === 'function';
  }
  // fine funzione gachaCompatible

  // inizio funzione availableDraws
  function availableDraws() {
    const g = G(); if (!g || !g.DB || !g.DB.save) return 0;
    const t = g.DB.save.tickets || { t1: 0, t10: 0 };
    return (t.t1 || 0) + (t.t10 || 0) * 10;
  }
  // fine funzione availableDraws

  // inizio funzione nativePullOpen
  function nativePullOpen() {
    const g = G(); if (!g || !g.GachaUI) return false;
    const fx = document.getElementById('pull-fx');
    return g.GachaUI.open_ || (fx && !fx.classList.contains('hidden') && getComputedStyle(fx).display !== 'none');
  }
  // fine funzione nativePullOpen

  // inizio funzione gachaRun
  async function gachaRun(count, gen) {
    const g = G();
    const user = g.DB.user;
    const t = g.DB.save.tickets || { t1: 0, t10: 0 };
    if (count % 10 > (t.t1 || 0)) throw new Error('Not enough regular tickets to complete; need a multiple of 10 or draw all.');
    const genButton = document.querySelector(`#gacha-gens button[data-gen="${gen}"]`);
    if (!genButton) throw new Error('Generation button not found.');
    genButton.click();
    while (gachaIssued < count && !gachaStop) {
      if (g.DB.user !== user) throw new Error('Account switched.');
      if (nativePullOpen()) throw new Error('Native pull open; close it first.');
      const screen = document.getElementById('scr-gacha');
      if (!screen || screen.classList.contains('hidden')) throw new Error('Left the gacha page.');
      const remaining = count - gachaIssued;
      const tickets = g.DB.save.tickets || { t1: 0, t10: 0 };
      const currency = remaining >= 10 && (tickets.t10 || 0) > 0 ? 't10' : 't1';
      const n = remaining >= 10 && (currency === 't10' || (tickets.t1 || 0) >= 10) ? 10 : 1;
      const cost = g.Gacha.costOf(g.DB.save, n, currency);
      if (!cost) throw new Error('Tickets insufficient.');
      const results = g.Gacha.pull(g.DB.save, n, gen, currency);
      if (!Array.isArray(results) || results.length !== n) throw new Error('Abnormal draw result.');
      for (const r of results) gachaResults.push(r);
      gachaIssued += n;
      try { g.Progress && g.Progress.checkAch && g.Progress.checkAch(); } catch {}
      g.DB.commit();
      if (g.UI && g.UI.refreshCoins) g.UI.refreshCoins();
      gachaStatus.textContent = `Drawing… ${gachaIssued}/${count}`;
      gachaProgress.textContent = `Drawn ${gachaIssued}/${count}`;
      await sleep(60);
    }
  }
  // fine funzione gachaRun

  // inizio funzione gachaStart
  async function gachaStart() {
    if (gachaRunning) return;
    if (!gachaStatus || !gachaProgress) {
      console.warn('[Ultimate] Gacha UI not built yet');
      return;
    }
    if (!gachaCompatible()) { gachaStatus.textContent = 'Gacha not ready yet.'; return; }
    const countInput = document.getElementById('ps-gacha-count');
    const allChk = document.getElementById('ps-gacha-all');
    const genSel = document.getElementById('ps-gacha-gen');
    const max = availableDraws();
    const count = allChk.checked ? max : Number(countInput.value);
    const gen = Number(genSel.value);
    if (!Number.isSafeInteger(count) || count <= 0) { gachaStatus.textContent = 'Enter a positive integer.'; return; }
    if (count > max) { gachaStatus.textContent = `Not enough tickets (available: ${max}).`; return; }
    gachaRunning = true; gachaStop = false; gachaIssued = 0; gachaTotal = count; gachaResults = [];
    gachaStatus.textContent = 'Drawing…';
    try {
      if (!navigator.locks || !navigator.locks.request) throw new Error('Browser does not support tab locks.');
      await navigator.locks.request('ps-ultimate-gacha', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Another tab is running gacha.');
        await gachaRun(count, gen);
      });
      gachaStatus.textContent = gachaStop ? 'Stopped' : 'Done';
      renderGachaResults();
    } catch (e) {
      gachaStatus.textContent = 'Stopped: ' + (e.message || e);
    } finally {
      gachaRunning = false;
    }
  }
  // fine funzione gachaStart

  // inizio funzione renderGachaResults
  function renderGachaResults() {
    const box = document.getElementById('ps-gacha-results');
    if (!box) return;
    if (!gachaResults.length) { box.innerHTML = ''; return; }
    const newCount = gachaResults.filter(r => r.isNew).length;
    const shinyCount = gachaResults.filter(r => r.shiny).length;
    box.innerHTML = `
      <div style="margin:8px 0 4px;color:#b7c6e4;font-size:11px">
        ${gachaResults.length} draws · New: ${newCount} · Shiny: ${shinyCount}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px;max-height:240px;overflow:auto">
        ${gachaResults.slice(0, 200).map(r => `
          <div style="padding:4px;background:#1c2c49;border:1px solid ${r.shiny ? '#9ae6ff' : '#7189b5'};border-radius:6px;text-align:center;font-size:11px">
            <div>#${r.dex}</div>
            <div style="color:${r.isNew ? '#ffdf73' : '#b7c6e4'}">${r.isNew ? 'NEW' : 'dup'}</div>
            ${r.shiny ? '<div style="color:#9ae6ff">✦</div>' : ''}
          </div>
        `).join('')}
        ${gachaResults.length > 200 ? `<div style="grid-column:1/-1;text-align:center;color:#b7c6e4;font-size:11px">…and ${gachaResults.length - 200} more</div>` : ''}
      </div>
    `;
  }
  // fine funzione renderGachaResults

  // =========================================================================
  // UI: MAIN PANEL
  // =========================================================================

  // inizio funzione buildPanel
  function buildPanel() {
    if (document.getElementById('ps-ultimate-panel')) return;

    const style = document.createElement('style');
    style.textContent = `
      #ps-ultimate-panel {
        position: fixed; top: 16px; right: 16px; width: 420px;
        background: rgba(10, 15, 29, 0.96);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 12px;
        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.85);
        font-family: 'Pixelify Sans', 'Segoe UI', system-ui, sans-serif;
        color: #f8fafc; z-index: 9999999; font-size: 12px; user-select: none;
      }
      #ps-ultimate-panel .ps-head {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; background: rgba(10, 20, 48, 0.5);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 11px 11px 0 0; cursor: grab; font-weight: 700; color: #8fb3ff;
        letter-spacing: .08em; text-transform: uppercase; font-size: 11px;
      }
      #ps-ultimate-panel .ps-tabs {
        display: flex; border-bottom: 1px solid rgba(255,255,255,.1);
      }
      #ps-ultimate-panel .ps-tabs button {
        flex: 1; padding: 8px 0; background: none; border: 0;
        border-bottom: 2px solid transparent; color: #94a3b8;
        font: inherit; font-size: 12px; cursor: pointer;
      }
      #ps-ultimate-panel .ps-tabs button:hover { color: #fff; background: rgba(255,255,255,.05); }
      #ps-ultimate-panel .ps-tabs button.on { color: #ffcb3d; border-bottom-color: #ffcb3d; }
      #ps-ultimate-panel {
        display: flex;
        flex-direction: column;
      }
      #ps-ultimate-panel .ps-body {
        padding: 10px 12px;
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
      }
      #ps-ultimate-panel .ps-tabs {
        flex: 0 0 auto;
      }
      #ps-ultimate-panel .ps-head {
        flex: 0 0 auto;
      }
      #ps-ultimate-panel .ps-pane { display: none; }
      #ps-ultimate-panel .ps-pane.on { display: block; }

      /* SEZIONI COMPRIMIBILI */
      #ps-ultimate-panel .pt-section { margin-bottom: 11px; }
      #ps-ultimate-panel .pt-title {
        font-size: 10px; text-transform: uppercase; color: #94a3b8;
        margin-bottom: 5px; font-weight: 700;
        border-left: 3px solid #ffcb3d; padding-left: 5px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #ps-ultimate-panel .pt-title::after { content: '−'; font-size: 14px; }
      #ps-ultimate-panel .pt-section.collapsed .pt-title::after { content: '+'; }
      #ps-ultimate-panel .pt-section.collapsed > *:not(.pt-title) { display: none !important; }

      #ps-ultimate-panel .pt-grid {
        display: grid; gap: 5px;
      }
      #ps-ultimate-panel .ps-pane[data-pane="trainer"] .pt-grid {
        grid-template-columns: 1fr 1fr 1fr;
      }
      #ps-ultimate-panel .ps-pane:not([data-pane="trainer"]) .pt-grid {
        grid-template-columns: 1fr 1fr;
      }
      #ps-ultimate-panel .pt-btn, #ps-ultimate-panel .pt-toggle-btn {
        background: #1e293b; color: #e2e8f0; border: 1px solid #334155;
        border-radius: 6px; padding: 5px 4px; font-size: 11px;
        font-weight: 600; cursor: pointer; text-align: center;
        transition: all 0.15s ease;
        display: flex; justify-content: center; align-items: center;
        position: relative;
      }
      #ps-ultimate-panel .pt-btn:hover {
        background: #334155; border-color: #ffcb3d; color: #ffcb3d;
      }
      #ps-ultimate-panel .pt-toggle-btn {
        font-size: 10.5px;
        padding-left: 6px; padding-right: 6px;
      }
      #ps-ultimate-panel .pt-toggle-btn.on {
        background: #14532d; border-color: #22c55e; color: #86efac;
      }

      #ps-ultimate-panel .dot {
        display: none !important;
      }

      #ps-ultimate-panel .pt-gold { border-color: #eab308; color: #facc15; }
      #ps-ultimate-panel .pt-purple { border-color: #c084fc; color: #e9d5ff; }
      #ps-ultimate-panel .pt-blue { border-color: #38bdf8; color: #38bdf8; }

      #ps-ultimate-panel .ps-pane[data-pane="trainer"] .pt-full { grid-column: span 3; }
      #ps-ultimate-panel .ps-pane:not([data-pane="trainer"]) .pt-full { grid-column: span 2; }
      #ps-ultimate-panel .pt-three-col { grid-template-columns: 1fr 1fr 1fr; }
      #ps-ultimate-panel .pt-two-col { grid-template-columns: 1fr 1fr; }

      #ps-ultimate-panel .pt-input, #ps-ultimate-panel select {
        background: #0f172a; border: 1px solid #334155; border-radius: 6px;
        color: #fff; padding: 5px 8px; font-size: 11px; width: 100%;
        box-sizing: border-box; margin-bottom: 4px;
      }
      #ps-ultimate-panel .pt-input:focus { border-color: #ffcb3d; outline: none; }

      #ps-ultimate-panel .pt-check-grid {
        display: grid; gap: 0px 4px;
      }
      #ps-ultimate-panel .ps-pane[data-pane="trainer"] .pt-check-grid {
        grid-template-columns: 1fr 1fr 1fr;
      }
      #ps-ultimate-panel .ps-pane:not([data-pane="trainer"]) .pt-check-grid {
        grid-template-columns: 1fr 1fr;
      }
      #ps-ultimate-panel label.pt-check {
        display: flex; align-items: center; gap: 6px;
        padding: 0px 2px; cursor: pointer; color: #cbd5e1; font-size: 11px;
      }
      #ps-ultimate-panel label.pt-check:hover { background: rgba(255,255,255,.05); border-radius: 4px; }
      #ps-ultimate-panel input[type=checkbox] { accent-color: #ffcb3d; }

      #ps-ultimate-panel #pt-toast {
        margin-top: 6px; font-size: 11px; text-align: center;
        color: #38bdf8; min-height: 14px;
      }
      #ps-ultimate-panel .ps-min {
        cursor: pointer; font-weight: bold; padding: 0 4px;
      }
      #ps-ultimate-panel .ps-note {
        font-size: 10px; color: #94a3b8; margin: 4px 0;
      }

      /* PRIORITY LIST */
      #ps-ultimate-panel .ps-prio-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.05);
        border-radius: 4px;
        cursor: grab;
        user-select: none;
        transition: background 0.1s;
      }
      #ps-ultimate-panel .ps-prio-row:active {
        cursor: grabbing;
      }
      #ps-ultimate-panel .ps-prio-row.drag-over {
        border-color: #ffcb3d;
        background: rgba(255,203,61,.1);
      }
      #ps-ultimate-panel .ps-prio-icon {
        font-size: 14px;
        width: 18px;
        text-align: center;
      }
      #ps-ultimate-panel .ps-prio-label {
        flex: 1;
        font-size: 11px;
        color: #e2e8f0;
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'ps-ultimate-panel';

    panel.innerHTML = `
      <div class="ps-head" id="ps-ultimate-head">
        <span>Ultimate Trainer v2.6.3/span>
        <div>
          <span class="ps-min" id="ps-ultimate-min">−</span>
        </div>
      </div>
      <div class="ps-tabs">
        <button data-tab="trainer" class="on">Trainer</button>
        <button data-tab="gacha">Progression</button>
        <button data-tab="hud">HUD</button>
      </div>
      <div class="ps-body" id="ps-ultimate-body">

        <div class="ps-pane on" data-pane="trainer">

          <div class="pt-section">
            <div class="pt-title">Stat Sliders (In-Run)</div>
            <div class="pt-grid">
              <button class="pt-toggle-btn" id="tog-strength" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="strength-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>⚔️ Attack
              </button>
              <button class="pt-toggle-btn" id="tog-fortune" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="fortune-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>🪙 Coins
              </button>
              <button class="pt-toggle-btn" id="tog-reflexes" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="reflexes-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>⚡ Cooldown
              </button>
              <button class="pt-toggle-btn" id="tog-critical" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="critical-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>🎯 Crit
              </button>
              <button class="pt-toggle-btn" id="tog-armor" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="armor-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>🛡️ Defense
              </button>
              <button class="pt-toggle-btn" id="tog-vitality" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="vitality-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>❤️ HP
              </button>
              <button class="pt-toggle-btn" id="tog-automagnet" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="magnet-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>🧲 Magnet
              </button>
              <button class="pt-toggle-btn" id="tog-synthesis" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="synthesis-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>🌿 Regen
              </button>
              <button class="pt-toggle-btn" id="tog-stride" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="stride-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>👟 Speed
              </button>
              <button class="pt-toggle-btn" id="tog-wisdom" style="position: relative; overflow: hidden; z-index: 1;">
                <div id="wisdom-bg" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: rgba(34, 197, 94, 0.4); z-index: -1; transition: width 0.1s;"></div>📖 XP
              </button>
              <button class="pt-toggle-btn pt-gold pt-full" id="tog-godmode" title="Keyboard shortcut: G">👑 GODMODE (G) 👑</button>
            </div>
          </div>

          <div class="pt-section">
            <div class="pt-title">Run Utilities</div>
            <div class="pt-grid">
              <button class="pt-btn" id="btn-reroll">🔄 +10 Reroll</button>
              <button class="pt-btn pt-gold" id="btn-bomb" title="Keyboard shortcut: B">💣 Bomb (B)</button>
              <button class="pt-toggle-btn" id="tog-autoRift">🌀 Rift</button>
              <button class="pt-toggle-btn" id="tog-instantChest">📦 Insta-Chest</button>
              <button class="pt-toggle-btn" id="tog-fly">🕊️ Fly</button>
              <button class="pt-toggle-btn" id="tog-autoEvade">🏃 Evade</button>
              <button class="pt-toggle-btn" id="tog-autoSwarm">🦟 Swarm</button>
              <button class="pt-btn" id="btn-lvlup">⬆️ Level Up</button>
            </div>
          </div>

          <div class="pt-section">
            <div class="pt-title">Auto Level-Up</div>
            <div class="pt-grid pt-two-col" style="margin-bottom: 8px;">
              <button class="pt-toggle-btn" id="tog-autolevel">⚡ Stats</button>
              <button class="pt-toggle-btn" id="tog-autolevel-all">🔥 Always</button>
            </div>
            <details style="margin-bottom: 16px;">
              <summary style="cursor: pointer; font-size: 10px; color: #94a3b8; display: flex; justify-content: center; align-items: center; outline: none; user-select: none; padding: 4px 0; position: relative;">
                <span>⚙️ Configure Priority Order</span>
                <span id="btn-reset-priority" style="position: absolute; right: 0; cursor: pointer; color: #38bdf8; font-weight: bold;" title="Reset to default">↺ Reset</span>
              </summary>
              <div id="ps-priority-list" style="display: flex; flex-direction: column; gap: 4px; padding: 4px; margin-top: 4px; background: rgba(0,0,0,0.2); border-radius: 6px; max-height: 150px; overflow-y: auto;"></div>
            </details>
          </div>

          <div class="pt-section">
            <div class="pt-title">Abilities</div>
            <select id="ps-ability-select" class="pt-input" style="margin-bottom: 6px;"></select>
            <div class="pt-grid pt-two-col" style="margin-bottom: 6px;">
              <button class="pt-btn" id="btn-ability-plus">Level +1</button>
              <button class="pt-btn" id="btn-ability-max">Max Level</button>
            </div>
            <div class="pt-grid">
              <select id="ps-ability-change-select" class="pt-input" style="margin-bottom: 0;"></select>
              <button class="pt-btn pt-blue" id="btn-ability-change">Change</button>
            </div>
          </div>

          <div id="pt-toast"></div>
        </div>

        <div class="ps-pane" data-pane="gacha">

          <!-- Currencies -->
          <div class="pt-section">
            <div class="pt-title">Currencies</div>
            <div class="pt-grid">
              <input type="number" id="ps-currency-amount" class="pt-input" step="1" value="5000"
                    placeholder="Amount (e.g. 5000 or -5000)"
                    title="Enter a positive number to ADD, or a negative number to REMOVE. Then click Coins or a Ticket button."
                    style="grid-column: span 2; margin-bottom: 6px;">
              <div style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;">
                <button class="pt-btn pt-gold" id="btn-coins-apply"
                        title="Add the amount of coins in the field. Use a negative value to REMOVE coins instead.">🪙 Coins</button>
                <button class="pt-btn pt-gold" id="btn-t1-apply"
                        title="Add the amount of GOLD (×1) tickets in the field. Use a negative value to REMOVE them instead.">🎟️ Gold</button>
                <button class="pt-btn pt-purple" id="btn-purp-apply"
                        title="Add the amount of PURPLE (×10) tickets in the field. Use a negative value to REMOVE them instead.">🎟️ Purple</button>
              </div>
            </div>
          </div>

          <!-- Pokédex & Gacha -->
          <div class="pt-section">
            <div class="pt-title">Pokédex & Gacha</div>
            <div class="pt-grid">
              <input type="text" id="pt-mon-input" class="pt-input" placeholder="Dex # or Name"
                    style="grid-column: span 2; margin-bottom: 6px;">
              <div style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 6px;">
                <button class="pt-btn" id="btn-unlock-normal"
                        title="Unlock this Pokémon's NORMAL form in your Pokédex.">Unlock Normal</button>
                <button class="pt-btn pt-gold" id="btn-unlock-shiny"
                        title="Unlock this Pokémon's SHINY form in your Pokédex.">Unlock Shiny</button>
                <button class="pt-btn" id="btn-lock-normal"
                        title="Remove this Pokémon's NORMAL form from your Pokédex."
                        style="border-color:#ef4444; color:#fca5a5;">Lock Normal</button>
                <button class="pt-btn" id="btn-lock-shiny"
                        title="Remove this Pokémon's SHINY form from your Pokédex."
                        style="border-color:#ef4444; color:#fca5a5;">Lock Shiny</button>
              </div>
              <button class="pt-toggle-btn pt-full" style="margin-bottom: 6px;" id="tog-shinygacha">✨ 100% Shiny Rate</button>
              <button class="pt-btn pt-blue" id="btn-unlock-all"
                      title="Unlock every Pokémon in your Pokédex, both normal and shiny.">🌟 Unlock All</button>
              <button class="pt-btn" id="btn-lock-all"
                      title="Remove EVERY normal and shiny entry from your Pokédex. Asks for confirmation."
                      style="border-color:#ef4444; color:#fca5a5;">🔒 Lock All</button>
            </div>
          </div>

          <!-- Batch Gacha -->
          <div class="pt-section">
            <div class="pt-title">Batch Gacha</div>
            <label class="pt-check" style="margin-bottom:6px">
              <input type="checkbox" id="ps-gacha-all"> Draw all tickets
            </label>
            <input type="number" id="ps-gacha-count" class="pt-input" min="1" max="100000" value="10">
            <select id="ps-gacha-gen" class="pt-input">
              <option value="1">Gen 1</option>
              <option value="2">Gen 2</option>
              <option value="3">Gen 3</option>
              <option value="4">Gen 4</option>
              <option value="5">Gen 5</option>
              <option value="6">Gen 6</option>
              <option value="7">Gen 7</option>
              <option value="8">Gen 8</option>
              <option value="9">Gen 9</option>
            </select>
            <div class="pt-grid">
              <button class="pt-btn" id="ps-gacha-start">▶ Start</button>
              <button class="pt-btn" id="ps-gacha-stop">■ Stop</button>
            </div>
            <div class="ps-note" id="ps-gacha-status">Ready</div>
            <div class="ps-note" id="ps-gacha-progress">Not started</div>
            <div id="ps-gacha-results"></div>
          </div>

          <!-- Ban / Veto Limit -->
          <div class="pt-section">
            <div class="pt-title">Ban / Veto Limit</div>
            <div class="pt-grid">
              <input type="number" id="ps-ban-limit" class="pt-input" min="1" max="20" value="10"
                     title="Set the maximum number of moves you can ban. Then click Apply."
                     style="grid-column: span 2; margin-bottom: 6px;">
              <button class="pt-btn pt-full" id="btn-apply-ban-limit"
                      title="Apply the limit to the game. Required before you can ban more than 3 moves.">Apply Limit</button>
              <button class="pt-btn pt-gold" id="btn-max-ban-lv"
                      title="Set the current Pokémon's Ban level to the max limit.">Max Lv (Selected)</button>
              <button class="pt-btn pt-gold" id="btn-max-ban-all"
                      title="Set EVERY Pokémon's Ban level to the max limit.">Max Lv (All)</button>
            </div>
          </div>
        </div> <!-- <--- ORA CHIUDE CORRETTAMENTE IL TAB PROGRESSION -->

        <div class="ps-pane" data-pane="hud">

          <div class="pt-section">
            <div class="pt-title">Panel Statistics</div>
            <div class="pt-check-grid">
              <label class="pt-check" title="Show or hide the entire HUD stats panel on the right."><input type="checkbox" id="hud-panel" checked> 🟢 Stats panel</label>
              <label class="pt-check" title="Show your current physical and special attack damage."><input type="checkbox" id="hud-atk" checked> ⚔️ Atk / SpAtk</label>
              <label class="pt-check" title="Show the amount of coins collected in the current run."><input type="checkbox" id="hud-coins" checked> 🪙 Coins</label>
              <label class="pt-check" title="Show your current coin gain multiplier."><input type="checkbox" id="hud-coinmul" checked> 💰 Coins mult.</label>
              <label class="pt-check" title="Show your attack cooldown multiplier. Lower is better."><input type="checkbox" id="hud-cd" checked> ⚡ Cooldown</label>
              <label class="pt-check" title="Show your chance to land a critical hit."><input type="checkbox" id="hud-crit" checked> 🎯 Crit</label>
              <label class="pt-check" title="Show your damage reduction percentage from armor."><input type="checkbox" id="hud-red" checked> 🛡️ Defense</label>
              <label class="pt-check" title="Show the current camera zoom level (Field of View)."><input type="checkbox" id="hud-fov" checked> 🔍 FOV</label>
              <label class="pt-check" title="Show current and maximum health points."><input type="checkbox" id="hud-hp" checked> ❤️ HP</label>
              <label class="pt-check" title="Show the number of enemies defeated in the current run."><input type="checkbox" id="hud-kills" checked> 💀 Kills</label>
              <label class="pt-check" title="Show your current loot magnet radius."><input type="checkbox" id="hud-magnet-stat" checked> 🧲 Magnet</label>
              <label class="pt-check" title="Show how much HP you regenerate per second."><input type="checkbox" id="hud-regen" checked> 🌿 Regen</label>
              <label class="pt-check" title="Show your movement speed."><input type="checkbox" id="hud-spd" checked> 👟 Speed</label>
              <label class="pt-check" title="Show current and required experience for the next level."><input type="checkbox" id="hud-xp" checked> ✨ XP Bar</label>
              <label class="pt-check" title="Show your current experience gain multiplier."><input type="checkbox" id="hud-xpmul" checked> 📖 XP mult.</label>
            </div>
          </div>

          <div class="pt-section">
            <div class="pt-title">World Overlay</div>
            <div class="pt-check-grid">
              <div style="grid-column: span 2; display: flex; align-items: center; gap: 8px; padding: 2px 0; margin-bottom: 4px;">
                <label class="pt-check" title="Show markers for chests (yellow), altars (gray), and springs (light blue)." style="flex: 0 0 auto; margin: 0;">
                  <input type="checkbox" id="hud-poi" checked> Item Finder
                </label>
                <input type="range" id="hud-poi-range" min="1000" max="5000" step="500" value="${hudCfg.poiRange || 2000}" style="flex: 1; accent-color: #ffcb3d; margin: 0;">
                <span id="hud-poi-range-val" style="font-size: 10px; color: #94a3b8; min-width: 32px; text-align: right;">${hudCfg.poiRange || 2000}</span>
              </div>

              <label class="pt-check" title="Draw a ring under enemies showing if your attack type is effective against them."><input type="checkbox" id="hud-ring" checked> Type rings</label>
              <label class="pt-check" title="Highlight healer, shielder, and summoner enemies with a dashed circle."><input type="checkbox" id="hud-support" checked> Support hints</label>
              <label class="pt-check" title="Draw visual warnings on the ground for enemy area-of-effect attacks."><input type="checkbox" id="hud-haz" checked> Warnings</label>
              <label class="pt-check" title="Draw a circle around the player showing the loot magnet radius."><input type="checkbox" id="hud-magnetCircle"> Magnet circle</label>
              <label class="pt-check" title="Draw arrows pointing towards off-screen bosses and thieves."><input type="checkbox" id="hud-arrows" checked> Boss arrows</label>
              <label class="pt-check" title="Play a sound and show a banner when a shiny, thief, or rift appears."><input type="checkbox" id="hud-alerts" checked> Alerts</label>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // inizio funzione sezioni comprimibili
    panel.querySelectorAll('.pt-title').forEach(title => {
      title.addEventListener('click', () => {
        title.parentElement.classList.toggle('collapsed');
      });
    });
    // fine funzione sezioni comprimibili

    // inizio funzione Panel Layout & Resize
    panel.style.resize = 'both';
    panel.style.overflow = 'hidden';
    panel.style.minWidth = '240px';
    panel.style.minHeight = '200px';

    (function applyPanelLayout() {
      const r = clampLayoutRect(
        { left: layout.panel.left, top: layout.panel.top, width: layout.panel.width, height: layout.panel.height },
        240, 200
      );
      if (layout.panel.left !== null && layout.panel.top !== null) {
        panel.style.left = r.left + 'px';
        panel.style.top = r.top + 'px';
        panel.style.right = 'auto';
      }
      panel.style.width = r.width + 'px';
      if (r.height && r.height > 100) {
        panel.style.height = r.height + 'px';
      }
      panel.dataset.baseBg = 'rgba(10, 15, 29, 0.96)';
      applyOpacity(panel, layout.panel.opacity, layout.panel.blur);
    })();

    let panelMinimized = false;

    const panelObserver = new ResizeObserver(() => {
      if (panelMinimized) return;
      layout.panel.width = panel.offsetWidth;
      layout.panel.height = panel.offsetHeight;
      saveLayout();
    });
    panelObserver.observe(panel);

    document.getElementById('ps-ultimate-min').addEventListener('click', () => {
      const body = document.getElementById('ps-ultimate-body');
      const tabs = panel.querySelector('.ps-tabs');

      if (!panelMinimized) {
        layout.panel.height = panel.offsetHeight;
        saveLayout();
        tabs.style.display = 'none';
        body.style.display = 'none';
        panel.style.height = 'auto';
        panel.style.minHeight = '0';
        panelMinimized = true;
        document.getElementById('ps-ultimate-min').textContent = '+';
      } else {
        tabs.style.display = 'flex';
        body.style.display = 'block';
        panel.style.height = layout.panel.height ? layout.panel.height + 'px' : '';
        panel.style.minHeight = '200px';
        panelMinimized = false;
        document.getElementById('ps-ultimate-min').textContent = '−';
      }
    });

    const savePanelPosition = () => {
      layout.panel.left = panel.offsetLeft;
      layout.panel.top = panel.offsetTop;
      saveLayout();
    };
    window.addEventListener('mouseup', savePanelPosition);
    // fine funzione Panel Layout & Resize

    // inizio funzione addOpacitySlider (Panel)
    (function addOpacitySlider() {
      const body = document.getElementById('ps-ultimate-body');
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)';
      wrap.innerHTML = `
        <span style="font-size:10px;color:#94a3b8;white-space:nowrap">Opacity</span>
        <input type="range" min="0.2" max="1" step="0.05" value="${layout.panel.opacity}"
               style="flex:1;accent-color:#ffcb3d">
        <span style="font-size:10px;color:#94a3b8;min-width:28px;text-align:right" class="ps-op-val">${Math.round(layout.panel.opacity*100)}%</span>
        <button type="button" class="ps-blur-btn" title="Toggle background blur"
                style="border:1px solid #334155;background:#1e293b;color:#cbd5e1;border-radius:5px;padding:1px 6px;font-size:10px;cursor:pointer;min-width:38px">
          ${layout.panel.blur ? 'Blur' : 'None'}
        </button>
      `;
      body.insertBefore(wrap, body.firstChild);
      const range = wrap.querySelector('input');
      const val = wrap.querySelector('.ps-op-val');
      const btn = wrap.querySelector('.ps-blur-btn');
      range.addEventListener('input', () => {
        const v = parseFloat(range.value);
        layout.panel.opacity = v;
        applyOpacity(panel, v, layout.panel.blur);
        val.textContent = Math.round(v * 100) + '%';
        saveLayout();
      });
      btn.addEventListener('click', () => {
        layout.panel.blur = !layout.panel.blur;
        btn.textContent = layout.panel.blur ? 'Blur' : 'None';
        applyOpacity(panel, layout.panel.opacity, layout.panel.blur);
        saveLayout();
      });
    })();
    // fine funzione addOpacitySlider (Panel)

    // inizio funzione showToast
    let toastTimer = null;
    function showToast(msg) {
      const t = document.getElementById('pt-toast');
      if (!t) return;
      t.textContent = msg;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.textContent = '', 2600);
    }
    // fine funzione showToast

    // inizio funzione Panel Drag
    const head = document.getElementById('ps-ultimate-head');
    let drag = null;
    head.addEventListener('mousedown', e => {
      if (e.target.closest('span') && e.target.id !== 'ps-ultimate-head') return;
      drag = { x: e.clientX, y: e.clientY, ox: panel.offsetLeft, oy: panel.offsetTop };
      head.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      panel.style.left = (drag.ox + e.clientX - drag.x) + 'px';
      panel.style.top = (drag.oy + e.clientY - drag.y) + 'px';
      panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { drag = null; head.style.cursor = 'grab'; });
    // fine funzione Panel Drag

    // inizio funzione Tab Switching
    panel.querySelectorAll('.ps-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        panel.querySelectorAll('.ps-tabs button').forEach(b => b.classList.toggle('on', b === btn));
        panel.querySelectorAll('.ps-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
      });
    });
    // fine funzione Tab Switching

    // inizio funzione bindToggle
    function bindToggle(elId, key, label, tooltip, onEnable, onDisable) {
      const btn = document.getElementById(elId);
      if (!btn) return;
      if (tooltip) btn.title = tooltip;
      if (toggles[key]) btn.classList.add('on');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggles[key] = !toggles[key];
        btn.classList.toggle('on', toggles[key]);
        saveToggles();

        if (toggles[key]) {
          if (onEnable) onEnable();
          showToast(`[ON] ${label}`);
        } else {
          if (onDisable) onDisable();
          showToast(`[OFF] ${label}`);
        }
      });
    }
    // fine funzione bindToggle

    // inizio funzione Bind Stat Sliders
    const statSliders = [
      { id: 'tog-vitality', bg: 'vitality-bg', key: 'vitality', label: 'HP' },
      { id: 'tog-strength', bg: 'strength-bg', key: 'strength', label: 'Attack' },
      { id: 'tog-stride', bg: 'stride-bg', key: 'stride', label: 'Speed' },
      { id: 'tog-reflexes', bg: 'reflexes-bg', key: 'reflexes', label: 'Cooldown' },
      { id: 'tog-armor', bg: 'armor-bg', key: 'armor', label: 'Defense' },
      { id: 'tog-synthesis', bg: 'synthesis-bg', key: 'synthesis', label: 'Regen' },
      { id: 'tog-wisdom', bg: 'wisdom-bg', key: 'wisdom', label: 'XP' },
      { id: 'tog-fortune', bg: 'fortune-bg', key: 'fortune', label: 'Coins' },
      { id: 'tog-critical', bg: 'critical-bg', key: 'critical', label: 'Crit' },
      { id: 'tog-automagnet', bg: 'magnet-bg', key: 'magnet', label: 'Magnet' }
    ];

    statSliders.forEach(({ id, bg, key, label }) => {
      const btn = document.getElementById(id);
      const bgEl = document.getElementById(bg);
      if (!btn || !bgEl) return;

      if (toggles[key + 'Slider'] === undefined) toggles[key + 'Slider'] = 0;
      if (toggles[key + 'Slider'] > 0) btn.classList.add('on');
      bgEl.style.width = `${toggles[key + 'Slider']}%`;

      let isDragging = false;

      const update = (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));

        toggles[key + 'Slider'] = pct;
        bgEl.style.width = `${pct}%`;

        if (pct > 0) {
          toggles[key] = true;
          btn.classList.add('on');
        } else {
          toggles[key] = false;
          btn.classList.remove('on');
        }
        saveToggles();
      };

      btn.addEventListener('mousedown', (e) => {
        isDragging = true;
        update(e);
        e.preventDefault();
        e.stopPropagation();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        update(e);
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          if (toggles[key + 'Slider'] === 0) {
            toggles[key] = false;
            btn.classList.remove('on');
            saveToggles();
          }
        }
      });
    });
    // fine funzione Bind Stat Sliders

    // inizio funzione Godmode Toggle
    bindToggle('tog-godmode', 'godmode', '👑 GODMODE 👑', 'Activates ALL stat toggles and infinite HP.',
      () => {
        statSliders.forEach(({ id, bg, key }) => {
          const btn = document.getElementById(id);
          const bgEl = document.getElementById(bg);
          if (!btn || !bgEl) return;
          toggles[key + 'Slider'] = 100;
          toggles[key] = true;
          btn.classList.add('on');
          bgEl.style.width = '100%';
        });
        saveToggles();
      },
      () => {
        // Quando disattivi il Godmode, mettiamo semplicemente tutti gli slider a 0.
        // Ci penserà lo Stat Loop a rimuovere i bonus in eccesso e ripristinare i valori,
        // preservando i potenziamenti del level up!
        statSliders.forEach(({ id, bg, key }) => {
          const btn = document.getElementById(id);
          const bgEl = document.getElementById(bg);
          if (!btn || !bgEl) return;
          toggles[key + 'Slider'] = 0;
          toggles[key] = false;
          btn.classList.remove('on');
          bgEl.style.width = '0%';
        });
        saveToggles();
      }
    );
    // fine funzione Godmode Toggle

    // inizio funzione Bind Other Toggles & Buttons (Run Utilities)
    bindToggle('tog-fly', 'fly', '🕊️ Fly', 'Walk through walls and ignore lava/water.', null, null);
    bindToggle('tog-autoEvade', 'autoEvade', '🏃 Evade', 'Automatically dodges enemy projectiles and enemies.', null, null);
    bindToggle('tog-autoSwarm', 'autoSwarm', '🦟 Swarm', 'Spawns extra enemies around you.', null, null);

    document.getElementById('btn-reroll').onclick = (e) => {
      e.stopPropagation();
      const p = getPlayer();
      if (p) {
        p.rerollBonus = (p.rerollBonus || 0) + 10;
        showToast('+10 Rerolls');
      } else {
        showToast('⚠️ Available only inside runs');
      }
    };

    document.getElementById('btn-bomb').onclick = (e) => {
      e.stopPropagation();
      const g = G(), p = getPlayer();
      if (!p || p.dead || !g || !g.Game || g.Game.state !== 'playing' || !g.EnemyMgr) {
        showToast('⚠️ Available only inside runs');
        return;
      }
      const damage = 60 + 14 * (Number(p.level) || 1);
      const radius = g.Camera && typeof g.Camera.outerRadius === 'function' ? g.Camera.outerRadius() : 520;

      if (g.Camera && typeof g.Camera.kick === 'function') g.Camera.kick(0.8);
      if (g.FX && typeof g.FX.ring === 'function') g.FX.ring(p.x, p.y, 20, radius, '#ff7b3d', 0.5, 6);
      if (g.Audio && typeof g.Audio.sfx === 'function') g.Audio.sfx('break');

      for (const enemy of g.EnemyMgr.all()) {
        if (!enemy || enemy.dead || typeof enemy.hurt !== 'function') continue;
        const dx = enemy.x - p.x, dy = enemy.y - p.y;
        if (dx*dx + dy*dy <= radius*radius) {
          enemy.hurt(99999, '#ff7b3d', dx, dy, 160);
        }
      }
      showToast('💣 Bomb detonated!');
    };
    // fine funzione Bind Other Toggles & Buttons

    // inizio funzione Keybinds
    window.addEventListener('keydown', (e) => {
      // 1. Ignora se stai scrivendo in un input, textarea o se il tasto è un modificatore
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      // 2. Tasto B per la Bomba
      if (key === 'b') {
        const bombBtn = document.getElementById('btn-bomb');
        if (bombBtn) bombBtn.click(); // Simula il click sul pulsante
      }

      // 3. Tasto G per il Godmode
      if (key === 'g') {
        const godBtn = document.getElementById('tog-godmode');
        if (godBtn) godBtn.click(); // Simula il click sul pulsante
      }
    });
    // fine funzione Keybinds

    // inizio funzione Bind Currency Buttons
    const currencyInput = document.getElementById('ps-currency-amount');
    const coinsApplyBtn = document.getElementById('btn-coins-apply');
    const t1ApplyBtn = document.getElementById('btn-t1-apply');
    const purpApplyBtn = document.getElementById('btn-purp-apply');
    const readCurrencyAmount = () => {
      const n = parseInt(currencyInput?.value, 10);
      if (!Number.isFinite(n) || n === 0) { showToast('⚠️ Enter a non-zero number'); return null; }
      return n;
    };
    if (coinsApplyBtn) {
      coinsApplyBtn.addEventListener('click', () => {
        const n = readCurrencyAmount(); if (n === null) return;
        addCoins(n);
        showToast(`${n > 0 ? '+' : ''}${n.toLocaleString()} Coins`);
      });
    }

    if (t1ApplyBtn) {
      t1ApplyBtn.addEventListener('click', () => {
        const n = readCurrencyAmount(); if (n === null) return;
        addGoldTickets(n);
        showToast(`${n > 0 ? '+' : ''}${n.toLocaleString()} Gold tickets`);
      });
    }

    if (purpApplyBtn) {
      purpApplyBtn.addEventListener('click', () => {
        const n = readCurrencyAmount(); if (n === null) return;
        addPurpleTickets(n);
        showToast(`${n > 0 ? '+' : ''}${n.toLocaleString()} Purple tickets`);
      });
    }
    // fine funzione Bind Currency Buttons

    // inizio funzione Bind Ban / Veto UI
    const banLimitInput = document.getElementById('ps-ban-limit');
    const applyBanLimitBtn = document.getElementById('btn-apply-ban-limit');
    const maxBanLvBtn = document.getElementById('btn-max-ban-lv');
    const maxBanAllBtn = document.getElementById('btn-max-ban-all');

    if (banLimitInput) banLimitInput.value = getCustomBanLimit();

    if (applyBanLimitBtn) {
      applyBanLimitBtn.onclick = () => {
        let val = parseInt(banLimitInput.value, 10);
        if (!Number.isFinite(val) || val < 1) { showToast('⚠️ Invalid limit'); return; }

        val = Math.min(20, val); // Forza il massimo a 20
        banLimitInput.value = val; // Aggiorna visivamente l'input

        localStorage.setItem('ps_custom_ban_limit', String(val));
        applyBanLimit(val);

        const sel = document.getElementById('upg-mon');
        if (sel && typeof sel.onchange === 'function') sel.onchange();

        showToast(`Ban limit set to ${val}`);
      };
    }

    if (maxBanLvBtn) {
      maxBanLvBtn.onclick = () => {
        const g = G();
        if (!g || !g.DB || !g.DB.upgradesOf) return;
        const sel = document.getElementById('upg-mon');
        const dex = sel ? parseInt(sel.value, 10) : g.DB.save.partner;
        if (!dex) { showToast('⚠️ No Pokémon selected'); return; }

        const limit = getCustomBanLimit();
        applyBanLimit(limit);
        g.DB.upgradesOf(dex).ban = limit;
        g.DB.commit();

        if (sel && typeof sel.onchange === 'function') sel.onchange();
        showToast(`Max Ban (Lv ${limit}) applied to #${dex}`);
      };
    }

    if (maxBanAllBtn) {
      maxBanAllBtn.onclick = () => {
        const g = G();
        if (!g || !g.DB || !g.DB.save || !g.DB.save.pupg) return;
        const limit = getCustomBanLimit();
        applyBanLimit(limit);
        let count = 0;
        for (const dex in g.DB.save.pupg) {
          g.DB.save.pupg[dex].ban = limit;
          count++;
        }
        g.DB.commit();

        const sel = document.getElementById('upg-mon');
        if (sel && typeof sel.onchange === 'function') sel.onchange();
        showToast(`Max Ban (Lv ${limit}) applied to ${count} Pokémon`);
      };
    }
    // fine funzione Bind Ban / Veto UI

    // inizio funzione Abilities Logic
    function refreshAbilityList() {
      const p = getPlayer();
      const sel = document.getElementById('ps-ability-select');
      const changeSel = document.getElementById('ps-ability-change-select');
      if (!p || !p.moves || !sel || !changeSel) return;

      const currentVal = sel.value;
      sel.innerHTML = '';
      p.moves.forEach((move, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${move.name} (Lvl ${move.lvl || 1}/${move.def?.maxLvl || move.maxLvl || '?'})`;
        sel.appendChild(opt);
      });
      if (currentVal && sel.options[currentVal]) sel.value = currentVal;

      const g = G();
      if (g && g.Moves && g.Moves.BY_ID) {
        changeSel.innerHTML = '';
        Object.values(g.Moves.BY_ID).forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          changeSel.appendChild(opt);
        });
      }
    }

    document.getElementById('ps-ability-select').addEventListener('focus', refreshAbilityList);
    document.getElementById('btn-ability-plus').onclick = (e) => {
      e.stopPropagation();
      const p = getPlayer(), g = G();
      if (!p || !g || !g.Moves) return;
      const idx = document.getElementById('ps-ability-select').value;
      const move = p.moves[idx];
      if (move && g.Moves.levelUp) {
        g.Moves.levelUp(move);
        showToast(`Leveled up ${move.name}`);
        refreshAbilityList();
      }
    };

    document.getElementById('btn-ability-max').onclick = (e) => {
      e.stopPropagation();
      const p = getPlayer(), g = G();
      if (!p || !g || !g.Moves) return;
      const idx = document.getElementById('ps-ability-select').value;
      const move = p.moves[idx];
      if (move && g.Moves.levelUp) {
        const maxLvl = move.def?.maxLvl || move.maxLvl || 10;
        while (move.lvl < maxLvl && g.Moves.levelUp(move));
        showToast(`Maxed out ${move.name}`);
        refreshAbilityList();
      }
    };

    document.getElementById('btn-ability-change').onclick = (e) => {
      e.stopPropagation();
      const p = getPlayer(), g = G();
      if (!p || !g || !g.Moves || !g.Moves.BY_ID) return;

      const idx = parseInt(document.getElementById('ps-ability-select').value, 10);
      const currentMove = p.moves[idx];
      const newId = document.getElementById('ps-ability-change-select').value;
      if (!currentMove || !newId) return;

      const definition = g.Moves.BY_ID[newId];
      if (!definition) return;

      // Crea la nuova istanza della mossa
      const replacement = g.Moves.instance(newId, currentMove.lvl || 1);
      if (!replacement) return;

      replacement.since = currentMove.since || 0;
      replacement.t = 0;

      if (currentMove.evolved && g.Moves.evolve) {
        g.Moves.evolve(replacement);
      }

      // Sostituisce nell'array
      p.moves[idx] = replacement;

      // Sostituisce negli slot (se presenti)
      if (Array.isArray(p.slots)) {
        for (const group of p.slots) {
          if (!Array.isArray(group)) continue;
          for (let i = 0; i < group.length; i++) {
            if (group[i] === currentMove) group[i] = replacement;
          }
        }
      }

      // Sostituisce nei tasti assegnati
      if (p.bind && typeof p.bind === 'object' && p.bind[currentMove.id] != null) {
        p.bind[newId] = p.bind[currentMove.id];
        delete p.bind[currentMove.id];
      }

      // Pulisce i proiettili e riordina
      if (g.Projectiles && g.Projectiles.clearOrbs) g.Projectiles.clearOrbs(p);
      if (p.arrange) p.arrange();

      showToast(`Changed to ${replacement.name}`);
      refreshAbilityList();
    };
    // fine funzione Abilities Logic

    // inizio funzione Bind Other Toggles
    bindToggle('tog-shinygacha', 'shinygacha', '✨ 100% Shiny', 'Forces every Gacha pull to be shiny.', () => {
      const g = G(); if (g && g.Gacha && g.Gacha.debugForceShiny) g.Gacha.debugForceShiny(9999);
    }, () => {
      const g = G(); if (g && g.Gacha && g.Gacha.debugForceShiny) g.Gacha.debugForceShiny(0);
    });

    bindToggle('tog-autolevel', 'autolevel', '⚡ Stats', 'Automatically picks stat upgrades when no moves are offered.', () => installLevelUpHook(), null);
    bindToggle('tog-autolevel-all', 'autolevelAll', '🔥 Always', 'Automatically picks EVERYTHING, including moves, bonds, and boss items.', () => installLevelUpHook(), null);
    bindToggle('tog-autoRift', 'autoRift', '🌀 Rift', 'Teleports you directly into a Rift as soon as it spawns.', null, null);
    bindToggle('tog-instantChest', 'instantChest', '📦 Insta-Chest', 'Opens chests instantly upon contact.', null, null);
    // fine funzione Bind Other Toggles

    // inizio funzione Bind Level Up Button
    document.getElementById('btn-lvlup').onclick = (e) => {
      e.stopPropagation();
      const g = G();
      if (g && g.Game && g.Game.debugLevelUp) { g.Game.debugLevelUp(); showToast('Level +1'); }
      else showToast('⚠️ Available only inside runs');
    };
    // fine funzione Bind Level Up Button

    // inizio funzione Bind Pokédex Buttons
    document.getElementById('btn-unlock-all').onclick = () => { unlockAllDex(); showToast('🌟 All unlocked'); };
    document.getElementById('btn-unlock-normal').onclick = () => {
      const v = document.getElementById('pt-mon-input').value;
      const r = unlockSinglePokemon(v, false);
      showToast(r ? `Unlocked: ${r}` : '⚠️ Invalid');
    };
    document.getElementById('btn-unlock-shiny').onclick = () => {
      const v = document.getElementById('pt-mon-input').value;
      const r = unlockSinglePokemon(v, true);
      showToast(r ? `Unlocked shiny: ${r}` : '⚠️ Invalid');
    };
    document.getElementById('btn-lock-all').onclick = () => {
      if (!confirm('Lock ALL Pokémon?\n\nThis will REMOVE every normal and shiny entry from your Pokédex. This cannot be undone.')) return;
      lockAllDex();
      showToast('🔒 All Pokémon locked');
    };
    document.getElementById('btn-lock-normal').onclick = () => {
      const v = document.getElementById('pt-mon-input').value;
      const r = lockSinglePokemon(v, false);
      showToast(r ? `Locked: ${r}` : '⚠️ Invalid');
    };
    document.getElementById('btn-lock-shiny').onclick = () => {
      const v = document.getElementById('pt-mon-input').value;
      const r = lockSinglePokemon(v, true);
      showToast(r ? `Locked shiny: ${r}` : '⚠️ Invalid');
    };
    // fine funzione Bind Pokédex Buttons

    // inizio funzione Bind Gacha UI
    gachaStatus = document.getElementById('ps-gacha-status');
    gachaProgress = document.getElementById('ps-gacha-progress');
    document.getElementById('ps-gacha-all').addEventListener('change', e => {
      document.getElementById('ps-gacha-count').disabled = e.target.checked;
      if (e.target.checked) document.getElementById('ps-gacha-count').value = availableDraws();
    });
    document.getElementById('ps-gacha-start').addEventListener('click', gachaStart);
    document.getElementById('ps-gacha-stop').addEventListener('click', () => { gachaStop = true; gachaStatus.textContent = 'Stopping…'; });
    // fine funzione Bind Gacha UI

    // inizio funzione Bind HUD Checkboxes
    const hudMap = {
      'hud-panel': 'hudPanel', 'hud-fov': 'hudFov',
      'hud-hp': 'hudHp', 'hud-xp': 'hudXp',
      'hud-atk': 'hudAtk', 'hud-spd': 'hudSpd', 'hud-red': 'hudRed',
      'hud-regen': 'hudRegen', 'hud-crit': 'hudCrit', 'hud-kills': 'hudKills',
      'hud-coins': 'hudCoins', 'hud-cd': 'hudCd', 'hud-xpmul': 'hudXpMul', 'hud-coinmul': 'hudCoinMul',
      'hud-magnet-stat': 'hudMagnet',
      'hud-ring': 'hudRing', 'hud-support': 'hudSupport',
      'hud-haz': 'hudHaz', 'hud-magnetCircle': 'hudMagnetCircle',
      'hud-arrows': 'hudArrows', 'hud-poi': 'hudPoi',
      'hud-alerts': 'hudAlerts'
    };
    for (const [elId, key] of Object.entries(hudMap)) {
      const el = document.getElementById(elId);
      if (el) {
        el.checked = !!toggles[key];
        el.addEventListener('change', () => {
          toggles[key] = el.checked;
          saveToggles();
        });
      }
    }
    // fine funzione Bind HUD Checkboxes

    // inizio funzione Bind HUD Slider
    const poiRangeInput = document.getElementById('hud-poi-range');
    const poiRangeVal = document.getElementById('hud-poi-range-val');
    if (poiRangeInput && poiRangeVal) {
      poiRangeInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        hudCfg.poiRange = val;
        poiRangeVal.textContent = val;
        saveHudCfg();
      });
    }
    // fine funzione Bind HUD Slider

    // inizio funzione Priority List UI
    function renderPriorityList() {
      const listContainer = document.getElementById('ps-priority-list');
      if (!listContainer) return;

      const statInfo = {
        atk: { icon: '⚔️', name: 'Attack' },
        cd: { icon: '⚡', name: 'Cooldown' },
        def: { icon: '🛡️', name: 'Defense' },
        xp: { icon: '📖', name: 'XP' },
        spd: { icon: '👟', name: 'Speed' },
        mag: { icon: '🧲', name: 'Magnet' },
        hp: { icon: '❤️', name: 'Max HP' },
        rgn: { icon: '🌿', name: 'Regen' },
        heal: { icon: '🍎', name: 'Heal' }
      };

      listContainer.innerHTML = '';

      statPriority.forEach((statId, index) => {
        const info = statInfo[statId] || { icon: '❓', name: statId };
        const row = document.createElement('div');
        row.className = 'ps-prio-row';
        row.draggable = true;
        row.dataset.id = statId;
        row.dataset.index = index;

        row.innerHTML = `
          <span style="color:#64748b; font-size:14px;">≡</span>
          <span class="ps-prio-icon">${info.icon}</span>
          <span class="ps-prio-label">${info.name}</span>
        `;

        row.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', index);
          e.dataTransfer.effectAllowed = 'move';
          row.style.opacity = '0.4';
        });

        row.addEventListener('dragend', () => {
          row.style.opacity = '1';
          document.querySelectorAll('.ps-prio-row').forEach(r => r.classList.remove('drag-over'));
        });

        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          row.classList.add('drag-over');
        });

        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over');
        });

        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('drag-over');
          const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
          const dropIndex = index;

          if (dragIndex !== dropIndex) {
            const movedItem = statPriority.splice(dragIndex, 1)[0];
            statPriority.splice(dropIndex, 0, movedItem);
            localStorage.setItem('ps_ultimate_priority', JSON.stringify(statPriority));
            renderPriorityList();
          }
        });

        listContainer.appendChild(row);
      });
    }

    document.getElementById('btn-reset-priority').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      statPriority = [...DEFAULT_PRIORITY];
      localStorage.setItem('ps_ultimate_priority', JSON.stringify(statPriority));
      renderPriorityList();
    });

    renderPriorityList();
    // fine funzione Priority List UI

    log('Panel built');
  }
  // fine funzione buildPanel

  // =========================================================================
  // INIT
  // =========================================================================

  // inizio funzione init
  function init() {
    if (!document.body) { setTimeout(init, 200); return; }
    buildPanel();
  }
  // fine funzione init

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // inizio funzione Retry Hooks Timer
  const hookTimer = setInterval(() => {
    if (hookCamera()) { /* camera ok */ }
    const g = G();
    const cand = (g && g.Enemy) || (window.G && window.G.Enemy);
    if (cand && typeof cand === 'function' && cand.prototype && typeof cand.prototype.draw === 'function') {
      patchEnemyClass(cand);
    }
    const hz = (g && g.Hazards) || (window.G && window.G.Hazards);
    if (hz && typeof hz.add === 'function') wrapHazards(hz);
    installLevelUpHook();
    if (Cam && curEnemy !== undefined && g && g.Enemy && g.Enemy._psHpPatched) clearInterval(hookTimer);
  }, 1000);
  // fine funzione Retry Hooks Timer

  log('Ultimate Trainer v2.6.3 loaded');
})();