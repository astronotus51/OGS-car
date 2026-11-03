'use strict';
/*
 * Arène d'auto-affrontement (sans serveur) : fait jouer les IA entre elles sur des centaines de parties
 * pour mesurer les taux de victoire, la durée des parties, l'usage et la valeur de chaque créature.
 *
 *   node scripts/ai-arena.js [--games 200] [--a difficile] [--b moyen] [--legacy a|b] [--team 1]
 *                            [--variety 0.7] [--seed 1] [--duration 180] [--balance] [--decks]
 *
 * Les camps sont alternés d'une partie à l'autre (A joue en haut puis en bas) pour neutraliser l'avantage de camp.
 * --legacy a : le camp A joue avec l'ancienne IA (shared/ai-legacy.js) pour comparer.
 * --balance  : rapport par créature (taux de victoire quand elle est dans l'équipe, dégâts à la base par pose…).
 * --deckA 1,2,3,4,5,6,7 --deckB 1,2,12,4,5,6,7 : équipes fixes (sinon tirées au hasard, variété = part de nouvelles créatures).
 * --set k=v  : essai d'équilibrage sans toucher au code, ex. --set orangeCooldown=2.5 --set og10.baseDamage=1 (répétable).
 */
const Sim = require('../shared/sim.js');
const AI = require('../shared/ai.js');
const Legacy = require('../shared/ai-legacy.js');
const Features = require('../shared/features.js');

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : null).filter(Boolean));
const sets = process.argv.slice(2).map((a, i, arr) => (a === '--set' ? arr[i + 1] : null)).filter(Boolean);
for (const kv of process.argv.slice(2).map((a, i, arr) => (a === '--ai' ? arr[i + 1] : null)).filter(Boolean)) { const [k, v] = kv.split('='), [lvl, prop] = k.split('.'); AI.CONFIGS[lvl][prop] = Number(v); console.log(`IA : ${k} = ${v}`); }
for (const kv of sets) {
  const [k, v] = kv.split('='), m = /^og(\d+)\.(\w+)$/.exec(k);
  if (m) Sim.OGS[m[1]][m[2]] = Number(v); else Sim.RULES[k] = Number(v);
  console.log(`réglage : ${k} = ${v}`);
}
const GAMES = Number(args.games || 100), A = args.a || 'difficile', B = args.b || 'moyen', TEAM = Number(args.team || 1);
const VARIETY = args.variety === undefined ? 0.7 : Number(args.variety), SEED0 = Number(args.seed || 1), DURATION = Number(args.duration || Sim.RULES.matchDuration);
const legacyWho = args.legacy === 'a' ? 'A' : args.legacy === 'b' ? 'B' : null;
const features = Features.resolveOptions(null, true); // réglages de la classée

function runGame(seed, aSide) {
  const keys = Sim.teamKeys(TEAM);
  const rng = Sim.createRng(seed ^ 0xa5a5);
  const decks = {};
  for (const k of keys) decks[k] = (Sim.sideOf(k) === aSide ? args.deckA : args.deckB) ? String(Sim.sideOf(k) === aSide ? args.deckA : args.deckB).split(',').map(Number) : AI.randomDeck(rng, VARIETY);
  const g = Sim.createGame({ seed, hazard: false, duration: DURATION, features, cols: Sim.TEAM_COLS[TEAM], players: keys, decks });
  const whoOf = (k) => (Sim.sideOf(k) === aSide ? 'A' : 'B');
  const ais = keys.map(k => {
    const who = whoOf(k), diff = who === 'A' ? A : B;
    return legacyWho === who ? Legacy.createAI(g, k, diff) : AI.createAI(g, k, diff, decks[k]);
  });
  const dt = 1 / 30;
  const maxTicks = 30 * (DURATION || 600) + 30 * 90; // + prolongation
  const baseDmg = {}; // ogId -> dégâts infligés à une base
  const kills = {}; // ogId -> fois tuée
  const fates = {}; // 'nom:cause' -> nombre
  for (let i = 0; i < maxTicks && !g.state.over; i += 1) {
    for (const ai of ais) ai.update(dt);
    g.step(dt);
    for (const ev of g.drainEvents()) {
      if (ev.type === 'base' && ev.ogId) baseDmg[ev.ogId] = (baseDmg[ev.ogId] || 0) + ev.amount;
      if (ev.type === 'kill' && ev.cause !== 'base' && ev.cause !== 'home') kills[ev.ogId] = (kills[ev.ogId] || 0) + 1;
      if (ev.type === 'kill') { const k = `${Sim.OGS[ev.ogId].name}:${ev.cause}`; fates[k] = (fates[k] || 0) + 1; }
    }
  }
  const S = g.state;
  const winner = S.over && S.winner !== 'draw' ? whoOf(S.winner) : 'draw';
  const placed = {};
  for (const side of ['top', 'bottom']) for (const [og, n] of Object.entries(S.stats[side].placedBy || {})) placed[og] = (placed[og] || 0) + n;
  const decksBy = { A: new Set(), B: new Set() };
  for (const k of keys) for (const id of decks[k]) decksBy[whoOf(k)].add(id);
  return { winner, time: S.time, hpA: S.hp[aSide], hpB: S.hp[Sim.other(aSide)], placed, baseDmg, kills, decksBy, fates };
}

