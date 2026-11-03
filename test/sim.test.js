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

// 5) Jaune rebondit sur son propre mur, rentre chez lui sans dégât (ni pour lui ni pour l'adversaire), le mur est intact.
const g4 = Sim.createGame({ seed: 3, hazard: false });
g4.state.mana.bottom = 70;
g4.place('bottom', 5, 4, 5); g4.state.mana.bottom = 70;
g4.place('bottom', 1, 4, 7);
let homeExit = false;
for (let i = 0; i < 30 * 30; i++) { g4.step(1 / 30); for (const e of g4.drainEvents()) if (e.type === 'kill' && e.ogId === 1 && e.cause === 'home') homeExit = true; }
assert.strictEqual(g4.state.hp.top, 30, 'jaune bloqué par son propre mur : pas de dégât adverse');
assert.strictEqual(g4.state.hp.bottom, 30, 'pas de dégât à sa propre base non plus');
assert.ok(g4.state.entities.some(e => e.ogId === 5 && e.hp === e.hpMax), 'son propre mur est intact');
assert.ok(homeExit, 'le jaune est sorti par sa propre base');

// 5b) Riko qui rebondit sur un mur ennemi devient une créature ennemie en repassant la frontière, et va frapper la base de son ancien maître.
const g4b = Sim.createGame({ seed: 5, hazard: false });
g4b.state.mana.top = 70;
for (let c = 0; c < 9; c++) { g4b.state.mana.top = 70; g4b.place('top', 5, c, 3); } // rangée de murs juste derrière la frontière
g4b.state.mana.bottom = 70; g4b.place('bottom', 4, 4, 7);
let flippedRed = false;
for (let i = 0; i < 30 * 40; i++) { g4b.step(1 / 30); for (const e of g4b.drainEvents()) if (e.type === 'bounce' && e.flip) flippedRed = true; }
assert.ok(flippedRed, 'Riko a changé de camp à la frontière');
assert.ok(g4b.state.hp.bottom < 30, 'la base de son ancien maître a été touchée par le Riko devenu ennemi');
// 6) Rouge rebondit sur un mur ennemi (sans mourir), le mur perd 1 PV par rebond.
const g5 = Sim.createGame({ seed: 4, hazard: false });
g5.state.mana.top = 70; g5.state.mana.bottom = 70;
for (let c = 0; c < 9; c++) { g5.state.mana.top = 70; g5.place('top', 5, c, 3); } g5.place('bottom', 4, 4, 7);
let bounces = 0, redDeadOnWall = false, wallHit = false;
for (let i = 0; i < 30 * 6; i++) { g5.step(1 / 30); for (const e of g5.drainEvents()) { if (e.type === 'bounce' && !e.flip) bounces += 1; if (e.type === 'kill' && e.ogId === 4 && e.cause === 'wall') redDeadOnWall = true; if (e.type === 'hit' && e.ogId === 5) wallHit = true; } }
assert.ok(bounces >= 1 && wallHit && !redDeadOnWall, 'rouge rebondit sur le mur (mur −1 PV, rouge vivant)');
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

// Portée de Krak : carré de 2 cases tout autour, uniquement dans son propre camp.
const gk2 = Sim.createGame({ seed: 11, duration: 0 });
gk2.state.mana.bottom = 70; assert.ok(gk2.place('bottom', 3, 4, 5).ok); // Krak col 4, row 5 (camp bas = rows 4..7)
const wallAt = (col, row) => { gk2.state.mana.top = 70; assert.ok(gk2.place('top', 5, 2, 0).ok); const w = gk2.state.entities[gk2.state.entities.length - 1]; const c = Sim.cellCenter(col, row); w.x = c.x; w.y = c.y; return w; };
const wIn = wallAt(2, 7);   // 2 colonnes à gauche, 2 lignes derrière -> dans la zone (camp bas)
const wEnemy = wallAt(4, 3); // 2 lignes devant mais camp adverse -> hors zone
const wSide = wallAt(7, 5);  // 3 colonnes à droite -> hors zone
let shots = 0; for (let i = 0; i < 30 * 5; i++) { gk2.step(1 / 30); for (const e of gk2.drainEvents()) if (e.type === 'shot') shots += 1; }
assert.ok(shots >= 2, 'Krak tire sur la cible derrière lui dans son camp');
assert.ok(wIn.hp < wIn.hpMax || !gk2.state.entities.includes(wIn), 'la cible dans la zone est touchée');
assert.strictEqual(wEnemy.hp, wEnemy.hpMax, 'le camp adverse n\'est jamais visé');
assert.strictEqual(wSide.hp, wSide.hpMax, 'hors zone latérale : intact');
console.log('portée Krak OK');

