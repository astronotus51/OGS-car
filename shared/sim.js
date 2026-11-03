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
  const DEFAULT_COLS = 9;
  const ROWS_PER_SIDE = 4;
  const ROWS = ROWS_PER_SIDE * 2;
  const CELL_W = 1536 / DEFAULT_COLS; // taille de case fixe : une arène plus large = plus de colonnes
  const FIELD_H = 1488;
  const CELL_H = FIELD_H / ROWS;
  // Géométrie d'une arène : 9 colonnes en 1v1, 13 en 2v2, 17 en 3v3.
  function geometry(cols) { const c = Math.max(5, Math.min(25, cols | 0) || DEFAULT_COLS); return { COLS: c, FIELD: { w: c * CELL_W, h: FIELD_H } }; }
  const TEAM_COLS = { 1: 9, 2: 13, 3: 17 };
  // Clés des joueurs pour N par camp : ['top','bottom'] puis 'top1','bottom1', 'top2','bottom2'.
  function teamKeys(perSide) { const keys = []; for (let i = 0; i < (perSide || 1); i += 1) { keys.push(i ? `top${i}` : 'top'); keys.push(i ? `bottom${i}` : 'bottom'); } return keys; }
  const FIELD = geometry(DEFAULT_COLS).FIELD; // valeurs par défaut (1v1), utilisées par le client hors partie
  const COLS = DEFAULT_COLS;
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
    orangeCooldown: 2.5, // Krak : un tir toutes les 2,5 s (1,5 s avant l'équilibrage : il gagnait 98 % des parties où un seul camp l'avait)
    wingedCooldown: 0.8,
    orangeRange: 2, // Krak : 2 cases tout autour (carré 5×5), uniquement dans son propre camp
    rikoWallDamage: 1,
    grompDamage: 1, // Gromp : dégâts par contact sur un runner (un Pik, 2 PV, survit au premier)
    mineDamage: 2, // Boum : dégâts de l'explosion
    mineRadiusCells: 1.5, // Boum : rayon de l'explosion
    mineRearm: 4, // Boum : secondes avant de pouvoir ré-exploser
    mineTriggerCells: 1.1,
    gluRadiusCells: 2, // Glu : rayon de la flaque
    gluFactor: 0.4, // Glu : vitesse des unités au sol englués (×0,4) // Boum : distance (en cases) à laquelle un ennemi la déclenche // Gromp : dégâts par contact sur un runner (tue aussi un Pik)
    gustEvery: 1.5, // Rafale : secondes entre deux souffles (et durée pendant laquelle une unité soufflée ne peut pas l'être à nouveau)
    gustPush: 0.75, // Rafale : recul en cases (les brutes : 2/3 de cette valeur)
    gustRangeCells: 3, // Rafale : portée devant elle
    tightSpacingFactor: 0.35, // option « pose rapprochée » : rayon de blocage d'une case réduit (0.35 × rayon) => on repose bien plus vite derrière une créature // PV perdus par un Blok à chaque rebond d'un Riko dessus (0 = le mur est indestructible pour Riko)
    wingedRangeCells: 1,
    projectileSpeed: 700,
    projectileLifetime: 2.5,
    matchDuration: 180, // s par défaut (classée), puis le joueur avec le plus de PV gagne ; 0 = illimité
    durations: [120, 180, 300, 0], // choix proposés en entraînement / amical
    countdown: 3,
  };

  const OGS = {
    1: { id: 1, key: 'runner', name: 'Zip', color: '#fbbf24', cost: 10, speed: SPEED_UNIT * 3.5, movement: 'straight', hp: 1, baseDamage: 1, backOnly: true, air: false, runner: true }, // se pose uniquement sur la ligne du fond (la plus loin de l'adversaire)
    2: { id: 2, key: 'defenseur', name: 'Gromp', color: '#a78bfa', cost: 20, speed: SPEED_UNIT * 3, movement: 'horizontal', hp: 1, baseDamage: 0, backOnly: false, air: false, patrol: true, eater: true },
    3: { id: 3, key: 'tourelle', name: 'Krak', color: '#fb923c', cost: 30, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: false, lifetime: 45, solid: true, turret: true },
    4: { id: 4, key: 'eponge', name: 'Riko', color: '#ef4444', cost: 40, speed: SPEED_UNIT * 4, movement: 'diagBounce', hp: 5, baseDamage: 3, backOnly: true, air: false },
    5: { id: 5, key: 'mur', name: 'Blok', color: '#3b82f6', cost: 50, speed: 0, movement: 'static', hp: 5, baseDamage: 0, backOnly: false, air: false, lifetime: 45, solid: true },
    6: { id: 6, key: 'chargeur', name: 'Mojo', color: '#22c55e', cost: 60, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, lifetime: 90, solid: true },
    7: { id: 7, key: 'ailee', name: 'Zéphir', color: '#f97316', cost: 70, speed: SPEED_UNIT * 2.2, movement: 'airStraight', hp: 6, baseDamage: 6, backOnly: true, air: true },
    // --- 10 nouveaux types (voir shared/catalog.js pour la collection) ---
    8: { id: 8, key: 'pik', name: 'Pik', color: '#d9b36b', cost: 10, speed: SPEED_UNIT * 1.9, movement: 'straight', hp: 2, baseDamage: 1, backOnly: true, air: false, runner: true }, // runner lent à 2 PV
    9: { id: 9, key: 'bulle', name: 'Bulle', color: '#7dd3fc', cost: 10, speed: SPEED_UNIT * 2.2, movement: 'airStraight', hp: 1, baseDamage: 0, backOnly: true, air: true, heals: 2 }, // soigne ta base de 2 en arrivant
    10: { id: 10, key: 'zazou', name: 'Zazou', color: '#a3e635', cost: 20, speed: SPEED_UNIT * 5.5, movement: 'airStraight', hp: 2, baseDamage: 2, backOnly: true, air: true }, // moustique : 2 dégâts, 2 PV, ultra rapide
    11: { id: 11, key: 'boum', name: 'Boum', color: '#475569', cost: 30, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: false, hiddenFromEnemy: true, mine: true, lifetime: 60 }, // 3 PV = 3 charges
    12: { id: 12, key: 'rafale', name: 'Rafale', color: '#93c5fd', cost: 30, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: false, fan: true, lifetime: 60, solid: true, turret: true },
    13: { id: 13, key: 'tiktak', name: 'Tiktak', color: '#1f2937', cost: 40, speed: SPEED_UNIT * 1.5, movement: 'straight', hp: 4, baseDamage: 4, backOnly: true, air: false, brute: true, blastOnDeath: 1 },
    14: { id: 14, key: 'fantome', name: 'Fantôme', color: '#e2e8f0', cost: 40, speed: SPEED_UNIT * 2.5, movement: 'straight', hp: 4, baseDamage: 3, backOnly: true, air: false, ghost: true },
    15: { id: 15, key: 'glu', name: 'Glu', color: '#84cc16', cost: 50, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, walkable: true, slowZone: true, lifetime: 60 },
    16: { id: 16, key: 'sirene', name: 'Sirène', color: '#f0abfc', cost: 60, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: false, charmer: true, lifetime: 50, solid: true },
    17: { id: 17, key: 'kraken', name: 'Kraken', color: '#7c3aed', cost: 70, speed: SPEED_UNIT * 1.3, movement: 'straight', hp: 8, baseDamage: 5, backOnly: true, air: false, brute: true, crushesWalls: true },
    // ---------- 30 créatures de plus (ids 18 à 47) : mécaniques génériques (voir extraCreatures) ----------
    // Coût 10
    18: { id: 18, key: 'puce', name: 'Puce', color: '#fde047', cost: 10, speed: SPEED_UNIT * 3.2, movement: 'straight', hp: 1, baseDamage: 1, backOnly: false, air: false, runner: true }, // se pose n'importe où sur ta moitié
    19: { id: 19, key: 'jumeaux', name: 'Jumeaux', color: '#fdba74', cost: 20, speed: SPEED_UNIT * 2.8, movement: 'straight', hp: 1, baseDamage: 1, backOnly: true, air: false, runner: true, spawnCount: 2 }, // deux à la fois
    20: { id: 20, key: 'etincelle', name: 'Étincelle', color: '#fef08a', cost: 10, speed: SPEED_UNIT * 4, movement: 'airStraight', hp: 1, baseDamage: 1, backOnly: true, air: true, kamikaze: { radius: 1, damage: 2, air: true } }, // explose sur le premier ennemi
    21: { id: 21, key: 'taupe', name: 'Taupe', color: '#a16207', cost: 10, speed: SPEED_UNIT * 2.0, movement: 'straight', hp: 2, baseDamage: 1, backOnly: true, air: false, runner: true, stealth: true }, // invisible dans ton camp
    // Coût 20
    22: { id: 22, key: 'canonnier', name: 'Canonnier', color: '#c084fc', cost: 20, speed: SPEED_UNIT * 2.2, movement: 'horizontal', hp: 1, baseDamage: 0, backOnly: false, air: false, patrol: true, lifetime: 45, turretCfg: { range: 1, cooldown: 3.5, air: 'none' } }, // patrouille 45 s et tire sur le sol
    23: { id: 23, key: 'nid', name: 'Nid', color: '#d6d3d1', cost: 20, speed: 0, movement: 'static', hp: 1, baseDamage: 0, backOnly: false, air: false, solid: true, lifetime: 30, spawner: { ogId: 1, every: 10 } }, // pond un Zip toutes les 10 s
    24: { id: 24, key: 'petard', name: 'Pétard', color: '#f43f5e', cost: 20, speed: SPEED_UNIT * 3, movement: 'straight', hp: 2, baseDamage: 2, backOnly: true, air: false, runner: true, kamikaze: { radius: 1.2, damage: 4, air: true } }, // explose sur le premier ennemi (sol ou air)
    25: { id: 25, key: 'lutin', name: 'Lutin', color: '#4ade80', cost: 20, speed: SPEED_UNIT * 3.2, movement: 'straight', hp: 2, baseDamage: 1, backOnly: true, air: false, runner: true, manaOnBase: 20 }, // vole 20 mana en arrivant
    26: { id: 26, key: 'flak', name: 'Flak', color: '#67e8f9', cost: 20, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: false, solid: true, turret: true, lifetime: 50, turretCfg: { range: 3, cooldown: 1.0, air: 'only' } }, // anti-aérien pur, longue portée
    // Coût 30
    27: { id: 27, key: 'nuage', name: 'Nuage', color: '#cbd5e1', cost: 30, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: false, walkable: true, lifetime: 60, aura: { radius: 2, slowAir: true, slowGround: true, zapAir: { every: 2, damage: 1 } } }, // englue tout, électrise les volants
    28: { id: 28, key: 'givre', name: 'Givre', color: '#bae6fd', cost: 30, speed: SPEED_UNIT * 1.5, movement: 'straight', hp: 3, baseDamage: 2, backOnly: true, air: false, brute: true, freezeOnHit: 1.5 }, // gèle ce qu'il touche
    29: { id: 29, key: 'pioche', name: 'Pioche', color: '#f59e0b', cost: 30, speed: SPEED_UNIT * 2.5, movement: 'straight', hp: 4, baseDamage: 2, backOnly: true, air: false, hunter: true }, // casse les structures, ignore les unités
    30: { id: 30, key: 'source', name: 'Source', color: '#5eead4', cost: 30, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, solid: true, lifetime: 60, healEvery: { every: 15, amount: 1 } }, // soigne ta base
    // Coût 40
    31: { id: 31, key: 'boule', name: 'Boule', color: '#e0f2fe', cost: 40, speed: SPEED_UNIT * 1.2, movement: 'straight', hp: 2, baseDamage: 3, backOnly: true, air: false, runner: true, grow: { every: 4, max: 7 } }, // grossit en roulant
    32: { id: 32, key: 'ballon', name: 'Ballon', color: '#f9a8d4', cost: 40, speed: 0, movement: 'static', hp: 2, baseDamage: 0, backOnly: false, air: true, lifetime: 50, turretCfg: { range: 1.5, cooldown: 2, air: 'none', pulse: true, damage: 1 } }, // bombarde le sol sous lui
    33: { id: 33, key: 'vampire', name: 'Vampire', color: '#7f1d1d', cost: 40, speed: SPEED_UNIT * 2, movement: 'straight', hp: 3, baseDamage: 2, backOnly: true, air: false, brute: true, healOnKill: 1 }, // chaque victime soigne ta base
    34: { id: 34, key: 'scarabee', name: 'Scarabée', color: '#166534', cost: 40, speed: SPEED_UNIT * 1.4, movement: 'straight', hp: 4, baseDamage: 3, backOnly: true, air: false, runner: true, armor: true }, // carapace : un projectile sur deux rebondit
    // Coût 50
    35: { id: 35, key: 'mortier', name: 'Mortier', color: '#78716c', cost: 50, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, solid: true, turret: true, lifetime: 50, turretCfg: { range: 3, cooldown: 3.5, air: 'none', pulse: true, damage: 2 } }, // frappe tout le sol à 3 cases
    36: { id: 36, key: 'hydre', name: 'Hydre', color: '#15803d', cost: 50, speed: SPEED_UNIT * 1.5, movement: 'straight', hp: 3, baseDamage: 2, backOnly: true, air: false, runner: true, onDeath: { ogId: 1, count: 2 } }, // deux Zip à sa mort
    37: { id: 37, key: 'phare', name: 'Phare', color: '#fcd34d', cost: 50, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, walkable: true, lifetime: 45, aura: { radius: 1.5, speed: 1.3 } }, // accélère tes alliés
    38: { id: 38, key: 'gel', name: 'Gel', color: '#a5f3fc', cost: 50, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, walkable: true, lifetime: 75, aura: { radius: 2, freezeEvery: 5, freeze: 3.5 } }, // gèle les ennemis au sol autour
    39: { id: 39, key: 'dynamite', name: 'Dynamite', color: '#ef4444', cost: 50, speed: SPEED_UNIT * 2, movement: 'airStraight', hp: 2, baseDamage: 2, backOnly: true, air: true, wallBreaker: { radius: 1, damage: 3 } }, // explose sur la première structure survolée
    // Coût 60
    40: { id: 40, key: 'oracle', name: 'Oracle', color: '#e9d5ff', cost: 60, speed: 0, movement: 'static', hp: 5, baseDamage: 0, backOnly: false, air: false, solid: true, turret: true, lifetime: 70, reveal: 3, turretCfg: { range: 3, cooldown: 1.2, air: 'all' } }, // révèle les cachés et tire loin
    41: { id: 41, key: 'golem', name: 'Golem', color: '#57534e', cost: 60, speed: SPEED_UNIT * 1, movement: 'straight', hp: 6, baseDamage: 4, backOnly: true, air: false, brute: true, crushesWalls: true, onDeath: { ogId: 8, count: 2 } }, // deux Pik à sa mort
    42: { id: 42, key: 'phenix', name: 'Phénix', color: '#fb923c', cost: 60, speed: SPEED_UNIT * 2, movement: 'airStraight', hp: 4, baseDamage: 4, backOnly: true, air: true, onDeath: { ogId: 10, count: 2 } }, // renaît en deux Zazou
    43: { id: 43, key: 'totem', name: 'Totem', color: '#a78bfa', cost: 60, speed: 0, movement: 'static', hp: 3, baseDamage: 0, backOnly: false, air: false, solid: true, lifetime: 60, spawner: { ogId: 2, every: 12 } }, // un Gromp toutes les 12 s
    // Coût 70
    44: { id: 44, key: 'leviathan', name: 'Léviathan', color: '#1e3a8a', cost: 70, speed: SPEED_UNIT * 1.2, movement: 'airStraight', hp: 8, baseDamage: 6, backOnly: true, air: true, turretCfg: { range: 1, cooldown: 2, air: 'none', pulse: true, damage: 1, anywhere: true } }, // bombarde le sol en volant
    45: { id: 45, key: 'titan', name: 'Titan', color: '#44403c', cost: 70, speed: SPEED_UNIT * 0.9, movement: 'straight', hp: 10, baseDamage: 6, backOnly: true, air: false, brute: true, crushesWalls: true }, // cuirassé
    46: { id: 46, key: 'essaim', name: 'Essaim', color: '#bef264', cost: 70, speed: SPEED_UNIT * 4, movement: 'airStraight', hp: 1, baseDamage: 1, backOnly: true, air: true, spawnCount: 6 }, // six moustiques
    47: { id: 47, key: 'reine', name: 'Reine', color: '#f0abfc', cost: 70, speed: 0, movement: 'static', hp: 5, baseDamage: 0, backOnly: false, air: false, solid: true, lifetime: 60, spawner: { ogId: 8, every: 5 } }, // un Pik toutes les 5 s
  };
  const OG_IDS = Object.keys(OGS).map(Number);
  // Familles de comportement (les nouvelles créatures s'y rattachent pour réutiliser les collisions de base).
  const idsWhere = (pred) => new Set(OG_IDS.filter(id => pred(OGS[id])));
  const RUNNERS = idsWhere(og => og.runner); // runners au sol : tués/abîmés par Gromp, Riko, tourelles et chargeurs ; rebondissent sur les murs
  const TURRETS = idsWhere(og => og.turret); // tourelles : détruites par Riko au contact, abîmées par les runners
  const STATIC_SOLID = idsWhere(og => og.solid); // obstacles pour Gromp
  const BRUTES = idsWhere(og => og.brute); // tanks : frappent tout ennemi au sol qu'ils touchent, prennent 1 dégât par choc
  const PATROLS = idsWhere(og => og.patrol); // patrouilleurs horizontaux (Gromp, Canonnier)
  const WINGED_TARGETS = idsWhere(og => og.runner || og.turret || og.air || og.ghost || og.id === 6 || og.id === 16); // cibles de Zéphir
  const HIT_IFRAME = 0.5; // s d'invulnérabilité après un choc, pour les créatures à plusieurs PV
  const EVOLVABLE = new Set([3, 5, 6]);
  const MAX_LEVEL = 3;
  const ABILITY_COST = 10;
  const ABILITY_COOLDOWN = 20;
  const KING_TARGET = 60;
  const ABILITIES = {
    1: { name: 'Sprint', desc: 'Tes Zip courent 2× plus vite pendant 3 s.' },
    2: { name: 'Rage', desc: 'Tes Gromp patrouillent 2× plus vite pendant 4 s.' },
    3: { name: 'Tir triple', desc: 'Chaque Krak tire immédiatement sur jusqu’à 3 cibles à portée.' },
    4: { name: 'Rebond fou', desc: 'Tes Riko gagnent 1 PV et accélèrent 2× pendant 4 s.' },
    5: { name: 'Mur de glace', desc: 'Chaque Blok gèle 2,5 s les ennemis au sol autour de lui.' },
    6: { name: 'Burst de mana', desc: '+15 mana par Mojo vivant (max 30).' },
    7: { name: 'Bombe', desc: 'Chaque Zéphir frappe (1 dégât) les unités au sol ennemies sous lui.' },
  };
  const VIOLET_OBSTACLES = STATIC_SOLID;

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
  // Un « joueur » est identifié par une clé : 'top' / 'bottom' (ou 'top1', 'bottom2'… en équipe) ; son camp est le préfixe.
  function sideOf(key) { return String(key).indexOf('top') === 0 ? 'top' : 'bottom'; }
  function other(player) { return sideOf(player) === 'top' ? 'bottom' : 'top'; }
  function dirOf(player) { return sideOf(player) === 'top' ? 1 : -1; }
  // Vrai si l'ordonnée y est dans la moitié de terrain de ce joueur (la ligne médiane n'appartient à personne).
  function inOwnHalf(player, y) { return sideOf(player) === 'top' ? y < FIELD_H / 2 : y > FIELD_H / 2; }
  // Une créature « rebondie » avance à contresens (vers sa propre base). Si elle repasse la frontière dans ce sens,
  // elle change de camp : elle devient une créature ennemie (ciblée par les tourelles, etc.).
  function markBounced(e) { if (e.vy) e.bounced = Math.sign(e.vy) !== dirOf(e.player); }
  function cellCenter(col, row) { return { x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H }; }
  function cellOf(x, y, cols) {
    const c = cols || DEFAULT_COLS;
    if (x < 0 || x >= c * CELL_W || y < 0 || y >= FIELD_H) return null;
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
    const opts = Object.assign({ seed: 1, hazard: false, duration: RULES.matchDuration, features: {}, bans: { top: [], bottom: [] }, cols: DEFAULT_COLS, players: ['top', 'bottom'] }, options || {}); // duration 0 = illimité ; hazard désactivé par défaut (le scorpion cassait le gameplay)
    const F = opts.features || {}; // interrupteurs (shared/features.js)
    const { COLS, FIELD } = geometry(opts.cols); // géométrie de cette partie (masque les valeurs par défaut du module)
    const PLAYERS = opts.players.slice(); // clés des joueurs (1 à 3 par camp)
    const teamOf = (side) => PLAYERS.filter(k => sideOf(k) === side);
    const bans = { top: (opts.bans && opts.bans.top) || [], bottom: (opts.bans && opts.bans.bottom) || [] }; // créatures interdites pour chaque joueur
    const rng = createRng(opts.seed);
    const S = {
      time: 0,
      tick: 0,
      over: false,
      winner: null, // 'top' | 'bottom' | 'draw'
      endReason: null,
      hp: { top: RULES.healthMax, bottom: RULES.healthMax }, // PV de base partagés par l'équipe
      mana: Object.fromEntries(PLAYERS.map(k => [k, F.manaX2 ? 30 : 0])), // mana individuelle, par clé de joueur
      abilities: Object.fromEntries(PLAYERS.map(k => [k, {}])), // par joueur : ogId -> fin de recharge (temps de jeu)
      overtime: false,
      points: { top: 0, bottom: 0 }, // Roi du centre
      entities: [],
      projectiles: [],
      orbs: [],
      hazard: { enabled: !!opts.hazard, active: false, phase: 'idle', x: 0, y: 0, targetX: 0, vx: 0, vy: 0, timer: 0, direction: null },
      orbTimers: { top: 0, bottom: 0 },
      stats: {
        top: { placed: 0, kills: 0, damage: 0, orbs: 0, manaSpent: 0, abilities: 0, evolutions: 0, placedBy: {} },
        bottom: { placed: 0, kills: 0, damage: 0, orbs: 0, manaSpent: 0, abilities: 0, evolutions: 0, placedBy: {} },
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
      // Pose rapprochée : une créature en mouvement ne bloque la case que tant que son centre en est tout proche.
      const r = F.tightSpacing ? RADIUS * RULES.tightSpacingFactor : RADIUS;
      return S.entities.some(e => (!ignoreAir || !e.air) && circleRect(e.x, e.y, e.movement === 'static' ? RADIUS : r, rx, ry, CELL_W, CELL_H));
    }

    // Évolution : l'unité statique (Krak, Blok, Mojo) du même joueur et du même type présente sur la case, si elle peut encore monter de niveau.
    function evolvable(player, ogId, col, row) {
      if (!F.evolution || !EVOLVABLE.has(ogId)) return null;
      const c = cellCenter(col, row), side = sideOf(player);
      return S.entities.find(e => e.player === side && e.ogId === ogId && (e.level || 1) < MAX_LEVEL && Math.abs(e.x - c.x) < 1 && Math.abs(e.y - c.y) < 1) || null;
    }
    function isBanned(player, ogId) { return bans[sideOf(player)].includes(ogId); }

    function availableCells(player, ogId) {
      const og = OGS[ogId];
      if (!og || isBanned(player, ogId)) return [];
      if (opts.decks && opts.decks[player] && !opts.decks[player].includes(ogId)) return [];
      const cells = [];
      const side = sideOf(player);
      const backRow = side === 'top' ? 0 : ROWS - 1; // ligne du fond, la plus loin de l'adversaire
      for (let row = 0; row < ROWS; row += 1) {
        if (sideOfRow(row) !== side) continue;
        if (og.backOnly && row !== backRow) continue;
        for (let col = 0; col < COLS; col += 1) {
          if (cellOccupied(col, row)) { if (evolvable(player, ogId, col, row)) cells.push({ col, row, evolve: true }); continue; }
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
      if (!(player in S.mana)) return { ok: false, reason: 'player' };
      const side = sideOf(player);
      if (sideOfRow(row) !== side) return { ok: false, reason: 'side' };
      const backRow = side === 'top' ? 0 : ROWS - 1;
      if (og.backOnly && row !== backRow) return { ok: false, reason: 'back' };
      if (isBanned(player, ogId)) return { ok: false, reason: 'banned' };
      if (opts.decks && opts.decks[player] && !opts.decks[player].includes(ogId)) return { ok: false, reason: 'deck' }; // pas dans son équipe
      const target = cellOccupied(col, row) ? evolvable(player, ogId, col, row) : null;
      if (cellOccupied(col, row) && !target) return { ok: false, reason: 'occupied' };
      if (S.mana[player] < og.cost) return { ok: false, reason: 'mana' };
      return { ok: true, evolve: target ? target.id : undefined };
    }

    function spawn(owner, ogId, col, row) {
      const og = OGS[ogId];
      const player = sideOf(owner); // camp de l'unité ; owner = clé du joueur qui l'a posée
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
      const mult = F.fastUnits ? 1.5 : 1;
      const e = {
        id: S.nextId++, ogId, player, owner, x: pos.x, y: pos.y, vx: vx * mult, vy: vy * mult,
        hp: og.hp, hpMax: og.hp, cooldown: 0, air: og.air, speed: og.speed * mult, movement: og.movement,
        rot: 0, rotTarget: 0, born: S.time, level: 1, boostUntil: 0, frozenUntil: 0, healTimer: 0,
        bounced: false, visitedEnemy: false, // rebond à contresens / a déjà été dans le camp adverse (changement de camp à la frontière)
        hitUntil: 0, slowUntil: 0, special: 0, // invulnérabilité après choc, ralenti par une Glu, minuteur des pouvoirs (Rafale, Sirène)
        expires: F.lifetime !== false && og.lifetime ? S.time + og.lifetime : Infinity, // structures éphémères (option « lifetime »)
        auraUntil: 0, auraSpeed: 1, armorHits: 0, growTimer: 0,
      };
      if (ogId === 3 || ogId === 7) { e.rot = e.rotTarget = player === 'top' ? Math.PI / 2 : -Math.PI / 2; }
      if (ogId === 2) { e.rot = vx >= 0 ? Math.PI : 0; }
      S.entities.push(e);
      return e;
    }

    function place(player, ogId, col, row) {
      const check = canPlace(player, ogId, col, row);
      if (!check.ok) return check;
      const og = OGS[ogId];
      const side = sideOf(player);
      S.mana[player] -= og.cost;
      S.stats[side].manaSpent += og.cost;
      S.stats[side].placed += 1;
      S.stats[side].placedBy[ogId] = (S.stats[side].placedBy[ogId] || 0) + 1;
      if (check.evolve) {
        const e = S.entities.find(x => x.id === check.evolve);
        e.level = (e.level || 1) + 1;
        e.hpMax += 1; e.hp = e.hpMax;
        if (e.expires !== Infinity) e.expires = S.time + (og.lifetime || 0); // l'évolution relance la durée de vie
        S.stats[side].evolutions += 1;
        emit('evolve', { player: side, owner: player, ogId, id: e.id, x: e.x, y: e.y, level: e.level });
        return { ok: true, id: e.id, evolved: e.level };
      }
      const e = spawn(player, ogId, col, row);
      emit('place', { player: side, owner: player, ogId, id: e.id, x: e.x, y: e.y });
      // Jumeaux, Essaim : plusieurs unités d'un coup, en éventail autour de la case.
      const n = og.spawnCount || 1;
      for (let i = 1; i < n; i += 1) {
        const x = spawn(player, ogId, col, row);
        const a = (i / n) * Math.PI * 2;
        x.x = Math.max(RADIUS, Math.min(FIELD.w - RADIUS, x.x + Math.cos(a) * RADIUS * 1.3)); x.y += Math.sin(a) * RADIUS * 0.8;
        emit('place', { player: side, owner: player, ogId, id: x.id, x: x.x, y: x.y });
      }
      return { ok: true, id: e.id };
    }

    // ----- Capacités actives (une par type de créature, 10 mana, 20 s de recharge) -----
    function canUseAbility(player, ogId) {
      if (!F.abilities) return { ok: false, reason: 'disabled' };
      if (S.over) return { ok: false, reason: 'over' };
      if (!ABILITIES[ogId]) return { ok: false, reason: 'unknown' };
      if (!(player in S.mana)) return { ok: false, reason: 'player' };
      if ((S.abilities[player][ogId] || 0) > S.time) return { ok: false, reason: 'cooldown' };
      if (S.mana[player] < ABILITY_COST) return { ok: false, reason: 'mana' };
      const mine = S.entities.filter(e => e.player === sideOf(player) && e.ogId === ogId); // toute l'équipe en profite
      if (!mine.length) return { ok: false, reason: 'none' };
      return { ok: true, units: mine };
    }
    function useAbility(owner, ogId) {
      const check = canUseAbility(owner, ogId);
      if (!check.ok) return check;
      const player = sideOf(owner);
      S.mana[owner] -= ABILITY_COST;
      S.abilities[owner][ogId] = S.time + ABILITY_COOLDOWN;
      S.stats[player].abilities += 1;
      const units = check.units;
      const near2 = (CELL_W * 1.1) ** 2;
      switch (ogId) {
        case 1: for (const u of units) u.boostUntil = S.time + 3; break; // Sprint
        case 2: for (const u of units) u.boostUntil = S.time + 4; break; // Rage
        case 3: // Tir triple : chaque Krak tire sur jusqu'à 3 cibles à portée
          for (const u of units) {
            let shots = 0;
            for (const e of S.entities) { if (shots >= 3) break; if (e.player === player || dead.has(e.id)) continue; if (dist2(u, e) <= near2) { fire(u, e); shots += 1; } }
            u.cooldown = RULES.orangeCooldown;
          }
          break;
        case 4: for (const u of units) { u.hp = Math.min(u.hpMax + 1, u.hp + 1); u.hpMax = Math.max(u.hpMax, u.hp); u.boostUntil = S.time + 4; } break; // Rebond fou
        case 5: // Mur de glace : gèle les ennemis autour de chaque Blok
          for (const u of units) for (const e of S.entities) { if (e.player === player || e.air) continue; if (dist2(u, e) <= near2) e.frozenUntil = S.time + 2.5; }
          break;
        case 6: S.mana[owner] = Math.min(RULES.manaMax, S.mana[owner] + Math.min(30, 15 * units.length)); break; // Burst de mana
        case 7: // Bombe : chaque Zéphir frappe les unités au sol ennemies sous lui
          for (const u of units) for (const e of S.entities) { if (e.player === player || e.air || dead.has(e.id)) continue; if (dist2(u, e) <= near2) damage(e, 1, player, 'bomb'); }
          break;
        default: break;
      }
      emit('ability', { player, owner, ogId, units: units.map(u => ({ id: u.id, x: u.x, y: u.y })) });
      return { ok: true };
    }

    function collectOrb(player, orbId) {
      if (S.over || !(player in S.mana)) return false;
      const side = sideOf(player);
      const idx = S.orbs.findIndex(o => o.id === orbId && o.player === side);
      if (idx === -1) return false;
      const orb = S.orbs[idx];
      S.orbs.splice(idx, 1);
      S.mana[player] = Math.min(RULES.manaMax, S.mana[player] + RULES.orbMana);
      S.stats[side].orbs += 1;
      emit('orb', { player: side, owner: player, x: orb.x, y: orb.y, mana: RULES.orbMana });
      return true;
    }

    // ----- Boucle -----
    const dead = new Set();
    function kill(e, by, cause) {
      if (dead.has(e.id)) return;
      dead.add(e.id);
      if (by && by !== e.player) S.stats[by].kills += 1;
      emit('kill', { id: e.id, ogId: e.ogId, player: e.player, x: e.x, y: e.y, cause: cause || 'contact' });
      const og = OGS[e.ogId];
      if (og && og.blastOnDeath && cause !== 'base' && cause !== 'home') blast(e, CELL_W * 1.1, og.blastOnDeath, e.player, 'blast');
      // Hydre, Golem, Phénix : laissent des rejetons à leur mort (pas en arrivant à une base).
      if (og && og.onDeath && cause !== 'base' && cause !== 'home' && cause !== 'expire') {
        const c = cellOf(e.x, e.y, COLS);
        for (let i = 0; i < og.onDeath.count; i += 1) {
          const child = spawn(e.owner, og.onDeath.ogId, c.col, c.row);
          child.player = e.player; child.x = Math.max(RADIUS, Math.min(FIELD.w - RADIUS, e.x + (i - (og.onDeath.count - 1) / 2) * RADIUS * 1.4)); child.y = e.y;
          child.vy = Math.abs(child.vy) * dirOf(e.player); child.vx = 0;
          emit('place', { player: e.player, owner: e.owner, ogId: child.ogId, id: child.id, x: child.x, y: child.y, spawned: true });
        }
      }
    }
    function damage(e, amount, by, cause) {
      if (dead.has(e.id)) return;
      e.hp -= amount;
      emit('hit', { id: e.id, ogId: e.ogId, player: e.player, x: e.x, y: e.y, hp: e.hp });
      if (e.hp <= 0) kill(e, by, cause);
    }
    function healBase(side, amount, source) {
      const before = S.hp[side];
      S.hp[side] = Math.min(RULES.healthMax, S.hp[side] + amount);
      if (S.hp[side] > before) emit('heal', { target: side, amount: S.hp[side] - before, x: source.x, y: source.y });
    }
    // Choc sur une créature à plusieurs PV : 1 dégât puis une courte invulnérabilité (sinon un contact prolongé la tuerait d'un coup).
    function hit(e, by, cause, amount) {
      if (dead.has(e.id) || e.hitUntil > S.time) return false;
      e.hitUntil = S.time + HIT_IFRAME;
      damage(e, amount || 1, by, cause);
      // Recul : une créature qui survit au choc est repoussée d'un demi-rayon, pour sortir du contact.
      if (!dead.has(e.id) && e.movement !== 'static' && (e.vx || e.vy)) { const len = Math.hypot(e.vx, e.vy) || 1; e.x -= e.vx / len * RADIUS * 1.2; e.y -= e.vy / len * RADIUS * 1.2; e.x = Math.max(RADIUS, Math.min(FIELD.w - RADIUS, e.x)); }
      return true;
    }
    function hurtBase(target, amount, source) {
      if (amount <= 0) return;
      S.hp[target] = Math.max(0, S.hp[target] - amount);
      S.stats[other(target)].damage += amount;
      emit('base', { target, amount, ogId: source ? source.ogId : 0, x: source ? source.x : FIELD.w / 2, y: source ? source.y : FIELD.h / 2 });
      if (S.overtime && !S.over) end(other(target), 'overtime');
    }

    function updateMana(dt) {
      const chargers = { top: 0, bottom: 0 };
      for (const e of S.entities) if (e.ogId === 6) chargers[e.player] += (e.level || 1);
      for (const k of PLAYERS) {
        const regen = RULES.manaRegen * (1 + RULES.chargerBoost * chargers[sideOf(k)]) * (F.manaX2 ? 2 : 1) * (S.overtime ? 3 : 1);
        S.mana[k] = Math.min(RULES.manaMax, S.mana[k] + regen * dt);
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
        if (e.frozenUntil > S.time) continue; // gelé par un Mur de glace
        const k = (e.boostUntil > S.time ? 2 : 1) * (e.slowUntil > S.time ? RULES.gluFactor : 1) * (e.auraUntil > S.time ? e.auraSpeed : 1); // capacité active (sprint / rage) / englué / Phare
        switch (e.movement) {
          case 'straight':
          case 'airStraight':
            e.y += e.vy * k * dt; e.x += e.vx * k * dt;
            if (F.zigzag && e.ogId === 1) { e.x += Math.cos(S.time * 5 + e.id) * e.speed * 1.2 * dt; if (e.x < RADIUS) e.x = RADIUS; if (e.x > FIELD.w - RADIUS) e.x = FIELD.w - RADIUS; }
            break;
          case 'horizontal':
            e.x += e.vx * k * dt;
            if (e.x - RADIUS <= 0) { e.x = RADIUS; setVioletVx(e, Math.abs(e.vx)); }
            else if (e.x + RADIUS >= FIELD.w) { e.x = FIELD.w - RADIUS; setVioletVx(e, -Math.abs(e.vx)); }
            break;
          case 'diagBounce':
            e.x += e.vx * k * dt; e.y += e.vy * k * dt;
            if (e.x - RADIUS <= 0) { e.x = RADIUS; e.vx = Math.abs(e.vx); }
            else if (e.x + RADIUS >= FIELD.w) { e.x = FIELD.w - RADIUS; e.vx = -Math.abs(e.vx); }
            break;
          default: break;
        }
        // Rotations décoratives mais synchronisées (tourelles, éponge).
        if (e.ogId === 4) e.rot += 0.6 * dt;
        if (e.ogId === 3 || e.ogId === 7) {
          const d = shortestAngle(e.rot, e.rotTarget);
          const step = 6 * dt;
          e.rot = Math.abs(d) <= step ? e.rotTarget : e.rot + Math.sign(d) * step;
        }
        // Frontière : une créature rebondie qui revient dans son camp après être allée chez l'adversaire change de camp.
        if (e.movement !== 'static') {
          if (e.bounced && e.visitedEnemy && inOwnHalf(e.player, e.y)) {
            e.player = other(e.player); e.bounced = false; e.visitedEnemy = true;
            emit('bounce', { id: e.id, x: e.x, y: e.y, flip: true, player: e.player });
          } else if (!inOwnHalf(e.player, e.y + dirOf(e.player) * RADIUS)) e.visitedEnemy = true; // son avant a franchi la ligne
        }
        // Bout de terrain : atteindre la base adverse fait des dégâts ; revenir à sa propre base (après un rebond chez soi) = sortie sans dégât.
        const reachedEnemy = (e.player === 'top' && e.y + RADIUS >= FIELD.h) || (e.player === 'bottom' && e.y - RADIUS <= 0);
        const reachedOwn = (e.player === 'top' && e.y - RADIUS <= 0) || (e.player === 'bottom' && e.y + RADIUS >= FIELD.h);
        if (reachedEnemy) {
          const og = OGS[e.ogId];
          if (og.baseDamage > 0) hurtBase(other(e.player), og.baseDamage, e);
          if (og.heals) healBase(e.player, og.heals, e);
          if (og.manaOnBase && e.owner in S.mana) { S.mana[e.owner] = Math.min(RULES.manaMax, S.mana[e.owner] + og.manaOnBase); emit('mana', { owner: e.owner, amount: og.manaOnBase, x: e.x, y: e.y }); } // Lutin
          kill(e, null, 'base');
        } else if (reachedOwn) kill(e, null, 'home');
      }
    }

    // ---------- Comportements des 10 nouvelles créatures ----------
    function blast(center, radius, amount, by, cause, hitsAir) {
      const r2 = radius * radius;
      for (const e of S.entities) { if (e.player === center.player || dead.has(e.id) || (e.air && !hitsAir)) continue; if (dist2(center, e) <= r2) damage(e, amount, by, cause); }
      emit('blast', { x: center.x, y: center.y, radius, player: center.player });
    }
    function newCreatures(minDist, minD2) {
      const near2 = (CELL_W * 1.05) ** 2;
      // Brutes (Tiktak, Kraken) : frappent tout ennemi au sol qu'elles touchent (1 dégât, ou mort pour Kraken), prennent 1 dégât par choc.
      for (const b of bySet(BRUTES)) {
        if (dead.has(b.id)) continue;
        const og = OGS[b.ogId];
        for (const e of S.entities) {
          if (e.player === b.player || dead.has(e.id) || dead.has(b.id) || e.air) continue;
          if (OGS[e.ogId].walkable || OGS[e.ogId].mine || (e.movement === 'static' && e.air)) continue; // flaques, mines, ballons : logique à part
          if (dist2(b, e) > minD2) continue;
          if (e.ogId === 5) { // mur : Kraken l'écrase, Tiktak rebondit dessus
            if (og.crushesWalls) { kill(e, b.player, 'crush'); hit(b, e.player, 'wall'); }
            else { b.vy = -b.vy; markBounced(b); b.y += Math.sign(b.vy) * RADIUS * 0.6; emit('bounce', { id: b.id, x: b.x, y: b.y }); }
            continue;
          }
          if (BRUTES.has(e.ogId)) { hit(e, b.player, 'brute'); hit(b, e.player, 'brute'); continue; } // deux brutes : coup pour coup
          if (og.crushesWalls) kill(e, b.player, 'crush'); else hit(e, b.player, 'brute');
          if (og.freezeOnHit && !dead.has(e.id)) e.frozenUntil = S.time + og.freezeOnHit; // Givre
          if (og.healOnKill && dead.has(e.id)) healBase(b.player, og.healOnKill, b); // Vampire
          hit(b, e.player, 'impact');
        }
      }
      extraCreatures(minDist, minD2);
      // Fantôme : traverse murs et unités au sol ; seuls les projectiles et Riko l'atteignent.
      for (const f of byOg(14)) for (const r of byOg(4)) { if (r.player === f.player || dead.has(f.id) || dead.has(r.id)) continue; if (dist2(f, r) <= minD2) { if (hit(f, r.player, 'red')) damage(r, 1, f.player, 'ghost'); } }
      // Mines (Boum) : sautent au passage d'un ennemi (sol ou air) : 3 dégâts dans 1,5 case autour, volants compris ; 3 charges (ses PV), réarmement 4 s.
      for (const m of byOg(11)) {
        if (dead.has(m.id)) continue;
        m.special -= 1 / 30;
        if (m.special > 0) continue;
        const trigger = S.entities.find(e => e.player !== m.player && !dead.has(e.id) && e.movement !== 'static' && dist2(m, e) <= (CELL_W * RULES.mineTriggerCells) ** 2);
        if (trigger) { blast(m, CELL_W * RULES.mineRadiusCells, RULES.mineDamage, m.player, 'mine', true); m.special = RULES.mineRearm; damage(m, 1, trigger.player, 'mine'); }
      }
      // Glu : englue les ennemis au sol qui passent dans sa flaque (1,5 case) : vitesse ×0,4.
      for (const g of byOg(15)) for (const e of S.entities) { if (e.player === g.player || dead.has(e.id) || e.air || e.movement === 'static') continue; if (dist2(g, e) <= (CELL_W * RULES.gluRadiusCells) ** 2) e.slowUntil = S.time + 0.3; }
      // Rafale : toutes les 2 s, souffle les ennemis (sol et air) devant elle (jusqu'à 2 cases, 1 colonne de chaque côté, dans son
      // camp seulement) de 3/4 de case vers l'arrière (volants : 1/2 case, brutes : pas de recul) et inflige 1 dégât. Une unité ne subit
      // qu'un souffle à la fois (plusieurs Rafales ne se cumulent pas).
      for (const f of byOg(12)) {
        if (dead.has(f.id) || f.frozenUntil > S.time) continue;
        f.special -= 1 / 30;
        if (f.special > 0) continue;
        const dir = dirOf(f.player);
        let pushed = 0;
        for (const e of S.entities) {
          if (e.player === f.player || dead.has(e.id) || e.movement === 'static' || (e.gustUntil || 0) > S.time) continue;
          const forward = dir * (e.y - f.y);
          if (forward < 0 || forward > CELL_H * RULES.gustRangeCells || Math.abs(e.x - f.x) > CELL_W * 1.5 || !inOwnHalf(f.player, e.y)) continue;
          const heavy = BRUTES.has(e.ogId);
          if (!heavy) e.y = Math.max(RADIUS, Math.min(FIELD.h - RADIUS, e.y + dir * CELL_H * RULES.gustPush * (e.air ? 0.66 : 1))); // les brutes ne reculent pas, les volants moins
          pushed += 1;
          e.gustUntil = S.time + RULES.gustEvery;
          hit(e, f.player, 'gust'); // le souffle blesse aussi (1 dégât, avec l'invulnérabilité courte habituelle)
        }
        if (pushed) { f.special = RULES.gustEvery; emit('gust', { id: f.id, x: f.x, y: f.y, player: f.player, dir }); } else f.special = 0.2;
      }
      // Sirène : toutes les 4,5 s, charme l'ennemi au sol le plus proche (2 cases) : il change de camp et repart dans l'autre sens.
      for (const s of byOg(16)) {
        if (dead.has(s.id) || s.frozenUntil > S.time) continue;
        s.special -= 1 / 30;
        if (s.special > 0) continue;
        let best = null, bestD = (CELL_W * 2.5) ** 2;
        for (const e of S.entities) { if (e.player === s.player || dead.has(e.id) || e.air || e.movement === 'static' || BRUTES.has(e.ogId)) continue; const d = dist2(s, e); if (d < bestD) { bestD = d; best = e; } }
        if (!best) { s.special = 0.3; continue; }
        best.player = s.player; best.owner = s.owner; best.vy = -best.vy; best.bounced = false; best.visitedEnemy = !inOwnHalf(s.player, best.y);
        if (best.ogId === 2) { best.vx = -best.vx; best.rot = best.vx >= 0 ? Math.PI : 0; }
        s.special = 4.5;
        emit('charm', { id: best.id, from: s.id, x: best.x, y: best.y, player: s.player });
        emit('bounce', { id: best.id, x: best.x, y: best.y, flip: true, player: s.player });
      }
    }

    // ---------- Mécaniques génériques des créatures 18 à 47 ----------
    function extraCreatures(minDist, minD2) {
      const dt = 1 / 30;
      for (const e of S.entities) {
        if (dead.has(e.id)) continue;
        const og = OGS[e.ogId];
        if (e.frozenUntil > S.time) continue;
        // Tourelles génériques (Flak, Canonnier, Oracle, Mortier, Ballon, Léviathan) : carré de `range` cases, dans son camp (sauf `anywhere`).
        if (og.turretCfg && e.frozenUntil <= S.time) {
          const T = og.turretCfg;
          e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
          if (e.cooldown <= 0) {
            const inRange = (t) => t.player !== e.player && !dead.has(t.id) && (T.air === 'all' || (T.air === 'only') === !!t.air) && Math.abs(t.x - e.x) <= (T.range + 0.5) * CELL_W && Math.abs(t.y - e.y) <= (T.range + 0.5) * CELL_H && (T.anywhere || inOwnHalf(e.player, t.y)) && !(t.movement === 'static' && T.pulse && OGS[t.ogId].walkable);
            const targets = S.entities.filter(inRange);
            if (targets.length) {
              e.cooldown = T.cooldown;
              if (T.pulse) { for (const t of targets) damage(t, T.damage || 1, e.player, 'pulse'); emit('blast', { x: e.x, y: e.y, radius: (T.range + 0.5) * CELL_W, player: e.player, pulse: true }); }
              else { let best = null, bd = Infinity; for (const t of targets) { const d = dist2(e, t); if (d < bd) { bd = d; best = t; } } e.rotTarget = Math.atan2(best.y - e.y, best.x - e.x); fire(e, best); }
            }
          }
        }
        // Pondeuses (Nid, Totem, Reine).
        if (og.spawner) {
          e.special -= dt;
          if (e.special <= 0) {
            e.special = og.spawner.every;
            const c = cellOf(e.x, e.y, COLS);
            const child = spawn(e.owner, og.spawner.ogId, c.col, c.row);
            child.player = e.player; child.y = e.y + dirOf(e.player) * RADIUS * 1.6; child.x = e.x;
            emit('place', { player: e.player, owner: e.owner, ogId: child.ogId, id: child.id, x: child.x, y: child.y, spawned: true });
          }
        }
        // Auras (Nuage : volants ennemis englués ; Phare : alliés accélérés ; Gel : gel périodique des ennemis au sol).
        if (og.aura) {
          const A = og.aura, r2 = (CELL_W * A.radius) ** 2;
          if (A.slowAir || A.slowGround) for (const t of S.entities) { if (t.player !== e.player && (t.air ? A.slowAir : A.slowGround) && t.movement !== 'static' && !dead.has(t.id) && dist2(e, t) <= r2) t.slowUntil = S.time + 0.3; }
          if (A.zapAir) { e.special -= dt; if (e.special <= 0) { let any = false; for (const t of S.entities) { if (t.player !== e.player && t.air && !dead.has(t.id) && dist2(e, t) <= r2) { damage(t, A.zapAir.damage, e.player, 'zap'); any = true; } } if (any) { e.special = A.zapAir.every; emit('blast', { x: e.x, y: e.y, radius: CELL_W * A.radius, player: e.player, pulse: true }); } else e.special = 0.2; } }
          if (A.speed) for (const t of S.entities) { if (t.player === e.player && t.movement !== 'static' && !dead.has(t.id) && dist2(e, t) <= r2) { t.auraUntil = S.time + 0.3; t.auraSpeed = A.speed; } }
          if (A.freezeEvery) {
            e.special -= dt;
            if (e.special <= 0) {
              let hitAny = false;
              for (const t of S.entities) { if (t.player !== e.player && !t.air && t.movement !== 'static' && !dead.has(t.id) && dist2(e, t) <= r2) { t.frozenUntil = S.time + A.freeze; hitAny = true; } }
              if (hitAny) { e.special = A.freezeEvery; emit('ability', { player: e.player, owner: e.owner, ogId: e.ogId, units: [{ id: e.id, x: e.x, y: e.y }], passive: true }); } else e.special = 0.3;
            }
          }
        }
        // Source : soigne la base régulièrement.
        if (og.healEvery) { e.special -= dt; if (e.special <= 0) { e.special = og.healEvery.every; healBase(e.player, og.healEvery.amount, e); } }
        // Boule : grossit en roulant.
        if (og.grow && e.hpMax < og.grow.max) { e.growTimer += dt; if (e.growTimer >= og.grow.every) { e.growTimer = 0; e.hpMax += 1; e.hp += 1; emit('evolve', { player: e.player, owner: e.owner, ogId: e.ogId, id: e.id, x: e.x, y: e.y, level: e.hpMax }); } }
        // Kamikazes (Étincelle, Pétard) : explosent sur le premier ennemi à portée.
        if (og.kamikaze) {
          const K = og.kamikaze, r2 = (CELL_W * K.radius) ** 2;
          const t = S.entities.find(t => t.player !== e.player && !dead.has(t.id) && (K.air || !t.air) && !OGS[t.ogId].walkable && dist2(e, t) <= r2);
          if (t) { blast(e, CELL_W * K.radius, K.damage, e.player, 'kamikaze', K.air); kill(e, null, 'kamikaze'); }
        }
        // Dynamite : explose sur la première structure ennemie survolée.
        if (og.wallBreaker) {
          const W = og.wallBreaker, r2 = (CELL_W * W.radius) ** 2;
          const t = S.entities.find(t => t.player !== e.player && !dead.has(t.id) && t.movement === 'static' && !t.air && dist2(e, t) <= r2);
          if (t) { blast(e, CELL_W * W.radius, W.damage, e.player, 'dynamite'); kill(e, null, 'dynamite'); }
        }
        // Pioche : casse les structures ennemies qu'elle touche (−1 PV), passe entre les unités.
        if (og.hunter) {
          for (const t of S.entities) {
            if (t.player === e.player || dead.has(t.id) || dead.has(e.id) || t.movement !== 'static' || t.air || OGS[t.ogId].walkable) continue;
            if (dist2(e, t) <= minD2) { kill(t, e.player, 'crush'); hit(e, t.player, 'impact'); }
          }
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
    function bySet(set) { return S.entities.filter(e => set.has(e.ogId) && !dead.has(e.id)); }

    function collisions() {
      const minDist = RADIUS * 2, minD2 = minDist * minDist;
      const yellows = bySet(RUNNERS), violets = bySet(PATROLS), oranges = bySet(TURRETS), reds = byOg(4), blues = byOg(5), greens = byOg(6);

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
      // Violet vs obstacles (tourelles, murs, chargeurs, sirènes, toutes équipes) et vs brutes (il rebondit dessus).
      for (const v of violets) for (const o of S.entities) {
        if (!(VIOLET_OBSTACLES.has(o.ogId) || BRUTES.has(o.ogId)) || dead.has(o.id)) continue;
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
          if (v.player === y.player || dead.has(y.id) || !OGS[v.ogId].eater) continue; // seul Gromp mange les runners
          if (dist2(y, v) <= minD2) hit(y, v.player, 'violet', RULES.grompDamage);
        }
        for (const b of blues) {
          if (dead.has(y.id) || dead.has(b.id)) continue;
          const d2 = dist2(y, b);
          if (d2 <= minD2) {
            // Rebond sur tout Blok, le sien compris (il faut laisser des allées à ses alliés). Le camp change à la frontière.
            const d = Math.max(Math.sqrt(d2), 1e-6);
            const overlap = minDist - d;
            y.x += (y.x - b.x) / d * overlap * 0.5;
            y.y += (y.y - b.y) / d * overlap * 0.5;
            y.vx = -(y.vx || 0);
            y.vy = -(y.vy || dirOf(y.player) * y.speed);
            markBounced(y);
            emit('bounce', { id: y.id, x: y.x, y: y.y });
            if (b.player !== y.player) damage(b, 1, y.owner, 'runner');
          }
        }
        for (const r of reds) {
          if (r.player === y.player || dead.has(y.id) || dead.has(r.id)) continue;
          if (dist2(y, r) <= minD2) { if (hit(y, r.player, 'red')) damage(r, 1, y.player, 'runner'); }
        }
        for (const o of oranges) {
          if (o.player === y.player || dead.has(y.id) || dead.has(o.id)) continue;
          if (dist2(y, o) <= minD2) { if (hit(y, o.player, 'turret')) damage(o, 1, y.player, 'runner'); }
        }
        for (const g of greens.concat(byOg(16))) { // chargeurs et sirènes : le runner les abîme et prend un coup
          if (g.player === y.player || dead.has(y.id) || dead.has(g.id)) continue;
          if (dist2(y, g) <= minD2) { if (hit(y, g.player, 'charger')) damage(g, 1, y.player, 'runner'); }
        }
      }
      // Runner vs runner adverse : destruction mutuelle, quels que soient les PV (un Zip à 10 mana répond à un Pik).
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
          if (dist2(r, v) <= minD2) {
            if (F.powerPatches) { // Gromp renvoie Riko (qui perd 1 PV) au lieu de mourir avec
              r.vy = -r.vy; r.vx = -r.vx; r.y += Math.sign(r.vy) * RADIUS * 0.6; markBounced(r);
              emit('bounce', { id: r.id, x: r.x, y: r.y }); damage(r, 1, v.player, 'violet');
            } else { kill(r, v.player, 'violet'); kill(v, r.player, 'red'); }
          }
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
          if (dead.has(b.id) || dead.has(r.id)) continue;
          if (dist2(r, b) <= minD2) {
            // Riko rebondit sur tout Blok (le sien compris) : réflexion de sa vitesse sur la normale au point de contact,
            // puis on le ressort du mur ; un mur ennemi encaisse RULES.rikoWallDamage PV. S'il repart à contresens, il
            // deviendra ennemi en repassant la frontière.
            let nx = r.x - b.x, ny = r.y - b.y; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
            const dot = r.vx * nx + r.vy * ny;
            if (dot < 0) { r.vx -= 2 * dot * nx; r.vy -= 2 * dot * ny; }
            r.x = b.x + nx * (minDist + 1); r.y = b.y + ny * (minDist + 1);
            markBounced(r);
            emit('bounce', { id: r.id, x: r.x, y: r.y });
            if (b.player !== r.player && RULES.rikoWallDamage > 0) damage(b, RULES.rikoWallDamage, r.player, 'red');
          }
        }
        // Riko vs Sirène : chacun prend un coup.
        for (const s of byOg(16)) { if (s.player === r.player || dead.has(s.id) || dead.has(r.id)) continue; if (dist2(r, s) <= minD2) { if (hit(r, s.player, 'impact')) damage(s, 1, r.player, 'red'); } }
      }
      newCreatures(minDist, minD2);
    }

    function turrets(dt) {
      for (const s of S.entities) {
        if ((s.ogId !== 3 && s.ogId !== 7) || dead.has(s.id)) continue;
        if (s.frozenUntil > S.time) continue;
        const range = RULES.wingedRangeCells * Math.max(CELL_W, CELL_H);
        const range2 = range * range;
        s.cooldown = Math.max(0, s.cooldown - dt);
        if (s.cooldown > 0) continue;
        let target = null, best = Infinity;
        for (const e of S.entities) {
          if (e.player === s.player || dead.has(e.id)) continue;
          const forward = dirOf(s.player) * (e.y - s.y); // distance devant (positive) ou derrière (négative)
          if (s.ogId === 3) {
            // Krak : carré de 2 cases tout autour de lui (devant, derrière, côtés), jamais dans le camp adverse.
            if (Math.abs(e.x - s.x) > (RULES.orangeRange + 0.5) * CELL_W) continue;
            if (Math.abs(e.y - s.y) > (RULES.orangeRange + 0.5) * CELL_H) continue;
            if (!inOwnHalf(s.player, e.y)) continue;
          } else {
            // Zéphir : tir vers l'avant, à 1 case, et jamais sur un ennemi encore dans le camp adverse.
            if (dist2(s, e) > range2) continue;
            if (!WINGED_TARGETS.has(e.ogId)) continue;
            if (forward < 0) continue; // tir vers l'avant uniquement
            if (!inOwnHalf(s.player, e.y)) continue;
          }
          const d = dist2(s, e);
          if (d < best) { best = d; target = e; }
        }
        if (target) {
          s.cooldown = (s.ogId === 3 ? RULES.orangeCooldown : RULES.wingedCooldown) * (1 - 0.2 * ((s.level || 1) - 1));
          s.rotTarget = Math.atan2(target.y - s.y, target.x - s.x);
          fire(s, target);
        } else {
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

    // Patchs de pouvoir : Mojo soigne ses voisins, Zéphir bombarde les Blok survolés.
    function powerPatches(dt) {
      if (!F.powerPatches) return;
      const near2 = (CELL_W * 1.1) ** 2;
      for (const m of S.entities) {
        if (m.ogId === 6 && !dead.has(m.id)) {
          m.healTimer += dt;
          if (m.healTimer >= 5) {
            m.healTimer = 0;
            for (const e of S.entities) { if (e.player !== m.player || e.id === m.id || e.hp >= e.hpMax) continue; if (dist2(m, e) <= near2) { e.hp += 1; emit('heal', { id: e.id, x: e.x, y: e.y }); } }
          }
        }
        if (m.ogId === 7 && !dead.has(m.id)) {
          m.bombed = m.bombed || [];
          for (const b of S.entities) { if (b.player === m.player || b.ogId !== 5 || dead.has(b.id) || m.bombed.includes(b.id)) continue; if (dist2(m, b) <= (RADIUS * 1.6) ** 2) { m.bombed.push(b.id); damage(b, 1, m.player, 'bomb'); emit('ability', { player: m.player, ogId: 7, units: [{ id: m.id, x: m.x, y: m.y }], passive: true }); } }
        }
      }
    }

    // Roi du centre : chaque unité dans les deux lignes centrales rapporte 1 point / s.
    function kingOfCenter(dt) {
      if (!F.kingOfCenter) return;
      const y0 = (ROWS_PER_SIDE - 1) * CELL_H, y1 = (ROWS_PER_SIDE + 1) * CELL_H;
      for (const e of S.entities) if (e.y >= y0 && e.y < y1 && !dead.has(e.id)) S.points[e.player] += dt;
      if (S.points.top >= KING_TARGET || S.points.bottom >= KING_TARGET) end(S.points.top >= S.points.bottom ? 'top' : 'bottom', 'points');
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
          if (OGS[hit.ogId].armor && (hit.armorHits = (hit.armorHits || 0) + 1) % 2 === 1) emit('hit', { id: hit.id, ogId: hit.ogId, player: hit.player, x: hit.x, y: hit.y, hp: hit.hp, armor: true }); // carapace : un projectile sur deux ricoche
          else damage(hit, 1, p.player, 'projectile');
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
      else if (opts.duration && S.time >= opts.duration && !S.overtime) {
        if (F.kingOfCenter && Math.round(S.points.top) !== Math.round(S.points.bottom)) end(S.points.top > S.points.bottom ? 'top' : 'bottom', 'points');
        else if (S.hp.top === S.hp.bottom) {
          if (F.overtime) { S.overtime = true; emit('overtime', {}); }
          else end('draw', 'time');
        } else end(S.hp.top > S.hp.bottom ? 'top' : 'bottom', 'time');
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
      for (const e of S.entities) if (e.expires <= S.time) kill(e, null, 'expire'); // structures arrivées en fin de vie
      moveEntities(dt);
      turrets(dt);
      collisions();
      powerPatches(dt);
      projectiles(dt);
      kingOfCenter(dt);
      flush();
      checkEnd();
    }

    function surrender(player) {
      if (S.over) return;
      end(other(player), 'surrender');
    }

    function drainEvents() { const ev = events; events = []; return ev; }

    // Caché pour l'adversaire ? Mines toujours, fantômes et taupes dans leur camp ; un Oracle adverse à portée révèle tout.
    function isHidden(e) {
      const og = OGS[e.ogId];
      const hidden = og.hiddenFromEnemy || ((og.ghost || og.stealth) && inOwnHalf(e.player, e.y));
      if (!hidden) return false;
      return !S.entities.some(o => o.player !== e.player && OGS[o.ogId].reveal && !dead.has(o.id) && Math.abs(o.x - e.x) <= CELL_W * (OGS[o.ogId].reveal + 0.5) && Math.abs(o.y - e.y) <= CELL_H * (OGS[o.ogId].reveal + 0.5));
    }
    // Snapshot compact (envoyé sur le réseau).
    function snapshot() {
      return {
        t: Math.round(S.time * 1000) / 1000,
        k: S.tick,
        hp: [S.hp.top, S.hp.bottom],
        mana: Object.fromEntries(PLAYERS.map(k => [k, Math.round(S.mana[k] * 10) / 10])), // par joueur
        e: S.entities.map(e => [e.id, e.ogId, e.player === 'top' ? 0 : 1, Math.round(e.x), Math.round(e.y), Math.round(e.rot * 100) / 100, e.hp, e.hpMax, e.owner === 'top' ? 0 : 1, (e.level || 1) + (e.frozenUntil > S.time ? 10 : 0) + (e.boostUntil > S.time ? 20 : 0) + (e.slowUntil > S.time ? 40 : 0), isHidden(e) ? 1 : 0, e.owner, e.expires === Infinity ? -1 : Math.max(0, Math.round(100 * (e.expires - S.time) / (OGS[e.ogId].lifetime || 1)))]),
        ab: Object.fromEntries(PLAYERS.map(k => [k, Object.fromEntries(Object.entries(S.abilities[k]).filter(([, until]) => until > S.time).map(([og, until]) => [og, Math.round((until - S.time) * 10) / 10]))])),
        pts: F.kingOfCenter ? [Math.round(S.points.top), Math.round(S.points.bottom)] : null,
        ot: S.overtime ? 1 : 0,
        p: S.projectiles.map(p => [p.id, Math.round(p.x), Math.round(p.y), p.player === 'top' ? 0 : 1, p.winged ? 1 : 0]),
        o: S.orbs.map(o => [o.id, o.player === 'top' ? 0 : 1, Math.round(o.x), Math.round(o.y), Math.round(o.life * 10) / 10]),
        h: S.hazard.active ? [S.hazard.phase === 'approach' ? 0 : S.hazard.phase === 'pause' ? 1 : 2, Math.round(S.hazard.x), Math.round(S.hazard.y)] : null,
        over: S.over ? { winner: S.winner, reason: S.endReason } : null,
      };
    }

    function setMana(player, value) { if (player in S.mana) S.mana[player] = Math.max(0, Math.min(RULES.manaMax, value)); }

    return {
      state: S, rng, opts, features: F, bans, players: PLAYERS, COLS, FIELD, teamOf,
      step, place, canPlace, availableCells, collectOrb, surrender, drainEvents, snapshot,
      cellOccupied, useAbility, canUseAbility, setMana, isBanned,
      cellOf: (x, y) => cellOf(x, y, COLS),
    };
  }

  // Décodage d'un snapshot côté client.
  function decodeSnapshot(s) {
    const P = ['top', 'bottom'];
    return {
      t: s.t, k: s.k,
      hp: { top: s.hp[0], bottom: s.hp[1] },
      mana: Array.isArray(s.mana) ? { top: s.mana[0], bottom: s.mana[1] } : (s.mana || {}),
      entities: s.e.map(a => ({ id: a[0], ogId: a[1], player: P[a[2]], x: a[3], y: a[4], rot: a[5], hp: a[6], hpMax: a[7], owner: a[11] || P[a[8]], level: (a[9] || 1) % 10, frozen: !!(Math.floor((a[9] || 1) / 10) % 2), boosted: ((a[9] || 1) % 40) >= 20, slowed: (a[9] || 1) >= 40, hiddenFromEnemy: !!a[10], life: a[12] === undefined || a[12] < 0 ? null : a[12] / 100 })),
      abilities: Array.isArray(s.ab) ? { top: s.ab[0], bottom: s.ab[1] } : (s.ab || {}),
      points: s.pts ? { top: s.pts[0], bottom: s.pts[1] } : null,
      overtime: !!s.ot,
      projectiles: s.p.map(a => ({ id: a[0], x: a[1], y: a[2], player: P[a[3]], winged: !!a[4] })),
      orbs: s.o.map(a => ({ id: a[0], player: P[a[1]], x: a[2], y: a[3], life: a[4] })),
      hazard: s.h ? { phase: ['approach', 'pause', 'dash'][s.h[0]], x: s.h[1], y: s.h[2] } : null,
      over: s.over,
    };
  }

  return {
    FIELD, COLS, ROWS, ROWS_PER_SIDE, CELL_W, CELL_H, RADIUS, RULES, OGS, OG_IDS, ABILITIES, ABILITY_COST, ABILITY_COOLDOWN, EVOLVABLE, MAX_LEVEL, KING_TARGET,
    TEAM_COLS, geometry, sideOf, teamKeys,
    createGame, createRng, decodeSnapshot, cellOf, cellCenter, sideOfRow, rowWithinSide, other,
  };
});
