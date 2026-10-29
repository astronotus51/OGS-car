/*
 * Catalogue partagé : skins, ligues (trophées), niveaux (XP), récompenses.
 * Pour ajouter un skin : une entrée ici + un PNG dans public/assets/skins/<skinId>.png
 * (si le PNG manque, le client dessine le sprite par défaut avec l'effet `fx`).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OGSCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OG_NAMES = { 1: 'Runner', 2: 'Défenseur', 3: 'Tourelle', 4: 'Éponge', 5: 'Mur', 6: 'Chargeur', 7: 'Ailée' };

  // unlock: { type: 'default' | 'level' | 'trophies' | 'coins' | 'wins', value }
  const SKINS = [];
  for (let og = 1; og <= 7; og += 1) {
    SKINS.push({ id: `og${og}_default`, ogId: og, name: `${OG_NAMES[og]} classique`, rarity: 'commun', fx: null, unlock: { type: 'default' } });
    SKINS.push({ id: `og${og}_neon`, ogId: og, name: `${OG_NAMES[og]} néon`, rarity: 'rare', fx: 'neon', unlock: { type: 'coins', value: 150 } });
    SKINS.push({ id: `og${og}_or`, ogId: og, name: `${OG_NAMES[og]} doré`, rarity: 'epique', fx: 'gold', unlock: { type: 'level', value: 5 + og } });
    SKINS.push({ id: `og${og}_ombre`, ogId: og, name: `${OG_NAMES[og]} ombre`, rarity: 'epique', fx: 'shadow', unlock: { type: 'coins', value: 400 } });
    SKINS.push({ id: `og${og}_prisme`, ogId: og, name: `${OG_NAMES[og]} prisme`, rarity: 'legendaire', fx: 'prism', unlock: { type: 'trophies', value: 300 + og * 100 } });
  }
  SKINS.push({ id: 'og1_champion', ogId: 1, name: 'Runner champion', rarity: 'legendaire', fx: 'champion', unlock: { type: 'wins', value: 100 } });
  SKINS.push({ id: 'og4_supernova', ogId: 4, name: 'Éponge supernova', rarity: 'legendaire', fx: 'nova', unlock: { type: 'wins', value: 50 } });

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
    // result: 'win' | 'loss' | 'draw'; mode: 'ranked' | 'bot' | 'friendly'
    const ranked = mode === 'ranked';
    const diff = (opp.trophies || 0) - (me.trophies || 0);
    let trophies = 0;
    if (ranked) {
      if (result === 'win') trophies = Math.round(Math.max(4, Math.min(16, 8 + diff / 50)));
      else if (result === 'loss') {
        const base = Math.round(Math.max(2, Math.min(12, 8 - diff / 50)));
        const protect = me.trophies < 100 ? 0.5 : 1; // pertes réduites en Bronze
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

  return { OG_NAMES, SKINS, SKIN_BY_ID, DEFAULT_EQUIP, RANKS, rankFor, nextRank, xpForLevel, levelFromXp, matchRewards, canUnlock };
});