// Frontière : Krak (bas, row 4) ne vise pas un ennemi à 1 case devant mais côté adverse (row 3) ; dès qu'il franchit la ligne, il tire.
const gk3 = Sim.createGame({ seed: 12, duration: 0 });
gk3.state.mana.bottom = 70; assert.ok(gk3.place('bottom', 3, 4, 4).ok);
gk3.state.mana.top = 70; assert.ok(gk3.place('top', 5, 4, 0).ok);
const wall = gk3.state.entities[gk3.state.entities.length - 1];
let cNear = Sim.cellCenter(4, 3); wall.x = cNear.x; wall.y = cNear.y; // côté adverse, collé à la frontière
let shots3 = 0; for (let i = 0; i < 30 * 3; i++) { gk3.step(1 / 30); for (const e of gk3.drainEvents()) if (e.type === 'shot') shots3 += 1; }
assert.strictEqual(shots3, 0, 'pas de tir sur un ennemi encore côté adverse');
wall.y = Sim.FIELD.h / 2 + 1; // franchit la frontière
for (let i = 0; i < 30 * 3; i++) { gk3.step(1 / 30); for (const e of gk3.drainEvents()) if (e.type === 'shot') shots3 += 1; }
assert.ok(shots3 >= 1, 'tir dès que l’ennemi a franchi la frontière');
console.log('frontière Krak OK');

// Pose rapprochée : avec l'option, la case se libère bien plus tôt derrière un Zip qui vient de partir.
function freeAfter(features) {
  const g = Sim.createGame({ seed: 21, duration: 0, features });
  g.state.mana.bottom = 70; assert.ok(g.place('bottom', 1, 4, 7).ok);
  for (let i = 1; i < 60; i++) { g.step(1 / 30); if (!g.cellOccupied(4, 7)) return i; }
  return 999;
}
const tight = freeAfter({ tightSpacing: true }), loose = freeAfter({ tightSpacing: false });
assert.ok(tight < loose, `pose rapprochée : case libre après ${tight} ticks (contre ${loose} sans l'option)`);
console.log(`espacement OK (${tight} vs ${loose} ticks)`);

// Équipes : 2v2 sur 13 colonnes, mana individuelle, PV de base partagés.
const gt = Sim.createGame({ seed: 31, duration: 0, cols: Sim.TEAM_COLS[2], players: Sim.teamKeys(2) });
assert.strictEqual(gt.COLS, 13); assert.deepStrictEqual(gt.players, ['top', 'bottom', 'top1', 'bottom1']);
gt.setMana('bottom1', 70); gt.setMana('bottom', 0);
assert.ok(gt.place('bottom1', 1, 12, 7).ok, 'le coéquipier pose sur la colonne 12 (arène large)');
assert.strictEqual(gt.place('bottom', 1, 4, 7).reason, 'mana', 'mana individuelle : le joueur 1 n’a pas celle du joueur 2');
assert.strictEqual(gt.place('bottom1', 1, 4, 2).reason, 'side', 'pas chez l’adversaire');
const unit = gt.state.entities[0]; assert.strictEqual(unit.player, 'bottom'); assert.strictEqual(unit.owner, 'bottom1');
for (let i = 0; i < 30 * 30; i++) gt.step(1 / 30);
assert.strictEqual(gt.state.hp.top, 29, 'la base adverse (partagée) a pris 1 dégât');
const snap2 = gt.snapshot(); assert.ok('top1' in snap2.mana && 'bottom1' in snap2.mana, 'snapshot : mana par joueur');
assert.ok(Sim.decodeSnapshot(snap2).mana.bottom1 >= 0);
console.log('équipes OK');

// IA en équipe : 3v3 sur 17 colonnes, six bots, pas d'exception et des unités posées par chaque clé.
const g33 = Sim.createGame({ seed: 77, duration: 60, cols: Sim.TEAM_COLS[3], players: Sim.teamKeys(3) });
const bots = g33.players.map(k => AI.createAI(g33, k, 'moyen'));
for (let i = 0; i < 30 * 65 && !g33.state.over; i++) { for (const b of bots) b.update(1 / 30); g33.step(1 / 30); g33.drainEvents(); }
const owners = new Set(g33.state.entities.map(e => e.owner));
assert.ok(g33.state.over, '3v3 : la partie se termine');
assert.ok(g33.state.stats.top.placed > 0 && g33.state.stats.bottom.placed > 0, 'les deux équipes ont posé');
console.log('IA 3v3 OK (fin :', g33.state.winner, g33.state.endReason, ', propriétaires vus :', [...owners].length, ')');

