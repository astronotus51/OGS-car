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
assert.strictEqual(g.canPlace('bottom', 1, 0, 4).reason, 'back', 'runner interdit hors ligne du fond');
assert.ok(g.canPlace('bottom', 4, 0, 7).ok);
assert.ok(g.place('bottom', 1, 0, 7).ok);
assert.strictEqual(g.canPlace('bottom', 1, 0, 7).reason, 'occupied');
assert.strictEqual(g.canPlace('bottom', 7, 1, 7).reason, 'mana');
assert.strictEqual(g.availableCells('bottom', 5).length, 35);
assert.strictEqual(g.availableCells('bottom', 1).length, 8);
const gu = Sim.createGame({ seed: 9, duration: 0 }); for (let i = 0; i < 30 * 400; i++) gu.step(1 / 30); assert.ok(!gu.state.over, 'durée illimitée');

// 3) Runner atteint la base adverse.
for (let i = 0; i < 30 * 30; i++) g.step(1 / 30);
assert.strictEqual(g.state.hp.top, 29, 'runner doit infliger 1');
// 4) Jaune rebondit sur mur ennemi et change de camp.
const g3 = Sim.createGame({ seed: 2, hazard: false });
g3.state.mana.top = 70; g3.state.mana.bottom = 70;
g3.place('top', 5, 4, 2); // mur top col 4 row 2
g3.place('bottom', 1, 4, 7);
let flipped = false;
for (let i = 0; i < 30 * 30; i++) { g3.step(1 / 30); const ev = g3.drainEvents(); if (ev.some(e => e.type === 'bounce' && e.flip)) flipped = true; }
assert.ok(flipped, 'le jaune doit rebondir sur le mur ennemi');

// 5) Jaune passe au-dessus de son propre mur.
const g4 = Sim.createGame({ seed: 3, hazard: false });
g4.state.mana.bottom = 70;
g4.place('bottom', 5, 4, 5); g4.state.mana.bottom = 70;
g4.place('bottom', 1, 4, 7);
for (let i = 0; i < 30 * 30; i++) g4.step(1 / 30);
assert.strictEqual(g4.state.hp.top, 29, 'jaune traverse son propre mur');
// 6) Rouge casse un mur ennemi et meurt.
const g5 = Sim.createGame({ seed: 4, hazard: false });
g5.state.mana.top = 70; g5.state.mana.bottom = 70;
for (let c = 0; c < 9; c++) { g5.state.mana.top = 70; g5.place('top', 5, c, 3); } g5.place('bottom', 4, 4, 7);
let wallDead = false, redDead = false;
for (let i = 0; i < 30 * 25; i++) { g5.step(1 / 30); for (const e of g5.drainEvents()) { if (e.type === 'kill' && e.ogId === 5) wallDead = true; if (e.type === 'kill' && e.ogId === 4) redDead = true; } }
assert.ok(wallDead && redDead, 'rouge vs mur');
// 7) Snapshot roundtrip
const snap = g1.snapshot(); const dec = Sim.decodeSnapshot(snap);
assert.strictEqual(dec.entities.length, snap.e.length);
console.log('tous les tests OK');

// ---- Fonctionnalités (features) ----
const FF = { abilities: true, evolution: true, overtime: true, powerPatches: true, kingOfCenter: false, manaX2: true, fastUnits: true, zigzag: true };
const gf = Sim.createGame({ seed: 5, features: FF, bans: { bottom: [7] } });
assert.strictEqual(gf.state.mana.bottom, 30, 'mana x2 : 30 au départ');
gf.state.mana.bottom = 70;
assert.strictEqual(gf.canPlace('bottom', 7, 0, 7).reason, 'banned');
assert.ok(gf.place('bottom', 3, 2, 5).ok);
gf.state.mana.bottom = 70;
const ev = gf.place('bottom', 3, 2, 5);
assert.strictEqual(ev.evolved, 2, 'évolution niveau 2');
assert.ok(gf.availableCells('bottom', 3).some(c => c.evolve), 'case évoluable listée');
gf.state.mana.bottom = 70;
assert.strictEqual(gf.canUseAbility('bottom', 1).reason, 'none');
assert.ok(gf.place('bottom', 1, 0, 7).ok);
gf.state.mana.bottom = 70;
assert.ok(gf.useAbility('bottom', 1).ok, 'sprint');
assert.strictEqual(gf.canUseAbility('bottom', 1).reason, 'cooldown');
const snapF = Sim.decodeSnapshot(gf.snapshot());
assert.ok(snapF.entities.find(e => e.ogId === 1).boosted, 'boost dans le snapshot');
assert.strictEqual(snapF.entities.find(e => e.ogId === 3).level, 2);
// Mort subite
const go = Sim.createGame({ seed: 6, duration: 1, features: { overtime: true } });
for (let i = 0; i < 40; i++) go.step(1 / 30);
assert.ok(go.state.overtime && !go.state.over, 'mort subite déclenchée');
go.state.mana.bottom = 70; go.place('bottom', 1, 4, 7);
for (let i = 0; i < 30 * 20 && !go.state.over; i++) go.step(1 / 30);
assert.strictEqual(go.state.winner, 'bottom'); assert.strictEqual(go.state.endReason, 'overtime');
// Roi du centre
const gk = Sim.createGame({ seed: 7, duration: 0, features: { kingOfCenter: true } });
gk.state.mana.bottom = 70; gk.place('bottom', 5, 4, 4); gk.state.mana.bottom = 70; gk.place('bottom', 5, 5, 4);
for (let i = 0; i < 30 * 40 && !gk.state.over; i++) gk.step(1 / 30);
assert.strictEqual(gk.state.endReason, 'points'); assert.strictEqual(gk.state.winner, 'bottom');
// Patch Gromp/Riko : Riko rebondit, Gromp survit
const gp = Sim.createGame({ seed: 8, features: { powerPatches: true } });
gp.state.mana.top = 70; gp.state.mana.bottom = 70;
for (let c = 0; c < 9; c++) { gp.state.mana.top = 70; gp.place('top', 2, c, 3); } gp.place('bottom', 4, 4, 7);
let grompAlive = true; for (let i = 0; i < 30 * 20; i++) { gp.step(1 / 30); for (const e of gp.drainEvents()) if (e.type === 'kill' && e.ogId === 2) grompAlive = false; }
assert.ok(grompAlive, 'Gromp survit au Riko');
console.log('features OK');
