/*
 * IA OGS – joue n'importe quel camp sur une partie créée par sim.js.
 * Niveaux : simple / moyen / difficile (cf. AI.md).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sim.js'));
  else root.OGSAI = factory(root.OGSSim);
})(typeof self !== 'undefined' ? self : this, function (Sim) {
  'use strict';

  const CONFIGS = {
    simple: { delay: [2.0, 3.2], pool: [1, 1, 2, 3, 6, 4], chargers: 3, orbOdds: 0.6, orbDelay: [1.5, 3.0] },
    moyen: { delay: [1.2, 2.4], pool: [1, 2, 3, 6, 7, 4], chargers: 3, orbOdds: 0.85, orbDelay: [0.8, 2.0] },
    difficile: { delay: [0.8, 1.6], pool: [1, 2, 3, 6, 7, 4], chargers: 4, orbOdds: 0.98, orbDelay: [0.4, 1.2] },
  };

  function createAI(game, player, difficulty) {
    const cfg = CONFIGS[difficulty] || CONFIGS.moyen;
    const rng = Sim.createRng((game.opts.seed * 7919 + (player === 'top' ? 13 : 29)) >>> 0);
    const S = game.state;
    const enemy = Sim.other(player);
    const { ROWS_PER_SIDE, COLS, OGS } = Sim;
    let timer = 1.5;
    let orbTimer = 1;
    // Ligne "rowWithinSide" : 0 = fond de camp, 3 = contact du centre pour top ; inversé pour bottom.
    const rowAt = (depthFromBack) => (player === 'top' ? depthFromBack : Sim.ROWS - 1 - depthFromBack);
    const frontRow = rowAt(ROWS_PER_SIDE - 1);
    const depthOf = (row) => (player === 'top' ? row : Sim.ROWS - 1 - row);

    const mine = (ids) => S.entities.filter(e => e.player === player && ids.includes(e.ogId));
    const theirs = (ids) => S.entities.filter(e => e.player === enemy && ids.includes(e.ogId));

    function placeOg(ogId, chooser) {
      const avail = game.availableCells(player, ogId);
      if (!avail.length) return false;
      if (S.mana[player] < OGS[ogId].cost) return false;
      const cell = chooser ? chooser(avail) : rng.pick(avail);
      if (!cell) return false;
      return game.place(player, ogId, cell.col, cell.row).ok;
    }
    const inCol = (cells, col, depth) => {
      const f = cells.filter(c => c.col === col && (depth === undefined || depthOf(c.row) === depth));
      return f.length ? rng.pick(f) : null;
    };
    const atDepth = (cells, depth) => {
      const f = cells.filter(c => depthOf(c.row) === depth);
      return rng.pick(f.length ? f : cells);
    };
    const setTimer = (lo, hi) => { timer = rng.range(lo, hi); };

    function defend(threat) {
      const cell = Sim.cellOf(threat.x, threat.y);
      if (!cell) return false;
      const col = cell.col;
      if (threat.ogId === 7 && cfg.pool.includes(3)) return placeOg(3, cells => inCol(cells, col, 2) || inCol(cells, col));
      if (threat.ogId === 1) return placeOg(5, cells => inCol(cells, col, 0) || inCol(cells, col));
      if (threat.ogId === 4) return placeOg(5, cells => inCol(cells, col, 1) || inCol(cells, col));
      return false;
    }

    function think() {
      const chargers = mine([6]);
      const turrets = mine([3]);
      const enemyChargers = theirs([6]);
      const enemyYellows = theirs([1]);
      const threats = S.entities.filter(e => e.player === enemy && e.movement !== 'static');

      // Menaces : traiter la plus proche de notre base.
      if (threats.length) {
        const sorted = [...threats].sort((a, b) => (player === 'top' ? a.y - b.y : b.y - a.y));
        for (const t of sorted) {
          const distToUs = player === 'top' ? t.y : Sim.FIELD.h - t.y;
          if (distToUs > Sim.FIELD.h * 0.6) continue;
          if (defend(t)) { setTimer(cfg.delay[0] * 0.7, cfg.delay[1]); return; }
        }
      }

      // Push coordonné.
      if (difficulty !== 'simple' && S.mana[player] >= 40 && cfg.pool.includes(3)) {
        const targetCol = enemyChargers.length ? Sim.cellOf(enemyChargers[0].x, enemyChargers[0].y).col : rng.int(COLS);
        const placedTurret = placeOg(3, cells => inCol(cells, targetCol, ROWS_PER_SIDE - 1) || rng.pick(cells));
        const placedViolet = placedTurret && cfg.pool.includes(2) ? placeOg(2, cells => inCol(cells, targetCol, ROWS_PER_SIDE - 2) || rng.pick(cells)) : false;
        const placedRunner = placedTurret && cfg.pool.includes(1) ? placeOg(1, cells => inCol(cells, targetCol) || rng.pick(cells)) : false;
        if (placedTurret || placedViolet || placedRunner) { setTimer(cfg.delay[0] * 0.7, cfg.delay[1] * 0.7); return; }
      }

      // Économie : chargeurs au milieu du camp.
      if (chargers.length < Math.max(2, cfg.chargers) && cfg.pool.includes(6)) {
        if (placeOg(6, cells => atDepth(cells, 1))) { setTimer(cfg.delay[0] * 0.7, cfg.delay[1]); return; }
      }
      // Protéger chaque chargeur avec une tourelle voisine.
      const unprotected = chargers.map(c => Sim.cellOf(c.x, c.y)).filter(Boolean).find(cc =>
        !turrets.some(t => { const tc = Sim.cellOf(t.x, t.y); return tc && Math.abs(tc.col - cc.col) <= 1 && Math.abs(tc.row - cc.row) <= 1; })
      );
      if (unprotected && cfg.pool.includes(3)) {
        if (placeOg(3, cells => {
          const near = cells.filter(c => Math.abs(c.col - unprotected.col) <= 1 && Math.abs(c.row - unprotected.row) <= 1);
          return rng.pick(near.length ? near : cells);
        })) { setTimer(cfg.delay[0] * 0.8, cfg.delay[1]); return; }
      }
      // Chasser les chargeurs ennemis avec des rouges.
      if (enemyChargers.length && cfg.pool.includes(4)) {
        if (placeOg(4)) { setTimer(cfg.delay[0], cfg.delay[1]); return; }
      }
      // Violets contre les jaunes.
      if (chargers.length >= 2 && enemyYellows.length && cfg.pool.includes(2)) {
        if (placeOg(2, cells => atDepth(cells, 2))) { setTimer(cfg.delay[0], cfg.delay[1]); return; }
      }
      // Pression mid/late.
      if (S.time > 80 && cfg.pool.includes(7) && S.mana[player] >= OGS[7].cost) {
        const col = enemyChargers.length ? Sim.cellOf(enemyChargers[0].x, enemyChargers[0].y).col : rng.int(COLS);
        if (placeOg(7, cells => inCol(cells, col) || rng.pick(cells))) { setTimer(cfg.delay[0] * 0.6, cfg.delay[1]); return; }
      }
      if (S.time > 70 && cfg.pool.includes(4) && S.mana[player] >= OGS[4].cost) {
        if (placeOg(4)) { setTimer(cfg.delay[0], cfg.delay[1]); return; }
      }
      // Attendre pour une pièce plus chère ?
      const maxCost = Math.max(...cfg.pool.map(id => OGS[id].cost));
      if (S.mana[player] < maxCost && difficulty !== 'simple' && rng.chance(0.6)) { setTimer(cfg.delay[0] * 0.8, cfg.delay[1] * 1.2); return; }
      // Sinon : pioche.
      for (let i = 0; i < 10; i += 1) { if (placeOg(rng.pick(cfg.pool))) break; }
      setTimer(cfg.delay[0], cfg.delay[1]);
    }

    function update(dt) {
      if (S.over) return;
      // Orbes.
      orbTimer -= dt;
      if (orbTimer <= 0) {
        orbTimer = rng.range(cfg.orbDelay[0], cfg.orbDelay[1]);
        const orb = S.orbs.find(o => o.player === player);
        if (orb && rng.chance(cfg.orbOdds)) game.collectOrb(player, orb.id);
      }
      if (S.hazard.active) return;
      timer -= dt;
      if (timer > 0) return;
      think();
    }

    return { update, player, difficulty };
  }

  return { createAI, CONFIGS };
});