const res = { A: 0, B: 0, draw: 0 }, usage = {}, baseDmg = {}, kills = {}, fates = {};
const perCreature = {}; // id -> { inA, winA, inB, winB }
let totalTime = 0, hpDiff = 0;
const t0 = Date.now();
for (let i = 0; i < GAMES; i += 1) {
  const r = runGame(SEED0 + i * 7, i % 2 ? 'bottom' : 'top');
  res[r.winner] += 1; totalTime += r.time; hpDiff += r.hpA - r.hpB;
  for (const [og, n] of Object.entries(r.placed)) usage[og] = (usage[og] || 0) + n;
  for (const [og, n] of Object.entries(r.baseDmg)) baseDmg[og] = (baseDmg[og] || 0) + n;
  for (const [og, n] of Object.entries(r.kills)) kills[og] = (kills[og] || 0) + n;
  for (const [k, n] of Object.entries(r.fates)) fates[k] = (fates[k] || 0) + n;
  for (const who of ['A', 'B']) for (const id of r.decksBy[who]) {
    const p = perCreature[id] = perCreature[id] || { games: 0, wins: 0, draws: 0 };
    if (!r.decksBy[who === 'A' ? 'B' : 'A'].has(id)) { p.games += 1; if (r.winner === who) p.wins += 1; else if (r.winner === 'draw') p.draws += 1; } // seulement les parties où l'adversaire ne l'a pas
  }
}
const name = (who, diff) => `${legacyWho === who ? 'legacy' : 'v2'}-${diff}`;
console.log(`${GAMES} parties ${TEAM}v${TEAM} en ${((Date.now() - t0) / 1000).toFixed(1)} s — A=${name('A', A)} vs B=${name('B', B)}, variété ${VARIETY}, camps alternés`);
console.log(`A gagne ${(100 * res.A / GAMES).toFixed(0)} %  |  B gagne ${(100 * res.B / GAMES).toFixed(0)} %  |  nuls ${(100 * res.draw / GAMES).toFixed(0)} %  |  durée moyenne ${(totalTime / GAMES).toFixed(0)} s  |  écart PV moyen (A−B) ${(hpDiff / GAMES).toFixed(1)}`);
const total = Object.values(usage).reduce((a, b) => a + b, 0) || 1;
console.log('Usage (% des poses) : ' + Object.entries(usage).sort((a, b) => b[1] - a[1]).map(([og, n]) => `${Sim.OGS[og].name} ${(100 * n / total).toFixed(1)}`).join(', '));
if (args.fates) console.log('Sorts (fin de vie, toutes parties) : ' + Object.entries(fates).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
if (args.balance) {
  console.log('\nBilan par créature (parties où un seul camp l\'a dans son équipe) :');
  console.log('créature     coût  victoire%  parties  poses/partie  dégâts base/pose  morts/pose');
  for (const id of Sim.OG_IDS) {
    const og = Sim.OGS[id], p = perCreature[id] || { games: 0, wins: 0, draws: 0 };
    const wr = p.games ? (100 * (p.wins + p.draws / 2) / p.games).toFixed(0) : '–';
    const poses = usage[id] || 0;
    console.log(`${og.name.padEnd(12)} ${String(og.cost).padStart(4)}  ${String(wr).padStart(8)}  ${String(p.games).padStart(7)}  ${(poses / Math.max(1, p.games * 2 / (TEAM * 2))).toFixed(1).padStart(12)}  ${((baseDmg[id] || 0) / Math.max(1, poses)).toFixed(2).padStart(16)}  ${((kills[id] || 0) / Math.max(1, poses)).toFixed(2).padStart(10)}`);
  }
}
