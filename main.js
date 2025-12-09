(() => {
  // Logical canvas size (kept fixed; scaled to the window to keep a stable aspect ratio).
  // Portrait iPad-like ratio (3:4) for vertical play, taille iPad app.
  const GAME_WIDTH = 1536;
  const GAME_HEIGHT = 2048;
  const BAR_HEIGHT = 210;
  const MANA_HEIGHT = 48;
  const HEALTH_MAX = 30;
  const SIDEBAR_WIDTH = 0; // no sidebar reserved; HUD drawn over the playfield
  const ORB_MIN_TIME = 5;
  const ORB_MAX_TIME = 20;
  const ORB_RADIUS = 34;
  const ORB_MANA = 10;
  const ORB_LIFETIME = 5; // seconds before an uncollected orb disappears
  const HAZARD_MIN_TIME = 60;
  const HAZARD_MAX_TIME = 90;
  const HAZARD_SPEED = 320;
  const HAZARD_RADIUS = 36;
  const HAZARD_PAUSE_TIME = 5;
  const HAZARD_DAMAGE = 7;
  const GRID_COLS = 9;
  const GRID_ROWS_PER_SIDE = 4; // 4 rows par côté => 8 lignes au total (top+bottom).
  const ENTITY_RADIUS = 24;
  const SPEED_UNIT = 40; // base speed multiplier for movement tuning
  const ORANGE_TURRET_COOLDOWN = 1.5; // seconds between shots for ground turrets
  const WINGED_TURRET_COOLDOWN = 0.8;
  const ORANGE_TURRET_RANGE_CELLS = 1;
  const WINGED_TURRET_RANGE_CELLS = 1;
  const PROJECTILE_SPEED = 700;
  const PROJECTILE_RADIUS = 8;
  const PROJECTILE_LIFETIME = 2.5;
  const MANA_ANIM_SPEED = 120; // px/s pour l'animation électrique
  const WAVE_STRIPES = 12;
  const WAVE_AMPLITUDE = 8;
  const WAVE_LENGTH = 120;
  const WAVE_SPEED = 1.6;
  // Plage organique entre mana et terrain.
  const BEACH_HEIGHT = 26;
  const BEACH_LAYERS = 3;
  const BEACH_AMPLITUDE = 6;
  const BEACH_LENGTH = 120;
  const BEACH_SPEED = 0.55;
  const BEACH_GLOW_COUNT = 3;
  const BLOCKING_OGS = new Set([2, 3, 5, 6]); // violet, orange (tourelle), bleu (mur), vert (chargeur)
  const UNIT_COUNT = 7;
  const UNIT_PADDING = 2;
  let manaBandHeight = MANA_HEIGHT;
  const MANA_SIDE_MARGIN = 8; // dépassement latéral plus large pour la barre de mana
  let animTime = 0; // temps accumulé pour les animations (arrêté en pause)
  const beachNoiseTop = Array.from({ length: BEACH_LAYERS }, () => Math.random() * Math.PI * 2);
  const beachNoiseBottom = Array.from({ length: BEACH_LAYERS }, () => Math.random() * Math.PI * 2);
  let menuOpen = true;
  let hazardEnabled = true;
  let gameMode = 'pvp'; // pvp ou ia
  let aiDifficulty = 'moyen';
  const MAX_DPR = 1.5; // clamp du devicePixelRatio pour alléger le rendu (iPad)
  let countdown = 0;
  let gameOver = false;
  let gameWinner = null;
  let lastGameConfig = { mode: 'pvp', ai: 'moyen', hazard: true };
  const gameOverButtons = {
    restart: { x: 0, y: 0, w: 0, h: 0 },
    menu: { x: 0, y: 0, w: 0, h: 0 },
  };

  // Slot metadata with Og mapping (color + ogId).
  const BOTTOM_SLOT_COLORS = [
    { ogId: 1, fill: '#fbbf24' },                    // jaune
    { ogId: 2, fill: '#a78bfa' },                    // violet
    { ogId: 3, fill: '#fb923c' },                    // orange
    { ogId: 4, fill: '#ef4444' },                    // rouge
    { ogId: 5, fill: '#3b82f6' },                    // bleu
    { ogId: 6, fill: '#22c55e' },                    // vert
    { ogId: 7, fill: '#f97316', stroke: '#0b1021' }, // orange/noir
  ];
  // Mirror mode top: gauche->droite = 7,6,5,4,3,2,1 (orange/noir -> jaune)
  const TOP_SLOT_COLORS = [
    { ogId: 7, fill: '#f97316', stroke: '#0b1021' },
    { ogId: 6, fill: '#22c55e' },
    { ogId: 5, fill: '#3b82f6' },
    { ogId: 4, fill: '#ef4444' },
    { ogId: 3, fill: '#fb923c' },
    { ogId: 2, fill: '#a78bfa' },
    { ogId: 1, fill: '#fbbf24' },
  ];

  // Basic Og catalog: extend these objects later with full stats/behaviors.
  const OGS = {
    1: {
      name: 'Og Runner',
      cost: 1,
      role: 'scout / marqueur de points',
      color: BOTTOM_SLOT_COLORS[0].fill,
      speed: SPEED_UNIT * 3, // slower runners
      movement: 'straight',
      shape: 'diamond',
    },
    2: {
      name: 'Og Défenseur',
      cost: 2,
      role: 'anti-runner mobile',
      color: BOTTOM_SLOT_COLORS[1].fill,
      speed: SPEED_UNIT * 3,
      movement: 'horizontal',
      shape: 'triangle',
    },
    3: {
      name: 'Og Tourelle',
      cost: 3,
      role: 'tourelle de contrôle',
      color: BOTTOM_SLOT_COLORS[2].fill,
      speed: 0,
      movement: 'static',
      shape: 'square',
    },
    4: {
      name: 'Og Éponge',
      cost: 4,
      role: 'anti-structure rebondissante',
      color: BOTTOM_SLOT_COLORS[3].fill,
      speed: SPEED_UNIT * 4, // ralenti
      movement: 'diagBounce',
      shape: 'circle',
    },
    5: {
      name: 'Og Mur',
      cost: 5,
      role: 'obstacle statique',
      color: BOTTOM_SLOT_COLORS[4].fill,
      speed: 0,
      movement: 'static',
      shape: 'hex',
    },
    6: {
      name: 'Og Chargeur',
      cost: 6,
      role: 'support économique / accélérateur de mana',
      color: BOTTOM_SLOT_COLORS[5].fill,
      speed: 0,
      movement: 'static',
      shape: 'circle',
      notes: 'Statique, fragile, accélère la génération de mana tant qu’il est en vie (+50%). Détruit au contact par l’Éponge rouge (Og 4). Cible valide pour la Tourelle ailée (Og 7). Résiste à 3 boules de feu mais one-shot par Og 4.',
    },
    7: {
      name: 'Og Tourelle ailée',
      cost: 7,
      role: 'aérien offensif / anti-sol ciblé',
      color: BOTTOM_SLOT_COLORS[6].fill,
      speed: SPEED_UNIT * 1.8, // ralenti pour limiter la pression
      movement: 'airStraight',
      shape: 'triangle',
      notes: 'Passe au-dessus des murs et unités. Tue au sol sur sa ligne. Tire des boules de feu uniquement sur Og 1, 3, 6. Résiste à 3 boules de feu.',
    },
  };

  // Skins (PNG) pour chaque Og. Utilisés pour les slots et les entités en jeu.
  const SKIN_PATHS = {
    1: 'OGS Skin/Ogs 1 - Jaune.png',
    2: 'OGS Skin/OGS 2 - Violet.png',
    3: 'OGS Skin/Ogs 3 - orange claire.png',
    4: 'OGS Skin/Ogs 4 - rouge.png',
    5: 'OGS Skin/Ogs 5 - bleue.png',
    6: 'OGS Skin/Ogs 6 - vert.png',
    7: 'OGS Skin/Ogs 7 - orange sombre.png',
  };
  const ogImages = {};

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const menuOverlay = document.getElementById('menuOverlay');
  const pvpButton = document.getElementById('btnPvp');
  const hazardCheckbox = document.getElementById('chkHazard');
  const aiButton = document.getElementById('btnAI');
  const aiSelect = document.getElementById('aiSelect');
  // Rend le scaling plus propre pour les skins (mode haute qualité).
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const viewport = {
    cssWidth: GAME_WIDTH,
    cssHeight: GAME_HEIGHT,
    scale: 1,
    renderScale: 1,
  };

  const uiRects = {
    topSlots: [],
    bottomSlots: [],
    topMana: null,
    bottomMana: null,
    pauseButton: null,
    topHealth: null,
    bottomHealth: null,
  };

  const dragState = {
    active: false,
    player: null,
    slotIndex: -1,
    og: null,
    ogId: -1,
    color: null,
    position: { x: 0, y: 0 },
  };

  let isPaused = true; // menu initial ouvert -> jeu figé

  const selectionState = {
    top: { active: false, player: 'top', slotIndex: -1, ogId: -1, color: '#ffffff', available: [] },
    bottom: { active: false, player: 'bottom', slotIndex: -1, ogId: -1, color: '#ffffff', available: [] },
  };
  const aiState = {
    timer: 0,
  };

  const manaOrbs = [];
  const orbTimers = {
    top: randomOrbTime(),
    bottom: randomOrbTime(),
  };

  const hazardState = {
    active: false,
    phase: 'idle', // idle -> approach -> pause -> dash
    x: 0,
    y: 0,
    targetX: 0,
    vx: 0,
    vy: 0,
    timer: randomHazardTime(),
    direction: null, // 'up' or 'down'
  };

  function isPlacementLocked() {
    return hazardState.active;
  }

  function getSlotMeta(player, slotIndex) {
    const arr = player === 'top' ? TOP_SLOT_COLORS : BOTTOM_SLOT_COLORS;
    return arr[slotIndex];
  }

  // Mana cost helper: both players share the same Og costs.
  function getManaCost(ogId) {
    const og = OGS[ogId];
    return og ? og.cost * 10 : 0; // 1->10, 4->40, etc.
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  const manaState = {
    max: 70,
    regenPerSec: 2, // 1 mana = 0.5s => 2 mana/sec
    top: 0,
    bottom: 0,
  };

  const healthState = {
    max: HEALTH_MAX,
    top: HEALTH_MAX,
    bottom: HEALTH_MAX,
  };

  const scoreState = {
    top: 0,
    bottom: 0,
  };

  const entities = [];
  const projectiles = [];
  let entityId = 1;
  let projectileId = 1;
  let orbId = 1;

  function randomOrbTime() {
    return ORB_MIN_TIME + Math.random() * (ORB_MAX_TIME - ORB_MIN_TIME);
  }

  function randomHazardTime() {
    return HAZARD_MIN_TIME + Math.random() * (HAZARD_MAX_TIME - HAZARD_MIN_TIME);
  }

  function getPlayfieldRect(playWidthOverride) {
    const playWidth = (playWidthOverride !== undefined) ? playWidthOverride : (GAME_WIDTH - SIDEBAR_WIDTH);
    const overlayHeight = manaBandHeight; // slots + marge + bande mana
    return {
      x: 0,
      y: overlayHeight + BEACH_HEIGHT,
      width: playWidth,
      height: GAME_HEIGHT - 2 * (overlayHeight + BEACH_HEIGHT),
    };
  }

  // One-time layout computation in logical units.
  function computeUIRects() {
    const playWidth = GAME_WIDTH - SIDEBAR_WIDTH;
    const slotWidth = playWidth / UNIT_COUNT;
    const slotSize = Math.min(slotWidth - UNIT_PADDING * 2, BAR_HEIGHT - UNIT_PADDING * 2); // force carré dans la barre
    const manaMargin = 24; // barre de mana plus épaisse
    const slotYOffset = manaMargin; // on laisse une marge au-dessus et en dessous
    manaBandHeight = slotSize + manaMargin * 2;

    uiRects.topSlots.length = 0;
    uiRects.bottomSlots.length = 0;

    for (let i = 0; i < UNIT_COUNT; i += 1) {
      const x = i * slotWidth + UNIT_PADDING;
      const width = slotSize;

      uiRects.topSlots.push({
        x,
        y: slotYOffset,
        width,
        height: slotSize,
      });

      uiRects.bottomSlots.push({
        x,
        y: GAME_HEIGHT - manaBandHeight + slotYOffset,
        width,
        height: slotSize,
      });
    }

    // Bande de mana derrière les slots (même zone verticale, marge autour).
    uiRects.topMana = {
      x: -MANA_SIDE_MARGIN,
      y: 0,
      width: playWidth + MANA_SIDE_MARGIN * 2, // centre conservé, dépassement 3px de chaque côté
      height: manaBandHeight,
    };

    uiRects.bottomMana = {
      x: -MANA_SIDE_MARGIN,
      y: GAME_HEIGHT - manaBandHeight,
      width: playWidth + MANA_SIDE_MARGIN * 2,
      height: manaBandHeight,
    };

    const healthWidth = 26;
    const healthHeight = 260;
    const healthMarginX = 12;
    const gapBetween = 14;
    const pauseWidth = 76;
    const pauseHeight = 76;
    const pausePadding = 12;
    const river = getPlayfieldRect(playWidth);
    const healthX = river.x + river.width - healthWidth - healthMarginX;
    const midY = river.y + river.height / 2;
    const pauseTop = midY - pauseHeight / 2;
    const pauseBottom = midY + pauseHeight / 2;

    uiRects.pauseButton = {
      width: pauseWidth,
      height: pauseHeight,
    };

    uiRects.topHealth = {
      x: healthX,
      y: pauseTop - gapBetween - healthHeight,
      width: healthWidth,
      height: healthHeight,
    };

    uiRects.bottomHealth = {
      x: healthX,
      y: pauseBottom + gapBetween,
      width: healthWidth,
      height: healthHeight,
    };

    // Bouton centré sur l’axe des barres, entre les deux barres de vie.
    uiRects.pauseButton.x = healthX + (healthWidth / 2) - (pauseWidth / 2);
    uiRects.pauseButton.y = pauseTop;
  }

  function resizeCanvas() {
    const targetRatio = GAME_WIDTH / GAME_HEIGHT;
    let cssWidth = window.innerWidth;
    let cssHeight = cssWidth / targetRatio;

    if (cssHeight > window.innerHeight) {
      cssHeight = window.innerHeight;
      cssWidth = cssHeight * targetRatio;
    }

    viewport.cssWidth = cssWidth;
    viewport.cssHeight = cssHeight;
    viewport.scale = cssWidth / GAME_WIDTH;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    viewport.renderScale = viewport.scale * dpr;

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.style.left = `${(window.innerWidth - cssWidth) / 2}px`;
    canvas.style.top = `${(window.innerHeight - cssHeight) / 2}px`;

    canvas.width = Math.round(GAME_WIDTH * viewport.renderScale);
    canvas.height = Math.round(GAME_HEIGHT * viewport.renderScale);

    // Reset transform then scale so drawing stays in logical units.
    ctx.setTransform(viewport.renderScale, 0, 0, viewport.renderScale, 0, 0);

    // Reposition pause button et barres de vie sur le terrain, à droite.
    const river = getPlayfieldRect();
    const midY = river.y + river.height / 2;
    const pauseTop = midY - uiRects.pauseButton.height / 2;
    const pauseBottom = midY + uiRects.pauseButton.height / 2;
    uiRects.pauseButton.y = pauseTop;

    const healthMarginX = 12;
    const gapBetween = 14;
    const healthX = river.x + river.width - uiRects.topHealth.width - healthMarginX;
    uiRects.pauseButton.x = healthX + (uiRects.topHealth.width / 2) - (uiRects.pauseButton.width / 2);
    uiRects.topHealth.x = healthX;
    uiRects.bottomHealth.x = healthX;
    uiRects.topHealth.y = pauseTop - gapBetween - uiRects.topHealth.height;
    uiRects.bottomHealth.y = pauseBottom + gapBetween;
  }

  function clear() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  function loadSkins() {
    const entries = Object.entries(SKIN_PATHS);
    return Promise.all(entries.map(([ogId, src]) => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        ogImages[ogId] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    })));
  }

  function drawOgSkin(ogId, x, y, size, opts = {}) {
    const img = ogImages[ogId];
    if (!img) return false;
    const { flipVertical = false, rotate180 = false } = opts;
    // Assure un rendu le plus net possible lors du redimensionnement des assets.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const scale = size / Math.max(img.width, img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.save();
    ctx.translate(x, y);
    if (rotate180) ctx.rotate(Math.PI);
    if (flipVertical) ctx.scale(1, -1);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    return true;
  }

  function renderBackground() {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  function renderPlayfield(time = 0) {
    // Central river / lane.
    const river = getPlayfieldRect();
    const midY = river.y + river.height / 2;

    // Bottom half (player bas) and Top half (player haut) in the same blue.
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(river.x, river.y, river.width, river.height);

    // Plages organiques animées (top et bottom) entre mana et terrain.
    const beachColor = '#f8d99e';
    const beaches = [
      { x: river.x, y: river.y - BEACH_HEIGHT, w: river.width, h: BEACH_HEIGHT, dir: 1, noise: beachNoiseTop },
      { x: river.x, y: river.y + river.height, w: river.width, h: BEACH_HEIGHT, dir: -1, noise: beachNoiseBottom },
    ];
    beaches.forEach(beach => {
      // Couche de base pleine pour éviter les trous/noir.
      ctx.fillStyle = beachColor;
      ctx.fillRect(beach.x, beach.y, beach.w, beach.h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(beach.x, beach.y, beach.w, beach.h);
      ctx.clip();

      const edgeY = beach.dir === 1 ? beach.y + beach.h : beach.y;

      // Rubans translucides organiques discrets.
      for (let layer = 0; layer < BEACH_LAYERS; layer += 1) {
        const amp = BEACH_AMPLITUDE * (0.3 + 0.2 * layer);
        const freq = BEACH_LENGTH * (0.95 + 0.08 * layer);
        const phase = time * (BEACH_SPEED * (0.5 + 0.25 * layer)) + beach.noise[layer];
        ctx.beginPath();
        for (let x = beach.x; x <= beach.x + beach.w; x += 8) {
          const y = edgeY + Math.sin((x / freq) + phase) * amp * beach.dir * 0.8;
          if (x === beach.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(beach.x + beach.w, beach.dir === 1 ? beach.y : beach.y + beach.h);
        ctx.lineTo(beach.x, beach.dir === 1 ? beach.y : beach.y + beach.h);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${0.035 + layer * 0.035})`;
        ctx.fill();
      }

      // Bord ondulé léger.
      ctx.strokeStyle = 'rgba(255, 239, 186, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = beach.x; x <= beach.x + beach.w; x += 8) {
        const wave = Math.sin((x / BEACH_LENGTH) + time * BEACH_SPEED) * BEACH_AMPLITUDE;
        const noise = Math.sin((x / (BEACH_LENGTH * 0.7)) + beach.noise[0] + time * BEACH_SPEED * 0.5) * (BEACH_AMPLITUDE * 0.3);
        const y = edgeY + (wave + noise) * beach.dir;
        if (x === beach.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Halos mouvants.
      const glowPhase = time * 0.7;
      for (let g = 0; g < BEACH_GLOW_COUNT; g += 1) {
        const gx = beach.x + ((g + 0.5) / BEACH_GLOW_COUNT) * beach.w;
        const gy = edgeY - beach.dir * (beach.h * 0.25 + 3 * Math.sin(glowPhase * 1.1 + g));
        const r = 7 + 3 * Math.sin(glowPhase * 1.4 + g);
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        grad.addColorStop(0, 'rgba(254, 249, 195, 0.22)');
        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Vagues psychédéliques ondulantes.
    const phase = time * WAVE_SPEED;
    ctx.lineCap = 'round';
    for (let i = 0; i < WAVE_STRIPES; i += 1) {
      const yBase = river.y + (river.height / (WAVE_STRIPES - 1)) * i;
      const localPhase = phase + i * 0.6;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(147, 197, 253, 0.16)' : 'rgba(59, 130, 246, 0.18)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      for (let x = river.x; x <= river.x + river.width; x += 16) {
        const y = yBase + Math.sin((x / WAVE_LENGTH) + localPhase) * WAVE_AMPLITUDE;
        if (x === river.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Divider line (gray, center).
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(river.x, midY - 2, river.width, 4);
  }

  function renderMenuWater(time = 0) {
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const phase = time * WAVE_SPEED;
    ctx.lineCap = 'round';
    for (let i = 0; i < WAVE_STRIPES; i += 1) {
      const yBase = (GAME_HEIGHT / (WAVE_STRIPES - 1)) * i;
      const localPhase = phase + i * 0.6;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(147, 197, 253, 0.18)' : 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      for (let x = 0; x <= GAME_WIDTH; x += 14) {
        const y = yBase + Math.sin((x / WAVE_LENGTH) + localPhase) * WAVE_AMPLITUDE * 1.2;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function renderUnitBars() {
    // Supprimé le fond gris des barres pour laisser la bande de mana visible proprement.
  }

  function renderSlots() {
    uiRects.topSlots.forEach((rect, index) => {
      const color = TOP_SLOT_COLORS[index % TOP_SLOT_COLORS.length];
      ctx.fillStyle = 'rgba(255,255,255,0.42)'; // fond translucide plus visible
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4; // contour blanc
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      const size = Math.min(rect.width, rect.height) * 0.9;
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      // Le joueur haut voit désormais les skins inversés pour garder la cohérence avec le terrain.
      drawOgSkin(color.ogId, centerX, centerY, size, { flipVertical: true });
    });

    uiRects.bottomSlots.forEach((rect, index) => {
      const color = BOTTOM_SLOT_COLORS[index % BOTTOM_SLOT_COLORS.length];
      ctx.fillStyle = 'rgba(255,255,255,0.42)'; // fond translucide plus visible
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4; // contour blanc
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      const size = Math.min(rect.width, rect.height) * 0.9;
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      // Le joueur bas n’a plus de flip pour aligner le sens des skins avec la nouvelle orientation.
      drawOgSkin(color.ogId, centerX, centerY, size);
    });
  }

  function renderMana(animTime) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const topRatio = clamp(manaState.top / manaState.max, 0, 1);
    const bottomRatio = clamp(manaState.bottom / manaState.max, 0, 1);

    const bars = [
      { rect: uiRects.topMana, ratio: topRatio, color: '#34d399', align: 'right' },
      { rect: uiRects.bottomMana, ratio: bottomRatio, color: '#10b981', align: 'left' },
    ];

    bars.forEach(({ rect, ratio, color, align }) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; // léger fond sombre translucide
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      const padding = 10;
      const innerWidth = rect.width - padding * 2;
      const fillWidth = innerWidth * ratio;
      const innerX = align === 'left'
        ? rect.x + padding
        : rect.x + rect.width - padding - fillWidth;

      const grad = ctx.createLinearGradient(innerX, rect.y, innerX, rect.y + rect.height);
      grad.addColorStop(0, '#86efac');
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fillRect(innerX, rect.y + padding, fillWidth, rect.height - padding * 2);
    });
  }

  function renderHealth() {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const bars = [
      { rect: uiRects.topHealth, current: healthState.top, orientation: 'top' },
      { rect: uiRects.bottomHealth, current: healthState.bottom, orientation: 'bottom' },
    ];

    bars.forEach(({ rect, current, orientation }) => {
      const ratio = clamp(current / healthState.max, 0, 1);
      const padding = 4;
      const innerWidth = rect.width - padding * 2;
      const innerHeight = rect.height - padding * 2;
      const greenHeight = innerHeight * ratio;
      const redHeight = innerHeight - greenHeight;

      // Background simple.
      ctx.fillStyle = '#0b0f1a';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      // Green gradient per orientation.
      const greenGrad = ctx.createLinearGradient(rect.x, rect.y + padding, rect.x, rect.y + padding + innerHeight);
      if (orientation === 'bottom') {
        // clair en haut, foncé en bas
        greenGrad.addColorStop(0, '#7bf3c5');
        greenGrad.addColorStop(1, '#0f7a43');
      } else {
        // foncé en haut, clair en bas
        greenGrad.addColorStop(0, '#0f7a43');
        greenGrad.addColorStop(1, '#7bf3c5');
      }

      // Red gradient per orientation.
      const redGrad = ctx.createLinearGradient(rect.x, rect.y + padding, rect.x, rect.y + padding + innerHeight);
      if (orientation === 'bottom') {
        // rouge vient du haut
        redGrad.addColorStop(0, '#ef4444');
        redGrad.addColorStop(1, 'rgba(239,68,68,0.15)');
      } else {
        // rouge vient du bas
        redGrad.addColorStop(0, 'rgba(239,68,68,0.15)');
        redGrad.addColorStop(1, '#ef4444');
      }

      // Draw red missing part.
      if (redHeight > 0) {
        const redY = orientation === 'bottom'
          ? rect.y + padding
          : rect.y + padding + greenHeight;
        ctx.fillStyle = redGrad;
        ctx.fillRect(rect.x + padding, redY, innerWidth, redHeight);
      }

      // Draw green fill.
      const greenY = orientation === 'bottom'
        ? rect.y + padding + redHeight
        : rect.y + padding;
      ctx.fillStyle = greenGrad;
      ctx.fillRect(rect.x + padding, greenY, innerWidth, greenHeight);

      // Gloss highlight.
      const glossHeight = Math.min(innerHeight * 0.25, greenHeight);
      const glossGrad = ctx.createLinearGradient(0, greenY, 0, greenY + glossHeight);
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      glossGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glossGrad;
      ctx.fillRect(rect.x + padding, greenY, innerWidth, glossHeight);
    });
  }

  function renderManaOrbs(time = 0) {
    if (!manaOrbs.length) return;
    ctx.save();
    manaOrbs.forEach(orb => {
      const spin = (time || 0) * 2.4;
      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.rotate(spin);

      // Spirale simple.
      ctx.strokeStyle = 'rgba(124, 231, 213, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const turns = 2.5;
      for (let t = 0; t <= Math.PI * 2 * turns; t += 0.15) {
        const r = ORB_RADIUS * 0.2 + (t / (Math.PI * 2 * turns)) * ORB_RADIUS * 0.9;
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Coeur lumineux.
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, ORB_RADIUS);
      grad.addColorStop(0, 'rgba(187, 247, 208, 0.9)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, ORB_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
    ctx.restore();
  }

  function handleGameOverClick(point) {
    const { restart, menu } = gameOverButtons;
    if (
      restart &&
      point.x >= restart.x && point.x <= restart.x + restart.w &&
      point.y >= restart.y && point.y <= restart.y + restart.h
    ) {
      startGame(lastGameConfig);
      return true;
    }
    if (
      menu &&
      point.x >= menu.x && point.x <= menu.x + menu.w &&
      point.y >= menu.y && point.y <= menu.y + menu.h
    ) {
      gameOver = false;
      gameWinner = null;
      countdown = 0;
      isPaused = true;
      menuOpen = true;
      resetGameState();
      if (menuOverlay) menuOverlay.classList.remove('hidden');
      return true;
    }
    return false;
  }

  function renderProjectiles() {
    projectiles.forEach(proj => {
      ctx.save();
      // Trail
      const angle = Math.atan2(proj.vy, proj.vx);
      const tailLength = 24;
      const tailX = proj.x - Math.cos(angle) * tailLength;
      const tailY = proj.y - Math.sin(angle) * tailLength;

      const grad = ctx.createLinearGradient(proj.x, proj.y, tailX, tailY);
      grad.addColorStop(0, '#fca5a5');
      grad.addColorStop(1, 'rgba(252,165,165,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Core
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function renderPlacementHints() {
    const river = getPlayfieldRect();
    const cellSize = getCellSize();
    const len = 12;
    const thickness = 2;

    ['top', 'bottom'].forEach(player => {
      const sel = selectionState[player];
      if (!sel.active || !sel.available.length) return;
      const color = sel.color || '#e5e7eb';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;

      sel.available.forEach(cell => {
        const x = river.x + cell.col * cellSize.w;
        const y = river.y + cell.globalRow * cellSize.h;
        const w = cellSize.w;
        const h = cellSize.h;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + len);
        ctx.lineTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + w - len, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + len);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + h - len);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + len, y + h);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + w - len, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - len);
        ctx.stroke();
      });

      ctx.restore();
    });
  }

  function renderHazard() {
    if (!hazardState.active) return;
    ctx.save();
    const body = '#0b0b0b';
    const outline = '#111827';
    const size = HAZARD_RADIUS * 2;
    ctx.translate(hazardState.x, hazardState.y);

    // Corps du scorpion (carré stylisé).
    ctx.fillStyle = body;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeRect(-size / 2, -size / 2, size, size);

    // Queue relevée.
    ctx.beginPath();
    ctx.moveTo(size * 0.1, -size * 0.4);
    ctx.lineTo(size * 0.35, -size * 0.7);
    ctx.lineTo(size * 0.55, -size * 0.4);
    ctx.stroke();

    // Pinces.
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, -size * 0.1);
    ctx.lineTo(-size * 0.8, -size * 0.2);
    ctx.moveTo(-size * 0.5, size * 0.1);
    ctx.lineTo(-size * 0.8, size * 0.2);
    ctx.stroke();

    ctx.restore();
  }

  function renderDragGhost() {
    if (!dragState.active || !dragState.og) return;

    const radius = 40;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = dragState.color || dragState.og.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(dragState.position.x, dragState.position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = '20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dragState.slotIndex + 1, dragState.position.x, dragState.position.y);
    ctx.restore();
  }

  function renderEntities() {
    const cellSize = getCellSize();
    const renderSize = Math.min(cellSize.w, cellSize.h) * 0.92; // remplir quasi toute la case
    const renderRadius = renderSize / 2;
    const ordered = [...entities].sort((a, b) => (a.ogId === 7 ? 1 : 0) - (b.ogId === 7 ? 1 : 0));
    ordered.forEach(entity => {
      ctx.save();
      ctx.translate(entity.x, entity.y);
      if (entity.rotation !== undefined) {
        const offset = entity.ogId === 3 ? Math.PI / 2 : 0; // sprite canon pointe vers le haut
        let angle = entity.rotation + offset;
        if (entity.ogId === 3 && entity.player === 'top') {
          angle += Math.PI; // 180° supplémentaires pour le joueur du haut
        }
        ctx.rotate(angle);
      }
      const drawn = drawOgSkin(entity.ogId, 0, 0, renderSize, {
        flipVertical: entity.player === 'top',
      });
      if (!drawn) {
        ctx.fillStyle = entity.color;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        switch (entity.shape) {
          case 'square':
            ctx.fillRect(-renderRadius, -renderRadius, renderRadius * 2, renderRadius * 2);
            ctx.strokeRect(-renderRadius, -renderRadius, renderRadius * 2, renderRadius * 2);
            break;
          case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0, -renderRadius);
            ctx.lineTo(renderRadius, renderRadius);
            ctx.lineTo(-renderRadius, renderRadius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
          case 'diamond':
            ctx.beginPath();
            ctx.moveTo(0, -renderRadius);
            ctx.lineTo(renderRadius, 0);
            ctx.lineTo(0, renderRadius);
            ctx.lineTo(-renderRadius, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
          case 'hex':
            ctx.beginPath();
            for (let i = 0; i < 6; i += 1) {
              const angle = Math.PI / 3 * i;
              const px = Math.cos(angle) * renderRadius;
              const py = Math.sin(angle) * renderRadius;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            break;
          default: // circle
            ctx.beginPath();
            ctx.arc(0, 0, renderRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
      }

      ctx.restore();
    });
  }

  function renderPauseButton() {
    const btn = uiRects.pauseButton;
    ctx.save();
    // Pas de fond dédié : on laisse le décor en dessous et on dessine seulement l’icône.
    ctx.translate(btn.x + btn.width / 2, btn.y + btn.height / 2);
    ctx.fillStyle = '#0f172a'; // icône noire sur fond transparent

    if (isPaused) {
      // Play triangle
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.lineTo(14, 0);
      ctx.lineTo(-8, 12);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pause II
      const barWidth = 6;
      const barHeight = 24;
      ctx.fillRect(-10 - barWidth / 2, -barHeight / 2, barWidth, barHeight);
      ctx.fillRect(10 - barWidth / 2, -barHeight / 2, barWidth, barHeight);
    }

    ctx.restore();
  }

  function render(animSeconds) {
    if (menuOpen && !gameOver) {
      clear();
      renderMenuWater(animSeconds);
      return;
    }
    clear();
    renderBackground();
    renderPlayfield(animSeconds);
    renderUnitBars();
    renderMana(animSeconds);
    renderSlots();
    renderHazard();
    renderPlacementHints();
    renderProjectiles();
    renderEntities();
    renderDragGhost();
    // Orbs toujours au-dessus des entités pour rester visibles/cliquables.
    renderManaOrbs(animSeconds);
    // Health rendered au-dessus des entités pour qu'elles passent dessous.
    renderHealth();
    renderPauseButton();
    renderCountdown();
    renderGameOver();
  }

  function renderCountdown() {
    if (countdown <= 0) return;
    ctx.save();
    ctx.fillStyle = 'rgba(11, 16, 33, 0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 6;
    ctx.font = 'bold 120px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const display = Math.ceil(countdown);
    const river = getPlayfieldRect();
    const topCenter = { x: river.x + river.width / 2, y: river.y + river.height / 4 };
    const bottomCenter = { x: river.x + river.width / 2, y: river.y + (river.height * 3) / 4 };

    ctx.save();
    ctx.translate(topCenter.x, topCenter.y);
    ctx.rotate(Math.PI); // retourner pour le joueur du haut
    ctx.strokeText(display, 0, 0);
    ctx.fillText(display, 0, 0);
    ctx.restore();
    ctx.strokeText(display, bottomCenter.x, bottomCenter.y);
    ctx.fillText(display, bottomCenter.x, bottomCenter.y);
    ctx.restore();
  }

  function renderGameOver() {
    if (!gameOver) return;
    ctx.save();
    ctx.fillStyle = 'rgba(11, 16, 33, 0.75)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Emoji géant orienté vers le gagnant (rotation pour regarder le camp vainqueur).
    ctx.save();
    ctx.translate(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
    if (gameWinner === 'top') ctx.rotate(-Math.PI / 2 + Math.PI);
    if (gameWinner === 'bottom') ctx.rotate(Math.PI / 2 + Math.PI);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 120px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('(:(', 0, 0);
    ctx.restore();

    // Boutons.
    const btnWidth = 200;
    const btnHeight = 60;
    const spacing = 20;
    const baseX = GAME_WIDTH / 2 - btnWidth - spacing / 2;
    const baseY = GAME_HEIGHT / 2 + 140;
    ctx.save();
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Recommencer
    gameOverButtons.restart = { x: baseX, y: baseY, w: btnWidth, h: btnHeight };
    ctx.fillStyle = '#3f2c1d';
    ctx.fillRect(baseX, baseY, btnWidth, btnHeight);
    ctx.fillStyle = '#9a6b3d';
    ctx.fillRect(baseX + 4, baseY + 4, btnWidth - 8, btnHeight - 8);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 4;
    ctx.strokeRect(baseX + 2, baseY + 2, btnWidth - 4, btnHeight - 4);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Recommencer', baseX + btnWidth / 2, baseY + btnHeight / 2);

    // Menu
    const menuX = GAME_WIDTH / 2 + spacing / 2;
    gameOverButtons.menu = { x: menuX, y: baseY, w: btnWidth, h: btnHeight };
    ctx.fillStyle = '#3f2c1d';
    ctx.fillRect(menuX, baseY, btnWidth, btnHeight);
    ctx.fillStyle = '#9a6b3d';
    ctx.fillRect(menuX + 4, baseY + 4, btnWidth - 8, btnHeight - 8);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 4;
    ctx.strokeRect(menuX + 2, baseY + 2, btnWidth - 4, btnHeight - 4);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Retour menu', menuX + btnWidth / 2, baseY + btnHeight / 2);

    ctx.restore();
    ctx.restore();
  }

  function update(deltaTime) {
    if (gameOver) return;
    // Mana regeneration (base).
    manaState.top = Math.min(manaState.max, manaState.top + manaState.regenPerSec * deltaTime);
    manaState.bottom = Math.min(manaState.max, manaState.bottom + manaState.regenPerSec * deltaTime);

    // Passive mana boost from Chargeurs (Og 6) on field: +50% regen per Chargeur.
    const chargeursTop = entities.filter(e => e.player === 'top' && e.ogId === 6).length;
    const chargeursBottom = entities.filter(e => e.player === 'bottom' && e.ogId === 6).length;
    const boostTop = manaState.regenPerSec * 0.5 * chargeursTop;
    const boostBottom = manaState.regenPerSec * 0.5 * chargeursBottom;
    manaState.top = Math.min(manaState.max, manaState.top + boostTop * deltaTime);
    manaState.bottom = Math.min(manaState.max, manaState.bottom + boostBottom * deltaTime);

    const toRemove = [];
    updateManaOrbs(deltaTime);
    updateAIOrbs(deltaTime);
    updateHazard(deltaTime, toRemove);
    updateAI(deltaTime);
    refreshSelectionAvailability();

    // Move entities and handle end-of-lane scoring/damage.
    const playfield = getPlayfieldRect();
    entities.forEach(entity => {
      const ogDef = OGS[entity.ogId];
      if (!ogDef) return;

      const entityRadius = getEntityRadius();
      switch (ogDef.movement) {
        case 'straight': {
          if (!entity.vy) {
            const dir = entity.player === 'top' ? 1 : -1;
            entity.vy = dir * entity.speed;
          }
          entity.y += entity.vy * deltaTime;
          break;
        }
        case 'airStraight': {
          const dir = entity.player === 'top' ? 1 : -1;
          entity.y += dir * entity.speed * deltaTime;
          break;
        }
        case 'horizontal': {
          entity.x += entity.vx * deltaTime;
          // bounce on left/right
          if (entity.x - entityRadius <= playfield.x) {
            entity.x = playfield.x + entityRadius;
            entity.vx = Math.abs(entity.vx);
          } else if (entity.x + entityRadius >= playfield.x + playfield.width) {
            entity.x = playfield.x + playfield.width - entityRadius;
            entity.vx = -Math.abs(entity.vx);
          }
          break;
        }
        case 'diagBounce': {
          entity.x += entity.vx * deltaTime;
          entity.y += entity.vy * deltaTime;
          // bounce on left/right
          if (entity.x - entityRadius <= playfield.x) {
            entity.x = playfield.x + entityRadius;
            entity.vx = Math.abs(entity.vx);
          } else if (entity.x + entityRadius >= playfield.x + playfield.width) {
            entity.x = playfield.x + playfield.width - entityRadius;
            entity.vx = -Math.abs(entity.vx);
          }
          // bounce on top/bottom (skip for red: ogId 4)
          if (entity.ogId !== 4) {
            if (entity.y - entityRadius <= playfield.y) {
              entity.y = playfield.y + entityRadius;
              entity.vy = Math.abs(entity.vy);
            } else if (entity.y + entityRadius >= playfield.y + playfield.height) {
              entity.y = playfield.y + playfield.height - entityRadius;
              entity.vy = -Math.abs(entity.vy);
            }
          }
          break;
        }
        case 'slow':
          // very slow forward drift
          entity.y += (entity.player === 'top' ? 1 : -1) * entity.speed * deltaTime;
          break;
        case 'static':
        default:
          break;
      }

      const bottomEdge = playfield.y + playfield.height;
      const topEdge = playfield.y;
      const reachedEnemyEnd =
        (entity.player === 'top' && entity.y + entityRadius >= bottomEdge) ||
        (entity.player === 'bottom' && entity.y - entityRadius <= topEdge);

      const reachedOwnEnd =
        (entity.player === 'top' && entity.y - entityRadius <= topEdge) ||
        (entity.player === 'bottom' && entity.y + entityRadius >= bottomEdge);

      if (reachedEnemyEnd || reachedOwnEnd) {
        const target =
          reachedEnemyEnd
            ? (entity.player === 'top' ? 'bottom' : 'top')
            : entity.player; // self-damage when re-entering own base

        if (entity.ogId === 1) {
          const dmg = 1;
          healthState[target] = Math.max(0, healthState[target] - dmg);
          console.log(`Runner du ${entity.player} touche la base ${target} (-${dmg}) -> HP ${healthState[target]}/${healthState.max}`);
          toRemove.push(entity.id);
        } else if (entity.ogId === 4) {
          const dmg = 2;
          healthState[target] = Math.max(0, healthState[target] - dmg);
          console.log(`Éponge rouge du ${entity.player} cogne la base ${target} (-${dmg}) -> HP ${healthState[target]}/${healthState.max}`);
          toRemove.push(entity.id);
        } else if (entity.ogId === 7) {
          const dmg = 5;
          healthState[target] = Math.max(0, healthState[target] - dmg);
          console.log(`Tourelle ailée du ${entity.player} frappe la base ${target} (-${dmg}) -> HP ${healthState[target]}/${healthState.max}`);
          toRemove.push(entity.id);
        } else {
          // Autres Ogs ne font pas de dégâts en bout de carte : on les retire simplement.
          toRemove.push(entity.id);
        }
      }
    });

    handleTurretAttacks(deltaTime);
    updateTurretRotations(deltaTime);
    updateRedRotations(deltaTime);
    handleYellowVsViolet(toRemove);
    handleVioletCollisions();
    handleRedCollisions(toRemove);
    updateProjectiles(toRemove, deltaTime);
    checkGameOver();

    if (toRemove.length) {
      for (const id of toRemove) {
        const idx = entities.findIndex(e => e.id === id);
        if (idx !== -1) entities.splice(idx, 1);
      }
    }
  }

  function gameLoop(timestamp) {
    if (!gameLoop.lastTime) {
      gameLoop.lastTime = timestamp;
    }

    const delta = (timestamp - gameLoop.lastTime) / 1000;
    gameLoop.lastTime = timestamp;

    if (countdown > 0) {
      countdown = Math.max(0, countdown - delta);
      if (countdown === 0) {
        isPaused = false;
      }
    }

    if (!isPaused && !gameOver) {
      update(delta);
      animTime += delta;
    } else if ((countdown > 0 || menuOpen) && !gameOver) {
      // animations continuent pendant le compte à rebours ou sur le menu (fond animé)
      animTime += delta;
    }
    render(animTime);

    window.requestAnimationFrame(gameLoop);
  }

  function screenToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * GAME_WIDTH,
      y: ((clientY - rect.top) / rect.height) * GAME_HEIGHT,
    };
  }

  function pointInRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  function pointToGrid(point) {
    const river = getPlayfieldRect();
    if (!pointInRect(point, river)) return null;

    const cellWidth = river.width / GRID_COLS;
    const cellHeight = river.height / (GRID_ROWS_PER_SIDE * 2);

    const col = Math.floor((point.x - river.x) / cellWidth);
    const globalRow = Math.floor((point.y - river.y) / cellHeight); // 0..7
    const midRow = GRID_ROWS_PER_SIDE;
    const side = globalRow < midRow ? 'top' : 'bottom';
    const rowWithinSide = side === 'top' ? globalRow : globalRow - midRow;

    return { col, globalRow, rowWithinSide, side };
  }

  function getCellFromPosition(x, y) {
    const river = getPlayfieldRect();
    if (x < river.x || x > river.x + river.width || y < river.y || y > river.y + river.height) {
      return null;
    }
    const cellWidth = river.width / GRID_COLS;
    const cellHeight = river.height / (GRID_ROWS_PER_SIDE * 2);
    const col = Math.floor((x - river.x) / cellWidth);
    const globalRow = Math.floor((y - river.y) / cellHeight);
    const midRow = GRID_ROWS_PER_SIDE;
    const side = globalRow < midRow ? 'top' : 'bottom';
    const rowWithinSide = side === 'top' ? globalRow : globalRow - midRow;
    return { col, globalRow, rowWithinSide, side };
  }

  function getCellBounds(cell) {
    const river = getPlayfieldRect();
    const cellWidth = river.width / GRID_COLS;
    const cellHeight = river.height / (GRID_ROWS_PER_SIDE * 2);
    return {
      x: river.x + cell.col * cellWidth,
      y: river.y + cell.globalRow * cellHeight,
      w: cellWidth,
      h: cellHeight,
    };
  }

  function circleIntersectsRect(cx, cy, radius, rect) {
    const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  function snapToCellCenter(cell) {
    const river = getPlayfieldRect();
    const cellWidth = river.width / GRID_COLS;
    const cellHeight = river.height / (GRID_ROWS_PER_SIDE * 2);
    return {
      x: river.x + (cell.col + 0.5) * cellWidth,
      y: river.y + (cell.globalRow + 0.5) * cellHeight,
    };
  }

  function getCellSize() {
    const river = getPlayfieldRect();
    return {
      w: river.width / GRID_COLS,
      h: river.height / (GRID_ROWS_PER_SIDE * 2),
    };
  }

  // Hitbox radius derived from current cell size to match rendered square PNG size.
  function getEntityRadius() {
    const cell = getCellSize();
    return Math.min(cell.w, cell.h) * 0.46;
  }

  function isCellBlocked(cell) {
    return entities.some(
      e =>
        e.cell &&
        e.cell.col === cell.col &&
        e.cell.globalRow === cell.globalRow &&
        BLOCKING_OGS.has(e.ogId)
    );
  }

  function spawnEntity(og, ogId, player, position, slotIndex, cell) {
    if (!og) return;
    const dir = player === 'top' ? 1 : -1;
    let vx = 0;
    let vy = 0;
    switch (og.movement) {
      case 'straight':
      case 'airStraight':
        vy = dir * og.speed;
        break;
      case 'horizontal':
        vx = (player === 'top' ? -1 : 1) * og.speed;
        break;
      case 'diagBounce':
        if (ogId === 4) {
          const river = getPlayfieldRect();
          const distLeft = position.x - river.x;
          const distRight = river.x + river.width - position.x;
          const dirX = distLeft === distRight ? (Math.random() < 0.5 ? -1 : 1) : (distLeft < distRight ? -1 : 1);
          vx = dirX * og.speed;
          vy = dir * og.speed;
        } else {
          vx = (player === 'top' ? 1 : -1) * og.speed;
          vy = dir * og.speed;
        }
        break;
      case 'slow':
        vy = dir * og.speed;
        break;
      default:
        vx = 0;
        vy = 0;
    }

    const baseEntity = {
      id: entityId++,
      ogId,
      ogName: og.name,
      player,
      x: position.x,
      y: position.y,
      color: og.color,
      shape: og.shape,
      movement: og.movement,
      speed: og.speed,
      vx,
      vy,
      cooldown: 0,
      cell,
      health:
        ogId === 3 || ogId === 7
          ? 3 // tourelles et ailées encaissent 3 projectiles
          : ogId === 4
            ? 3 // Éponge rouge : 3 PV
            : ogId === 5
              ? 3 // Mur bleu : 3 PV pour encaisser les impacts rouges
              : ogId === 6
                ? 3 // Chargeur (vert) encaisse 3 contacts de jaunes
                : 1,
    };

    // Les tourelles (Og 3) ont un angle, les autres restent sans rotation.
    if (ogId === 3) {
      // Orientation naturelle : joueur haut vise vers le bas, joueur bas vise vers le haut.
      const baseAim = player === 'top' ? Math.PI / 2 : -Math.PI / 2;
      baseEntity.rotation = baseAim;
      baseEntity.rotationTarget = baseAim;
    } else if (ogId === 4) {
      // Éponge rouge : rotation lente en continu.
      baseEntity.rotation = 0;
    }

    entities.push(baseEntity);
  }

  function beginSelection(player, slotIndex) {
    if (isPaused) return;
    const slotMeta = getSlotMeta(player, slotIndex);
    if (!slotMeta) return;
    const sel = selectionState[player];
    if (!sel) {
      console.warn(`Aucun état de sélection pour ${player}`);
      return;
    }
    const ogId = slotMeta.ogId;
    const available = computeAvailableCells(player, ogId);
    sel.active = true;
    sel.player = player;
    sel.slotIndex = slotIndex;
    sel.ogId = ogId;
    sel.color = slotMeta.fill;
    sel.available = available;
    console.log(`Sélection de ${OGS[ogId]?.name || 'Og'} pour ${player}. Cases disponibles: ${available.length}`);
  }

  function clearSelection(player) {
    const clearOne = p => {
      const sel = selectionState[p];
      if (!sel) return;
      sel.active = false;
      sel.player = p;
      sel.slotIndex = -1;
      sel.ogId = -1;
      sel.color = '#ffffff';
      sel.available = [];
    };
    if (player) {
      clearOne(player);
    } else {
      clearOne('top');
      clearOne('bottom');
    }
  }

  function refreshSelectionAvailability() {
    ['top', 'bottom'].forEach(p => {
      const sel = selectionState[p];
      if (sel && sel.active) {
        sel.available = computeAvailableCells(p, sel.ogId);
      }
    });
  }

  function isCellOccupied(cell) {
    const rect = getCellBounds(cell);
    const radius = getEntityRadius();
    return entities.some(e => circleIntersectsRect(e.x, e.y, radius, rect));
  }

  function isCellInAvailable(sel, cell) {
    return sel.available.some(c => c.col === cell.col && c.globalRow === cell.globalRow);
  }

  function computeAvailableCells(player, ogId) {
    const river = getPlayfieldRect();
    const cells = [];
    for (let col = 0; col < GRID_COLS; col += 1) {
      for (let row = 0; row < GRID_ROWS_PER_SIDE * 2; row += 1) {
        const cell = { col, globalRow: row };
        cell.side = row < GRID_ROWS_PER_SIDE ? 'top' : 'bottom';
        cell.rowWithinSide = cell.side === 'top' ? row : row - GRID_ROWS_PER_SIDE;

        // Only own side.
        if ((player === 'top' && cell.side !== 'top') || (player === 'bottom' && cell.side !== 'bottom')) {
          continue;
        }

        // Yellow constraint: only first line of own side (top: rowWithinSide === 0, bottom: last row).
        if (ogId === 1 || ogId === 4 || ogId === 7) {
          const targetRow = player === 'top' ? 0 : GRID_ROWS_PER_SIDE - 1;
          if (cell.rowWithinSide !== targetRow) continue;
        }

        // Must be empty.
        if (isCellOccupied(cell)) continue;

        cells.push(cell);
      }
    }
    return cells;
  }

  function attemptPlacement(sel, cell, point) {
    if (isPlacementLocked()) {
    console.log('Impossible de poser des Ogs pendant le passage du scorpion noir');
      clearSelection(sel.player);
      return;
    }
    const og = OGS[sel.ogId];
    if (!og) {
      clearSelection(sel.player);
      return;
    }

    if (isCellOccupied(cell)) {
      console.log('Case déjà occupée');
      return;
    }
    const poolKey = sel.player === 'top' ? 'top' : 'bottom';
    const manaCost = getManaCost(sel.ogId);
    const currentMana = manaState[poolKey];
    if (currentMana < manaCost) {
      console.log(`Pas assez de mana (${Math.floor(currentMana)}/${manaState.max}) pour jouer ${og.name} (${manaCost} requis)`);
      return;
    }

    const snapped = snapToCellCenter(cell);
    manaState[poolKey] = Math.max(0, currentMana - manaCost);
    const cellInfo = `cell (${cell.col + 1}, ${cell.globalRow + 1})`;
    console.log(`${sel.player === 'top' ? 'Player top' : 'Player bottom'} déploie ${og.name} pour ${manaCost} mana en ${cellInfo}`);
    spawnEntity(og, sel.ogId, sel.player, snapped, sel.slotIndex, cell);
    refreshSelectionAvailability();
    clearSelection(sel.player);
  }

  function handleVioletCollisions() {
    const violets = entities.filter(e => e.ogId === 2);
    const oranges = entities.filter(e => e.ogId === 3);
    const obstacles = entities.filter(e => e.ogId === 3 || e.ogId === 5 || e.ogId === 6);
    const radius = getEntityRadius();
    const minDist = radius * 2;
    const minDistSq = minDist * minDist;

    // Violet vs violet.
    for (let i = 0; i < violets.length; i += 1) {
      for (let j = i + 1; j < violets.length; j += 1) {
        const a = violets[i];
        const b = violets[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          separateViolets(a, b, minDist);
        }
      }
    }

    // Violet vs obstacles (orange tourelle, mur, chargeur).
    violets.forEach(violet => {
      obstacles.forEach(obs => {
        const dx = violet.x - obs.x;
        const dy = violet.y - obs.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          separateVioletFromObstacle(violet, obs, minDist);
        }
      });
    });
  }

  // Keep Défenseurs violets from overlapping: push them apart horizontally and flip directions.
  function separateViolets(a, b, minDist) {
    const dx = a.x - b.x;
    const dist = Math.max(Math.sqrt(dx * dx + (a.y - b.y) * (a.y - b.y)), 1e-6);
    const overlap = Math.max(0, minDist - dist);
    const nx = dx !== 0 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
    const push = overlap * 0.5;
    a.x += nx * push;
    b.x -= nx * push;
    a.vx = nx * a.speed;
    b.vx = -nx * b.speed;
  }

  // Bounce violets away from static obstacles with a small horizontal nudge.
  function separateVioletFromObstacle(violet, obstacle, minDist) {
    const dx = violet.x - obstacle.x;
    const dy = violet.y - obstacle.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6);
    const overlap = Math.max(0, minDist - dist);
    const nx = dx !== 0 ? Math.sign(dx) : (Math.random() < 0.5 ? -1 : 1);
    violet.x += nx * overlap;
    violet.vx = nx * violet.speed;
  }

  function handleYellowVsViolet(toRemove) {
    const yellows = entities.filter(e => e.ogId === 1);
    const violets = entities.filter(e => e.ogId === 2);
    const blues = entities.filter(e => e.ogId === 5);
    const reds = entities.filter(e => e.ogId === 4);
    const greens = entities.filter(e => e.ogId === 6);
    const oranges = entities.filter(e => e.ogId === 3);
    const radius = getEntityRadius();
    const minDist = radius * 2;
    const minDistSq = minDist * minDist;

    yellows.forEach(yellow => {
      violets.forEach(violet => {
        if (yellow.player === violet.player) return;
        const dx = yellow.x - violet.x;
        const dy = yellow.y - violet.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          if (!toRemove.includes(yellow.id)) {
            toRemove.push(yellow.id);
            console.log(`Runner jaune du joueur ${yellow.player} est mangé par un Défenseur violet adverse`);
          }
        }
      });

      blues.forEach(blue => {
        const dx = yellow.x - blue.x;
        const dy = yellow.y - blue.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          // Compute separation to avoid sticking.
          const dist = Math.max(Math.sqrt(distSq), 1e-6);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
            yellow.x += nx * (overlap * 0.5);
            yellow.y += ny * (overlap * 0.5);

            // Le mur encaisse 10 touches de jaunes.
            blue.health = (blue.health || 10) - 1;
            // Inversion complète et changement de camp.
            yellow.vx = -(yellow.vx || ((yellow.player === 'top' ? 1 : -1) * yellow.speed));
            yellow.vy = -(yellow.vy || ((yellow.player === 'top' ? 1 : -1) * yellow.speed));
            yellow.player = yellow.player === 'top' ? 'bottom' : 'top';
            console.log(`Runner jaune rebondit sur un Mur bleu (pv mur: ${blue.health}) et change de camp`);
            if (blue.health <= 0 && !toRemove.includes(blue.id)) {
              toRemove.push(blue.id);
            }
          }
        });

      reds.forEach(red => {
        if (yellow.player === red.player) return;
        const dx = yellow.x - red.x;
        const dy = yellow.y - red.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          // Yellow dies, red perd 1 pv, pas de rebond.
          if (!toRemove.includes(yellow.id)) toRemove.push(yellow.id);
          red.health = (red.health || 1) - 1;
          console.log(`Runner jaune est détruit au contact d'une Éponge rouge (${red.player}), pv rouge: ${red.health}`);
          if (red.health <= 0 && !toRemove.includes(red.id)) {
            toRemove.push(red.id);
          }
        }
      });

      oranges.forEach(orange => {
        if (yellow.player === orange.player) return;
        const dx = yellow.x - orange.x;
        const dy = yellow.y - orange.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          orange.health = (orange.health || 2) - 1;
          console.log(`Runner jaune touche une Tourelle orange (${orange.player}), pv restants: ${orange.health}`);
          if (!toRemove.includes(yellow.id)) toRemove.push(yellow.id);
          if (orange.health <= 0 && !toRemove.includes(orange.id)) {
            toRemove.push(orange.id);
          }
        }
      });

      greens.forEach(green => {
        if (yellow.player === green.player) return;
        const dx = yellow.x - green.x;
        const dy = yellow.y - green.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          green.health = (green.health || 2) - 1;
          console.log(`Runner jaune touche Chargeur vert (${green.player}), pv restants: ${green.health}`);
          // Yellow meurt toujours au contact.
          if (!toRemove.includes(yellow.id)) toRemove.push(yellow.id);
          if (green.health <= 0 && !toRemove.includes(green.id)) {
            toRemove.push(green.id);
          }
        }
      });
    });

    // Yellow vs Yellow (mutual destruction only entre joueurs opposés).
    for (let i = 0; i < yellows.length; i += 1) {
      for (let j = i + 1; j < yellows.length; j += 1) {
        const a = yellows[i];
        const b = yellows[j];
        if (a.player === b.player) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        const sameCell = (() => {
          const ca = getCellFromPosition(a.x, a.y);
          const cb = getCellFromPosition(b.x, b.y);
          return ca && cb && ca.col === cb.col && ca.globalRow === cb.globalRow;
        })();
        if (distSq <= minDistSq || sameCell) {
          if (!toRemove.includes(a.id)) toRemove.push(a.id);
          if (!toRemove.includes(b.id)) toRemove.push(b.id);
          console.log(`Deux Runners jaunes se détruisent mutuellement (joueurs ${a.player} et ${b.player})`);
        }
      }
    }
  }

  function handleRedCollisions(toRemove) {
    const reds = entities.filter(e => e.ogId === 4);
    const oranges = entities.filter(e => e.ogId === 3);
    const violets = entities.filter(e => e.ogId === 2);
    const blues = entities.filter(e => e.ogId === 5);
    const radius = getEntityRadius();
    const minDist = radius * 2;
    const minDistSq = minDist * minDist;

    reds.forEach(red => {
      oranges.forEach(orange => {
        if (red.player === orange.player) return;
        const dx = red.x - orange.x;
        const dy = red.y - orange.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          // One-shot tourelle, red perd 1 pv, continue sa route.
          if (!toRemove.includes(orange.id)) toRemove.push(orange.id);
          red.health = (red.health || 1) - 1;
          console.log(`Éponge rouge (${red.player}) détruit une Tourelle orange (${orange.player}) au contact (pv rouge: ${red.health})`);
          if (red.health <= 0 && !toRemove.includes(red.id)) {
            toRemove.push(red.id);
          }
        }
      });

      violets.forEach(violet => {
        if (red.player === violet.player) return;
        const dx = red.x - violet.x;
        const dy = red.y - violet.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          if (!toRemove.includes(red.id)) {
            toRemove.push(red.id);
          }
          if (!toRemove.includes(violet.id)) {
            toRemove.push(violet.id);
          }
          console.log(`Éponge rouge (${red.player}) et Défenseur violet (${violet.player}) se détruisent mutuellement`);
        }
      });

      reds.forEach(otherRed => {
        if (red.id === otherRed.id) return;
        if (red.player === otherRed.player) return;
        const dx = red.x - otherRed.x;
        const dy = red.y - otherRed.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          if (!toRemove.includes(red.id)) toRemove.push(red.id);
          if (!toRemove.includes(otherRed.id)) toRemove.push(otherRed.id);
          console.log(`Deux Éponges rouges se détruisent mutuellement (${red.player} vs ${otherRed.player})`);
        }
      });

      // Red vs green: green dies on contact.
      entities.filter(e => e.ogId === 6).forEach(green => {
        if (green.player === red.player) return;
        const dx = red.x - green.x;
        const dy = red.y - green.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          if (!toRemove.includes(green.id)) toRemove.push(green.id);
          red.health = (red.health || 1) - 1;
          console.log(`Éponge rouge (${red.player}) détruit un Chargeur vert (${green.player}) (pv rouge: ${red.health})`);
          if (red.health <= 0 && !toRemove.includes(red.id)) {
            toRemove.push(red.id);
          }
        }
      });

      // Red vs blue: 3 impacts rouges requis pour casser le mur (chaque rouge meurt).
      blues.forEach(blue => {
        if (blue.player === red.player) return;
        const dx = red.x - blue.x;
        const dy = red.y - blue.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= minDistSq) {
          blue.health = (blue.health || 3) - 1;
          console.log(`Éponge rouge (${red.player}) percute un Mur bleu (${blue.player}) (pv bleu restants: ${blue.health})`);
          if (blue.health <= 0 && !toRemove.includes(blue.id)) {
            toRemove.push(blue.id);
          }
          if (!toRemove.includes(red.id)) toRemove.push(red.id);
        }
      });
    });
  }

  function handleTurretAttacks(deltaTime) {
    const cellSize = getCellSize();
    const playfield = getPlayfieldRect();
    const midY = playfield.y + playfield.height / 2;

    const shooters = entities.filter(e => e.ogId === 3 || e.ogId === 7);
    shooters.forEach(shooter => {
      const rangeCells = shooter.ogId === 3 ? ORANGE_TURRET_RANGE_CELLS : WINGED_TURRET_RANGE_CELLS;
      const range = rangeCells * Math.max(cellSize.w, cellSize.h);
      const cooldownMax = shooter.ogId === 3 ? ORANGE_TURRET_COOLDOWN : WINGED_TURRET_COOLDOWN;
      shooter.cooldown = Math.max(0, (shooter.cooldown || 0) - deltaTime);
      if (shooter.cooldown > 0) return;

      const target = entities.find(e => {
        if (e.player === shooter.player) return false;
        if (distance(shooter, e) > range) return false;
        if (shooter.ogId === 7 && ![1, 3, 6].includes(e.ogId)) return false;
        // Ne tirent que vers l’avant (top -> vers le bas, bottom -> vers le haut).
        if (shooter.player === 'top' && e.y < shooter.y) return false;
        if (shooter.player === 'bottom' && e.y > shooter.y) return false;
        // Tourelles fixes ne tirent que dans leur moitié, ailées tirent partout.
        if (shooter.ogId === 3) {
          const inOwnHalf = (shooter.player === 'top' && e.y < midY) ||
                            (shooter.player === 'bottom' && e.y >= midY);
          const sideShot = e.ogId === 1 || e.ogId === 4 || e.ogId === 7;
          // Peut tirer de l'autre côté seulement sur 1/4/7 et à 1 bloc de portée.
          return inOwnHalf || (sideShot && !inOwnHalf);
        }
        return true;
      });

      if (target) {
        shooter.cooldown = cooldownMax;
        // Oriente la tourelle (Og 3) vers sa cible avant de tirer.
        if (shooter.ogId === 3) {
          shooter.rotationTarget = Math.atan2(target.y - shooter.y, target.x - shooter.x);
        }
        spawnProjectile(shooter, target);
        console.log(`${shooter.ogName || 'Tourelle'} (${shooter.player}) tire vers ${target.ogName} du joueur ${target.player}`);
      } else if (shooter.ogId === 3) {
        // Revient vers l'orientation neutre (top: bas, bottom: haut) quand aucune cible.
        shooter.rotationTarget = shooter.player === 'top' ? Math.PI / 2 : -Math.PI / 2;
      }
    });
  }

  function shortestAngleDist(a, b) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return diff < -Math.PI ? diff + Math.PI * 2 : diff;
  }

  function checkGameOver() {
    if (gameOver) return;
    if (healthState.top <= 0) {
      triggerGameOver('bottom');
    } else if (healthState.bottom <= 0) {
      triggerGameOver('top');
    }
  }

  function triggerGameOver(winner) {
    gameOver = true;
    gameWinner = winner;
    isPaused = true;
    countdown = 0;
    console.log(`Game over, vainqueur: ${winner}`);
  }

  function updateAI(deltaTime) {
    if (gameMode !== 'ia' || gameOver || isPaused) return;
    if (isPlacementLocked()) return;
    aiState.timer -= deltaTime;
    if (aiState.timer > 0) return;

    const configs = {
      simple: { delay: [2.0, 3.2], pool: [1, 1, 2, 3, 6, 4] },
      moyen: { delay: [1.2, 2.4], pool: [1, 2, 3, 6, 7, 4] },
      difficile: { delay: [0.8, 1.6], pool: [1, 2, 3, 6, 7, 4] },
    };
    const cfg = configs[aiDifficulty] || configs.moyen;
    const ogPool = cfg.pool;
    const pickOg = () => ogPool[Math.floor(Math.random() * ogPool.length)];

    const placeOg = (ogId, chooser = cells => cells[Math.floor(Math.random() * cells.length)]) => {
      const avail = computeAvailableCells('top', ogId);
      if (!avail.length) return false;
      const cost = getManaCost(ogId);
      if (manaState.top < cost) return false;
      const cell = chooser(avail);
      if (!cell) return false;
      const pos = snapToCellCenter(cell);
      manaState.top = Math.max(0, manaState.top - cost);
      spawnEntity(OGS[ogId], ogId, 'top', pos, -1, cell);
      console.log(`IA (${aiDifficulty}) joue ${OGS[ogId]?.name || ogId} en (${cell.col + 1}, ${cell.globalRow + 1}) côté haut`);
      return true;
    };

    const topEntities = ids => entities.filter(e => e.player === 'top' && ids.includes(e.ogId));
    const bottomEntities = ids => entities.filter(e => e.player === 'bottom' && ids.includes(e.ogId));

    const chargersTop = topEntities([6]);
    const turretsTop = topEntities([3]);
    const greensBottom = bottomEntities([6]);
    const yellowsBottom = bottomEntities([1]);
    const threats = entities.filter(e => e.player === 'bottom');
    const bottomChargers = greensBottom.map(e => getCellFromPosition(e.x, e.y)).filter(Boolean);
    const elapsed = animTime || 0;

    // Réaction aux menaces proches (IA top).
    const defendAgainstThreat = threat => {
      const threatCell = getCellFromPosition(threat.x, threat.y);
      if (!threatCell) return false;
      const col = threatCell.col;

      // Helper pour choisir une case dans une colonne donnée.
      const pickColumnCell = (cells, rowWithinSide) => {
        const colCells = cells.filter(c => c.col === col && (rowWithinSide === undefined || c.rowWithinSide === rowWithinSide));
        if (!colCells.length) return null;
        return colCells[Math.floor(Math.random() * colCells.length)];
      };

      if (threat.ogId === 7 && ogPool.includes(3)) {
        // Anti-air: placer une tourelle en dessous du milieu top.
        return placeOg(3, cells => pickColumnCell(cells, Math.min(GRID_ROWS_PER_SIDE - 1, 2)) || pickColumnCell(cells));
      }

      if (threat.ogId === 1 && ogPool.includes(5)) {
        // Mur pour renvoyer le jaune.
        return placeOg(5, cells => pickColumnCell(cells, 0) || pickColumnCell(cells));
      }

      if (threat.ogId === 4 && ogPool.includes(5)) {
        // Mur pour bloquer l'éponge rouge.
        return placeOg(5, cells => pickColumnCell(cells, 1) || pickColumnCell(cells));
      }

      return false; // ne fait plus de miroir par défaut
    };

    // Traite la menace la plus proche du camp top (y le plus faible).
    if (threats.length) {
      const sorted = [...threats].sort((a, b) => a.y - b.y);
      for (const threat of sorted) {
        if (defendAgainstThreat(threat)) {
          aiState.timer = randomRange(cfg.delay[0] * 0.7, cfg.delay[1]);
          return;
        }
      }
    }

    // 0) Push coordonné si mana suffisant (éviter miroir simple).
    if (aiDifficulty !== 'simple' && manaState.top >= 40 && ogPool.includes(3)) {
      const targetCol = (bottomChargers[0]?.col !== undefined)
        ? bottomChargers[0].col
        : Math.floor(Math.random() * GRID_COLS);
      const pickCol = (cells, rowWithinSide) => {
        const filtered = cells.filter(c => c.col === targetCol && (rowWithinSide === undefined || c.rowWithinSide === rowWithinSide));
        return (filtered.length ? filtered : cells)[Math.floor(Math.random() * (filtered.length ? filtered.length : cells.length))];
      };
      const placedTurret = placeOg(3, cells => pickCol(cells, GRID_ROWS_PER_SIDE - 1));
      const placedViolet = placedTurret && ogPool.includes(2) ? placeOg(2, cells => pickCol(cells, GRID_ROWS_PER_SIDE - 2)) : false;
      const placedRunner = placedTurret && ogPool.includes(1) ? placeOg(1, cells => pickCol(cells, 0)) : false;
      if (placedTurret || placedViolet || placedRunner) {
        aiState.timer = randomRange(cfg.delay[0], cfg.delay[1]) * 0.7;
        return;
      }
    }

    // 1) Priorité absolue en début de game : placer au moins 2 Chargeurs centrés et protéger chacun par une tourelle.
    const chargerCount = chargersTop.length;
    const desiredChargers = aiDifficulty === 'difficile' ? 4 : aiDifficulty === 'moyen' ? 3 : 3;
    if (chargerCount < Math.max(2, desiredChargers) && ogPool.includes(6)) {
      const placed = placeOg(6, cells => {
        const middleRow = GRID_ROWS_PER_SIDE - 2;
        const filtered = cells.filter(c => c.rowWithinSide === middleRow);
        const pool = filtered.length ? filtered : cells;
        return pool[Math.floor(Math.random() * pool.length)];
      });
      aiState.timer = randomRange(cfg.delay[0] * 0.7, cfg.delay[1]);
      if (placed) return;
    }
    // Protéger chaque Chargeur par une tourelle proche.
    const chargerCells = chargersTop.map(e => getCellFromPosition(e.x, e.y)).filter(Boolean);
    const unprotectedCharger = chargerCells.find(cc =>
      !turretsTop.some(t => {
        const tc = getCellFromPosition(t.x, t.y);
        return tc && Math.abs(tc.col - cc.col) <= 1 && Math.abs(tc.globalRow - cc.globalRow) <= 1;
      })
    );
    if (unprotectedCharger && ogPool.includes(3)) {
      const placed = placeOg(3, cells => {
        const near = cells.filter(c => Math.abs(c.col - unprotectedCharger.col) <= 1 && Math.abs(c.globalRow - unprotectedCharger.globalRow) <= 1);
        const pool = near.length ? near : cells;
        return pool[Math.floor(Math.random() * pool.length)];
      });
      aiState.timer = randomRange(cfg.delay[0] * 0.8, cfg.delay[1]);
      if (placed) return;
    }

    // 2) Cibler les Chargeurs ennemis avec des Éponges rouges.
    if (greensBottom.length && ogPool.includes(4)) {
      const placed = placeOg(4);
      aiState.timer = randomRange(cfg.delay[0], cfg.delay[1]);
      if (placed) return;
    }

    // 4) Défendre contre les jaunes adverses avec des violets seulement si recharges déjà en place.
    if (chargersTop.length >= 2 && yellowsBottom.length && ogPool.includes(2)) {
      const placed = placeOg(2, cells => {
        const midRow = Math.max(0, Math.min(GRID_ROWS_PER_SIDE - 1, GRID_ROWS_PER_SIDE - 2));
        const pool = cells.filter(c => c.rowWithinSide === midRow);
        return (pool.length ? pool : cells)[Math.floor(Math.random() * (pool.length ? pool.length : cells.length))];
      });
      aiState.timer = randomRange(cfg.delay[0], cfg.delay[1]);
      if (placed) return;
    }

    // 5) Pression mid/late : plus d'ailées et d'éponges rouges vers la base adverse.
    if (elapsed > 80 && ogPool.includes(7) && manaState.top >= getManaCost(7)) {
      const placed = placeOg(7, cells => {
        const target = bottomChargers[0]?.col !== undefined ? bottomChargers[0].col : Math.floor(Math.random() * GRID_COLS);
        const filtered = cells.filter(c => c.col === target);
        return (filtered.length ? filtered : cells)[Math.floor(Math.random() * (filtered.length ? filtered.length : cells.length))];
      });
      if (placed) {
        aiState.timer = randomRange(cfg.delay[0] * 0.6, cfg.delay[1]);
        return;
      }
    }
    if (elapsed > 70 && ogPool.includes(4) && manaState.top >= getManaCost(4)) {
      const placed = placeOg(4);
      if (placed) {
        aiState.timer = randomRange(cfg.delay[0], cfg.delay[1]);
        return;
      }
    }

    // 5) Sinon, piocher dans le pool par défaut.
    // Peut décider d'attendre un peu pour accumuler du mana afin de sortir une pièce plus chère.
    const maxDesire = Math.max(...ogPool.map(id => getManaCost(id)));
    const manaNow = manaState.top;
    const wantWait = manaNow < maxDesire && aiDifficulty !== 'simple';
    if (wantWait && Math.random() < 0.6) {
      aiState.timer = randomRange(cfg.delay[0] * 0.8, cfg.delay[1] * 1.2);
      return;
    }

    let placed = false;
    let attempts = 0;
    while (attempts < 10 && !placed) {
      const ogId = pickOg();
      placed = placeOg(ogId);
      attempts += 1;
    }

    aiState.timer = randomRange(cfg.delay[0], cfg.delay[1]);
  }

  function updateTurretRotations(deltaTime) {
    const rotSpeed = 6; // rad/s interpolation
    entities.forEach(ent => {
      if (ent.ogId !== 3) return;
      const fallback = ent.player === 'top' ? Math.PI / 2 : -Math.PI / 2;
      const target = ent.rotationTarget !== undefined ? ent.rotationTarget : fallback;
      const current = ent.rotation !== undefined ? ent.rotation : fallback;
      const diff = shortestAngleDist(current, target);
      const step = rotSpeed * deltaTime;
      if (Math.abs(diff) <= step) {
        ent.rotation = target;
      } else {
        ent.rotation = current + Math.sign(diff) * step;
      }
    });
  }

  function updateRedRotations(deltaTime) {
    const rotSpeed = 0.6; // rotation lente
    entities.forEach(ent => {
      if (ent.ogId !== 4) return;
      const current = ent.rotation || 0;
      ent.rotation = current + rotSpeed * deltaTime;
    });
  }

  function updateProjectiles(toRemove, deltaTime) {
    const playfield = getPlayfieldRect();
    const toRemoveProj = [];

    projectiles.forEach(proj => {
      proj.x += proj.vx * deltaTime;
      proj.y += proj.vy * deltaTime;
      proj.lifetime -= deltaTime;

      // Remove if out of bounds or expired.
      if (
        proj.lifetime <= 0 ||
        proj.x < playfield.x - 50 ||
        proj.x > playfield.x + playfield.width + 50 ||
        proj.y < playfield.y - 50 ||
        proj.y > playfield.y + playfield.height + 50
      ) {
        toRemoveProj.push(proj.id);
        return;
      }

      // Collision with enemy entity.
      const radius = getEntityRadius();
      const hit = entities.find(
        e =>
          e.player === proj.targetPlayer &&
          distance(proj, e) <= radius
      );

      if (hit) {
        if (hit.ogId === 4) {
          // Éponge rouge résiste aux projectiles.
          toRemoveProj.push(proj.id);
          return;
        }
        hit.health = (hit.health || 1) - 1;
        console.log(`Projectile touche ${hit.ogName} du joueur ${hit.player} (pv restants: ${hit.health})`);
        if (hit.health <= 0) {
          if (!toRemove.includes(hit.id)) {
            toRemove.push(hit.id);
          }
          checkGameOver();
        }
        toRemoveProj.push(proj.id);
      }
    });

    if (toRemoveProj.length) {
      for (const id of toRemoveProj) {
        const idx = projectiles.findIndex(p => p.id === id);
        if (idx !== -1) projectiles.splice(idx, 1);
      }
    }
  }

  function updateHazard(deltaTime, toRemove) {
    if (gameOver) return;
    if (!hazardEnabled) {
      hazardState.active = false;
      hazardState.timer = Infinity;
      return;
    }

    const river = getPlayfieldRect();

    // Spawn countdown when idle.
    if (!hazardState.active) {
      hazardState.timer -= deltaTime;
      if (hazardState.timer <= 0) {
        hazardState.active = true;
        hazardState.phase = 'approach';
        hazardState.direction = null;
        // Choix aléatoire du point d'arrêt sur l'axe horizontal de la rivière.
        const minX = river.x + HAZARD_RADIUS;
        const maxX = river.x + river.width - HAZARD_RADIUS;
        hazardState.targetX = minX + Math.random() * (maxX - minX);
        hazardState.x = river.x + river.width + HAZARD_RADIUS;
        hazardState.y = river.y + river.height / 2;
        hazardState.vx = -HAZARD_SPEED;
        hazardState.vy = 0;
        clearSelection();
      }
      return;
    }

    // Helper: move hazard and delete collided entities.
    const advance = dt => {
      hazardState.x += hazardState.vx * dt;
      hazardState.y += hazardState.vy * dt;
    };
    const destroyOnPath = (phase) => {
    const radius = HAZARD_RADIUS + getEntityRadius();
      const radiusSq = radius * radius;
      entities.forEach(ent => {
        const dx = hazardState.x - ent.x;
        const dy = hazardState.y - ent.y;
        if (phase !== 'dash') return; // destruction uniquement pendant la phase verticale
        if (dx * dx + dy * dy <= radiusSq) {
          if (!toRemove.includes(ent.id)) {
            toRemove.push(ent.id);
          }
        }
      });
    };

    switch (hazardState.phase) {
      case 'approach': {
        advance(deltaTime);
        destroyOnPath('approach');
        const targetX = hazardState.targetX || (river.x + river.width / 2);
        if (hazardState.x <= targetX) {
          hazardState.x = targetX;
          hazardState.vx = 0;
          hazardState.vy = 0;
          hazardState.phase = 'pause';
          hazardState.timer = HAZARD_PAUSE_TIME;
        }
        break;
      }
      case 'pause': {
        hazardState.timer -= deltaTime;
        if (hazardState.timer <= 0) {
          hazardState.phase = 'dash';
          hazardState.direction = Math.random() < 0.5 ? 'up' : 'down';
          hazardState.vx = 0;
          hazardState.vy = hazardState.direction === 'up' ? -HAZARD_SPEED : HAZARD_SPEED;
        }
        break;
      }
      case 'dash': {
        advance(deltaTime);
        destroyOnPath('dash');
        const offTop = hazardState.y + HAZARD_RADIUS < river.y;
        const offBottom = hazardState.y - HAZARD_RADIUS > river.y + river.height;
        if (offTop || offBottom) {
          const targetPlayer = offTop ? 'top' : 'bottom';
          applyHazardDamage(targetPlayer);
          resetHazard();
        }
        break;
      }
      default:
        break;
    }
  }

  function applyHazardDamage(targetPlayer) {
    healthState[targetPlayer] = Math.max(0, healthState[targetPlayer] - HAZARD_DAMAGE);
    console.log(`Bloc noir inflige ${HAZARD_DAMAGE} dégâts à ${targetPlayer}. HP: ${healthState[targetPlayer]}/${healthState.max}`);
  }

  function resetHazard() {
    hazardState.active = false;
    hazardState.phase = 'idle';
    hazardState.targetX = 0;
    hazardState.vx = 0;
    hazardState.vy = 0;
    hazardState.timer = randomHazardTime();
  }

  function resetGameState() {
    manaState.top = 0;
    manaState.bottom = 0;
    manaState.regenPerSec = 2;
    healthState.top = HEALTH_MAX;
    healthState.bottom = HEALTH_MAX;
    scoreState.top = 0;
    scoreState.bottom = 0;
    entities.length = 0;
    projectiles.length = 0;
    manaOrbs.length = 0;
    entityId = 1;
    projectileId = 1;
    orbId = 1;
    orbTimers.top = randomOrbTime();
    orbTimers.bottom = randomOrbTime();
    clearSelection('top');
    clearSelection('bottom');
    dragState.active = false;
    aiState.timer = 0;
    resetHazard();
    hazardState.timer = hazardEnabled ? randomHazardTime() : Infinity;
    hazardState.active = false;
    animTime = 0;
    gameOver = false;
    gameWinner = null;
  }

  function startGame(config = {}) {
    const { mode = 'pvp', ai = 'moyen', hazard = true } = config;
    gameMode = mode;
    aiDifficulty = ai;
    hazardEnabled = hazard;
    lastGameConfig = { mode, ai, hazard };
    menuOpen = false;
    if (menuOverlay) menuOverlay.classList.add('hidden');
    resetGameState();
    gameLoop.lastTime = null;
    resizeCanvas();
    countdown = 5;
    isPaused = true; // bloqué pendant le compte à rebours
    gameOver = false;
  }

  function setupMenu() {
    if (!menuOverlay) {
      // Pas de menu : démarrage direct.
      menuOpen = false;
      isPaused = false;
      return;
    }
    menuOverlay.classList.remove('hidden');
    if (pvpButton) {
      pvpButton.addEventListener('click', () => {
        const hazardOn = hazardCheckbox ? hazardCheckbox.checked : true;
        startGame({ mode: 'pvp', hazard: hazardOn });
      });
    }
    if (aiButton) {
      aiButton.addEventListener('click', () => {
        const diff = aiSelect ? aiSelect.value || 'moyen' : 'moyen';
        const hazardOn = hazardCheckbox ? hazardCheckbox.checked : true;
        startGame({ mode: 'ia', ai: diff, hazard: hazardOn });
      });
    }
  }

  function updateManaOrbs(deltaTime) {
    const river = getPlayfieldRect();
    const midY = river.y + river.height / 2;

    ['top', 'bottom'].forEach(player => {
      orbTimers[player] -= deltaTime;
      if (orbTimers[player] <= 0) {
        spawnManaOrb(player, river, midY);
        orbTimers[player] = randomOrbTime();
      }
    });

    // Expire old orbs.
    for (let i = manaOrbs.length - 1; i >= 0; i -= 1) {
      manaOrbs[i].lifetime -= deltaTime;
      if (manaOrbs[i].lifetime <= 0) {
        manaOrbs.splice(i, 1);
      }
    }
  }

  function spawnManaOrb(player, river, midY) {
    const halfTopY = river.y;
    const halfBottomY = midY;
    const halfHeight = river.height / 2;

    const x = river.x + ORB_RADIUS + Math.random() * (river.width - ORB_RADIUS * 2);
    const yBase = player === 'top' ? halfTopY : halfBottomY;
    const y = yBase + ORB_RADIUS + Math.random() * (halfHeight - ORB_RADIUS * 2);
    manaOrbs.push({ id: orbId++, player, x, y, lifetime: ORB_LIFETIME });
  }

  function handleOrbClick(point) {
    const river = getPlayfieldRect();
    const midY = river.y + river.height / 2;
    // Determine which side the click is on.
    const clickPlayer = point.y < midY ? 'top' : 'bottom';

    const hitIndex = manaOrbs.findIndex(orb => {
      if (orb.player !== clickPlayer) return false;
      return distance(orb, point) <= ORB_RADIUS;
    });

    if (hitIndex !== -1) {
      const orb = manaOrbs[hitIndex];
      manaState[clickPlayer] = Math.min(manaState.max, manaState[clickPlayer] + ORB_MANA);
      manaOrbs.splice(hitIndex, 1);
      console.log(`Mana +${ORB_MANA} pour ${clickPlayer}`);
      return true;
    }
    return false;
  }

  function updateAIOrbs(deltaTime) {
    if (gameMode !== 'ia' || gameOver || isPaused) return;
    const odds = aiDifficulty === 'simple' ? 0.6 : aiDifficulty === 'moyen' ? 0.85 : 0.98;
    // IA top ramasse les orbes du top avec probabilité selon la difficulté.
    for (let i = manaOrbs.length - 1; i >= 0; i -= 1) {
      const orb = manaOrbs[i];
      if (orb.player !== 'top') continue;
      if (Math.random() > odds) continue;
      manaState.top = Math.min(manaState.max, manaState.top + ORB_MANA);
      manaOrbs.splice(i, 1);
      console.log(`IA (${aiDifficulty}) ramasse une orbe (+${ORB_MANA} mana)`);
    }
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function spawnProjectile(fromEntity, targetEntity) {
    const lead = computeLead(fromEntity, targetEntity, PROJECTILE_SPEED);
    const dx = lead.x - fromEntity.x;
    const dy = lead.y - fromEntity.y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * PROJECTILE_SPEED;
    const vy = (dy / len) * PROJECTILE_SPEED;
    projectiles.push({
      id: projectileId++,
      player: fromEntity.player,
      x: fromEntity.x,
      y: fromEntity.y,
      vx,
      vy,
      lifetime: PROJECTILE_LIFETIME,
      targetPlayer: targetEntity.player,
    });
  }

  function computeLead(shooter, target, speed) {
    const tx = target.x - shooter.x;
    const ty = target.y - shooter.y;
    const tvx = target.vx || 0;
    const tvy = target.vy || 0;

    const a = tvx * tvx + tvy * tvy - speed * speed;
    const b = 2 * (tx * tvx + ty * tvy);
    const c = tx * tx + ty * ty;

    let t;
    if (Math.abs(a) < 1e-6) {
      t = b !== 0 ? -c / b : 0;
    } else {
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        t = -b / (2 * a);
      } else {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
      }
    }

    if (!isFinite(t) || t <= 0) {
      return { x: target.x, y: target.y };
    }

    return {
      x: target.x + tvx * t,
      y: target.y + tvy * t,
    };
  }

  function handlePointerDown(event) {
    const point = screenToCanvas(event.clientX, event.clientY);

    if (gameOver) {
      handleGameOverClick(point);
      return;
    }

    // Si clic sur pause, on autorise même en pause.
    if (pointInRect(point, uiRects.pauseButton)) {
      isPaused = !isPaused;
      console.log(isPaused ? 'Pause activée' : 'Lecture reprise');
      return;
    }

    if (menuOpen) {
      console.log('Menu actif : patiente avant de jouer.');
      return;
    }

    if (isPaused) {
      console.log('Le jeu est en pause : aucune pose ni action possible.');
      return;
    }

    if (handleOrbClick(point)) return;

    const topHit = uiRects.topSlots.findIndex(rect => pointInRect(point, rect));
    const bottomHit = uiRects.bottomSlots.findIndex(rect => pointInRect(point, rect));

    if (topHit !== -1) {
      if (isPlacementLocked()) {
        console.log('Impossible de poser des Ogs pendant le passage du scorpion noir');
        return;
      }
      // Toggle selection if same slot re-clicked.
      const sel = selectionState.top;
      if (sel.active && sel.slotIndex === topHit) {
        clearSelection('top');
      } else {
        beginSelection('top', topHit);
      }
      return;
    }
    if (bottomHit !== -1) {
      if (isPlacementLocked()) {
        console.log('Impossible de poser des Ogs pendant le passage du bloc noir');
        return;
      }
      const sel = selectionState.bottom;
      if (sel.active && sel.slotIndex === bottomHit) {
        clearSelection('bottom');
      } else {
        beginSelection('bottom', bottomHit);
      }
      return;
    }

    // If a selection is active, attempt placement on valid cell (independent per player).
    const river = getPlayfieldRect();
    if (pointInRect(point, river)) {
      const cell = pointToGrid(point);
      if (!cell) return;
      const side = cell.side;
      const sel = selectionState[side];
      if (sel && sel.active) {
        if (isCellInAvailable(sel, cell)) {
          attemptPlacement(sel, cell, point);
        } else {
          console.log('Case non autorisée pour cet Og');
        }
      }
      return;
    }
  }

  function startDrag(player, slotIndex, point) {
    if (isPlacementLocked()) {
      console.log('Impossible de poser des Ogs pendant le passage du bloc noir');
      return;
    }
    const slotMeta = getSlotMeta(player, slotIndex);
    if (!slotMeta) return;
    if (isPaused) return;
    dragState.active = true;
    dragState.player = player;
    dragState.slotIndex = slotIndex;
    dragState.ogId = slotMeta.ogId;
    dragState.og = OGS[slotMeta.ogId] || null;
    dragState.color = slotMeta.fill;
    dragState.position = { ...point };

    console.log(`${player === 'top' ? 'Player top' : 'Player bottom'} commence un drag de ${dragState.og?.name || 'Og'} (${slotIndex + 1})`);
  }

  function updateDragPosition(event) {
    if (!dragState.active || isPaused) return;
    dragState.position = screenToCanvas(event.clientX, event.clientY);
  }

  function endDrag(event) {
    if (!dragState.active || isPaused) return;
    dragState.active = false;
    dragState.player = null;
    dragState.slotIndex = -1;
    dragState.og = null;
    dragState.ogId = -1;
    dragState.color = null;
  }

  computeUIRects();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', updateDragPosition);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointerleave', endDrag);
  setupMenu();

  // Chargement des skins puis lancement de la boucle (formes colorées si skin absent).
  loadSkins().then(() => {
    console.log('Skins chargés');
  });
  window.requestAnimationFrame(gameLoop);

  // TODO: When units are added, place their spawn/lanes inside renderPlayfield and update().
})();
