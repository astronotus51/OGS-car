const Sim = require('../shared/sim.js');
const AI = require('../shared/ai.js');
const assert = require('assert');

// 1) Déterminisme : même seed => mêmes snapshots.
function run(seed, ticks) {
  const g = Sim.createGame({ seed, hazard: true });
  const a = AI.createAI(g, 'top', 'difficile');
  const b = AI.createAI(g, 'bottom', 'moyen');
  const dt = 1 / 30;
  for (let i = 0; i < ticks; i++) { a.update(dt); b.update(dt); g.step(dt); if (g.state.over) break; }
  return g;
}
const g1 = run(42, 30 * 240), g2 = run(42, 30 * 240);
assert.deepStrictEqual(g1.snapshot(), g2.snapshot(), 'sim non déterministe');
console.log('déterminisme OK, fin:', g1.state.over, g1.state.winner, g1.state.endReason, 'time', g1.state.time.toFixed(1), 'hp', g1.state.hp);
console.log('stats', JSON.stringify(g1.state.stats));

// 2) Règles de placement.
const g = Sim.createGame({ seed: 1, hazard: false });
g.state.mana.bottom = 70;
assert.strictEqual(g.canPlace('bottom', 1, 0, 0).reason, 'side');
assert.ok(g.canPlace('bottom', 1, 0, 7).ok, 'runner posable au fond');
assert.strictEqual(g.canPlace('bottom', 4, 0, 7).reason, 'front');
assert.ok(g.place('bottom', 1, 0, 4).ok);
assert.strictEqual(g.canPlace('bottom', 1, 0, 4).reason, 'occupied');
assert.strictEqual(g.canPlace('bottom', 7, 1, 4).reason, 'mana');
assert.strictEqual(g.availableCells('bottom', 5).length, 35);
assert.strictEqual(g.availableCells('bottom', 1).length, 35);
const gu = Sim.createGame({ seed: 9, duration: 0 }); for (let i = 0; i < 30 * 400; i++) gu.step(1 / 30); assert.ok(!gu.state.over, 'durée illimitée');

// 3) Runner atteint la base adverse.
for (let i = 0; i < 30 * 20; i++) g.step(1 / 30);
assert.strictEqual(g.state.hp.top, 29, 'runner doit infliger 1');
// 4) Jaune rebondit sur mur ennemi et change de camp.
const g3 = Sim.createGame({ seed: 2, hazard: false });
g3.state.mana.top = 70; g3.state.mana.bottom = 70;
g3.place('top', 5, 4, 2); // mur top col 4 row 2
g3.place('bottom', 1, 4, 4);
let flipped = false;
for (let i = 0; i < 30 * 30; i++) { g3.step(1 / 30); const ev = g3.drainEvents(); if (ev.some(e => e.type === 'bounce' && e.flip)) flipped = true; }
assert.ok(flipped, 'le jaune doit rebondir sur le mur ennemi');
assert.strictEqual(g3.state.hp.bottom, 29, 'le jaune renvoyé doit toucher sa propre base');
// 5) Jaune passe au-dessus de son propre mur.
const g4 = Sim.createGame({ seed: 3, hazard: false });
g4.state.mana.bottom = 70;
g4.place('bottom', 5, 4, 5); g4.state.mana.bottom = 70;
g4.place('bottom', 1, 4, 4);
for (let i = 0; i < 30 * 30; i++) g4.step(1 / 30);
assert.strictEqual(g4.state.hp.top, 29, 'jaune traverse son propre mur');
// 6) Rouge casse un mur ennemi et meurt.
const g5 = Sim.createGame({ seed: 4, hazard: false });
g5.state.mana.top = 70; g5.state.mana.bottom = 70;
g5.place('top', 5, 4, 3); g5.place('bottom', 4, 4, 4);
let wallDead = false, redDead = false;
for (let i = 0; i < 30 * 10; i++) { g5.step(1 / 30); for (const e of g5.drainEvents()) { if (e.type === 'kill' && e.ogId === 5) wallDead = true; if (e.type === 'kill' && e.ogId === 4) redDead = true; } }
assert.ok(wallDead && redDead, 'rouge vs mur');
// 7) Snapshot roundtrip
const snap = g1.snapshot(); const dec = Sim.decodeSnapshot(snap);
assert.strictEqual(dec.entities.length, snap.e.length);
console.log('tous les tests OK');
