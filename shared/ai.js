/*
 * IA Glouglou Arena v2 – joue n'importe quel camp, avec n'importe quelle équipe (deck de 7 créatures, une par coût).
 *
 * Principe : chaque coup possible (créature × colonne) est évalué par la valeur attendue qu'il rapporte
 * (dégâts à la base adverse, structures détruites, soins…) compte tenu de la défense adverse visible dans le
 * couloir : tourelles Krak (nombre de tirs encaissés avant la base), Gromp en patrouille, murs, Rafale, Glu, Sirène.
 * L'IA joue le coup le plus rentable (valeur / mana), et sait ÉCONOMISER pour un coup cher plus rentable plutôt
 * que de gaspiller en créatures bon marché. Elle défend par couloir (menaces entrantes avec temps d'arrivée,
 * contre adapté au type de créature), mémorise les couloirs que l'adversaire utilise le plus, protège son économie
 * et utilise les capacités actives à bon escient. Elle ne triche pas : les mines et les fantômes cachés sont ignorés.
 * Niveaux : simple / moyen / difficile (temps de réaction, discipline de mana, finesse d'évaluation).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sim.js'));
  else root.OGSAI = factory(root.OGSSim);
})(typeof self !== 'undefined' ? self : this, function (Sim) {
  'use strict';

  const { OGS, ROWS, ROWS_PER_SIDE, CELL_W, CELL_H, RULES } = Sim;
  const HALF_H = Sim.FIELD.h / 2;
  const CONFIGS = {
    //           réaction (s)      orbes            réserve  bruit d'évaluation  économise  capacités  Mojo max  anticipation (s)
    //           réaction (s)      orbes            réserve  bruit  économise  capacités  Mojo max  anticipation (s)  réflexe de contre  choix du couloir
    simple: { delay: [2.2, 3.6], orbOdds: 0.5, orbDelay: [1.5, 3.0], reserve: 0, noise: 0.6, saving: 0, abilities: false, economy: 1, lookahead: 4, skill: 0.5, laneSkill: 0.35 },
    moyen: { delay: [1.2, 2.2], orbOdds: 0.8, orbDelay: [0.8, 2.0], reserve: 10, noise: 0.3, saving: 1.15, abilities: true, economy: 1, lookahead: 7, skill: 0.7, laneSkill: 0.6 },
    difficile: { delay: [0.3, 0.7], orbOdds: 0.98, orbDelay: [0.3, 0.9], reserve: 5, noise: 0.25, saving: 1.15, abilities: true, economy: 2, lookahead: 12, skill: 1, laneSkill: 1 },
  };
  const DEFAULT_DECK = [1, 2, 3, 4, 5, 6, 7];
  // Rôles tactiques (par ogId).
  const RUNNER = new Set([1, 8]), AIR = new Set([7, 9, 10]), BRUTE = new Set([13, 17]), GHOST = new Set([14]);
  const DEFENDER = new Set([2]), TURRET = new Set([3]), FAN = new Set([12]), WALL = new Set([5]), ECON = new Set([6]), MINE = new Set([11]), SLOW = new Set([15]), CHARM = new Set([16]), BOUNCER = new Set([4]);
  const ATTACKERS = [1, 4, 7, 8, 9, 10, 13, 14, 17];
  const MOVERS = new Set([1, 2, 4, 7, 8, 9, 10, 13, 14, 17]);
  const STATIC_DEF = new Set([3, 5, 11, 12, 15, 16]);
  const KRAK_HIT = 0.85; // probabilité qu'un tir de Krak touche une cible qui avance tout droit

  // Tirage d'une équipe pour un bot : une créature par coût, parmi celles du jeu ; `variety` = part de nouvelles créatures.
  function randomDeck(rng, variety) {
    const byCost = {};
    for (const og of Object.values(OGS)) (byCost[og.cost] = byCost[og.cost] || []).push(og.id);
    const deck = [];
    for (const cost of [10, 20, 30, 40, 50, 60, 70]) {
      const options = byCost[cost] || [];
      const base = options.find(id => id <= 7), news = options.filter(id => id > 7);
      deck.push(news.length && rng.chance(variety === undefined ? 0.5 : variety) ? rng.pick(news) : base);
    }
    return deck;
  }

  function createAI(game, key, difficulty, deckIn) {
    const cfg = CONFIGS[difficulty] || CONFIGS.moyen;
    const player = Sim.sideOf(key);
    const enemy = Sim.other(player);
    const rng = Sim.createRng((game.opts.seed * 7919 + (player === 'top' ? 13 : 29) + key.length * 101) >>> 0);
    const S = game.state;
    const COLS = game.COLS;
    const deck = (deckIn && deckIn.length === 7 ? deckIn.map(Number) : DEFAULT_DECK).filter(id => OGS[id]);
    const has = (id) => deck.includes(id);
    let timer = rng.range(0.6, 1.4);
    let orbTimer = 1;
    let abilityTimer = 1;
    let lastPlan = null;
    let saving = null; // { id, col, eff, since } : coup pour lequel on économise
    let noSavingUntil = 0; // après un objectif abandonné, pas de nouvelle épargne pendant un moment
    let lastAttack = 0; // dernier coup offensif (pour ne pas rester passif)
    const lanes = new Array(COLS).fill(0); // mémoire des couloirs d'attaque adverses (unités vues dans mon camp)
    const dir = player === 'top' ? 1 : -1; // +1 : mes unités avancent vers y croissant
    const myBaseY = player === 'top' ? 0 : Sim.FIELD.h;
    const depthOf = (row) => (player === 'top' ? row : ROWS - 1 - row); // 0 = ligne du fond, 3 = ligne de front
    const enemyDepthOf = (row) => (enemy === 'top' ? row : ROWS - 1 - row);
    const colOf = (e) => Math.max(0, Math.min(COLS - 1, Math.floor(e.x / CELL_W)));
    const rowOf = (e) => Math.max(0, Math.min(ROWS - 1, Math.floor(e.y / CELL_H)));
    const mana = () => S.mana[key];
    const inMyHalf = (e) => (player === 'top' ? e.y < HALF_H : e.y > HALF_H);
    const visible = (e) => !(e.player === enemy && (OGS[e.ogId].hiddenFromEnemy || (OGS[e.ogId].ghost && !inMyHalf(e))));
    const mine = (pred) => S.entities.filter(e => e.player === player && (!pred || pred(e)));
    const theirs = (pred) => S.entities.filter(e => e.player === enemy && visible(e) && (!pred || pred(e)));
    const enemyKeys = () => game.players.filter(k => Sim.sideOf(k) === enemy);
    const enemyMana = () => Math.max(0, ...enemyKeys().map(k => S.mana[k] || 0));
    const noise = () => 1 + (rng.next() * 2 - 1) * cfg.noise;

    function place(ogId, chooser) {
      if (!has(ogId) || !OGS[ogId] || mana() < OGS[ogId].cost) return false;
      const avail = game.availableCells(key, ogId);
      if (!avail.length) return false;
      const cell = chooser ? chooser(avail) : rng.pick(avail);
      if (!cell) return false;
      return game.place(key, ogId, cell.col, cell.row).ok;
    }
    // Case dans une colonne (± spread colonnes, la plus proche d'abord), à une profondeur donnée (ou n'importe laquelle).
    const inCol = (cells, col, depth, spread) => {
      for (const d of [0, 1, -1, 2, -2].slice(0, spread === undefined ? 1 : spread * 2 + 1)) {
        const f = cells.filter(c => c.col === col + d && (depth === undefined || depthOf(c.row) === depth));
        if (f.length) return rng.pick(f);
      }
      return null;
    };
    const atDepth = (cells, depth) => { const f = cells.filter(c => depthOf(c.row) === depth); return f.length ? rng.pick(f) : rng.pick(cells); };
    const setTimer = (k) => { timer = rng.range(cfg.delay[0], cfg.delay[1]) * (k || 1); };

    // ----- Lecture du terrain -----
    // Nombre de tirs de Krak qu'une unité encaisse en traversant `px` pixels couverts à `speed` px/s.
    const shotsOver = (px, speed) => (px <= 0 ? 0 : 1 + px / Math.max(10, speed) / RULES.orangeCooldown);
    // Lignes (de profondeur) couvertes par un Krak posé à la profondeur d.
    const krakRows = (d) => Math.min(ROWS_PER_SIDE - 1, d + RULES.orangeRange) - Math.max(0, d - RULES.orangeRange) + 1;
    const survival = (hp, hits) => Math.max(0.05, Math.min(1, (hp - hits + 0.5) / hp));

    // Valeur attendue (en "PV de base") d'une créature attaquante lancée dans la colonne c, vu la défense adverse visible.
    function attackValue(ogId, c) {
      const og = OGS[ogId];
      let value = og.baseDamage, hits = 0, surv = 1;
      const hp = og.hp;
      const air = og.air, ghost = !!og.ghost, brute = !!og.brute;
      const speed = og.speed;
      // Kraks adverses : tirs encaissés pendant la traversée de leur camp.
      let krakPx = 0;
      for (const k of theirs(e => TURRET.has(e.ogId))) {
        if (Math.abs(colOf(k) - c) > RULES.orangeRange) continue;
        krakPx += krakRows(enemyDepthOf(rowOf(k))) * CELL_H * (1 + 0.3 * ((k.level || 1) - 1));
      }
      if (krakPx) hits += shotsOver(krakPx, speed) * KRAK_HIT * (BOUNCER.has(ogId) ? 0.75 : 1);
      // Glu dans la colonne : vitesse ÷2 sur une case => plus de tirs.
      if (!air && krakPx && theirs(e => SLOW.has(e.ogId) && Math.abs(colOf(e) - c) <= 1).length) hits += shotsOver(CELL_H * 1.5, speed * RULES.gluFactor) - shotsOver(CELL_H * 1.5, speed);
      // Rafale : repousse d'une case toutes les 2 s les unités au sol devant elle => les lentes n'avancent plus.
      const fans = theirs(e => FAN.has(e.ogId) && Math.abs(colOf(e) - c) <= 1).length;
      if (fans) { surv *= brute ? 1 : speed < 75 ? 0.3 : speed < 110 ? 0.6 : 0.85; hits += brute ? shotsOver(CELL_H * 2.5, speed) * 0.7 : air ? 1 : 1.4; } // le souffle repousse (pas les brutes) et blesse (sol et air)
      // Mes propres murs dans la colonne renvoient mes unités au sol (sauf fantôme et Kraken) : couloir à éviter.
      if (!air && !ghost && !og.crushesWalls && mine(e => WALL.has(e.ogId) && colOf(e) === c).length) surv *= 0.05;
      // Gromp en patrouille (toute la largeur) : frappe les unités au sol.
      const gromps = theirs(e => DEFENDER.has(e.ogId)).length;
      if (gromps && !air && !ghost) {
        if (BOUNCER.has(ogId)) { surv *= 0.45; value += 0.8; } // Riko et Gromp meurent ensemble
        else if (brute) { value += 0.6 * Math.min(gromps, 2); hits += 0.6; } // la brute l'écrase mais prend un coup
        else surv *= Math.pow(hp === 1 ? 0.55 : 0.85, gromps);
      }
      // Murs : renvoient runners, Riko et Tiktak (le runner devient ennemi en repassant la frontière !) ; Kraken les écrase.
      const walls = theirs(e => WALL.has(e.ogId) && colOf(e) === c).length;
      if (walls && !air && !ghost) {
        if (og.crushesWalls) { value += 1.2 * walls; hits += 0.8 * walls; }
        else if (BOUNCER.has(ogId)) surv *= 0.5;
        else { surv *= 0.1; value -= 0.6; }
      }
      // Sirène : charme l'unité au sol la plus proche (hors brutes) ; l'unité charmée se retourne contre moi.
      const sirens = theirs(e => CHARM.has(e.ogId) && Math.abs(colOf(e) - c) <= 2).length;
      if (sirens && !air && !brute && !ghost) { surv *= 0.5; value -= 0.3; }
      // Bonus : Riko détruit tourelles et chargeurs ; Kraken écrase les unités au sol ; Tiktak explose en mourant.
      if (BOUNCER.has(ogId)) {
        value += 2.2 * theirs(e => (TURRET.has(e.ogId) || FAN.has(e.ogId)) && Math.abs(colOf(e) - c) <= 1).length;
        value += 2.5 * theirs(e => ECON.has(e.ogId) && Math.abs(colOf(e) - c) <= 1).length;
      }
      if (og.crushesWalls) value += 0.8 * theirs(e => STATIC_DEF.has(e.ogId) && !WALL.has(e.ogId) && colOf(e) === c).length;
      if (og.blastOnDeath) value += 0.3;
      if (og.heals) value = (S.hp[player] <= RULES.healthMax - 1 ? 1 : 0) * (S.hp[player] < 15 ? 1.4 : 1);
      // Zéphir adverse en défense (tire devant lui dans son camp) : malus pour les cibles qu'il peut toucher.
      if ((air || RUNNER.has(ogId) || ghost) && theirs(e => e.ogId === 7 && !inMyHalf(e) && Math.abs(colOf(e) - c) <= 1).length) hits += 1;
      return Math.max(0, value * survival(hp, hits) * surv);
    }

    // Menaces : unités adverses en marche vers ma base, avec temps d'arrivée estimé et tirs que mes Kraks leur réservent.
    function threats() {
      const out = [];
      for (const e of theirs(x => MOVERS.has(x.ogId) && x.movement !== 'horizontal')) {
        const toward = Math.sign(e.vy || 0) === -dir;
        if (!toward) continue;
        const dist = Math.abs(e.y - myBaseY);
        const eta = dist / Math.max(1, Math.abs(e.vy) || e.speed);
        const col = colOf(e);
        const og = OGS[e.ogId];
        // Couverture : px restants dans mon camp couverts par mes Kraks (dans leur carré de portée).
        let px = 0;
        for (const k of mine(x => TURRET.has(x.ogId))) {
          if (Math.abs(colOf(k) - col) > RULES.orangeRange) continue;
          const kd = depthOf(rowOf(k));
          const lo = Math.max(0, kd - RULES.orangeRange), hi = Math.min(ROWS_PER_SIDE - 1, kd + RULES.orangeRange);
          const d = inMyHalf(e) ? Math.min(ROWS_PER_SIDE - 1, depthOf(rowOf(e))) : ROWS_PER_SIDE - 1; // profondeur actuelle, elle ira vers 0
          const rows = Math.max(0, Math.min(d, hi) - lo + 1);
          px += rows * CELL_H;
        }
        const hits = shotsOver(px, Math.abs(e.vy) || e.speed) * KRAK_HIT;
        const covered = hits >= e.hp + 0.3;
        const value = og.baseDamage + (og.heals ? 0.8 : 0) + (og.crushesWalls ? 1.5 : 0);
        out.push({ e, col, eta, hits, covered, value, danger: value / Math.max(1, eta / 4) });
      }
      return out.sort((a, b) => b.danger - a.danger);
    }
    function myDefenseIn(col) {
      return mine(e => Math.abs(colOf(e) - col) <= 1 && STATIC_DEF.has(e.ogId));
    }
    function hottestLane() {
      let best = Math.floor(COLS / 2), bestN = -1;
      for (let c = 0; c < COLS; c += 1) { const n = lanes[c] + rng.next() * 0.5; if (n > bestN) { bestN = n; best = c; } }
      return best;
    }
    // Profondeur idéale pour un Krak : couvrir toute ma moitié (profondeur 1 ou 2), un peu en retrait si l'adversaire a des Riko/Kraken.
    const krakDepth = () => (theirs(e => BOUNCER.has(e.ogId) || e.ogId === 17).length ? 1 : rng.chance(0.5) ? 1 : 2);

    // ----- Contres : meilleure réponse à une menace -----
    function counter(t) {
      const { e, col } = t;
      const og = e.ogId;
      if (rng.next() > cfg.skill) return false; // les IA faibles ratent parfois la réponse
      const tried = [];
      const attempt = (id, chooser) => { if (!has(id) || tried.includes(id)) return false; tried.push(id); return place(id, chooser); };
      const krak = () => attempt(3, cells => inCol(cells, col, krakDepth(), 1) || inCol(cells, col, 2, 2));
      const fans = mine(x => FAN.has(x.ogId)).length, mines = mine(x => MINE.has(x.ogId));
      const fan = () => fans < 3 && attempt(12, cells => inCol(cells, col, 2, 1));
      // Boum (3 charges, sol et air) : une mine dans le couloir s'il n'y en a pas déjà une à portée.
      const mineHere = () => mines.length < 3 && !mines.some(m => Math.abs(colOf(m) - col) <= 1) && attempt(11, cells => inCol(cells, col, 3, 0) || inCol(cells, col, 2, 0));
      if (AIR.has(og)) return krak() || fan() || mineHere() || attempt(7, cells => inCol(cells, col, 0, 1)); // volant : Krak, Rafale (vent), Boum, Zéphir
      if (GHOST.has(og)) return krak() || mineHere() || attempt(4, cells => inCol(cells, col, 0, 1)) || attempt(7, cells => inCol(cells, col, 0, 1));
      if (BRUTE.has(og)) { // Tiktak / Kraken : mine (3 dégâts), Rafale, Krak, Blok (Tiktak rebondit), Glu, contre-brute
        return mineHere() || fan()
          || krak() || (og === 13 && attempt(5, cells => inCol(cells, col, 1, 0))) || attempt(15, cells => inCol(cells, col, 2, 0)) || attempt(17, cells => inCol(cells, col, 0, 1)) || attempt(13, cells => inCol(cells, col, 0, 1));
      }
      if (BOUNCER.has(og)) { // Riko : Gromp (échange gagnant), mur, brute
        return attempt(2, cells => inCol(cells, col, 2, 2)) || attempt(5, cells => inCol(cells, col, 1, 1)) || attempt(13, cells => inCol(cells, col, 0, 1)) || fan();
      }
      if (RUNNER.has(og)) { // runners (1 dégât) : seulement des contres durables et pas trop chers — Gromp, Krak, Blok/Sirène dans un couloir très utilisé
        const gromps = mine(x => DEFENDER.has(x.ogId)).length;
        const hot = lanes[col] >= 3;
        return (gromps < 1 && attempt(2, cells => inCol(cells, col, 2, 1) || inCol(cells, col, 1, 2))) || krak()
          || (hot && mine(x => WALL.has(x.ogId)).length < 2 && attempt(5, cells => inCol(cells, col, 1, 0))) || (hot && mineHere()) || (hot && attempt(16, cells => inCol(cells, col, 2, 1))) || (hot && fan())
          || (gromps < 2 && attempt(2, cells => inCol(cells, col, 2, 2)));
      }
      return false;
    }

    // ----- Attaque : le coup le plus rentable, en économisant si un coup cher vaut nettement mieux -----
    function bestAttack(budget) {
      let best = null;
      const sloppy = rng.next() > cfg.laneSkill; // IA faible : ne regarde qu'un couloir au hasard
      const only = sloppy ? Math.floor(rng.next() * COLS) : -1;
      for (const id of deck) {
        if (!ATTACKERS.includes(id) || OGS[id].cost > budget) continue;
        const og = OGS[id];
        for (let c = 0; c < COLS; c += 1) {
          if (only >= 0 && c !== only) continue;
          const v = attackValue(id, c) * noise();
          const eff = v / og.cost;
          if (!best || eff > best.eff) best = { id, col: c, value: v, eff, cost: og.cost };
        }
      }
      return best;
    }
    function attack(forced) {
      const m = mana();
      const hard = m - (forced ? 0 : fortifyNeed()); // la fortification en attente passe avant toute attaque
      const reserve = forced ? 0 : S.time > 15 ? cfg.reserve + (enemyMana() > 55 ? 10 : 0) : 0; // réserve souple (défense d'urgence)
      const budget = hard - reserve;
      const play = (o) => { const og = OGS[o.id]; const ok = place(o.id, cells => inCol(cells, o.col, og.backOnly ? 0 : 3, 1) || inCol(cells, o.col, undefined, 2) || rng.pick(cells)); if (ok) lastAttack = S.time; return ok; };
      // Objectif d'épargne atteint : on le joue (s'il vaut toujours le coup), la réserve ne s'applique pas à lui.
      if (saving && hard >= saving.cost) {
        const target = saving;
        saving = null;
        if (attackValue(target.id, target.col) > 0.4 && play(target)) return true;
      }
      const all = bestAttack(m >= RULES.manaMax - 2 ? hard : RULES.manaMax); // meilleur coup toutes bourses confondues
      const best = bestAttack(budget); // meilleur coup payable maintenant (réserve déduite)
      // Économiser : un coup plus cher nettement plus rentable, et on n'est pas près de plafonner la mana. L'objectif est
      // conservé (sinon le bruit d'évaluation ferait dépenser à chaque réflexion) jusqu'à être payable, ou 25 s.
      if (!forced && cfg.saving) {
        if (saving && S.time - saving.since < 25 && saving.cost > hard && attackValue(saving.id, saving.col) > 0.5) return false;
        if (saving) noSavingUntil = S.time + 20; // objectif abandonné (trop long ou plus rentable)
        if (S.time >= noSavingUntil && all && all.cost > hard && (!best || all.eff > best.eff * cfg.saving) && all.value > 0.6) { saving = Object.assign({ since: S.time }, all); return false; }
      }
      saving = null;
      if (all && all.cost <= hard && all.cost > budget && all.cost >= 40 && all.value > 0.6 && (!best || all.eff > best.eff * (cfg.saving || 1))) return play(all); // coup cher payable : la réserve souple ne le bloque pas
      if (!best) return false;
      // Rien de rentable : on laisse monter la mana… sauf si on n'a rien tenté depuis 20 s (rester passif, c'est perdre à l'usure).
      if (!forced && best.value < 0.15 && S.time - lastAttack < 20) return false;
      return play(best);
    }

    // ----- Défense préventive, économie -----
    // Structure défensive de niveau 30 du deck (Krak, Rafale ou Boum) et portée latérale (en colonnes) de chacune.
    const DEF30 = deck.find(id => id === 3 || id === 12 || id === 11) || null;
    const REACH = { 3: RULES.orangeRange, 12: 1, 11: 1 };
    const coveredBy = (col) => mine(e => REACH[e.ogId] !== undefined && Math.abs(colOf(e) - col) <= REACH[e.ogId]).length;
    const placeDef = (id, col, spread) => place(id, cells => inCol(cells, col, id === 3 ? krakDepth() : id === 12 ? 2 : 3, spread === undefined ? 1 : spread) || inCol(cells, col, undefined, 2));
    // Mana à garder pour la fortification en attente (la première structure, ou la couverture du couloir chaud).
    function fortifyNeed() {
      if (!DEF30) return 0;
      const n = mine(e => REACH[e.ogId] !== undefined).length;
      if (n === 0 && S.time > 4) return 30;
      if (n < 3 && lanes[hottestLane()] >= 2 && !coveredBy(hottestLane())) return 30;
      return 0;
    }
    function fortify() {
      const m = mana();
      const enemyAir = theirs(e => AIR.has(e.ogId)).length;
      const hot = hottestLane();
      const structures = mine(e => REACH[e.ogId] !== undefined);
      // Une première structure défensive tôt dans le couloir le plus utilisé (ou au centre) : elle tue à elle seule les vagues de petites créatures.
      if (DEF30 && structures.length === 0 && m >= 30 && (S.time > 6 || enemyAir)) { if (placeDef(DEF30, hot, 2)) return true; }
      // Couvrir le couloir chaud s'il ne l'est pas (jusqu'à 3 structures).
      if (DEF30 && structures.length >= 1 && structures.length < 3 && m >= 30 + cfg.reserve && !coveredBy(hot) && lanes[hot] >= 1) { if (placeDef(DEF30, hot, 1)) return true; }
      // Mine supplémentaire dans le couloir chaud, au front (elle a 3 charges).
      if (has(11) && structures.length < 4 && m >= 30 + cfg.reserve && lanes[hot] >= 3 && rng.chance(0.5)) { if (place(11, cells => inCol(cells, hot, 3, 1))) return true; }
      // Sirène dans le couloir chaud quand l'adversaire envoie des unités au sol (chaque charme = 2 PV de différence).
      if (has(16) && !mine(e => CHARM.has(e.ogId)).length && m >= 60 + cfg.reserve && lanes.reduce((a, b) => a + b, 0) >= 4 && theirs(e => !e.air && e.movement !== 'static' && !BRUTE.has(e.ogId)).length) { if (place(16, cells => inCol(cells, hot, 2, 2))) return true; }
      // Blok dans le couloir chaud contre les runners (ils rebondissent et changent de camp à la frontière).
      if (has(5) && mine(e => WALL.has(e.ogId)).length < 2 && m >= 50 + cfg.reserve && lanes[hot] >= 3 && theirs(e => RUNNER.has(e.ogId)).length && !mine(e => WALL.has(e.ogId) && Math.abs(colOf(e) - hot) <= 1).length) { if (place(5, cells => inCol(cells, hot, 1, 0))) return true; }
      // Glu au front du couloir chaud, devant une structure qui tire : les unités englués prennent plus de coups.
      if (has(15) && !mine(e => SLOW.has(e.ogId)).length && m >= 50 + cfg.reserve && lanes[hot] >= 3 && coveredBy(hot)) { if (place(15, cells => inCol(cells, hot, 3, 1))) return true; }
      return false;
    }
    function economy() {
      const chargers = mine(e => ECON.has(e.ogId));
      // Mojo : rentable seulement tôt (il se rembourse en ~60 s), et quand rien ne presse.
      if (has(6) && chargers.length < cfg.economy && S.time < 70 && mana() >= 60 && !threats().some(t => t.eta < 8 && !t.covered)) {
        if (place(6, cells => atDepth(cells, 0))) return true;
      }
      // Protéger un chargeur sans tourelle à côté.
      const turrets = mine(e => TURRET.has(e.ogId));
      const unprotected = chargers.find(c => !turrets.some(t => Math.abs(colOf(t) - colOf(c)) <= 1));
      if (unprotected && has(3) && mana() >= 30) { const cc = colOf(unprotected); if (place(3, cells => inCol(cells, cc, 1, 1))) return true; }
      return false;
    }

    // Trop de mana : renforts durables (Krak supplémentaire, Blok dans le couloir chaud, Gromp, Mojo tôt).
    function overflow() {
      const hot = hottestLane();
      const kraks = mine(e => TURRET.has(e.ogId));
      if (has(3) && kraks.length < 3 && place(3, cells => inCol(cells, kraks.length ? (kraks.every(k => Math.abs(colOf(k) - hot) > 1) ? hot : (hot + Math.floor(COLS / 2)) % COLS) : hot, krakDepth(), 2))) return true;
      if (has(6) && S.time < 110 && mine(e => ECON.has(e.ogId)).length < cfg.economy + 1 && place(6, cells => atDepth(cells, 0))) return true;
      if (has(5) && mine(e => WALL.has(e.ogId)).length < 2 && lanes[hot] >= 2 && place(5, cells => inCol(cells, hot, 1, 0))) return true;
      if (has(2) && mine(e => DEFENDER.has(e.ogId)).length < 2 && place(2, cells => inCol(cells, hot, 2, 2))) return true;
      if (has(16) && !mine(e => CHARM.has(e.ogId)).length && place(16, cells => inCol(cells, hot, 2, 2))) return true;
      if (has(12) && !mine(e => FAN.has(e.ogId)).length && place(12, cells => inCol(cells, hot, 3, 1))) return true;
      return false;
    }

    // ----- Capacités actives -----
    function abilities() {
      if (!cfg.abilities || !game.features.abilities) return;
      const near = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r * r;
      const en = theirs(e => e.movement !== 'static');
      const tryUse = (id, cond) => { if (!has(id) || !cond()) return false; return game.useAbility(key, id).ok; };
      if (tryUse(6, () => mana() <= RULES.manaMax - 32 && mine(e => e.ogId === 6).length >= 1)) return; // burst : rentable dès 1 Mojo
      if (tryUse(3, () => mine(e => e.ogId === 3).some(k => en.filter(e => near(k, e, CELL_W * 1.1)).length >= 2))) return;
      if (tryUse(5, () => mine(e => e.ogId === 5).some(w => en.some(e => !e.air && near(w, e, CELL_W * 1.1))))) return;
      if (tryUse(7, () => mine(e => e.ogId === 7).some(z => en.some(e => !e.air && near(z, e, CELL_W * 1.1))))) return;
      if (tryUse(1, () => mine(e => e.ogId === 1 && !inMyHalf(e)).length >= 2)) return;
      if (tryUse(4, () => mine(e => e.ogId === 4 && !inMyHalf(e)).length >= 1 && mana() > 30)) return;
      if (tryUse(2, () => mine(e => e.ogId === 2).length >= 1 && theirs(e => RUNNER.has(e.ogId) && inMyHalf(e)).length >= 2)) return;
    }

    function think() {
      // Mémoire des couloirs : unités adverses qui avancent dans mon camp.
      for (const e of theirs(x => MOVERS.has(x.ogId) && x.movement !== 'horizontal' && inMyHalf(x))) lanes[colOf(e)] += 0.5;
      const ts = threats();
      // 1) Menaces non couvertes qui arrivent dans la fenêtre d'anticipation, les plus dangereuses d'abord.
      for (const t of ts) {
        if (t.eta > cfg.lookahead) break;
        if (t.covered) continue;
        if (t.value < 1 && myDefenseIn(t.col).length >= 1) continue;
        if (counter(t)) { lastPlan = 'defense'; setTimer(0.6); return; }
      }
      // 2) Économie, puis fortification (Krak tôt).
      if (economy()) { lastPlan = 'eco'; setTimer(0.8); return; }
      if (fortify()) { lastPlan = 'fortify'; setTimer(0.8); return; }
      // 3) Attaque (ou économie pour un coup cher).
      if (attack()) { lastPlan = 'attack'; setTimer(0.7); return; }
      // 4) Mana presque au plafond : ne rien faire serait du gaspillage => renforcer, sinon attaquer quand même.
      if (mana() >= RULES.manaMax - (saving ? 1 : 8) && (overflow() || attack(true))) { lastPlan = 'overflow'; setTimer(0.7); return; }
      lastPlan = saving ? 'saving' : 'wait';
      setTimer(saving ? 0.5 : 1);
    }

    function update(dt) {
      if (S.over) return;
      orbTimer -= dt;
      if (orbTimer <= 0) {
        orbTimer = rng.range(cfg.orbDelay[0], cfg.orbDelay[1]);
        const orb = S.orbs.find(o => o.player === player);
        if (orb && rng.chance(cfg.orbOdds)) game.collectOrb(key, orb.id);
      }
      abilityTimer -= dt;
      if (abilityTimer <= 0) { abilityTimer = rng.range(0.6, 1.4); abilities(); }
      if (S.hazard.active) return;
      timer -= dt;
      if (timer > 0) return;
      think();
    }

    return { update, player, difficulty, deck, get plan() { return lastPlan; }, get lanes() { return lanes.slice(); } };
  }

  return { createAI, CONFIGS, randomDeck, DEFAULT_DECK };
});
