'use strict';
/*
 * Évalue des équipes candidates (archétypes) : chacune joue N parties contre des équipes au hasard (IA difficile des deux côtés,
 * camps alternés), puis un tournoi toutes contre toutes. Sert à choisir les équipes conseillées de shared/catalog.js.
 *   node scripts/ai-decks.js [--games 120] [--rr 40]
 */
const Sim = require('../shared/sim.js');
const AI = require('../shared/ai.js');
const Features = require('../shared/features.js');
const Catalog = require('../shared/catalog.js');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : null).filter(Boolean));
const GAMES = Number(args.games || 120), RR = Number(args.rr || 40);
const features = Features.resolveOptions(null, true);
const CANDIDATES = Catalog.RECOMMENDED_DECKS.map(d => ({ name: d.name, deck: Catalog.DECK_COSTS.map(c => d.deck[c]) }));

function play(seed, deckA, deckB) {
  const aSide = seed % 2 ? 'bottom' : 'top';
  const rng = Sim.createRng(seed ^ 0xa5a5);
  const decks = { top: aSide === 'top' ? deckA : deckB || AI.randomDeck(rng, 0.85), bottom: aSide === 'bottom' ? deckA : deckB || AI.randomDeck(rng, 0.85) };
  if (!deckB) decks[Sim.other(aSide)] = AI.randomDeck(rng, 0.85);
  const g = Sim.createGame({ seed, hazard: false, features, players: ['top', 'bottom'], decks });
  const ais = ['top', 'bottom'].map(k => AI.createAI(g, k, 'difficile', decks[k]));
  for (let i = 0; i < 30 * 270 && !g.state.over; i += 1) { for (const ai of ais) ai.update(1 / 30); g.step(1 / 30); g.drainEvents(); }
  const w = g.state.winner;
  return w === aSide ? 1 : w === 'draw' || !w ? 0.5 : 0;
}
const rows = [];
for (const c of CANDIDATES) {
  let pts = 0; for (let i = 0; i < GAMES; i += 1) pts += play(1000 + i * 3, c.deck, null);
  rows.push({ name: c.name, vsRandom: pts / GAMES, rr: 0, deck: c.deck });
}
for (let i = 0; i < CANDIDATES.length; i += 1) for (let j = 0; j < CANDIDATES.length; j += 1) {
  if (i === j) continue;
  let pts = 0; for (let k = 0; k < RR; k += 1) pts += play(5000 + k * 7 + i * 131 + j * 17, CANDIDATES[i].deck, CANDIDATES[j].deck);
  rows[i].rr += pts / RR / (CANDIDATES.length - 1);
}
rows.sort((a, b) => (b.vsRandom + b.rr) - (a.vsRandom + a.rr));
console.log('équipe                     vs hasard   tournoi   créatures');
for (const r of rows) console.log(`${r.name.padEnd(26)} ${(100 * r.vsRandom).toFixed(0).padStart(6)} %  ${(100 * r.rr).toFixed(0).padStart(6)} %   ${r.deck.map(id => Sim.OGS[id].name).join(', ')}`);