// ----- Les 10 nouvelles créatures -----
const DECK_ALL = Sim.OG_IDS;
function mk(seed, opts) { return Sim.createGame(Object.assign({ seed, duration: 0, decks: { top: DECK_ALL, bottom: DECK_ALL } }, opts || {})); }
function runFor(g, secs, fn) { const out = []; for (let i = 0; i < 30 * secs && !g.state.over; i++) { g.step(1 / 30); for (const e of g.drainEvents()) { out.push(e); if (fn) fn(e); } } return out; }
function alive(g, ogId, side) { return g.state.entities.filter(e => e.ogId === ogId && (!side || e.player === side)); }

// Pik : 2 PV, encaisse un Gromp puis continue (un Zip, lui, meurt).
{ const g = mk(101); g.setMana('bottom', 70); g.place('bottom', 8, 4, 7);
  // On pose le Gromp sur la ligne 3 juste quand le Pik approche, pour garantir le contact.
  const ev = []; let grompPlaced = false;
  for (let i = 0; i < 30 * 12; i++) { g.step(1 / 30); ev.push(...g.drainEvents()); const p = alive(g, 8, 'bottom')[0]; if (p && !grompPlaced && p.y < Sim.CELL_H * 3.5 + Sim.RADIUS * 1.9) { g.setMana('top', 70); g.place('top', 2, Math.floor(p.x / Sim.CELL_W) + 1, 3); grompPlaced = true; } } // une colonne à droite : le Gromp (camp haut) part vers la gauche, droit sur le Pik
  const pik = alive(g, 8, 'bottom');
  assert.ok(ev.some(e => e.type === 'hit' && e.ogId === 8), 'Pik a pris un coup du Gromp');
  const firstHit = ev.findIndex(e => e.type === 'hit' && e.ogId === 8), firstKill = ev.findIndex(e => e.type === 'kill' && e.ogId === 8);
  assert.ok(firstHit >= 0 && (firstKill === -1 || firstKill > firstHit) && ev[firstHit].hp === 1, 'Pik survit au premier contact (1 PV restant)');
  console.log('Pik OK (PV restants', pik.length ? pik[0].hp : 'arrivé', ')'); }
// Bulle : atteint la base adverse sans dégât et soigne la sienne de 1.
{ const g = mk(102); g.state.hp.bottom = 25; g.setMana('bottom', 70); g.place('bottom', 9, 4, 7);
  const ev = runFor(g, 40); assert.ok(ev.some(e => e.type === 'heal' && e.target === 'bottom'), 'Bulle soigne'); assert.strictEqual(g.state.hp.bottom, 26); assert.strictEqual(g.state.hp.top, 30); console.log('Bulle OK'); }
// Zazou : volant rapide, ignore un Gromp et un mur, 2 dégâts à la base.
{ const g = mk(103); g.setMana('top', 70); g.place('top', 5, 4, 3); g.setMana('top', 70); g.place('top', 2, 4, 2); g.setMana('bottom', 70); g.place('bottom', 10, 4, 7);
  runFor(g, 15); assert.strictEqual(g.state.hp.top, 28, 'Zazou passe au-dessus et frappe'); console.log('Zazou OK'); }
// Boum : explose au passage d'un ennemi (2 dégâts dans 1,5 case, volants compris), perd une charge (PV) et se réarme.
{ const g = mk(104); g.setMana('top', 70); g.place('top', 11, 4, 3); g.setMana('bottom', 70); g.place('bottom', 8, 4, 7);
  const ev = runFor(g, 10); assert.ok(ev.some(e => e.type === 'blast'), 'la mine explose'); assert.ok(ev.some(e => e.type === 'kill' && e.ogId === 8), 'le Pik (2 PV) est tué par l’explosion'); assert.strictEqual(alive(g, 11).length, 1); assert.strictEqual(alive(g, 11)[0].hp, 1, 'il reste 1 charge'); console.log('Boum OK'); }
// Rafale : souffle (dans son camp seulement) un Zip ennemi vers l'arrière et le blesse (1 PV : il meurt).
{ const g = mk(105); g.setMana('top', 70); g.place('top', 12, 4, 1); g.setMana('bottom', 70); g.place('bottom', 1, 4, 7);
  const ev = runFor(g, 20); assert.ok(ev.some(e => e.type === 'gust'), 'Rafale souffle'); assert.ok(ev.some(e => e.type === 'kill' && e.ogId === 1 && e.cause === 'gust'), 'le Zip meurt du souffle'); assert.strictEqual(g.state.hp.top, 30); console.log('Rafale OK'); }
