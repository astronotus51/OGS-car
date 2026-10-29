/*
 * Catalogue partagé : créatures, skins (thèmes dessinés en vectoriel par public/js/creatures.js),
 * ligues (trophées), niveaux (XP), récompenses.
 * Pour ajouter un skin : une entrée dans SKINS avec un `theme` géré par creatures.js (ou un nouveau thème à y dessiner).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OGSCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OG_NAMES = { 1: 'Zip', 2: 'Gromp', 3: 'Krak', 4: 'Riko', 5: 'Blok', 6: 'Mojo', 7: 'Zéphir' };
  const OG_ROLES = { 1: 'Runner', 2: 'Défenseur', 3: 'Tourelle', 4: 'Étoile rebondissante', 5: 'Mur', 6: 'Chargeur de mana', 7: 'Dragonnet volant' };
  const OG_LORE = {
    1: 'Petite boule d’énergie qui ne sait faire qu’une chose : foncer. Tout droit. Toujours.',
    2: 'Grincheux à griffes qui patrouille sa ligne et croque tout Zip qui passe.',
    3: 'Marmite à canon. Vise, grogne, tire. Ne bouge jamais, par principe.',
    4: 'Étoile qui rebondit sur les murs en riant. Casse ce qu’elle touche, puis se fait mal.',
    5: 'Bloc têtu avec des dents. Ne parle pas, ne bouge pas, encaisse.',
    6: 'Trèfle à quatre branches qui ronronne de mana. Fragile, mais précieux.',
    7: 'Dragonnet rondouillard qui vole au-dessus de tout et crache des boules de feu.',
  };

  // Thèmes de skins : nom affiché par créature + déblocage.
  const HALLOWEEN_NAMES = { 1: 'Zip Citrouille', 2: 'Gromp Vampire', 3: 'Krak Sorcière', 4: 'Riko Momie', 5: 'Blok Frankenstein', 6: 'Mojo Zombie', 7: 'Zéphir Chauve-souris' };
  const THEMES = [
    { theme: 'default', suffix: 'default', name: (n) => `${n} classique`, rarity: 'commun', unlock: { type: 'default' } },
    { theme: 'halloween', suffix: 'halloween', name: (n, og) => HALLOWEEN_NAMES[og], rarity: 'epique', unlock: { type: 'coins', value: 200 } },
    { theme: 'ghost', suffix: 'ghost', name: (n) => `${n} Fantôme`, rarity: 'rare', unlock: (og) => ({ type: 'level', value: 2 + og }) },
    { theme: 'neon', suffix: 'neon', name: (n) => `${n} Néon`, rarity: 'rare', unlock: { type: 'coins', value: 150 } },
    { theme: 'robot', suffix: 'robot', name: (n) => `Robo-${n}`, rarity: 'epique', unlock: (og) => ({ type: 'trophies', value: 150 + og * 50 }) },
    { theme: 'ice', suffix: 'ice', name: (n) => `${n} Givré`, rarity: 'epique', unlock: (og) => ({ type: 'wins', value: 5 + og * 5 }) },
    { theme: 'gold', suffix: 'gold', name: (n) => `${n} Doré`, rarity: 'legendaire', unlock: (og) => ({ type: 'level', value: 8 + og * 2 }) },
  ];
  const SKINS = [];
  for (let og = 1; og <= 7; og += 1) {
    for (const th of THEMES) {
      SKINS.push({ id: `og${og}_${th.suffix}`, ogId: og, theme: th.theme, name: th.name(OG_NAMES[og], og), rarity: th.rarity, unlock: typeof th.unlock === 'function' ? th.unlock(og) : th.unlock });
    }
  }
  // Compatibilité avec les anciens identifiants (comptes créés avant la refonte).
  const LEGACY = { or: 'gold', ombre: 'neon', prisme: 'gold' };
  for (const [old, theme] of Object.entries(LEGACY)) for (let og = 1; og <= 7; og += 1) SKINS.push({ id: `og${og}_${old}`, ogId: og, theme, name: `${OG_NAMES[og]} (ancien)`, rarity: 'commun', unlock: { type: 'hidden' }, hidden: true });

  const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const DEFAULT_EQUIP = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(og => [og, `og${og}_default`]));

  const RANKS = [
    { name: 'Bronze', min: 0, color: '#b45309' },
    { name: 'Argent', min: 200, color: '#94a3b8' },
    { name: 'Or', min: 500, color: '#f59e0b' },
    { name: 'Diamant', min: 900, color: '#38bdf8' },
    { name: 'Mythique', min: 1400, color: '#a855f7' },
    { name: 'Légendaire', min: 2000, color: '#f43f5e' },
  ];
  function rankFor(trophies) {
    let r = RANKS[0];
    for (const rank of RANKS) if (trophies >= rank.min) r = rank;
    return r;
  }
  function nextRank(trophies) { return RANKS.find(r => r.min > trophies) || null; }

  function xpForLevel(level) { return 100 + (level - 1) * 60; } // XP pour passer du niveau `level` au suivant
  function levelFromXp(xp) {
    let level = 1, rest = xp;
    while (rest >= xpForLevel(level) && level < 200) { rest -= xpForLevel(level); level += 1; }
    return { level, into: rest, need: xpForLevel(level) };
  }

  // Récompenses de fin de partie (style Brawl Stars : gains/pertes selon l'écart de trophées).
  function matchRewards(me, opp, result, mode) {
    const ranked = mode === 'ranked';
    const diff = (opp.trophies || 0) - (me.trophies || 0);
    let trophies = 0;
    if (ranked) {
      if (result === 'win') trophies = Math.round(Math.max(4, Math.min(16, 8 + diff / 50)));
      else if (result === 'loss') {
        const base = Math.round(Math.max(2, Math.min(12, 8 - diff / 50)));
        const protect = me.trophies < 100 ? 0.5 : 1;
        trophies = -Math.round(base * protect);
        if (me.trophies + trophies < 0) trophies = -me.trophies;
      }
    }
    let xp = result === 'win' ? 40 : result === 'draw' ? 20 : 15;
    let coins = result === 'win' ? 20 : result === 'draw' ? 10 : 6;
    if (mode === 'bot') { xp = Math.round(xp * 0.6); coins = Math.round(coins * 0.5); }
    if (mode === 'friendly') { xp = Math.round(xp * 0.5); coins = 0; }
    const streakBonus = result === 'win' && (me.streak || 0) >= 2 ? Math.min(10, (me.streak || 0) * 2) : 0;
    return { trophies, xp: xp + streakBonus, coins: coins + (streakBonus ? 4 : 0), streakBonus };
  }

  function canUnlock(skin, profile) {
    const u = skin.unlock;
    if (u.type === 'default') return { ok: true };
    if (u.type === 'level') return { ok: profile.level >= u.value, label: `Niveau ${u.value}` };
    if (u.type === 'trophies') return { ok: profile.bestTrophies >= u.value, label: `${u.value} trophées` };
    if (u.type === 'wins') return { ok: profile.wins >= u.value, label: `${u.value} victoires` };
    if (u.type === 'coins') return { ok: profile.coins >= u.value, label: `${u.value} pièces`, price: u.value };
    return { ok: false };
  }

  return { OG_NAMES, OG_ROLES, OG_LORE, THEMES, SKINS, SKIN_BY_ID, DEFAULT_EQUIP, RANKS, rankFor, nextRank, xpForLevel, levelFromXp, matchRewards, canUnlock };
});
