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
    { theme: 'pirate', suffix: 'pirate', name: (n) => `Capitaine ${n}`, rarity: 'rare', unlock: { type: 'coins', value: 180 } },
    { theme: 'astro', suffix: 'astro', name: (n) => `${n} Astronaute`, rarity: 'epique', unlock: { type: 'coins', value: 260 } },
    { theme: 'candy', suffix: 'candy', name: (n) => `${n} Bonbon`, rarity: 'rare', unlock: { type: 'coins', value: 160 } },
    { theme: 'lava', suffix: 'lava', name: (n) => `${n} Magma`, rarity: 'epique', unlock: (og) => ({ type: 'trophies', value: 400 + og * 60 }) },
    { theme: 'ninja', suffix: 'ninja', name: (n) => `${n} Ninja`, rarity: 'rare', unlock: { type: 'coins', value: 170 } },
    { theme: 'royal', suffix: 'royal', name: (n) => `Roi ${n}`, rarity: 'legendaire', unlock: (og) => ({ type: 'wins', value: 30 + og * 10 }) },
    { theme: 'summer', suffix: 'summer', name: (n) => `${n} Plage`, rarity: 'commun', unlock: { type: 'coins', value: 90 } },
    { theme: 'xmas', suffix: 'xmas', name: (n) => `${n} Noël`, rarity: 'epique', unlock: { type: 'coins', value: 220 } },
    { theme: 'toxic', suffix: 'toxic', name: (n) => `${n} Toxique`, rarity: 'rare', unlock: (og) => ({ type: 'level', value: 5 + og }) },
    { theme: 'cyber', suffix: 'cyber', name: (n) => `Cyber-${n}`, rarity: 'legendaire', unlock: (og) => ({ type: 'trophies', value: 700 + og * 80 }) },
  ];
  // 15 avatars de profil proposés (dessinés par creatures.js) ; sinon photo importée (data URL).
  const AVATAR_PRESETS = ['og1_default', 'og2_default', 'og3_default', 'og4_default', 'og5_default', 'og6_default', 'og7_default', 'og1_pirate', 'og2_royal', 'og4_candy', 'og7_cyber', 'og6_astro', 'og3_ninja', 'og5_lava', 'og1_halloween'];
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

  // ----- Quêtes du jour -----
  // kind : 'wins' | 'games' | 'kills' | 'orbs' | 'placed' (ogId) | 'abilities' | 'evolutions' | 'waves' (survie)
  const QUEST_TEMPLATES = [
    { id: 'win2', kind: 'wins', goal: 2, label: 'Gagne 2 parties', coins: 40 },
    { id: 'play3', kind: 'games', goal: 3, label: 'Joue 3 parties', coins: 30 },
    { id: 'kills20', kind: 'kills', goal: 20, label: 'Élimine 20 unités adverses', coins: 35 },
    { id: 'orbs10', kind: 'orbs', goal: 10, label: 'Ramasse 10 orbes de mana', coins: 25 },
    { id: 'zip15', kind: 'placed', ogId: 1, goal: 15, label: 'Pose 15 Zip', coins: 30 },
    { id: 'gromp8', kind: 'placed', ogId: 2, goal: 8, label: 'Pose 8 Gromp', coins: 30 },
    { id: 'krak6', kind: 'placed', ogId: 3, goal: 6, label: 'Pose 6 Krak', coins: 30 },
    { id: 'riko5', kind: 'placed', ogId: 4, goal: 5, label: 'Pose 5 Riko', coins: 30 },
    { id: 'blok4', kind: 'placed', ogId: 5, goal: 4, label: 'Pose 4 Blok', coins: 30 },
    { id: 'mojo4', kind: 'placed', ogId: 6, goal: 4, label: 'Pose 4 Mojo', coins: 30 },
    { id: 'zephir3', kind: 'placed', ogId: 7, goal: 3, label: 'Pose 3 Zéphir', coins: 35 },
    { id: 'abil5', kind: 'abilities', goal: 5, label: 'Utilise 5 capacités actives', coins: 30 },
    { id: 'evo3', kind: 'evolutions', goal: 3, label: 'Fais évoluer 3 unités', coins: 35 },
    { id: 'waves5', kind: 'waves', goal: 5, label: 'Survis à 5 vagues en Survie', coins: 40 },
  ];
  function dayKey(d) { return (d || new Date()).toISOString().slice(0, 10); }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 3 quêtes du jour, déterministes par (jour, joueur).
  function dailyQuests(userId, day) {
    const key = day || dayKey();
    let h = hashStr(`${key}:${userId}`);
    const pool = [...QUEST_TEMPLATES];
    const picked = [];
    while (picked.length < 3 && pool.length) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; picked.push(pool.splice(h % pool.length, 1)[0]); }
    return { date: key, items: picked.map(q => ({ id: q.id, progress: 0, claimed: false })) };
  }
  function questTemplate(id) { return QUEST_TEMPLATES.find(q => q.id === id); }
  // Fait avancer les quêtes à partir des stats d'une partie.
  function advanceQuests(quests, { result, stats, mode, waves }) {
    for (const item of quests.items) {
      const q = questTemplate(item.id);
      if (!q || item.claimed) continue;
      let add = 0;
      switch (q.kind) {
        case 'wins': add = result === 'win' ? 1 : 0; break;
        case 'games': add = 1; break;
        case 'kills': add = stats.kills || 0; break;
        case 'orbs': add = stats.orbs || 0; break;
        case 'placed': add = (stats.placedBy && stats.placedBy[q.ogId]) || 0; break;
        case 'abilities': add = stats.abilities || 0; break;
        case 'evolutions': add = stats.evolutions || 0; break;
        case 'waves': add = mode === 'survival' ? Math.max(0, (waves || 0) - item.progress) : 0; break;
        default: break;
      }
      item.progress = Math.min(q.goal, item.progress + add);
    }
    return quests;
  }

  // ----- Offre de la semaine : un skin payant à -50 % -----
  function weekKey(d) { const date = d || new Date(); const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); return `${date.getUTCFullYear()}-${Math.floor((date - start) / 604800000)}`; }
  function weeklyDeal(d) {
    const paid = SKINS.filter(s => !s.hidden && s.unlock.type === 'coins');
    if (!paid.length) return null;
    const skin = paid[hashStr(weekKey(d)) % paid.length];
    return { skinId: skin.id, price: Math.ceil(skin.unlock.value / 2), week: weekKey(d) };
  }

  return { OG_NAMES, OG_ROLES, OG_LORE, THEMES, AVATAR_PRESETS, SKINS, SKIN_BY_ID, DEFAULT_EQUIP, RANKS, rankFor, nextRank, xpForLevel, levelFromXp, matchRewards, canUnlock, QUEST_TEMPLATES, dailyQuests, questTemplate, advanceQuests, dayKey, weeklyDeal };
});
