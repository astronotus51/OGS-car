'use strict';
const Catalog = require('../shared/catalog.js');

function ownedSkins(user) {
  const owned = new Set(Array.isArray(user.skins) ? user.skins : []);
  for (const og of [1, 2, 3, 4, 5, 6, 7]) owned.add(`og${og}_default`);
  return [...owned];
}

function equippedOf(user) {
  const eq = Object.assign({}, Catalog.DEFAULT_EQUIP, user.equipped || {});
  const owned = new Set(ownedSkins(user));
  for (const og of Object.keys(eq)) if (!owned.has(eq[og])) eq[og] = `og${og}_default`;
  return eq;
}

// Profil public (envoyé au client / à l'adversaire).
function publicProfile(user, extra) {
  const lv = Catalog.levelFromXp(user.xp || 0);
  const rank = Catalog.rankFor(user.trophies || 0);
  const next = Catalog.nextRank(user.trophies || 0);
  return Object.assign({
    id: user.id,
    username: user.username,
    trophies: user.trophies || 0,
    bestTrophies: user.best_trophies || 0,
    xp: user.xp || 0,
    level: lv.level,
    xpInto: lv.into,
    xpNeed: lv.need,
    coins: user.coins || 0,
    wins: user.wins || 0,
    losses: user.losses || 0,
    draws: user.draws || 0,
    games: (user.wins || 0) + (user.losses || 0) + (user.draws || 0),
    streak: user.streak || 0,
    rank: rank.name,
    rankColor: rank.color,
    nextRank: next ? { name: next.name, min: next.min } : null,
    equipped: equippedOf(user),
    skins: ownedSkins(user),
    survivalBest: user.survival_best || 0,
    createdAt: user.created_at,
  }, extra || {});
}

// Quêtes du jour de l'utilisateur (régénérées chaque jour).
function questsOf(user) {
  const q = user.quests && user.quests.date === Catalog.dayKey() ? user.quests : Catalog.dailyQuests(user.id);
  return JSON.parse(JSON.stringify(q));
}
function questsView(user) {
  const q = questsOf(user);
  return { date: q.date, items: q.items.map(it => { const t = Catalog.questTemplate(it.id) || {}; return Object.assign({}, it, { label: t.label, goal: t.goal, coins: t.coins, done: it.progress >= (t.goal || Infinity) }); }) };
}

// Applique le résultat d'un match : retourne { patch, rewards, levelUp, unlocked }
// result : 'win' | 'loss' | 'draw' | 'survival' ; extra : { stats, survival }
function applyResult(user, opponentProfile, result, mode, extra) {
  const me = publicProfile(user);
  const ex = extra || {};
  if (result === 'survival') {
    const score = (ex.survival && ex.survival.score) || 0;
    const rewards = { trophies: 0, xp: Math.min(120, Math.floor(score / 15)), coins: Math.min(60, Math.floor(score / 30)), streakBonus: 0, score };
    const before = Catalog.levelFromXp(user.xp || 0).level;
    const patch = { xp: (user.xp || 0) + rewards.xp, coins: (user.coins || 0) + rewards.coins, survival_best: Math.max(user.survival_best || 0, score) };
    patch.quests = Catalog.advanceQuests(questsOf(user), { result, stats: ex.stats || {}, mode, waves: ex.survival ? ex.survival.wave : 0 });
    const after = Catalog.levelFromXp(patch.xp).level;
    return { patch, rewards, levelUp: after > before ? after : null, unlocked: [], newBest: score > (user.survival_best || 0) };
  }
  const rewards = Catalog.matchRewards(me, opponentProfile || { trophies: me.trophies }, result, mode);
  const before = Catalog.levelFromXp(user.xp || 0).level;
  const patch = {
    trophies: Math.max(0, (user.trophies || 0) + rewards.trophies),
    xp: (user.xp || 0) + rewards.xp,
    coins: (user.coins || 0) + rewards.coins,
    wins: (user.wins || 0) + (result === 'win' ? 1 : 0),
    losses: (user.losses || 0) + (result === 'loss' ? 1 : 0),
    draws: (user.draws || 0) + (result === 'draw' ? 1 : 0),
    streak: result === 'win' ? (user.streak || 0) + 1 : 0,
  };
  patch.best_trophies = Math.max(user.best_trophies || 0, patch.trophies);
  const after = Catalog.levelFromXp(patch.xp).level;
  // Déblocages automatiques (niveau / trophées / victoires).
  const owned = new Set(ownedSkins(user));
  const tmpProfile = { level: after, bestTrophies: patch.best_trophies, wins: patch.wins, coins: patch.coins };
  const unlocked = [];
  for (const skin of Catalog.SKINS) {
    if (owned.has(skin.id) || skin.unlock.type === 'coins' || skin.unlock.type === 'default') continue;
    if (Catalog.canUnlock(skin, tmpProfile).ok) { owned.add(skin.id); unlocked.push(skin.id); }
  }
  if (unlocked.length) patch.skins = [...owned];
  patch.quests = Catalog.advanceQuests(questsOf(user), { result, stats: ex.stats || {}, mode });
  return { patch, rewards, levelUp: after > before ? after : null, unlocked };
}

module.exports = { publicProfile, applyResult, ownedSkins, equippedOf, questsOf, questsView };