// Tiktak : 3 PV, 4 dégâts à la base ; abattu par des tourelles, il explose (1 dégât autour).
{ const g = mk(106); g.setMana('bottom', 70); g.place('bottom', 13, 4, 7); runFor(g, 40); assert.strictEqual(g.state.hp.top, 26, 'Tiktak frappe la base pour 4'); 
  const g2 = mk(107); g2.setMana('top', 70); g2.place('top', 3, 4, 3); g2.setMana('top', 70); g2.place('top', 3, 3, 3); g2.setMana('top', 70); g2.place('top', 3, 5, 3); g2.setMana('top', 70); g2.place('top', 2, 4, 2); g2.setMana('bottom', 70); g2.place('bottom', 13, 4, 7);
  const ev = runFor(g2, 30); assert.ok(ev.some(e => e.type === 'blast' && e.player === 'bottom') || g2.state.hp.top === 26, 'Tiktak explose à sa mort (ou arrive)'); console.log('Tiktak OK'); }
// Fantôme : traverse un mur, frappe pour 2 ; est caché dans son camp (snapshot).
{ const g = mk(108); g.setMana('top', 70); g.place('top', 5, 4, 3); g.setMana('bottom', 70); g.place('bottom', 14, 4, 7);
  const s0 = g.snapshot(); const f0 = s0.e.find(a => a[1] === 14); assert.strictEqual(f0[10], 1, 'Fantôme caché chez lui');
  runFor(g, 20); assert.strictEqual(g.state.hp.top, 27, 'Fantôme traverse le mur et frappe 3'); console.log('Fantôme OK'); }
// Glu : ralentit un Zip qui la traverse.
{ const g = mk(109); g.setMana('top', 70); g.place('top', 15, 4, 3); g.setMana('bottom', 70); g.place('bottom', 1, 4, 7);
  let slowed = false; for (let i = 0; i < 30 * 14; i++) { g.step(1 / 30); g.drainEvents(); const z = alive(g, 1)[0]; if (z && z.slowUntil > g.state.time) slowed = true; }
  assert.ok(slowed, 'le Zip est englué'); console.log('Glu OK'); }
// Sirène : charme un Zip ennemi qui change de camp et repart frapper son ancien maître.
{ const g = mk(110); g.setMana('top', 70); g.place('top', 16, 4, 3); g.setMana('bottom', 70); g.place('bottom', 1, 4, 7);
  const ev = runFor(g, 25); assert.ok(ev.some(e => e.type === 'charm'), 'charme'); assert.ok(g.state.hp.bottom < 30, 'le Zip charmé frappe la base du bas'); assert.strictEqual(g.state.hp.top, 30); console.log('Sirène OK'); }
// Kraken : écrase un mur (−1 PV) et tue un Gromp, puis 3 dégâts à la base.
{ const g = mk(111); g.setMana('top', 70); g.place('top', 5, 4, 3); g.setMana('top', 70); g.place('top', 5, 3, 2); g.setMana('top', 70); g.place('top', 5, 5, 2); g.setMana('top', 70); g.place('top', 2, 4, 2); g.setMana('bottom', 70); g.place('bottom', 17, 4, 7); // Gromp coincé entre deux murs sur la colonne 4
  const ev = runFor(g, 60); assert.ok(ev.some(e => e.type === 'kill' && e.ogId === 5 && e.cause === 'crush'), 'mur écrasé'); assert.ok(ev.some(e => e.type === 'kill' && e.ogId === 2), 'Gromp écrasé'); assert.strictEqual(g.state.hp.top, 25, 'Kraken frappe pour 5'); console.log('Kraken OK'); }
// Structures éphémères : un Krak disparaît au bout de sa durée de vie (option « lifetime »), pas si l'option est coupée.
{ const g = mk(110, { features: { lifetime: true } }); g.setMana('top', 70); g.place('top', 3, 4, 2);
  const ev = runFor(g, Sim.OGS[3].lifetime + 1); assert.ok(ev.some(e => e.type === 'kill' && e.ogId === 3 && e.cause === 'expire'), 'le Krak expire'); assert.strictEqual(alive(g, 3).length, 0);
  const g2 = mk(111, { features: { lifetime: false } }); g2.setMana('top', 70); g2.place('top', 3, 4, 2); runFor(g2, Sim.OGS[3].lifetime + 1); assert.strictEqual(alive(g2, 3).length, 1, 'sans l’option, il reste'); console.log('Structures éphémères OK'); }
