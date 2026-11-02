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

  const OG_NAMES = { 1: 'Zip', 2: 'Gromp', 3: 'Krak', 4: 'Riko', 5: 'Blok', 6: 'Mojo', 7: 'Zéphir', 8: 'Pik', 9: 'Bulle', 10: 'Zazou', 11: 'Boum', 12: 'Rafale', 13: 'Tiktak', 14: 'Fantôme', 15: 'Glu', 16: 'Sirène', 17: 'Kraken' };
  const OG_ROLES = { 1: 'Runner', 2: 'Défenseur', 3: 'Tourelle', 4: 'Étoile rebondissante', 5: 'Mur', 6: 'Chargeur de mana', 7: 'Dragonnet volant', 8: 'Hérisson à ressort', 9: 'Bulle de soin', 10: 'Moustique', 11: 'Mine', 12: 'Ventilo', 13: 'Bombe à retardement', 14: 'Spectre', 15: 'Flaque gluante', 16: 'Charmeuse', 17: 'Colosse' };
  const OG_LORE = {
    1: 'Petite boule d’énergie qui ne sait faire qu’une chose : foncer. Tout droit. Toujours.',
    2: 'Grincheux à griffes qui patrouille sa ligne et croque tout Zip qui passe.',
    3: 'Marmite à canon. Vise, grogne, tire. Ne bouge jamais, par principe.',
    4: 'Étoile qui rebondit sur les murs en riant. Casse ce qu’elle touche, puis se fait mal.',
    5: 'Bloc têtu avec des dents. Ne parle pas, ne bouge pas, encaisse.',
    6: 'Trèfle à quatre branches qui ronronne de mana. Fragile, mais précieux.',
    7: 'Dragonnet rondouillard qui vole au-dessus de tout et crache des boules de feu.',
    8: 'Boule de piquants sur ressort. Pas rapide, mais il en faut deux pour l’arrêter.',
    9: 'Bulle rêveuse qui flotte jusqu’à l’autre bout et soigne ta base en éclatant.',
    10: 'Moustique insupportable : trop rapide, trop petit, pique la base et s’en va.',
    11: 'Mine boudeuse enfouie dans le sable. Clignote. Attend. Boum.',
    12: 'Ventilateur grincheux qui souffle tout ce qui s’approche vers l’arrière.',
    13: 'Bombe pressée avec un réveil dans le ventre. Compte à rebours ambulant.',
    14: 'Drap qui hante son propre camp, invisible, et passe au travers des murs.',
    15: 'Flaque de bave verte. Tout ce qui marche dedans y reste collé un moment.',
    16: 'Chanteuse des abysses : qui l’entend change de camp.',
    17: 'Le seigneur des profondeurs. Lent, immense, et il n’aime pas les murs.',
  };

  // ----- Collection de créatures (façon Clash Royale) -----
  // Les 7 de base sont acquises. Les suivantes arrivent par capsules et route des trophées (`playable:false` servirait à en annoncer une avant sa sortie).
  const RARITIES = {
    commune: { name: 'Commune', color: '#8fb7c9', weight: 70, copiesPerStar: 2 },
    rare: { name: 'Rare', color: '#22e3c8', weight: 22, copiesPerStar: 2 },
    epique: { name: 'Épique', color: '#c084fc', weight: 7, copiesPerStar: 1 },
    legendaire: { name: 'Légendaire', color: '#ffc14d', weight: 1, copiesPerStar: 1 },
  };
  const CREATURES = [
    { id: 1, name: 'Zip', role: 'Runner', cost: 10, rarity: 'commune', base: true, playable: true, power: 'Fonce tout droit vers la base ennemie. Rebondit sur les murs.' },
    { id: 2, name: 'Gromp', role: 'Défenseur', cost: 20, rarity: 'commune', base: true, playable: true, power: 'Patrouille sa ligne et croque les Runners adverses.' },
    { id: 3, name: 'Krak', role: 'Tourelle', cost: 30, rarity: 'rare', base: true, playable: true, power: 'Tire sur tout ennemi dans un carré de 2 cases autour de lui, dans ton camp.' },
    { id: 4, name: 'Riko', role: 'Étoile rebondissante', cost: 40, rarity: 'rare', base: true, playable: true, power: 'Avance en diagonale, détruit tourelles et chargeurs, rebondit sur les murs.' },
    { id: 5, name: 'Blok', role: 'Mur', cost: 50, rarity: 'commune', base: true, playable: true, power: 'Bloque et renvoie les créatures qui avancent.' },
    { id: 6, name: 'Mojo', role: 'Chargeur de mana', cost: 60, rarity: 'rare', base: true, playable: true, power: '+50 % de régénération de mana pour toute ton équipe.' },
    { id: 7, name: 'Zéphir', role: 'Dragonnet volant', cost: 70, rarity: 'epique', base: true, playable: true, power: 'Vole au-dessus de tout, tire à 1 case, 5 dégâts à la base.' },
    // --- 10 nouveaux types (pouvoirs inédits), jouables à la prochaine mise à jour ---
    { id: 8, name: 'Pik', role: 'Hérisson à ressort', cost: 10, rarity: 'commune', playable: true, power: 'Runner lent mais à 2 PV : il encaisse un coup et continue.' },
    { id: 9, name: 'Bulle', role: 'Bulle de soin', cost: 10, rarity: 'rare', playable: true, power: 'Flotte lentement au-dessus de tout. Si elle atteint la base ennemie, ta base récupère 1 PV.' },
    { id: 10, name: 'Zazou', role: 'Moustique', cost: 20, rarity: 'commune', playable: true, power: 'Minuscule volant très rapide, 1 PV : ignore les unités au sol, 1 dégât à la base.' },
    { id: 11, name: 'Boum', role: 'Mine', cost: 30, rarity: 'rare', playable: true, power: 'Statique et discret : explose au premier contact ennemi, 2 dégâts dans la case autour.' },
    { id: 12, name: 'Rafale', role: 'Ventilo', cost: 30, rarity: 'epique', playable: true, power: 'Tourelle qui souffle : repousse d’une case les ennemis au sol devant elle, toutes les 2 s.' },
    { id: 13, name: 'Tiktak', role: 'Bombe à retardement', cost: 40, rarity: 'rare', playable: true, power: 'Marche lentement, 3 PV. Explose à l’arrivée (4 dégâts) ou à sa mort (1 dégât autour).' },
    { id: 14, name: 'Fantôme', role: 'Spectre', cost: 40, rarity: 'epique', playable: true, power: 'Invisible tant qu’il est dans ton camp, traverse les murs. 2 PV, 2 dégâts.' },
    { id: 15, name: 'Glu', role: 'Flaque gluante', cost: 50, rarity: 'commune', playable: true, power: 'Zone collante : les ennemis au sol qui la traversent sont ralentis de moitié.' },
    { id: 16, name: 'Sirène', role: 'Charmeuse', cost: 60, rarity: 'legendaire', playable: true, power: 'Toutes les 8 s, charme l’ennemi au sol le plus proche (2 cases) : il change de camp.' },
    { id: 17, name: 'Kraken', role: 'Colosse', cost: 70, rarity: 'legendaire', playable: true, power: 'Lent, 6 PV, 3 dégâts. Écrase les murs en passant (−1 PV pour lui).' },
  ];
  const CREATURE_BY_ID = Object.fromEntries(CREATURES.map(c => [c.id, c]));
  const DECK_COSTS = [10, 20, 30, 40, 50, 60, 70];
  const DEFAULT_DECK = Object.fromEntries(DECK_COSTS.map(cost => [cost, CREATURES.find(c => c.base && c.cost === cost).id]));
  const BASE_COLLECTION = Object.fromEntries(CREATURES.filter(c => c.base).map(c => [c.id, 1]));
  // Étoiles d'une carte selon ses exemplaires (cosmétique) : 1 étoile à l'obtention, puis +1 tous les copiesPerStar×n.
  function cardStars(creature, copies) { const per = RARITIES[creature.rarity].copiesPerStar; let s = 1, need = per; let c = (copies || 0) - 1; while (c >= need && s < 5) { c -= need; need += per; s += 1; } return s; }
  function nextStarCopies(creature, copies) { const per = RARITIES[creature.rarity].copiesPerStar; let s = 1, need = per; let c = (copies || 0) - 1; while (c >= need && s < 5) { c -= need; need += per; s += 1; } return s >= 5 ? null : { have: c, need }; }

  // ----- Capsules (butin de victoire, tirage par rareté avec garanties) -----
  const CAPSULE = { max: 5, pityEpic: 12, pityLegendary: 40, skinChance: 0.3 };
  function rollRarity(rng, pity) {
    if (pity.legendary >= CAPSULE.pityLegendary) return 'legendaire';
    if (pity.epic >= CAPSULE.pityEpic) return 'epique';
    const total = Object.values(RARITIES).reduce((n, r) => n + r.weight, 0);
    let x = rng() * total;
    for (const [key, r] of Object.entries(RARITIES)) { x -= r.weight; if (x < 0) return key; }
    return 'commune';
  }
  // rng : fonction () => [0,1). Retourne { cards: [{ id, rarity, copies }], coins, skin?: id }
  function openCapsule(rng, collection, ownedSkins, pity) {
    const cards = [];
    const n = 2 + (rng() < 0.3 ? 1 : 0);
    const p = Object.assign({ epic: 0, legendary: 0 }, pity || {});
    for (let i = 0; i < n; i += 1) {
      const rarity = rollRarity(rng, p);
      const pool = CREATURES.filter(c => c.rarity === rarity && !c.base) ;
      const fallback = CREATURES.filter(c => c.rarity === rarity);
      const pick = (pool.length ? pool : fallback)[Math.floor(rng() * (pool.length ? pool : fallback).length)];
      const copies = rarity === 'commune' ? 1 + Math.floor(rng() * 3) : rarity === 'rare' ? 1 + Math.floor(rng() * 2) : 1;
      cards.push({ id: pick.id, rarity, copies, isNew: !collection[pick.id] });
      if (rarity === 'epique' || rarity === 'legendaire') p.epic = 0; else p.epic += 1;
      if (rarity === 'legendaire') p.legendary = 0; else p.legendary += 1;
    }
    const coins = 20 + Math.floor(rng() * 41);
    let skin = null;
    if (rng() < CAPSULE.skinChance) {
      const candidates = SKINS.filter(s => !s.hidden && s.unlock.type !== 'default' && !ownedSkins.includes(s.id));
      if (candidates.length) skin = candidates[Math.floor(rng() * candidates.length)].id;
    }
    return { cards, coins, skin, pity: p };
  }

  // ----- Route des trophées (paliers de meilleurs trophées, récompenses à réclamer) -----
  const TROPHY_ROAD = [];
  (function buildRoad() {
    const creatureAt = { 50: 8, 150: 10, 300: 15, 450: 11, 600: 9, 800: 12, 1000: 13, 1250: 14, 1500: 16, 2200: 17 };
    for (let t = 50; t <= 2500; t += 50) {
      let reward;
      if (creatureAt[t]) reward = { type: 'creature', id: creatureAt[t] };
      else if (t % 250 === 0) reward = { type: 'capsule', count: t >= 1000 ? 2 : 1 };
      else if (t % 200 === 0) reward = { type: 'skin', pick: 'random' };
      else reward = { type: 'coins', count: 40 + Math.floor(t / 50) * 10 };
      TROPHY_ROAD.push({ trophies: t, reward });
    }
  })();
  function roadLabel(r) {
    if (r.type === 'creature') return `Créature : ${CREATURE_BY_ID[r.id].name}`;
    if (r.type === 'capsule') return r.count > 1 ? `${r.count} capsules` : '1 capsule';
    if (r.type === 'skin') return 'Skin surprise';
    return `${r.count} pièces`;
  }

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
  // Arènes (décors) : dessinées par public/js/maps.js ; 'random' = tirage au sort par le serveur.
  const MAPS = [{ id: 'lagoon', name: 'Lagon' }, { id: 'space', name: 'Espace' }, { id: 'lava', name: 'Mer de lave' }, { id: 'halloween', name: 'Cimetière' }, { id: 'farm', name: 'Ferme' }, { id: 'ice', name: 'Banquise' }, { id: 'candy', name: 'Pays des bonbons' }];
  // 15 avatars de profil proposés (dessinés par creatures.js) ; sinon photo importée (data URL).
  const AVATAR_PRESETS = ['og1_default', 'og2_default', 'og3_default', 'og4_default', 'og5_default', 'og6_default', 'og7_default', 'og1_pirate', 'og2_royal', 'og4_candy', 'og7_cyber', 'og6_astro', 'og3_ninja', 'og5_lava', 'og1_halloween'];
  const SKINS = [];
  for (let og = 1; og <= 17; og += 1) {
    for (const th of THEMES) {
      SKINS.push({ id: `og${og}_${th.suffix}`, ogId: og, theme: th.theme, name: th.name(OG_NAMES[og], og), rarity: th.rarity, unlock: typeof th.unlock === 'function' ? th.unlock(og) : th.unlock });
    }
  }
  // Compatibilité avec les anciens identifiants (comptes créés avant la refonte).
  const LEGACY = { or: 'gold', ombre: 'neon', prisme: 'gold' };
  for (const [old, theme] of Object.entries(LEGACY)) for (let og = 1; og <= 7; og += 1) SKINS.push({ id: `og${og}_${old}`, ogId: og, theme, name: `${OG_NAMES[og]} (ancien)`, rarity: 'commun', unlock: { type: 'hidden' }, hidden: true });

  const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const DEFAULT_EQUIP = Object.fromEntries(Array.from({ length: 17 }, (_, i) => i + 1).map(og => [og, `og${og}_default`]));

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

  return { OG_NAMES, OG_ROLES, OG_LORE, THEMES, MAPS, AVATAR_PRESETS, SKINS, SKIN_BY_ID, DEFAULT_EQUIP, RANKS,
    RARITIES, CREATURES, CREATURE_BY_ID, DECK_COSTS, DEFAULT_DECK, BASE_COLLECTION, cardStars, nextStarCopies, CAPSULE, openCapsule, TROPHY_ROAD, roadLabel, rankFor, nextRank, xpForLevel, levelFromXp, matchRewards, canUnlock, QUEST_TEMPLATES, dailyQuests, questTemplate, advanceQuests, dayKey, weeklyDeal };
});
