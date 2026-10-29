/*
 * OGS – simulation partagée (serveur + client).
 * Déterministe : RNG seedé, pas de rendu, pas de DOM.
 * Coordonnées : terrain de FIELD.w x FIELD.h, 9 colonnes x 8 lignes (4 par camp).
 * Le joueur "top" attaque vers le bas (y croissant), "bottom" vers le haut.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OGSSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Constantes de jeu ----------
  const FIELD = { w: 1536, h: 1488 };
  const COLS = 9;
  const ROWS_PER_SIDE = 4;
  const ROWS = ROWS_PER_SIDE * 2;
  const CELL_W = FIELD.w / COLS;
  const CELL_H = FIELD.h / ROWS;
  const RADIUS = Math.min(CELL_W, CELL_H) * 0.46; // hitbox des Ogs
  const SPEED_UNIT = 40;

  const RULES = {
    healthMax: 30,
    manaMax: 70,
    manaRegen: 2, // mana / s
    chargerBoost: 0.5, // +50 % regen par Chargeur
    orbMana: 10,
    orbRadius: 34,
    orbLifetime: 5,
    orbMinTime: 5,
    orbMaxTime: 20,
    hazardMinTime: 60,
    hazardMaxTime: 90,
    hazardSpeed: 320,
    hazardRadius: 36,
    hazardPause: 5,
    hazardDamage: 0, // BALANCE.md : 0 dégât en sortie (README historique : 7)
    orangeCooldown: 1.5,
    wingedCooldown: 0.8,
    orangeRangeCells: 1,
    wingedRangeCells: 1,
    projectileSpeed: 700,
    projectileLifetime: 2.5,
    matchDuration: 180, // s par défaut (classée), puis le joueur avec le plus de PV gagne ; 0 = illimité
    durations: [120, 180, 300, 0], // choix proposés en entraînement / amical
    countdown: 3,
  };

  const OGS = {
    1: { id: 1, key: 'runner', name: 'Zip', color: '#fbbf24', cost: 10, speed: SPEED_UNIT * 3, movement: 'straight', hp: 1, baseDamage: 1, frontOnly: false, air: false }, // posable sur toute sa moitié (y compris la ligne du fond)
    2: { id: 2, key: 'defenseur', name: 'Gromp', color: '#a78bfa', cost: 20, speed: SPEED_UNIT * 3, movement: 'horizontal', hp: 1, baseDamage: 0, frontOnly: false, air: false },
    3: { id: 3, key: 'tourelle', name: 'Krak', color: '#fb923c', cost: 30, speed: 0, movement: 'static', hp: 2, baseDamage: 0, frontOnly: false, air: false },
    4: { id: 4, key: 'eponge', name: 'Riko', color: '#ef4444', cost: 40, speed: SPEED_UNIT * 4, movement: 'diagBounce', hp: 3, baseDamage: 2, frontOnly: true, air: false },
    5: { id: 5, key: 'mur', name: 'Blok', color: '#3b82f6', cost: 50, speed: 0, movement: 'static', hp: 3, baseDamage: 0, frontOnly: false, air: false },
    6: { id: 6, key: 'chargeur', name: 'Mojo', color: '#22c55e', cost: 60, speed: 0, movement: 'static', hp: 3, baseDamage: 0, frontOnly: false, air: false },
    7: { id: 7, key: 'ailee', name: 'Zéphir', color: '#f97316', cost: 70, speed: SPEED_UNIT * 1.8, movement: 'airStraight', hp: 2, baseDamage: 5, frontOnly: true, air: true },
  };
  const OG_IDS = [1, 2, 3, 4, 5, 6, 7];
  const WINGED_TARGETS = new Set([1, 3, 6, 7]);
  const VIOLET_OBSTACLES = new Set([3, 5, 6]);

  // ---------- RNG déterministe (mulberry32) ----------
  function createRng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (min, max) => min + next() * (max - min),
      int: (n) => Math.floor(next() * n),
      pick: (arr) => (arr.length ? arr[Math.floor(next() * arr.length)] : undefined),
      chance: (p) => next() < p,
    };
  }

  // ---------- Helpers géométrie ----------
  function other(player) { return player === 'top' ? 'bottom' : 'top'; }
  function dirOf(player) { return player === 'top' ? 1 : -1; }
  function cellCenter(col, row) { return { x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H }; }
  function cellOf(x, y) {
    if (x < 0 || x >= FIELD.w || y < 0 || y >= FIELD.h) return null;
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    return { col, row, side: row < ROWS_PER_SIDE ? 'top' : 'bottom' };
  }
  function sideOfRow(row) { return row < ROWS_PER_SIDE ? 'top' : 'bottom'; }
  function rowWithinSide(row) { return row < ROWS_PER_SIDE ? row : row - ROWS_PER_SIDE; }
  function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }
  function shortestAngle(a, b) {
    const d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return d < -Math.PI ? d + Math.PI * 2 : d;
  }

  // ---------- Création d'une partie ----------
  function createGame(options) {
    const opts = Object.assign({ seed: 1, hazard: false, duration: RULES.matchDuration }, options || {}); // duration 0 = illimité ; hazard désactivé par défaut (le scorpion cassait le gameplay)
    const rng = createRng(opts.seed);
    const S = {
      time: 0,
      tick: 0,
      over: false,
      winner: null, // 'top' | 'bottom' | 'draw'
      endReason: null,
      hp: { top: RULES.healthMax, bottom: RULES.healthMax },
      mana: { top: 0, bottom: 0 },
      entities: [],
      projectiles: [],
      orbs: [],
      hazard: { enabled: !!opts.hazard, active: false, phase: 'idle', x: 0, y: 0, targetX: 0, vx: 0, vy: 0, timer: 0, direction: null },
      orbTimers: { top: 0, bottom: 0 },
      stats: {
        top: { placed: 0, kills: 0, damage: 0, orbs: 0, manaSpent: 0 },
        bottom: { placed: 0, kills: 0, damage: 0, orbs: 0, manaSpent: 0 },
      },
      nextId: 1,
    };
    S.orbTimers.top = rng.range(RULES.orbMinTime, RULES.orbMaxTime);
    S.orbTimers.bottom = rng.range(RULES.orbMinTime, RULES.orbMaxTime);
    S.hazard.timer = S.hazard.enabled ? rng.range(RULES.hazardMinTime, RULES.hazardMaxTime) : Infinity;

    let events = [];
    const emit = (type, data) => { events.push(Object.assign({ type, t: S.time }, data || {})); };

    // ----- Placement -----
    function cellOccupied(col, row, ignoreAir) {
      const rx = col * CELL_W, ry = row * CELL_H;
      return S.entities.some(e => (!ignoreAir || !e.air) && circleRect(e.x, e.y, RADIUS, rx, ry, CELL_W, CELL_H));
    }

    function availableCells(player, ogId) {
      const og = OGS[ogId];
      if (!og) return [];
      const cells = [];
      const frontRow = player === 'top' ? ROWS_PER_SIDE - 1 : ROWS_PER_SIDE; // ligne au contact du centre
      for (let row = 0; row < ROWS; row += 1) {
        if (sideOfRow(row) !== player) continue;
        if (og.frontOnly && row !== frontRow) continue;
        for (let col = 0; col < COLS; col += 1) {
          if (cellOccupied(col, row)) continue;
          cells.push({ col, row });
        }
      }
      return cells;
    }

    function canPlace(player, ogId, col, row) {
      if (S.over) return { ok: false, reason: 'over' };
      if (S.hazard.active) return { ok: false, reason: 'hazard' };
      const og = OGS[ogId];
      if (!og) return { ok: false, reason: 'unknown' };
      if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col >= COLS || row < 0 || row >= ROWS) return { ok: false, reason: 'cell' };
      if (sideOfRow(row) !== player) return { ok: false, reason: 'side' };
      const frontRow = player === 'top' ? ROWS_PER_SIDE - 1 : ROWS_PER_SIDE;
      if (og.frontOnly && row !== frontRow) return { ok: false, reason: 'front' };
      if (cellOccupied(col, row)) return { ok: false, reason: 'occupied' };
      if (S.mana[player] < og.cost) return { ok: false, reason: 'mana' };
      return { ok: true };
    }

    function spawn(player, ogId, col, row) {
      const og = OGS[ogId];
      const pos = cellCenter(col, row);
      const dir = dirOf(player);
      let vx = 0, vy = 0;
      switch (og.movement) {
        case 'straight':
        case 'airStraight':
          vy = dir * og.speed; break;
        case 'horizontal':
          vx = (player === 'top' ? -1 : 1) * og.speed; break;
        case 'diagBounce': {
          const distLeft = pos.x, distRight = FIELD.w - pos.x;
          const dx = Math.abs(distLeft - distRight) < 1 ? (rng.chance(0.5) ? -1 : 1) : (distLeft < distRight ? -1 : 1);
          vx = dx * og.speed; vy = dir * og.speed; break;
        }
        default: break;
      }
      const e = {
        id: S.nextId++, ogId, player, owner: player, x: pos.x, y: pos.y, vx, vy,
        hp: og.hp, hpMax: og.hp, cooldown: 0, air: og.air, speed: og.speed, movement: og.movement,
        rot: 0, rotTarget: 0, born: S.time,
      };
      if (ogId === 3) { e.rot = e.rotTarget = player === 'top' ? Math.PI / 2 : -Math.PI / 2; }
      if (ogId === 2) { e.rot = vx >= 0 ? Math.PI : 0; }
      S.entities.push(e);
      return e;
    }

    function place(player, ogId, col, row) {
      const check = canPlace(player, ogId, col, row);
      if (!check.ok) return check;
      const og = OGS[ogId];
      S.mana[player] -= og.cost;
      S.stats[player].manaSpent += og.cost;
      S.stats[player].placed += 1;
      const e = spawn(player, ogId, col, row);
      emit('place', { player, ogId, id: e.id, x: e.x, y: e.y });
      return { ok: true, id: e.id };
    }

    function collectOrb(player, orbId) {
      if (S.over) return false;
      const idx = S.orbs.findIndex(o => o.id === orbId && o.player === player);
      if (idx === -1) return false;
      const orb = S.orbs[idx];
      S.orbs.splice(idx, 1);
      S.mana[player] = Math.min(RULES.manaMax, S.mana[player] + RULES.orbMana);
      S.stats[player].orbs += 1;
      emit('orb', { player, x: orb.x, y: orb.y, mana: RULES.orbMana });
      return true;
    }

    // ----- Boucle -----
    const dead = new Set();
    function kill(e, by, cause) {
      if (dead.has(e.id)) return;
      dead.add(e.id);
      if (by && by !== e.player) S.stats[by].kills += 1;
      emit('kill', { id: e.id, ogId: e.ogId, player: e.player, x: e.x, y: e.y, cause: cause || 'contact' });
    }
    function damage(e, amount, by, cause) {
      if (dead.has(e.id)) return;
      e.hp -= amount;
      emit('hit', { id: e.id, ogId: e.ogId, player: e.player, x: e.x, y: e.y, hp: e.hp });
      if (e.hp <= 0) kill(e, by, cause);
    }
    function hurtBase(target, amount, source) {
      if (amount <= 0) return;
      S.hp[target] = Math.max(0, S.hp[target] - amount);
      S.stats[other(target)].damage += amount;
      emit('base', { target, amount, ogId: source ? source.ogId : 0, x: source ? source.x : FIELD.w / 2, y: source ? source.y : FIELD.h / 2 });
    }

    function updateMana(dt) {
      const chargers = { top: 0, bottom: 0 };
      for (const e of S.entities) if (e.ogId === 6) chargers[e.player] += 1;
      for (const p of ['top', 'bottom']) {
        const regen = RULES.manaRegen * (1 + RULES.chargerBoost * chargers[p]);
        S.mana[p] = Math.min(RULES.manaMax, S.mana[p] + regen * dt);
      }
    }

    function updateOrbs(dt) {
      for (const p of ['top', 'bottom']) {
        S.orbTimers[p] -= dt;
        if (S.orbTimers[p] <= 0) {
          const r = RULES.orbRadius;
          const half = FIELD.h / 2;
          const x = r + rng.next() * (FIELD.w - r * 2);
          const y = (p === 'top' ? 0 : half) + r + rng.next() * (half - r * 2);
          S.orbs.push({ id: S.nextId++, player: p, x, y, life: RULES.orbLifetime });
          S.orbTimers[p] = rng.range(RULES.orbMinTime, RULES.orbMaxTime);
        }
      }
      for (let i = S.orbs.length - 1; i >= 0; i -= 1) {
        S.orbs[i].life -= dt;
        if (S.orbs[i].life <= 0) S.orbs.splice(i, 1);
      }
    }

    function updateHazard(dt) {
      const H = S.hazard;
      if (!H.enabled) return;
      if (!H.active) {
        H.timer -= dt;
        if (H.timer <= 0) {
          H.active = true; H.phase = 'approach'; H.direction = null;
          H.targetX = rng.range(RULES.hazardRadius, FIELD.w - RULES.hazardRadius);
          H.x = FIELD.w + RULES.hazardRadius; H.y = FIELD.h / 2;
          H.vx = -RULES.hazardSpeed; H.vy = 0;
          emit('hazard', { phase: 'approach' });
        }
        return;
      }
      H.x += H.vx * dt; H.y += H.vy * dt;
      if (H.phase === 'approach') {
        if (H.x <= H.targetX) { H.x = H.targetX; H.vx = 0; H.phase = 'pause'; H.timer = RULES.hazardPause; emit('hazard', { phase: 'pause' }); }
      } else if (H.phase === 'pause') {
        H.timer -= dt;
        if (H.timer <= 0) {
          H.phase = 'dash'; H.direction = rng.chance(0.5) ? 'up' : 'down';
          H.vy = H.direction === 'up' ? -RULES.hazardSpeed : RULES.hazardSpeed;
          emit('hazard', { phase: 'dash', direction: H.direction });
        }
      } else if (H.phase === 'dash') {
        const r = RULES.hazardRadius + RADIUS, r2 = r * r;
        for (const e of S.entities) {
          if (dist2(H, e) <= r2) kill(e, null, 'hazard');
        }
        const offTop = H.y + RULES.hazardRadius < 0;
        const offBottom = H.y - RULES.hazardRadius > FIELD.h;
        if (offTop || offBottom) {
          hurtBase(offTop ? 'top' : 'bottom', RULES.hazardDamage, null);
          H.active = false; H.phase = 'idle'; H.vx = H.vy = 0;
          H.timer = rng.range(RULES.hazardMinTime, RULES.hazardMaxTime);
          emit('hazard', { phase: 'idle' });
        }
      }
    }

    function moveEntities(dt) {
      for (const e of S.entities) {
        switch (e.movement) {
          case 'straight':
          case 'airStraight':
            e.y += e.vy * dt; e.x += e.vx * dt; break;
          case 'horizontal':
            e.x += e.vx * dt;
            if (e.x - RADIUS <= 0) { e.x = RADIUS; setVioletVx(e, Math.abs(e.vx)); }
            else if (e.x + RADIUS >= FIELD.w) { e.x = FIELD.w - RADIUS; setVioletVx(e, -Math.abs(e.vx)); }
            break;
          case 'diagBounce':
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.x - RADIUS <= 0) { e.x = RADIUS; e.vx = Math.abs(e.vx); }
            else if (e.x + RADIUS >= FIELD.w) { e.x = FIELD.w - RADIUS; e.vx = -Math.abs(e.vx); }
            break;
          default: break;
        }
        // Rotations décoratives mais synchronisées (tourelles, éponge).
        if (e.ogId === 4) e.rot += 0.6 * dt;
        if (e.ogId === 3) {
          const d = shortestAngle(e.rot, e.rotTarget);
          const step = 6 * dt;
          e.rot = Math.abs(d) <= step ? e.rotTarget : e.rot + Math.sign(d) * step;
        }
        // Bout de terrain.
        const reachedEnemy = (e.player === 'top' && e.y + RADIUS >= FIELD.h) || (e.player === 'bottom' && e.y - RADIUS <= 0);
        const reachedOwn = (e.player === 'top' && e.y - RADIUS <= 0) || (e.player === 'bottom' && e.y + RADIUS >= FIELD.h);
        if (reachedEnemy || reachedOwn) {
          const target = reachedEnemy ? other(e.player) : e.player;
          const dmg = OGS[e.ogId].baseDamage;
          if (dmg > 0) hurtBase(target, dmg, e);
          kill(e, null, 'base');
        }
      }
    }

    function setVioletVx(v, vx) {
      const prev = Math.sign(v.vx || 0), next = Math.sign(vx || 0);
      v.vx = vx;
      if (next !== 0) v.rot = next > 0 ? Math.PI : 0;
      if (prev && next && prev !== next) emit('bounce', { id: v.id, x: v.x, y: v.y });
    }

    function byOg(id) { return S.entities.filter(e => e.ogId === id && !dead.has(e.id)); }

    function collisions() {
      const minDist = RADIUS * 2, minD2 = minDist * minDist;
      const yellows = byOg(1), violets = byOg(2), oranges = byOg(3), reds = byOg(4), blues = byOg(5), greens = byOg(6);

      // Violet vs violet : séparation + rebond.
      for (let i = 0; i < violets.length; i += 1) for (let j = i + 1; j < violets.length; j += 1) {
        const a = violets[i], b = violets[j];
        if (dist2(a, b) <= minD2) {
          const dx = a.x - b.x;
          const d = Math.max(Math.sqrt(dist2(a, b)), 1e-6);
          const overlap = Math.max(0, minDist - d) * 0.5;
          const nx = dx !== 0 ? Math.sign(dx) : (rng.chance(0.5) ? -1 : 1);
          a.x += nx * overlap; b.x -= nx * overlap;
          setVioletVx(a, nx * a.speed); setVioletVx(b, -nx * b.speed);
        }
      }
      // Violet vs obstacles (tourelles, murs, chargeurs, toutes équipes).
      for (const v of violets) for (const o of S.entities) {
        if (!VIOLET_OBSTACLES.has(o.ogId) || dead.has(o.id)) continue;
        if (dist2(v, o) <= minD2) {
          const dx = v.x - o.x;
          const d = Math.max(Math.sqrt(dist2(v, o)), 1e-6);
          const overlap = Math.max(0, minDist - d);
          const nx = dx !== 0 ? Math.sign(dx) : (rng.chance(0.5) ? -1 : 1);
          v.x += nx * overlap;
          setVioletVx(v, nx * v.speed);
        }
      }

      // Jaunes.
      for (const y of yellows) {
        if (dead.has(y.id)) continue;
        for (const v of violets) {
          if (v.player === y.player || dead.has(y.id)) continue;
          if (dist2(y, v) <= minD2) kill(y, v.player, 'violet');
        }
        for (const b of blues) {
          if (dead.has(y.id) || dead.has(b.id)) continue;
          if (b.player === y.player) continue; // passe au-dessus de ses propres murs (BALANCE.md)
          const d2 = dist2(y, b);
          if (d2 <= minD2) {
            const d = Math.max(Math.sqrt(d2), 1e-6);
            const overlap = minDist - d;
            y.x += (y.x - b.x) / d * overlap * 0.5;
            y.y += (y.y - b.y) / d * overlap * 0.5;
            // Rebond complet + changement de camp.
            y.vx = -(y.vx || 0);
            y.vy = -(y.vy || dirOf(y.player) * y.speed);
            y.player = other(y.player);
            emit('bounce', { id: y.id, x: y.x, y: y.y, flip: true, player: y.player });
            damage(b, 1, y.owner, 'runner');
          }
        }
        for (const r of reds) {
          if (r.player === y.player || dead.has(y.id) || dead.has(r.id)) continue;
          if (dist2(y, r) <= minD2) { kill(y, r.player, 'red'); damage(r, 1, y.player, 'runner'); }
        }
        for (const o of oranges) {
          if (o.player === y.player || dead.has(y.id) || dead.has(o.id)) continue;
          if (dist2(y, o) <= minD2) { damage(o, 1, y.player, 'runner'); kill(y, o.player, 'turret'); }
        }
        for (const g of greens) {
          if (g.player === y.player || dead.has(y.id) || dead.has(g.id)) continue;
          if (dist2(y, g) <= minD2) { damage(g, 1, y.player, 'runner'); kill(y, g.player, 'charger'); }
        }
      }
      // Jaune vs jaune adverse : destruction mutuelle.
      for (let i = 0; i < yellows.length; i += 1) for (let j = i + 1; j < yellows.length; j += 1) {
        const a = yellows[i], b = yellows[j];
        if (a.player === b.player || dead.has(a.id) || dead.has(b.id)) continue;
        if (dist2(a, b) <= minD2) { kill(a, b.player, 'runner'); kill(b, a.player, 'runner'); }
      }

      // Rouges.
      for (const r of reds) {
        if (dead.has(r.id)) continue;
        for (const o of oranges) {
          if (o.player === r.player || dead.has(o.id) || dead.has(r.id)) continue;
          if (dist2(r, o) <= minD2) { kill(o, r.player, 'red'); damage(r, 1, o.player, 'impact'); }
        }
        for (const v of violets) {
          if (v.player === r.player || dead.has(v.id) || dead.has(r.id)) continue;
          if (dist2(r, v) <= minD2) { kill(r, v.player, 'violet'); kill(v, r.player, 'red'); }
        }
        for (const r2 of reds) {
          if (r2.id === r.id || r2.player === r.player || dead.has(r2.id) || dead.has(r.id)) continue;
          if (dist2(r, r2) <= minD2) { kill(r, r2.player, 'red'); kill(r2, r.player, 'red'); }
        }
        for (const g of greens) {
          if (g.player === r.player || dead.has(g.id) || dead.has(r.id)) continue;
          if (dist2(r, g) <= minD2) { kill(g, r.player, 'red'); damage(r, 1, g.player, 'impact'); }
        }
        for (const b of blues) {
          if (b.player === r.player || dead.has(b.id) || dead.has(r.id)) continue;
          if (dist2(r, b) <= minD2) { kill(b, r.player, 'red'); kill(r, b.player, 'wall'); } // casse le mur mais meurt (BALANCE.md)
        }
      }
    }

    function turrets(dt) {
      const midY = FIELD.h / 2;
      for (const s of S.entities) {
        if ((s.ogId !== 3 && s.ogId !== 7) || dead.has(s.id)) continue;
        const rangeCells = s.ogId === 3 ? RULES.orangeRangeCells : RULES.wingedRangeCells;
        const range = rangeCells * Math.max(CELL_W, CELL_H);
        const range2 = range * range;
        s.cooldown = Math.max(0, s.cooldown - dt);
        if (s.cooldown > 0) continue;
        let target = null;
        for (const e of S.entities) {
          if (e.player === s.player || dead.has(e.id)) continue;
          if (dist2(s, e) > range2) continue;
          if (s.ogId === 7 && !WINGED_TARGETS.has(e.ogId)) continue;
          if (s.player === 'top' && e.y < s.y) continue; // tir vers l'avant uniquement
          if (s.player === 'bottom' && e.y > s.y) continue;
          if (s.ogId === 3) {
            const inOwnHalf = s.player === 'top' ? e.y < midY : e.y >= midY;
            const sideShot = e.ogId === 1 || e.ogId === 4 || e.ogId === 7;
            if (!inOwnHalf && !sideShot) continue;
          }
          target = e; break;
        }
        if (target) {
          s.cooldown = s.ogId === 3 ? RULES.orangeCooldown : RULES.wingedCooldown;
          if (s.ogId === 3) s.rotTarget = Math.atan2(target.y - s.y, target.x - s.x);
          fire(s, target);
        } else if (s.ogId === 3) {
          s.rotTarget = s.player === 'top' ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }

    function fire(from, target) {
      const lead = computeLead(from, target, RULES.projectileSpeed);
      const dx = lead.x - from.x, dy = lead.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      S.projectiles.push({
        id: S.nextId++, player: from.player, x: from.x, y: from.y,
        vx: dx / len * RULES.projectileSpeed, vy: dy / len * RULES.projectileSpeed,
        life: RULES.projectileLifetime, targetPlayer: target.player, winged: from.ogId === 7,
      });
      emit('shot', { id: from.id, ogId: from.ogId, x: from.x, y: from.y });
    }

    function computeLead(shooter, target, speed) {
      const tx = target.x - shooter.x, ty = target.y - shooter.y;
      const tvx = target.vx || 0, tvy = target.vy || 0;
      const a = tvx * tvx + tvy * tvy - speed * speed;
      const b = 2 * (tx * tvx + ty * tvy);
      const c = tx * tx + ty * ty;
      let t;
      if (Math.abs(a) < 1e-6) t = b !== 0 ? -c / b : 0;
      else {
        const disc = b * b - 4 * a * c;
        if (disc < 0) t = -b / (2 * a);
        else { const sq = Math.sqrt(disc); const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a); t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2); }
      }
      if (!isFinite(t) || t <= 0) return { x: target.x, y: target.y };
      return { x: target.x + tvx * t, y: target.y + tvy * t };
    }

    function projectiles(dt) {
      for (let i = S.projectiles.length - 1; i >= 0; i -= 1) {
        const p = S.projectiles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0 || p.x < -50 || p.x > FIELD.w + 50 || p.y < -50 || p.y > FIELD.h + 50) { S.projectiles.splice(i, 1); continue; }
        const r2 = RADIUS * RADIUS;
        let hit = null;
        for (const e of S.entities) {
          if (e.player !== p.targetPlayer || dead.has(e.id)) continue;
          if (dist2(p, e) <= r2) { hit = e; break; }
        }
        if (hit) {
          damage(hit, 1, p.player, 'projectile');
          S.projectiles.splice(i, 1);
        }
      }
    }

    function flush() {
      if (!dead.size) return;
      S.entities = S.entities.filter(e => !dead.has(e.id));
      dead.clear();
    }

    function checkEnd() {
      if (S.over) return;
      if (S.hp.top <= 0 && S.hp.bottom <= 0) end('draw', 'ko');
      else if (S.hp.top <= 0) end('bottom', 'ko');
      else if (S.hp.bottom <= 0) end('top', 'ko');
      else if (opts.duration && S.time >= opts.duration) {
        if (S.hp.top === S.hp.bottom) end('draw', 'time');
        else end(S.hp.top > S.hp.bottom ? 'top' : 'bottom', 'time');
      }
    }
    function end(winner, reason) {
      S.over = true; S.winner = winner; S.endReason = reason;
      emit('end', { winner, reason });
    }

    function step(dt) {
      if (S.over) return;
      S.time += dt; S.tick += 1;
      updateMana(dt);
      updateOrbs(dt);
      updateHazard(dt);
      moveEntities(dt);
      turrets(dt);
      collisions();
      projectiles(dt);
      flush();
      checkEnd();
    }

    function surrender(player) {
      if (S.over) return;
      end(other(player), 'surrender');
    }

    function drainEvents() { const ev = events; events = []; return ev; }

    // Snapshot compact (envoyé sur le réseau).
    function snapshot() {
      return {
        t: Math.round(S.time * 1000) / 1000,
        k: S.tick,
        hp: [S.hp.top, S.hp.bottom],
        mana: [Math.round(S.mana.top * 10) / 10, Math.round(S.mana.bottom * 10) / 10],
        e: S.entities.map(e => [e.id, e.ogId, e.player === 'top' ? 0 : 1, Math.round(e.x), Math.round(e.y), Math.round(e.rot * 100) / 100, e.hp, e.hpMax, e.owner === 'top' ? 0 : 1]),
        p: S.projectiles.map(p => [p.id, Math.round(p.x), Math.round(p.y), p.player === 'top' ? 0 : 1, p.winged ? 1 : 0]),
        o: S.orbs.map(o => [o.id, o.player === 'top' ? 0 : 1, Math.round(o.x), Math.round(o.y), Math.round(o.life * 10) / 10]),
        h: S.hazard.active ? [S.hazard.phase === 'approach' ? 0 : S.hazard.phase === 'pause' ? 1 : 2, Math.round(S.hazard.x), Math.round(S.hazard.y)] : null,
        over: S.over ? { winner: S.winner, reason: S.endReason } : null,
      };
    }

    return {
      state: S, rng, opts,
      step, place, canPlace, availableCells, collectOrb, surrender, drainEvents, snapshot,
      cellOccupied,
    };
  }

  // Décodage d'un snapshot côté client.
  function decodeSnapshot(s) {
    const P = ['top', 'bottom'];
    return {
      t: s.t, k: s.k,
      hp: { top: s.hp[0], bottom: s.hp[1] },
      mana: { top: s.mana[0], bottom: s.mana[1] },
      entities: s.e.map(a => ({ id: a[0], ogId: a[1], player: P[a[2]], x: a[3], y: a[4], rot: a[5], hp: a[6], hpMax: a[7], owner: P[a[8]] })),
      projectiles: s.p.map(a => ({ id: a[0], x: a[1], y: a[2], player: P[a[3]], winged: !!a[4] })),
      orbs: s.o.map(a => ({ id: a[0], player: P[a[1]], x: a[2], y: a[3], life: a[4] })),
      hazard: s.h ? { phase: ['approach', 'pause', 'dash'][s.h[0]], x: s.h[1], y: s.h[2] } : null,
      over: s.over,
    };
  }

  return {
    FIELD, COLS, ROWS, ROWS_PER_SIDE, CELL_W, CELL_H, RADIUS, RULES, OGS, OG_IDS,
    createGame, createRng, decodeSnapshot, cellOf, cellCenter, sideOfRow, rowWithinSide, other,
  };
});
