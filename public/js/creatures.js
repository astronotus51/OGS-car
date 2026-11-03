/*
 * Créatures OGS dessinées en vectoriel (canvas), animées par parties.
 * Creatures.draw(ctx, ogId, skinId, size, t, state) dessine la créature centrée en (0,0), face « vers le haut ».
 * state : { moving, vx, vy, hit (0..1), shoot (0..1), bounce (0..1), rot (tourelle/étoile), hpRatio, phase, team }
 */
(function () {
  'use strict';
  const OUTLINE = '#2a2438';
  const TAU = Math.PI * 2;

  const NAMES = { 1: 'Zip', 2: 'Gromp', 3: 'Krak', 4: 'Riko', 5: 'Blok', 6: 'Mojo', 7: 'Zéphir', 8: 'Pik', 9: 'Bulle', 10: 'Zazou', 11: 'Boum', 12: 'Rafale', 13: 'Tiktak', 14: 'Fantôme', 15: 'Glu', 16: 'Sirène', 17: 'Kraken', 18: 'Puce', 19: 'Jumeaux', 20: 'Étincelle', 21: 'Taupe', 22: 'Canonnier', 23: 'Nid', 24: 'Pétard', 25: 'Lutin', 26: 'Flak', 27: 'Nuage', 28: 'Givre', 29: 'Pioche', 30: 'Source', 31: 'Boule', 32: 'Ballon', 33: 'Vampire', 34: 'Scarabée', 35: 'Mortier', 36: 'Hydre', 37: 'Phare', 38: 'Gel', 39: 'Dynamite', 40: 'Oracle', 41: 'Golem', 42: 'Phénix', 43: 'Totem', 44: 'Léviathan', 45: 'Titan', 46: 'Essaim', 47: 'Reine' };
  const ROLES = { 1: 'Runner', 2: 'Défenseur', 3: 'Tourelle', 4: 'Étoile rebondissante', 5: 'Mur', 6: 'Chargeur de mana', 7: 'Dragonnet volant' };

  // Palettes de base par créature (classique).
  const BASE = {
    1: { base: '#fde047', light: '#fef9c3', dark: '#ca8a04' },
    2: { base: '#c084fc', light: '#f3e8ff', dark: '#7e22ce' },
    3: { base: '#fb923c', light: '#ffedd5', dark: '#c2410c' },
    4: { base: '#f87171', light: '#fee2e2', dark: '#b91c1c' },
    5: { base: '#60a5fa', light: '#dbeafe', dark: '#1d4ed8' },
    6: { base: '#4ade80', light: '#dcfce7', dark: '#15803d' },
    7: { base: '#fb923c', light: '#fed7aa', dark: '#9a3412' },
    8: { base: '#d9b36b', light: '#f5e6c4', dark: '#8a6a2b' },
    9: { base: '#7dd3fc', light: '#e0f2fe', dark: '#0284c7' },
    10: { base: '#a3e635', light: '#ecfccb', dark: '#4d7c0f' },
    11: { base: '#475569', light: '#94a3b8', dark: '#1e293b' },
    12: { base: '#93c5fd', light: '#dbeafe', dark: '#1d4ed8' },
    13: { base: '#334155', light: '#64748b', dark: '#0f172a' },
    14: { base: '#e2e8f0', light: '#ffffff', dark: '#94a3b8' },
    15: { base: '#84cc16', light: '#d9f99d', dark: '#3f6212' },
    16: { base: '#f0abfc', light: '#fae8ff', dark: '#a21caf' },
    17: { base: '#7c3aed', light: '#c4b5fd', dark: '#3b0764' },
    18: { base: '#fde047', light: '#fefce8', dark: '#a16207' },
    19: { base: '#fdba74', light: '#ffedd5', dark: '#c2410c' },
    20: { base: '#fef08a', light: '#fffbeb', dark: '#f97316' },
    21: { base: '#a16207', light: '#d4a24c', dark: '#5a3306' },
    22: { base: '#c084fc', light: '#f3e8ff', dark: '#6b21a8' },
    23: { base: '#d6d3d1', light: '#fafaf9', dark: '#78716c' },
    24: { base: '#f43f5e', light: '#fecdd3', dark: '#9f1239' },
    25: { base: '#4ade80', light: '#dcfce7', dark: '#166534' },
    26: { base: '#67e8f9', light: '#cffafe', dark: '#0e7490' },
    27: { base: '#cbd5e1', light: '#f8fafc', dark: '#64748b' },
    28: { base: '#bae6fd', light: '#f0f9ff', dark: '#0369a1' },
    29: { base: '#f59e0b', light: '#fde68a', dark: '#92400e' },
    30: { base: '#5eead4', light: '#ccfbf1', dark: '#0f766e' },
    31: { base: '#e0f2fe', light: '#ffffff', dark: '#7dd3fc' },
    32: { base: '#f9a8d4', light: '#fce7f3', dark: '#be185d' },
    33: { base: '#991b1b', light: '#ef4444', dark: '#450a0a' },
    34: { base: '#16a34a', light: '#86efac', dark: '#14532d' },
    35: { base: '#78716c', light: '#d6d3d1', dark: '#292524' },
    36: { base: '#15803d', light: '#4ade80', dark: '#052e16' },
    37: { base: '#fcd34d', light: '#fef3c7', dark: '#b45309' },
    38: { base: '#a5f3fc', light: '#ecfeff', dark: '#0891b2' },
    39: { base: '#ef4444', light: '#fecaca', dark: '#7f1d1d' },
    40: { base: '#e9d5ff', light: '#faf5ff', dark: '#7e22ce' },
    41: { base: '#78716c', light: '#a8a29e', dark: '#1c1917' },
    42: { base: '#fb923c', light: '#fef3c7', dark: '#b91c1c' },
    43: { base: '#a78bfa', light: '#ede9fe', dark: '#4c1d95' },
    44: { base: '#1e40af', light: '#60a5fa', dark: '#0c1a4d' },
    45: { base: '#57534e', light: '#a8a29e', dark: '#0c0a09' },
    46: { base: '#bef264', light: '#f7fee7', dark: '#4d7c0f' },
    47: { base: '#f0abfc', light: '#fdf4ff', dark: '#86198f' },
  };
  // Palettes Halloween, spécifiques par créature.
  const HALLOWEEN = {
    1: { base: '#f97316', light: '#fdba74', dark: '#9a3412' }, // Zip citrouille
    2: { base: '#d8b4fe', light: '#f5f3ff', dark: '#6b21a8' }, // Gromp vampire
    3: { base: '#84cc16', light: '#d9f99d', dark: '#3f6212' }, // Krak sorcière
    4: { base: '#e7e5e4', light: '#fafaf9', dark: '#a8a29e' }, // Riko momie
    5: { base: '#86efac', light: '#dcfce7', dark: '#166534' }, // Blok Frankenstein
    6: { base: '#a3e635', light: '#ecfccb', dark: '#4d7c0f' }, // Mojo zombie
    7: { base: '#3f3f46', light: '#71717a', dark: '#18181b' }, // Zéphir chauve-souris
  };
  const THEME_PALETTE = {
    ghost: { base: '#f8fafc', light: '#ffffff', dark: '#cbd5e1' },
    robot: { base: '#a1a1aa', light: '#e4e4e7', dark: '#52525b' },
    ice: { base: '#bae6fd', light: '#f0f9ff', dark: '#0284c7' },
    gold: { base: '#fbbf24', light: '#fef3c7', dark: '#b45309' },
    pirate: { base: '#b91c1c', light: '#fca5a5', dark: '#7f1d1d' },
    astro: { base: '#e2e8f0', light: '#ffffff', dark: '#94a3b8' },
    candy: { base: '#f9a8d4', light: '#fdf2f8', dark: '#db2777' },
    lava: { base: '#1c1917', light: '#44403c', dark: '#0c0a09', glow: '#f97316' },
    ninja: { base: '#1e3a8a', light: '#3b82f6', dark: '#172554' },
    royal: { base: '#7e22ce', light: '#d8b4fe', dark: '#4c1d95' },
    summer: { base: '#fde047', light: '#fef9c3', dark: '#f59e0b' },
    xmas: { base: '#dc2626', light: '#fecaca', dark: '#991b1b' },
    toxic: { base: '#84cc16', light: '#d9f99d', dark: '#365314' },
    cyber: { base: '#0f172a', light: '#1e293b', dark: '#020617', glow: '#22d3ee' },
  };

  function themeOf(skinId, ogId) {
    const skin = window.OGSCatalog && OGSCatalog.SKIN_BY_ID[skinId];
    if (skin && skin.theme) return skin.theme;
    return 'default';
  }
  function colorsFor(ogId, theme) {
    if (theme === 'halloween') return HALLOWEEN[ogId] || BASE[ogId];
    if (theme === 'neon') return { base: '#111827', light: '#1f2937', dark: '#030712', glow: BASE[ogId].base };
    if (theme === 'lava' || theme === 'cyber') return THEME_PALETTE[theme];
    if (THEME_PALETTE[theme]) return THEME_PALETTE[theme];
    return BASE[ogId];
  }

  // ----- Helpers -----
  function rr(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function blink(t, phase) { const k = (t + phase * 1.7) % 3.9; return k < 0.14 ? 0.12 : 1; }
  function bodyStyle(ctx, C, s, theme, cx, cy) {
    if (theme === 'gold') { const g = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2); g.addColorStop(0, '#fef3c7'); g.addColorStop(0.45, '#fbbf24'); g.addColorStop(0.55, '#f59e0b'); g.addColorStop(1, '#b45309'); return g; }
    const g = ctx.createLinearGradient(cx - s * 0.35, cy - s * 0.4, cx + s * 0.25, cy + s * 0.45);
    g.addColorStop(0, C.light); g.addColorStop(0.25, C.base); g.addColorStop(1, C.dark);
    return g;
  }
  // Remplit + contour le chemin courant selon le thème.
  function paint(ctx, C, s, theme, cx, cy) {
    ctx.save();
    if ((theme === 'neon' || theme === 'lava' || theme === 'cyber') && C.glow) { ctx.shadowColor = C.glow; ctx.shadowBlur = s * 0.18; }
    if (theme === 'ghost') ctx.globalAlpha *= 0.88;
    ctx.fillStyle = bodyStyle(ctx, C, s, theme, cx || 0, cy || 0);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = s * 0.055; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = (theme === 'neon' || theme === 'cyber') ? C.glow : theme === 'lava' ? '#f97316' : OUTLINE;
    ctx.stroke();
  }
  function shine(ctx, x, y, w, h, a) {
    ctx.save(); ctx.globalAlpha *= (a || 0.55); ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x, y, w, h, -0.6, 0, TAU); ctx.fill(); ctx.restore();
  }
  function eye(ctx, x, y, w, h, t, phase, opts) {
    const o = opts || {};
    const b = blink(t, phase);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, b);
    if (o.theme === 'robot') { ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); rr(ctx, -w, -h * 0.6, w * 2, h * 1.2, h * 0.3); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = w * 0.25; ctx.stroke(); ctx.fillStyle = '#e0f2fe'; ctx.fillRect(-w * 0.6, -h * 0.25, w * 0.5, h * 0.3); ctx.restore(); return; }
    if (o.theme === 'ghost') { ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.ellipse(0, 0, w, h * 1.1, 0, 0, TAU); ctx.fill(); ctx.restore(); return; }
    ctx.fillStyle = o.white ? '#fff' : OUTLINE;
    ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, TAU); ctx.fill();
    if (o.white) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = w * 0.3; ctx.stroke(); ctx.fillStyle = o.pupil || OUTLINE; ctx.beginPath(); ctx.ellipse((o.lookX || 0) * w * 0.35, (o.lookY || 0) * h * 0.35, w * 0.5, h * 0.5, 0, 0, TAU); ctx.fill(); }
    // reflet
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-w * 0.3, -h * 0.35, w * 0.28, h * 0.22, 0, 0, TAU); ctx.fill();
    if (o.angry) { ctx.strokeStyle = o.browColor || OUTLINE; ctx.lineWidth = w * 0.4; ctx.beginPath(); ctx.moveTo(-w * 0.9, -h * 1.45 + (o.angrySide || 1) * h * 0.35); ctx.lineTo(w * 0.9, -h * 1.45 - (o.angrySide || 1) * h * 0.35); ctx.stroke(); }
    ctx.restore();
  }
  function mouth(ctx, x, y, w, kind, t) {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = w * 0.14; ctx.lineCap = 'round';
    ctx.beginPath();
    if (kind === 'smile') { ctx.arc(x, y - w * 0.1, w * 0.5, 0.25, Math.PI - 0.25); }
    else if (kind === 'grin') { ctx.arc(x, y - w * 0.2, w * 0.6, 0.15, Math.PI - 0.15); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.rect(x - w * 0.25, y + w * 0.05, w * 0.18, w * 0.2); ctx.rect(x + w * 0.07, y + w * 0.05, w * 0.18, w * 0.2); ctx.fill(); return; }
    else if (kind === 'o') { ctx.ellipse(x, y, w * 0.22, w * 0.3 * (0.8 + 0.2 * Math.sin((t || 0) * 6)), 0, 0, TAU); ctx.fillStyle = OUTLINE; ctx.fill(); return; }
    else if (kind === 'frown') { ctx.arc(x, y + w * 0.45, w * 0.5, Math.PI + 0.35, TAU - 0.35); }
    else if (kind === 'zigzag') { const n = 4, w2 = w * 0.9; ctx.moveTo(x - w2 / 2, y); for (let i = 1; i <= n; i += 1) ctx.lineTo(x - w2 / 2 + (w2 / n) * i, y + (i % 2 ? w * 0.18 : 0)); }
    else { ctx.moveTo(x - w * 0.3, y); ctx.lineTo(x + w * 0.3, y); }
    ctx.stroke();
  }
  function fangs(ctx, x, y, w) { ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = w * 0.08; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * w * 0.28, y); ctx.lineTo(x + sx * w * 0.18, y + w * 0.32); ctx.lineTo(x + sx * w * 0.08, y); ctx.closePath(); ctx.fill(); ctx.stroke(); } }

  // ----- Accessoires de thème (dessinés après le corps) -----
  function hatWitch(ctx, x, y, s, C) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12);
    ctx.fillStyle = '#1f1235'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.24, 0); ctx.quadraticCurveTo(-s * 0.05, -s * 0.35, s * 0.12, -s * 0.62); ctx.quadraticCurveTo(0, -s * 0.3, s * 0.24, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a855f7'; ctx.fillRect(-s * 0.2, -s * 0.09, s * 0.4, s * 0.07);
    ctx.restore();
  }
  function stemPumpkin(ctx, x, y, s) {
    ctx.fillStyle = '#4d7c0f'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.moveTo(x - s * 0.06, y); ctx.quadraticCurveTo(x - s * 0.02, y - s * 0.16, x + s * 0.1, y - s * 0.2); ctx.lineTo(x + s * 0.12, y - s * 0.12); ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.1, x + s * 0.07, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function pumpkinFace(ctx, x, y, s, t) {
    const glow = 0.75 + 0.25 * Math.sin(t * 5);
    ctx.fillStyle = `rgba(254,240,138,${glow})`;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sx * s * 0.2, y - s * 0.02); ctx.lineTo(x + sx * s * 0.07, y + s * 0.05); ctx.lineTo(x + sx * s * 0.19, y + s * 0.09); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); const w = s * 0.34, yy = y + s * 0.2; ctx.moveTo(x - w / 2, yy); for (let i = 1; i <= 6; i += 1) ctx.lineTo(x - w / 2 + (w / 6) * i, yy + (i % 2 ? s * 0.09 : 0)); ctx.lineTo(x + w / 2, yy + s * 0.12); ctx.lineTo(x - w / 2, yy + s * 0.12); ctx.closePath(); ctx.fill();
  }
  function bandages(ctx, pathFn, s) {
    ctx.save(); ctx.beginPath(); pathFn(); ctx.clip();
    ctx.strokeStyle = 'rgba(120,113,108,0.55)'; ctx.lineWidth = s * 0.035;
    for (let i = -4; i <= 4; i += 1) { ctx.beginPath(); ctx.moveTo(-s * 0.6, i * s * 0.11 - s * 0.05); ctx.lineTo(s * 0.6, i * s * 0.11 + s * 0.06); ctx.stroke(); }
    ctx.restore();
  }
  function bolts(ctx, x, y, s) { ctx.fillStyle = '#71717a'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; for (const sx of [-1, 1]) { ctx.beginPath(); rr(ctx, x + sx * s * 0.5 - s * 0.05, y - s * 0.05, s * 0.1, s * 0.1, s * 0.02); ctx.fill(); ctx.stroke(); } }
  function stitches(ctx, x, y, s, angle) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(-s * 0.15, 0); ctx.lineTo(s * 0.15, 0); for (let i = -2; i <= 2; i += 1) { ctx.moveTo(i * s * 0.06, -s * 0.04); ctx.lineTo(i * s * 0.06, s * 0.04); } ctx.stroke(); ctx.restore(); }
  function antenna(ctx, x, y, s, t) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.18); ctx.stroke(); ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ef4444' : '#7f1d1d'; ctx.beginPath(); ctx.arc(x, y - s * 0.22, s * 0.05, 0, TAU); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.025; ctx.stroke(); }
  function frost(ctx, x, y, s, t) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.1) * s * 0.22, y + Math.sin(i * 2.1) * s * 0.18, s * 0.035, 0, TAU); ctx.fill(); } ctx.fillStyle = '#e0f2fe'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; for (const sx of [-0.2, 0.05, 0.25]) { ctx.beginPath(); ctx.moveTo(x + sx * s - s * 0.04, y - s * 0.44); ctx.lineTo(x + sx * s, y - s * 0.44 + s * (0.14 + 0.05 * Math.abs(sx * 3))); ctx.lineTo(x + sx * s + s * 0.04, y - s * 0.44); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
  function sparkles(ctx, s, t, color) { ctx.fillStyle = color || '#fff'; for (let i = 0; i < 4; i += 1) { const a = t * 1.3 + i * 1.57, r = s * 0.46; const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.6 - s * 0.05; const k = (Math.sin(t * 4 + i) + 1) / 2; ctx.save(); ctx.globalAlpha *= 0.4 + 0.6 * k; ctx.translate(x, y); ctx.beginPath(); for (let j = 0; j < 8; j += 1) { const rr2 = j % 2 ? s * 0.015 : s * 0.05 * (0.6 + 0.4 * k); ctx.lineTo(Math.cos(j * Math.PI / 4) * rr2, Math.sin(j * Math.PI / 4) * rr2); } ctx.closePath(); ctx.fill(); ctx.restore(); } }
  function ghostTail(ctx, x, y, w, s, t, C) {
    // Bas ondulé de fantôme qui remplace le bas du corps.
    ctx.save(); ctx.globalAlpha *= 0.88; ctx.fillStyle = C.base; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.055;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - s * 0.12);
    const n = 4; for (let i = 0; i <= n; i += 1) { const px = x - w / 2 + (w / n) * i; const py = y + Math.sin(t * 5 + i * 1.5) * s * 0.03 + (i % 2 ? s * 0.08 : -s * 0.02); ctx.quadraticCurveTo(px - w / n / 2, py + s * 0.1, px, py); }
    ctx.lineTo(x + w / 2, y - s * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function cape(ctx, s, t) { ctx.fillStyle = '#7f1d1d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.2); ctx.quadraticCurveTo(-s * 0.6, s * 0.1 + Math.sin(t * 3) * s * 0.04, -s * 0.5, s * 0.42); ctx.lineTo(s * 0.5, s * 0.42); ctx.quadraticCurveTo(s * 0.6, s * 0.1 - Math.sin(t * 3) * s * 0.04, s * 0.3, -s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function batEars(ctx, s, C) { for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.12, -s * 0.3); ctx.lineTo(sx * s * 0.3, -s * 0.62); ctx.lineTo(sx * s * 0.34, -s * 0.28); ctx.closePath(); paint(ctx, C, s, 'default'); } }

  function hatPirate(ctx, x, y, s) { ctx.fillStyle = '#dc2626'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(x - s * 0.34, y + s * 0.02); ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.22, x, y - s * 0.2); ctx.quadraticCurveTo(x + s * 0.2, y - s * 0.22, x + s * 0.34, y + s * 0.02); ctx.lineTo(x + s * 0.42, y - s * 0.06); ctx.lineTo(x + s * 0.3, y + s * 0.06); ctx.lineTo(x - s * 0.3, y + s * 0.06); ctx.lineTo(x - s * 0.42, y - s * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(x - s * 0.1 + i * s * 0.1, y - s * 0.06, s * 0.02, 0, TAU); ctx.fill(); } }
  function eyePatch(ctx, x, y, s) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.12); ctx.lineTo(x + s * 0.3, y - s * 0.02); ctx.stroke(); ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.085, s * 0.075, 0, 0, TAU); ctx.fill(); }
  function helmet(ctx, x, y, s, t) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.arc(x, y, s * 0.46, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.arc(x, y, s * 0.46, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.arc(x, y, s * 0.38, -2.4, -1.6); ctx.stroke(); ctx.restore(); }
  function sprinkles(ctx, s, t) { const cols = ['#f472b6', '#60a5fa', '#fde047', '#4ade80', '#fff']; for (let i = 0; i < 9; i += 1) { ctx.save(); ctx.translate(Math.cos(i * 2.4) * s * 0.22, Math.sin(i * 1.7) * s * 0.26); ctx.rotate(i); ctx.fillStyle = cols[i % 5]; ctx.beginPath(); rr(ctx, -s * 0.04, -s * 0.012, s * 0.08, s * 0.024, s * 0.012); ctx.fill(); ctx.restore(); } }
  function cracks(ctx, s, t) { ctx.save(); ctx.strokeStyle = `rgba(249,115,22,${0.6 + 0.4 * Math.sin(t * 4)})`; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.1); ctx.lineTo(-s * 0.08, 0); ctx.lineTo(-s * 0.16, s * 0.14); ctx.moveTo(s * 0.1, -s * 0.2); ctx.lineTo(s * 0.18, -s * 0.04); ctx.lineTo(s * 0.08, s * 0.1); ctx.lineTo(s * 0.2, s * 0.22); ctx.stroke(); ctx.restore(); }
  function headband(ctx, x, y, s, t) { ctx.fillStyle = '#dc2626'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.beginPath(); rr(ctx, x - s * 0.32, y - s * 0.04, s * 0.64, s * 0.08, s * 0.03); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + s * 0.3, y); ctx.quadraticCurveTo(x + s * 0.45, y + s * 0.05 + Math.sin(t * 6) * s * 0.03, x + s * 0.5, y + s * 0.18); ctx.lineTo(x + s * 0.44, y + s * 0.2); ctx.quadraticCurveTo(x + s * 0.4, y + s * 0.08, x + s * 0.3, y + s * 0.06); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function crown(ctx, x, y, s) { ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(x - s * 0.22, y); ctx.lineTo(x - s * 0.24, y - s * 0.2); ctx.lineTo(x - s * 0.11, y - s * 0.1); ctx.lineTo(x, y - s * 0.26); ctx.lineTo(x + s * 0.11, y - s * 0.1); ctx.lineTo(x + s * 0.24, y - s * 0.2); ctx.lineTo(x + s * 0.22, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y - s * 0.07, s * 0.03, 0, TAU); ctx.fill(); ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(x - s * 0.13, y - s * 0.06, s * 0.025, 0, TAU); ctx.arc(x + s * 0.13, y - s * 0.06, s * 0.025, 0, TAU); ctx.fill(); }
  function sunglasses(ctx, x, y, s) { ctx.fillStyle = '#111827'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.025; for (const sx of [-1, 1]) { ctx.beginPath(); rr(ctx, x + sx * s * 0.12 - s * 0.1, y - s * 0.06, s * 0.2, s * 0.12, s * 0.04); ctx.fill(); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x - s * 0.02, y); ctx.lineTo(x + s * 0.02, y); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(x - s * 0.15, y - s * 0.03, s * 0.04, s * 0.015, -0.5, 0, TAU); ctx.fill(); }
  function santaHat(ctx, x, y, s, t) { ctx.fillStyle = '#dc2626'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y); ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.4, x + s * 0.28, y - s * 0.46 + Math.sin(t * 3) * s * 0.02); ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.2, x + s * 0.3, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); rr(ctx, x - s * 0.34, y - s * 0.06, s * 0.68, s * 0.1, s * 0.05); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x + s * 0.3, y - s * 0.46 + Math.sin(t * 3) * s * 0.02, s * 0.06, 0, TAU); ctx.fill(); ctx.stroke(); }
  function snow(ctx, s, t) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 6; i += 1) { const k = ((t * 0.4 + i * 0.17) % 1); ctx.beginPath(); ctx.arc(Math.sin(i * 2.1 + t) * s * 0.4, -s * 0.5 + k * s, s * 0.02, 0, TAU); ctx.fill(); } }
  function bubbles(ctx, s, t) { ctx.strokeStyle = 'rgba(190,242,100,0.9)'; ctx.lineWidth = s * 0.02; for (let i = 0; i < 4; i += 1) { const k = ((t * 0.6 + i * 0.25) % 1); ctx.beginPath(); ctx.arc(Math.sin(i * 1.9) * s * 0.25, s * 0.3 - k * s * 0.7, s * 0.03 + k * s * 0.03, 0, TAU); ctx.stroke(); } }
  function circuits(ctx, s, t) { ctx.save(); ctx.strokeStyle = `rgba(34,211,238,${0.5 + 0.5 * Math.sin(t * 5)})`; ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.15); ctx.lineTo(-s * 0.05, -s * 0.15); ctx.lineTo(-s * 0.05, s * 0.05); ctx.lineTo(s * 0.12, s * 0.05); ctx.moveTo(s * 0.05, -s * 0.22); ctx.lineTo(s * 0.18, -s * 0.22); ctx.lineTo(s * 0.18, -s * 0.02); ctx.stroke(); ctx.fillStyle = '#22d3ee'; for (const [x, y] of [[-s * 0.2, -s * 0.15], [s * 0.12, s * 0.05], [s * 0.05, -s * 0.22]]) { ctx.beginPath(); ctx.arc(x, y, s * 0.025, 0, TAU); ctx.fill(); } ctx.restore(); }

  function accessories(ctx, ogId, theme, s, t, C, top) {
    // top : y du sommet du corps (pour poser un chapeau). Accessoires génériques, valables pour toutes les créatures.
    switch (theme) {
      case 'robot': antenna(ctx, 0, top + s * 0.02, s, t); break;
      case 'ice': frost(ctx, 0, top + s * 0.44, s, t); break;
      case 'gold': sparkles(ctx, s, t, '#fffbeb'); break;
      case 'pirate': hatPirate(ctx, 0, top + s * 0.02, s); eyePatch(ctx, s * 0.1, top + s * 0.3, s); break;
      case 'astro': helmet(ctx, 0, top + s * 0.4, s, t); antenna(ctx, s * 0.3, top + s * 0.1, s, t); break;
      case 'candy': sprinkles(ctx, s, t); break;
      case 'lava': cracks(ctx, s, t); break;
      case 'ninja': headband(ctx, 0, top + s * 0.14, s, t); break;
      case 'royal': crown(ctx, 0, top + s * 0.03, s); break;
      case 'summer': sunglasses(ctx, 0, top + s * 0.3, s); break;
      case 'xmas': santaHat(ctx, 0, top + s * 0.04, s, t); snow(ctx, s, t); break;
      case 'toxic': bubbles(ctx, s, t); break;
      case 'cyber': circuits(ctx, s, t); break;
      default: break;
    }
  }

  // ----- Les 7 créatures -----
  // Chaque drawer reçoit (ctx, s, t, st, C, theme) et dessine centré en 0,0, face vers -y.

  function drawZip(ctx, s, t, st, C, theme) {
    // Zip est une limace-mille-pattes : corps mou qui ondule, antennes à yeux, une frange de petites pattes qui font la vague.
    const run = st.moving ? 1 : 0;
    const ph = t * (run ? 10 : 2) + st.phase;
    const sq = run ? 0.06 * Math.sin(ph) : 0.02 * Math.sin(ph);
    const wob = run ? Math.sin(ph * 0.5) * 0.05 : 0;
    // Traînée de bave quand il avance.
    if (run) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = theme === 'halloween' ? '#86efac' : '#bae6fd'; for (let i = 0; i < 3; i += 1) { const k = ((t * 1.5 + i * 0.33) % 1); ctx.beginPath(); ctx.ellipse((Math.sin(i * 2.3) * s * 0.1), s * 0.48 + k * s * 0.35, s * 0.1 * (1 - k * 0.5), s * 0.045, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
    ctx.save(); ctx.rotate(wob); ctx.scale(1 - sq, 1 + sq);
    // Petites pattes : 6 de chaque côté, qui ondulent en vague (mille-pattes).
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i += 1) {
      const y = -s * 0.22 + i * s * 0.11;
      const wave = run ? Math.sin(ph * 1.6 - i * 0.9) : Math.sin(t * 1.5 - i * 0.9) * 0.3;
      const x0 = sx * s * 0.26, x1 = sx * (s * 0.36 + Math.max(0, wave) * s * 0.04);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + wave * s * 0.05); ctx.stroke();
      ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(x1, y + wave * s * 0.05, s * 0.03, 0, TAU); ctx.fill();
    }
    // Corps de limace : goutte allongée, large en bas.
    const bodyPath = () => { ctx.moveTo(0, -s * 0.44); ctx.quadraticCurveTo(s * 0.3, -s * 0.44, s * 0.28, -s * 0.05); ctx.quadraticCurveTo(s * 0.27, s * 0.46, 0, s * 0.46); ctx.quadraticCurveTo(-s * 0.27, s * 0.46, -s * 0.28, -s * 0.05); ctx.quadraticCurveTo(-s * 0.3, -s * 0.44, 0, -s * 0.44); ctx.closePath(); };
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
    // Taches / côtes.
    ctx.save(); ctx.beginPath(); bodyPath(); ctx.clip();
    if (theme === 'halloween') { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = s * 0.03; for (const sx of [-0.14, 0, 0.14]) { ctx.beginPath(); ctx.moveTo(sx * s, -s * 0.44); ctx.quadraticCurveTo(sx * s * 1.4, 0, sx * s, s * 0.46); ctx.stroke(); } }
    else { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.ellipse(Math.sin(i * 2.7) * s * 0.12, s * 0.05 + i * s * 0.1, s * 0.05, s * 0.03, 0, 0, TAU); ctx.fill(); } }
    ctx.restore();
    shine(ctx, s * 0.12, s * 0.15, s * 0.05, s * 0.12);
    // Antennes à yeux (tentacules oculaires) qui se balancent.
    const sway = run ? Math.sin(ph * 0.8) * 0.25 : Math.sin(t * 1.2 + st.phase) * 0.1;
    for (const sx of [-1, 1]) {
      const bx = sx * s * 0.12, by = -s * 0.38, tx = sx * s * 0.2 + sway * s * 0.1, ty = -s * 0.62 + Math.abs(sway) * s * 0.05;
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + (tx - bx) * 0.3, by - s * 0.15, tx, ty); ctx.stroke();
      ctx.strokeStyle = C.base; ctx.lineWidth = s * 0.05; ctx.stroke();
      if (theme === 'halloween') { ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(tx, ty, s * 0.07, 0, TAU); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.stroke(); }
      else eye(ctx, tx, ty, s * 0.065, s * 0.075, t, st.phase, { theme, white: theme !== 'ghost' && theme !== 'robot', pupil: OUTLINE, lookY: run ? -0.5 : 0 });
    }
    // Bouche
    if (theme === 'halloween') pumpkinFace(ctx, 0, -s * 0.02, s, t);
    else mouth(ctx, 0, -s * 0.12, s * 0.18, run ? 'o' : 'smile', t);
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.4, s * 0.52, s, t, C);
    accessories(ctx, 1, theme, s, t, C, -s * 0.44);
    ctx.restore();
    if (run) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = s * 0.03; for (let i = 0; i < 2; i += 1) { const y = s * 0.1 + i * s * 0.14, off = ((t * 3 + i * 0.5) % 1) * s * 0.25; ctx.beginPath(); ctx.moveTo(-s * 0.45 - off, y); ctx.lineTo(-s * 0.35 - off, y); ctx.moveTo(s * 0.45 + off, y); ctx.lineTo(s * 0.35 + off, y); ctx.stroke(); } }
  }

  function drawGromp(ctx, s, t, st, C, theme) {
    const walk = st.moving ? 1 : 0;
    const ph = t * 9 + st.phase;
    const rock = walk ? Math.sin(ph) * 0.06 : Math.sin(t * 1.5 + st.phase) * 0.02;
    const facing = st.vx < 0 ? -1 : 1; // griffes du côté du déplacement
    ctx.save(); ctx.rotate(rock); ctx.scale(facing, 1);
    if (theme === 'halloween') cape(ctx, s, t);
    // Pattes courtes
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.07;
    for (let i = 0; i < 3; i += 1) {
      const x = -s * 0.25 + i * s * 0.25, lift = walk ? Math.max(0, Math.sin(ph + i * 2.1)) * s * 0.06 : 0;
      ctx.beginPath(); ctx.moveTo(x, s * 0.25); ctx.lineTo(x, s * 0.42 - lift); ctx.stroke();
    }
    // Griffes (côté avant), ciseaux en marchant
    const snap = walk ? (Math.sin(ph * 1.5) + 1) * 0.12 : 0.05;
    for (const sy of [-1, 1]) {
      ctx.save(); ctx.translate(s * 0.36, sy * s * 0.14); ctx.rotate(sy * snap);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.06); ctx.lineTo(s * 0.22, sy * s * 0.05 - s * 0.04); ctx.lineTo(s * 0.1, sy * s * 0.02 + s * 0.06); ctx.closePath(); paint(ctx, C, s, theme);
      ctx.restore();
    }
    // Pointes du dos
    for (let i = 0; i < 3; i += 1) { const x = -s * 0.3 + i * s * 0.2; ctx.beginPath(); ctx.moveTo(x - s * 0.07, -s * 0.3); ctx.lineTo(x, -s * 0.48); ctx.lineTo(x + s * 0.07, -s * 0.3); ctx.closePath(); paint(ctx, C, s, theme); }
    // Corps trapu
    const bodyPath = () => rr(ctx, -s * 0.44, -s * 0.34, s * 0.84, s * 0.62, s * 0.22);
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
    shine(ctx, -s * 0.22, -s * 0.18, s * 0.08, s * 0.04);
    ctx.scale(facing, 1); // visage non retourné
    // Visage grognon
    eye(ctx, -s * 0.12, -s * 0.08, s * 0.055, s * 0.07, t, st.phase, { theme, angry: theme !== 'ghost', angrySide: 1 });
    eye(ctx, s * 0.12, -s * 0.08, s * 0.055, s * 0.07, t, st.phase, { theme, angry: theme !== 'ghost', angrySide: -1 });
    mouth(ctx, 0, s * 0.12, s * 0.26, theme === 'halloween' ? 'grin' : 'zigzag', t);
    if (theme === 'halloween') fangs(ctx, 0, s * 0.12, s * 0.3);
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.28, s * 0.84, s, t, C);
    accessories(ctx, 2, theme, s, t, C, -s * 0.34);
    ctx.restore();
  }

  function drawKrak(ctx, s, t, st, C, theme) {
    const breathe = 1 + 0.025 * Math.sin(t * 2.5 + st.phase);
    const recoil = st.shoot || 0;
    // Socle de pierre (une tourelle ne bouge pas : pas de pieds).
    ctx.fillStyle = '#475569'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.4, s * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.ellipse(0, s * 0.39, s * 0.36, s * 0.07, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.scale(breathe * (1 - 0.1 * recoil), breathe * (1 + 0.16 * recoil));
    // Corps marmite
    const bodyPath = () => { ctx.moveTo(-s * 0.36, -s * 0.05); ctx.quadraticCurveTo(-s * 0.46, s * 0.42, 0, s * 0.42); ctx.quadraticCurveTo(s * 0.46, s * 0.42, s * 0.36, -s * 0.05); ctx.quadraticCurveTo(s * 0.2, -s * 0.2, 0, -s * 0.2); ctx.quadraticCurveTo(-s * 0.2, -s * 0.2, -s * 0.36, -s * 0.05); ctx.closePath(); };
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
    // Rivets autour de la marmite.
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 5; i += 1) { const a2 = Math.PI * 0.15 + i * Math.PI * 0.175; ctx.beginPath(); ctx.arc(Math.cos(a2) * s * 0.38, s * 0.02 + Math.sin(a2) * s * 0.34, s * 0.025, 0, TAU); ctx.fill(); }
    shine(ctx, -s * 0.18, s * 0.05, s * 0.06, s * 0.12);
    // Canon orienté (st.rot = angle écran, 0 = droite ; -PI/2 = haut)
    const aim = (st.rot !== undefined ? st.rot : -Math.PI / 2);
    ctx.save(); ctx.translate(0, -s * 0.1); ctx.rotate(aim + Math.PI / 2);
    const len = s * 0.36 * (1 - 0.25 * recoil);
    ctx.beginPath(); rr(ctx, -s * 0.14, -len, s * 0.28, len + s * 0.05, s * 0.06); paint(ctx, C, s, theme, 0, -len / 2);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(0, -len, s * 0.1, s * 0.05, 0, 0, TAU); ctx.fill();
    if (recoil > 0.2) { ctx.fillStyle = `rgba(254,240,138,${recoil})`; ctx.beginPath(); ctx.arc(0, -len - s * 0.06, s * 0.14 * recoil, 0, TAU); ctx.fill(); }
    ctx.restore();
    // Visage
    eye(ctx, -s * 0.13, s * 0.12, s * 0.05, s * 0.07, t, st.phase, { theme });
    eye(ctx, s * 0.13, s * 0.12, s * 0.05, s * 0.07, t, st.phase, { theme });
    mouth(ctx, 0, s * 0.27, s * 0.18, recoil > 0.3 ? 'o' : 'smile', t);
    if (theme === 'halloween') hatWitch(ctx, 0, -s * 0.2, s, C);
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.4, s * 0.7, s, t, C);
    accessories(ctx, 3, theme, s, t, C, -s * 0.46);
    ctx.restore();
  }

  function drawRiko(ctx, s, t, st, C, theme) {
    const pulse = 1 + 0.05 * Math.sin(t * 6 + st.phase);
    ctx.save(); ctx.rotate(st.rot || 0); ctx.scale(pulse, pulse);
    const starPath = (R, r) => { ctx.moveTo(0, -R); for (let i = 1; i < 10; i += 1) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); };
    ctx.beginPath(); starPath(s * 0.5, s * 0.25); paint(ctx, C, s, theme, 0, 0);
    if (theme === 'halloween') bandages(ctx, () => starPath(s * 0.5, s * 0.25), s);
    shine(ctx, -s * 0.12, -s * 0.12, s * 0.05, s * 0.09);
    ctx.restore();
    // Visage droit (ne tourne pas avec l'étoile)
    const dizzy = Math.abs(st.rot || 0) > 0 && st.moving;
    eye(ctx, -s * 0.1, -s * 0.04, s * 0.05, s * 0.075, t, st.phase, { theme, lookX: dizzy ? Math.sin(t * 8) * 0.8 : 0 });
    eye(ctx, s * 0.1, -s * 0.04, s * 0.05, s * 0.075, t, st.phase, { theme, lookX: dizzy ? Math.sin(t * 8 + 1) * 0.8 : 0 });
    mouth(ctx, 0, s * 0.12, s * 0.18, dizzy ? 'o' : 'smile', t);
    if (theme === 'halloween') { ctx.strokeStyle = C.dark; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.16); ctx.lineTo(s * 0.22, -s * 0.1); ctx.stroke(); }
    accessories(ctx, 4, theme, s, t, C, -s * 0.5);
  }

  function drawBlok(ctx, s, t, st, C, theme) {
    const hp = st.hpRatio === undefined ? 1 : st.hpRatio;
    const shake = st.hit ? (Math.random() - 0.5) * s * 0.06 * st.hit : 0;
    ctx.save(); ctx.translate(shake, 0);
    const bodyPath = () => rr(ctx, -s * 0.44, -s * 0.44, s * 0.88, s * 0.88, s * 0.14);
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
    // Rivets / bords
    ctx.save(); ctx.beginPath(); bodyPath(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = s * 0.05; ctx.beginPath(); rr(ctx, -s * 0.36, -s * 0.36, s * 0.72, s * 0.72, s * 0.08); ctx.stroke();
    // Fissures selon les PV
    if (hp < 1) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(-s * 0.44, -s * 0.3); ctx.lineTo(-s * 0.2, -s * 0.15); ctx.lineTo(-s * 0.3, s * 0.02); ctx.stroke(); }
    if (hp < 0.5) { ctx.beginPath(); ctx.moveTo(s * 0.44, s * 0.1); ctx.lineTo(s * 0.18, s * 0.2); ctx.lineTo(s * 0.3, s * 0.44); ctx.moveTo(s * 0.1, -s * 0.44); ctx.lineTo(s * 0.02, -s * 0.25); ctx.stroke(); }
    ctx.restore();
    shine(ctx, -s * 0.24, -s * 0.26, s * 0.08, s * 0.04);
    // Grille / dents
    ctx.fillStyle = OUTLINE; ctx.beginPath(); rr(ctx, -s * 0.3, s * 0.02, s * 0.6, s * 0.22, s * 0.06); ctx.fill();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i += 1) { ctx.fillRect(-s * 0.25 + i * s * 0.13, s * 0.05, s * 0.09, s * 0.08); }
    const sleepy = !st.hit && Math.sin(t * 0.7 + st.phase) > 0.95;
    eye(ctx, -s * 0.16, -s * 0.16, s * 0.055, sleepy ? s * 0.02 : s * 0.06, t, st.phase, { theme, angry: theme !== 'ghost', angrySide: 1 });
    eye(ctx, s * 0.16, -s * 0.16, s * 0.055, sleepy ? s * 0.02 : s * 0.06, t, st.phase, { theme, angry: theme !== 'ghost', angrySide: -1 });
    if (theme === 'halloween') { bolts(ctx, 0, s * 0.1, s); stitches(ctx, s * 0.2, -s * 0.34, s, 0.3); ctx.fillStyle = '#1f2937'; ctx.fillRect(-s * 0.44, -s * 0.44, s * 0.88, s * 0.1); }
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.42, s * 0.88, s, t, C);
    accessories(ctx, 5, theme, s, t, C, -s * 0.44);
    ctx.restore();
  }

  function drawMojo(ctx, s, t, st, C, theme) {
    const breathe = 1 + 0.05 * Math.sin(t * 3 + st.phase);
    // Étincelles de mana en orbite
    ctx.fillStyle = theme === 'halloween' ? '#bef264' : '#bbf7d0';
    for (let i = 0; i < 3; i += 1) { const a = t * 2.2 + i * 2.09, r = s * 0.5 + Math.sin(t * 4 + i) * s * 0.04; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.5 - s * 0.05, s * 0.04, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.scale(breathe, breathe);
    ctx.beginPath(); const a = s * 0.16, b = s * 0.46, r = s * 0.1;
    ctx.moveTo(-a, -b + r); ctx.arcTo(-a, -b, -a + r, -b, r); ctx.lineTo(a - r, -b); ctx.arcTo(a, -b, a, -b + r, r); ctx.lineTo(a, -a); ctx.lineTo(b - r, -a); ctx.arcTo(b, -a, b, -a + r, r); ctx.lineTo(b, a - r); ctx.arcTo(b, a, b - r, a, r); ctx.lineTo(a, a); ctx.lineTo(a, b - r); ctx.arcTo(a, b, a - r, b, r); ctx.lineTo(-a + r, b); ctx.arcTo(-a, b, -a, b - r, r); ctx.lineTo(-a, a); ctx.lineTo(-b + r, a); ctx.arcTo(-b, a, -b, a - r, r); ctx.lineTo(-b, -a + r); ctx.arcTo(-b, -a, -b + r, -a, r); ctx.lineTo(-a, -a); ctx.closePath();
    paint(ctx, C, s, theme, 0, 0);
    shine(ctx, -s * 0.07, -s * 0.32, s * 0.04, s * 0.08);
    // Visage au centre
    if (theme === 'halloween') { // zombie : un œil en X, l'autre pendouille
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.1); ctx.lineTo(-s * 0.05, 0); ctx.moveTo(-s * 0.05, -s * 0.1); ctx.lineTo(-s * 0.15, 0); ctx.stroke();
      eye(ctx, s * 0.1, -s * 0.02 + Math.sin(t * 3) * s * 0.02, s * 0.06, s * 0.07, t, st.phase, { white: true, pupil: '#dc2626', lookY: 0.6 });
      stitches(ctx, 0, s * 0.3, s, 0.2); mouth(ctx, 0, s * 0.12, s * 0.2, 'frown', t);
    } else {
      eye(ctx, -s * 0.09, -s * 0.04, s * 0.045, s * 0.07, t, st.phase, { theme });
      eye(ctx, s * 0.09, -s * 0.04, s * 0.045, s * 0.07, t, st.phase, { theme });
      mouth(ctx, 0, s * 0.1, s * 0.16, 'smile', t);
    }
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.42, s * 0.32, s, t, C);
    accessories(ctx, 6, theme, s, t, C, -s * 0.46);
    ctx.restore();
  }

  function drawZephir(ctx, s, t, st, C, theme) {
    // Zéphir est une tourelle volante : une petite marmite blindée portée par deux ailes, avec un canon qui vise.
    const ph = t * 14 + st.phase;
    const flap = Math.sin(ph);
    const hover = Math.sin(t * 4 + st.phase) * s * 0.05;
    const recoil = st.shoot || 0;
    ctx.save(); ctx.translate(0, hover);
    // Réacteur / fumée sous la tourelle.
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#e2e8f0'; for (let i = 0; i < 3; i += 1) { const k = ((t * 1.8 + i * 0.33) % 1); ctx.beginPath(); ctx.arc(Math.sin(i * 2) * s * 0.06, s * 0.38 + k * s * 0.25, s * 0.07 * (1 - k * 0.6), 0, TAU); ctx.fill(); } ctx.restore();
    // Ailes (battement), attachées au corps.
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.translate(sx * s * 0.26, s * 0.02); ctx.scale(sx, 1); ctx.rotate(-0.15 + flap * 0.4);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.6, -s * 0.36); ctx.quadraticCurveTo(s * 0.48, -s * 0.12, s * 0.56, s * 0.02); ctx.quadraticCurveTo(s * 0.38, -s * 0.02, s * 0.4, s * 0.16); ctx.quadraticCurveTo(s * 0.2, s * 0.06, 0, s * 0.12); ctx.closePath();
      const wingC = theme === 'default' ? { base: '#f59e0b', light: '#fde68a', dark: '#b45309' } : C;
      paint(ctx, wingC, s, theme, s * 0.3, -s * 0.2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = s * 0.025; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.48, -s * 0.28); ctx.moveTo(0, 0); ctx.lineTo(s * 0.46, -s * 0.04); ctx.stroke();
      ctx.restore();
    }
    if (theme === 'halloween') batEars(ctx, s, C);
    // Corps : marmite blindée (plus petite que Krak), avec un hublot.
    ctx.save(); ctx.scale(1 - 0.08 * recoil, 1 + 0.12 * recoil);
    const bodyPath = () => { ctx.moveTo(-s * 0.3, -s * 0.02); ctx.quadraticCurveTo(-s * 0.38, s * 0.36, 0, s * 0.36); ctx.quadraticCurveTo(s * 0.38, s * 0.36, s * 0.3, -s * 0.02); ctx.quadraticCurveTo(s * 0.16, -s * 0.14, 0, -s * 0.14); ctx.quadraticCurveTo(-s * 0.16, -s * 0.14, -s * 0.3, -s * 0.02); ctx.closePath(); };
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
    // Bandes de blindage.
    ctx.save(); ctx.beginPath(); bodyPath(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.2); ctx.lineTo(s * 0.4, s * 0.2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * s * 0.2, s * 0.24, s * 0.025, 0, TAU); ctx.fill(); }
    shine(ctx, -s * 0.14, s * 0.06, s * 0.05, s * 0.09);
    ctx.restore();
    // Canon orienté (vise la cible ; neutre = vers l'avant).
    const aim = (st.rot !== undefined ? st.rot : -Math.PI / 2);
    ctx.save(); ctx.translate(0, -s * 0.06); ctx.rotate(aim + Math.PI / 2);
    const len = s * 0.34 * (1 - 0.25 * recoil);
    ctx.beginPath(); rr(ctx, -s * 0.11, -len, s * 0.22, len + s * 0.04, s * 0.05); paint(ctx, C, s, theme, 0, -len / 2);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(0, -len, s * 0.08, s * 0.04, 0, 0, TAU); ctx.fill();
    // Lueur de charge dans le canon.
    const glow = recoil > 0 ? recoil : 0.3 + 0.2 * Math.sin(t * 6);
    ctx.fillStyle = theme === 'halloween' ? `rgba(248,113,113,${glow})` : `rgba(254,240,138,${glow})`; ctx.beginPath(); ctx.arc(0, -len, s * 0.045, 0, TAU); ctx.fill();
    if (recoil > 0.2) { ctx.fillStyle = `rgba(254,240,138,${recoil})`; ctx.beginPath(); ctx.arc(0, -len - s * 0.06, s * 0.13 * recoil, 0, TAU); ctx.fill(); }
    ctx.restore();
    // Visage sur le flanc de la marmite.
    const evil = theme === 'halloween';
    eye(ctx, -s * 0.1, s * 0.1, s * 0.045, s * 0.06, t, st.phase, evil ? { white: true, pupil: '#dc2626', lookY: 0.2 } : { theme });
    eye(ctx, s * 0.1, s * 0.1, s * 0.045, s * 0.06, t, st.phase, evil ? { white: true, pupil: '#dc2626', lookY: 0.2 } : { theme });
    mouth(ctx, 0, s * 0.22, s * 0.14, recoil > 0.3 ? 'o' : evil ? 'grin' : 'smile', t);
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.34, s * 0.5, s, t, C);
    accessories(ctx, 7, theme, s, t, C, -s * 0.4);
    ctx.restore();
  }

  // ----- Les 10 nouvelles créatures -----
  function drawPik(ctx, s, t, st, C, theme) {
    // Hérisson à ressort : boule de piquants qui se hérissent en marchant, petites pattes, museau pointu.
    const run = st.moving ? 1 : 0, ph = t * (run ? 9 : 2) + st.phase;
    const bob = run ? Math.abs(Math.sin(ph)) * s * 0.04 : 0;
    ctx.save(); ctx.translate(0, -bob);
    // pattes
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { const k = Math.sin(ph + (sx > 0 ? 0 : Math.PI)) * run; ctx.beginPath(); ctx.moveTo(sx * s * 0.18, s * 0.3); ctx.lineTo(sx * s * 0.22 + k * s * 0.08, s * 0.46); ctx.stroke(); }
    // piquants
    const n = 14, bristle = run ? 0.5 + 0.5 * Math.sin(ph * 2) : 0.2 + 0.1 * Math.sin(t * 2);
    ctx.fillStyle = C.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03;
    for (let i = 0; i < n; i += 1) { const a = -Math.PI * 1.05 + (i / (n - 1)) * Math.PI * 1.1, L = s * (0.46 + bristle * 0.12 + 0.04 * Math.sin(i * 1.7 + t * 3)); ctx.beginPath(); ctx.moveTo(Math.cos(a + 0.12) * s * 0.3, Math.sin(a + 0.12) * s * 0.3); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a - 0.12) * s * 0.3, Math.sin(a - 0.12) * s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // corps
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.34, s * 0.3, 0, 0, TAU); paint(ctx, C, s, theme, 0, 0);
    shine(ctx, -s * 0.12, -s * 0.08, s * 0.08, s * 0.05);
    // museau clair en bas du visage, truffe au bout
    ctx.fillStyle = C.light; ctx.beginPath(); ctx.ellipse(0, s * 0.14, s * 0.14, s * 0.1, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.05, s * 0.035, 0, 0, TAU); ctx.fill();
    eye(ctx, -s * 0.13, -s * 0.04, s * 0.055, s * 0.07, t, st.phase, { theme }); eye(ctx, s * 0.13, -s * 0.04, s * 0.055, s * 0.07, t, st.phase + 1, { theme });
    mouth(ctx, 0, s * 0.2, s * 0.12, 'smile', t);
    ctx.restore();
  }
  function drawBulle(ctx, s, t, st, C, theme) {
    // Bulle de soin : sphère translucide qui ondule, visage serein, petites bulles satellites.
    const w = Math.sin(t * 3 + st.phase) * 0.06;
    ctx.save(); ctx.scale(1 + w, 1 - w);
    ctx.globalAlpha *= 0.85;
    const g = ctx.createRadialGradient(-s * 0.15, -s * 0.15, s * 0.05, 0, 0, s * 0.45); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, C.base + 'cc'); g.addColorStop(1, C.dark + 'aa');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.045; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    ctx.globalAlpha = 1;
    eye(ctx, -s * 0.12, -s * 0.02, s * 0.05, s * 0.07, t, st.phase, { theme }); eye(ctx, s * 0.12, -s * 0.02, s * 0.05, s * 0.07, t, st.phase + 2, { theme });
    mouth(ctx, 0, s * 0.14, s * 0.14, 'smile', t);
    // croix de soin rose sur le ventre
    ctx.fillStyle = '#fb7185'; ctx.fillRect(-s * 0.03, s * 0.18, s * 0.06, s * 0.16); ctx.fillRect(-s * 0.08, s * 0.23, s * 0.16, s * 0.06);
    ctx.restore();
    for (let i = 0; i < 3; i += 1) { const k = (t * 0.6 + i * 0.33 + st.phase) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.arc(s * (0.3 + i * 0.1) * Math.sin(i * 2), s * 0.3 - k * s * 0.6, s * 0.05, 0, TAU); ctx.stroke(); }
  }
  function drawZazou(ctx, s, t, st, C, theme) {
    // Moustique : corps fin rayé, ailes qui vrombissent, trompe, grands yeux.
    const buzz = Math.sin(t * 60 + st.phase);
    ctx.save(); ctx.translate(Math.sin(t * 17) * s * 0.01, Math.cos(t * 13) * s * 0.01);
    // ailes
    ctx.fillStyle = 'rgba(224,242,254,0.55)'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.025;
    for (const sx of [-1, 1]) { ctx.save(); ctx.rotate(sx * (0.5 + buzz * 0.35)); ctx.beginPath(); ctx.ellipse(sx * s * 0.28, -s * 0.05, s * 0.3, s * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // pattes
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; for (const sx of [-1, 1]) for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(sx * s * 0.08, s * (0.05 + i * 0.08)); ctx.lineTo(sx * s * 0.3, s * (0.15 + i * 0.1) + Math.sin(t * 20 + i) * s * 0.02); ctx.stroke(); }
    // abdomen rayé
    ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.11, s * 0.28, 0, 0, TAU); paint(ctx, C, s, theme, 0, s * 0.18);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.11, s * 0.28, 0, 0, TAU); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i += 1) ctx.fillRect(-s * 0.2, s * (0.02 + i * 0.12), s * 0.4, s * 0.05); ctx.restore();
    // thorax + tête
    ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.13, 0, TAU); paint(ctx, C, s, theme, 0, -s * 0.08);
    ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.15, 0, TAU); paint(ctx, C, s, theme, 0, -s * 0.3);
    eye(ctx, -s * 0.07, -s * 0.32, s * 0.06, s * 0.07, t, st.phase, { theme, white: true, pupil: '#991b1b' }); eye(ctx, s * 0.07, -s * 0.32, s * 0.06, s * 0.07, t, st.phase + 1, { theme, white: true, pupil: '#991b1b' });
    // trompe
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, -s * 0.66); ctx.stroke();
    ctx.restore();
  }
  function drawBoum(ctx, s, t, st, C, theme) {
    // Mine : sphère sombre à nubs, voyant rouge qui clignote, à demi enfouie (ombre).
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.4, s * 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04;
    for (let i = 0; i < 8; i += 1) { const a = i / 8 * TAU + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36 * 0.9, s * 0.07, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.33, s * 0.3, 0, 0, TAU); paint(ctx, C, s, theme, 0, 0);
    shine(ctx, -s * 0.12, -s * 0.12, s * 0.07, s * 0.04, 0.3);
    const on = Math.sin(t * 6 + st.phase) > 0.3;
    ctx.fillStyle = on ? '#ff3b5c' : '#5b1020'; ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.08, 0, TAU); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.stroke();
    if (on) { ctx.fillStyle = 'rgba(255,59,92,0.35)'; ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.16, 0, TAU); ctx.fill(); }
    // petit sourire sournois
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.1, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
  }
  function drawRafale(ctx, s, t, st, C, theme) {
    // Ventilo : socle, cage ronde, pales qui tournent, souffle vers l'avant (haut).
    ctx.save();
    const spin = t * 14 + st.phase;
    // souffle
    ctx.strokeStyle = 'rgba(219,234,254,0.5)'; ctx.lineWidth = s * 0.03; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) { const k = (t * 1.6 + i * 0.33) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.moveTo(-s * 0.2 + Math.sin(i * 2 + t * 5) * s * 0.05, -s * 0.5 - k * s * 0.45); ctx.lineTo(s * 0.2 + Math.sin(i * 2 + t * 5) * s * 0.05, -s * 0.5 - k * s * 0.45); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // socle
    ctx.fillStyle = C.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04; ctx.beginPath(); rr(ctx, -s * 0.22, s * 0.22, s * 0.44, s * 0.2, s * 0.05); ctx.fill(); ctx.stroke();
    ctx.fillRect(-s * 0.05, s * 0.05, s * 0.1, s * 0.2);
    // cage
    ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.36, 0, TAU); paint(ctx, C, s, theme, 0, -s * 0.08);
    ctx.fillStyle = '#0b1b33'; ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.29, 0, TAU); ctx.fill();
    // pales
    ctx.save(); ctx.translate(0, -s * 0.08); ctx.rotate(spin); ctx.fillStyle = C.light; ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i += 1) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.22, -s * 0.05, s * 0.27, s * 0.08); ctx.quadraticCurveTo(s * 0.12, s * 0.1, 0, 0); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(219,234,254,0.5)'; ctx.lineWidth = s * 0.02; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(-s * 0.29, -s * 0.08 + (i - 1.5) * s * 0.13); ctx.lineTo(s * 0.29, -s * 0.08 + (i - 1.5) * s * 0.13); ctx.stroke(); }
    ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.06, 0, TAU); ctx.fill();
    eye(ctx, -s * 0.1, s * 0.3, s * 0.035, s * 0.045, t, st.phase, { theme, white: true }); eye(ctx, s * 0.1, s * 0.3, s * 0.035, s * 0.045, t, st.phase + 1, { theme, white: true });
    ctx.restore();
  }
  function drawTiktak(ctx, s, t, st, C, theme) {
    // Bombe à retardement : boule noire avec cadran, mèche qui crépite, petites jambes pressées.
    const run = st.moving ? 1 : 0, ph = t * (run ? 8 : 2) + st.phase;
    const tick = Math.floor(t * 2) % 2 ? 1 : -1;
    ctx.save(); ctx.scale(1 + 0.03 * Math.sin(t * 12), 1 - 0.03 * Math.sin(t * 12));
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { const k = Math.sin(ph + (sx > 0 ? 0 : Math.PI)) * run; ctx.beginPath(); ctx.moveTo(sx * s * 0.14, s * 0.3); ctx.lineTo(sx * s * 0.18 + k * s * 0.1, s * 0.47); ctx.stroke(); }
    // mèche
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = s * 0.045; ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.34); ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.14, -s * 0.6); ctx.stroke();
    const spark = 0.7 + 0.3 * Math.sin(t * 25); ctx.fillStyle = `rgba(255,214,77,${spark})`; ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.6, s * 0.06 * spark, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.6, s * 0.025, 0, TAU); ctx.fill();
    ctx.fillStyle = C.light; ctx.fillRect(-s * 0.02, -s * 0.4, s * 0.12, s * 0.07);
    // corps
    ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); paint(ctx, C, s, theme, 0, 0);
    shine(ctx, -s * 0.14, -s * 0.14, s * 0.09, s * 0.05, 0.35);
    // cadran
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.17, 0, TAU); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03; ctx.stroke();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(0, s * 0.02); ctx.lineTo(tick * s * 0.1, -s * 0.06); ctx.stroke();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.025; ctx.beginPath(); ctx.moveTo(0, s * 0.02); ctx.lineTo(Math.sin(t * 2) * s * 0.11, s * 0.02 - Math.cos(t * 2) * s * 0.11); ctx.stroke();
    eye(ctx, -s * 0.14, -s * 0.18, s * 0.05, s * 0.06, t, st.phase, { theme, white: true, angry: true, browColor: '#fff' }); eye(ctx, s * 0.14, -s * 0.18, s * 0.05, s * 0.06, t, st.phase + 1, { theme, white: true, angry: true, angrySide: -1, browColor: '#fff' });
    ctx.restore();
  }
  function drawFantome(ctx, s, t, st, C, theme) {
    // Spectre : drap qui flotte, bas ondulé, yeux creux ; légèrement transparent et scintillant.
    const fl = 0.7 + 0.2 * Math.sin(t * 9 + st.phase);
    ctx.save(); ctx.globalAlpha *= fl; ctx.translate(0, Math.sin(t * 2.5 + st.phase) * s * 0.04);
    const body = () => { ctx.moveTo(-s * 0.34, s * 0.4); ctx.lineTo(-s * 0.34, -s * 0.1); ctx.arc(0, -s * 0.1, s * 0.34, Math.PI, TAU); ctx.lineTo(s * 0.34, s * 0.4); for (let i = 0; i < 5; i += 1) { const x = s * 0.34 - (i + 1) * s * 0.136; ctx.quadraticCurveTo(x + s * 0.068, s * 0.4 + (i % 2 ? -1 : 1) * s * (0.08 + 0.04 * Math.sin(t * 6 + i)), x, s * 0.4); } ctx.closePath(); };
    ctx.beginPath(); body(); paint(ctx, C, s, theme, 0, 0);
    // yeux creux + bouche
    ctx.fillStyle = '#0b1b33'; ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.1, s * 0.07, s * 0.1, 0, 0, TAU); ctx.ellipse(s * 0.12, -s * 0.1, s * 0.07, s * 0.1, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.06, s * 0.09 * (0.7 + 0.3 * Math.sin(t * 4)), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(34,227,200,0.6)'; ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.1, s * 0.025, 0, TAU); ctx.arc(s * 0.12, -s * 0.1, s * 0.025, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawGlu(ctx, s, t, st, C, theme) {
    // Flaque gluante : galette qui bulle, gouttes qui s'étirent, yeux qui flottent dedans.
    ctx.save(); ctx.translate(0, s * 0.12);
    const flat = () => { ctx.moveTo(-s * 0.46, 0); ctx.bezierCurveTo(-s * 0.5, -s * 0.3, -s * 0.1, -s * 0.34, s * 0.05, -s * 0.26); ctx.bezierCurveTo(s * 0.3, -s * 0.32, s * 0.5, -s * 0.15, s * 0.46, 0); ctx.bezierCurveTo(s * 0.4, s * 0.22, -s * 0.4, s * 0.22, -s * 0.46, 0); ctx.closePath(); };
    ctx.beginPath(); flat(); paint(ctx, C, s, theme, 0, 0);
    ctx.save(); ctx.beginPath(); flat(); ctx.clip();
    for (let i = 0; i < 5; i += 1) { const k = (t * 0.5 + i * 0.2) % 1; ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(-s * 0.3 + i * s * 0.15, s * 0.05 - k * s * 0.2, s * (0.03 + k * 0.05), 0, TAU); ctx.fill(); }
    ctx.restore();
    // gouttes qui s'étirent
    ctx.fillStyle = C.base; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03;
    for (const [x, ph] of [[-s * 0.25, 0], [s * 0.2, 2]]) { const L = s * (0.1 + 0.06 * Math.sin(t * 2 + ph)); ctx.beginPath(); ctx.moveTo(x - s * 0.04, 0); ctx.quadraticCurveTo(x, L * 0.5, x, L); ctx.quadraticCurveTo(x, L * 0.5, x + s * 0.04, 0); ctx.fill(); ctx.stroke(); }
    eye(ctx, -s * 0.12, -s * 0.1 + Math.sin(t * 2) * s * 0.02, s * 0.06, s * 0.07, t, st.phase, { theme, white: true, lookX: Math.sin(t) }); eye(ctx, s * 0.12, -s * 0.1 + Math.sin(t * 2 + 1) * s * 0.02, s * 0.06, s * 0.07, t, st.phase + 1, { theme, white: true, lookX: Math.sin(t) });
    mouth(ctx, 0, s * 0.05, s * 0.14, 'zigzag', t);
    ctx.restore();
  }
  function drawSirene(ctx, s, t, st, C, theme) {
    // Charmeuse : sirène assise sur un rocher, queue qui bat, chevelure ondulante, notes qui s'envolent.
    ctx.save();
    // rocher
    ctx.fillStyle = '#334155'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.45); ctx.lineTo(-s * 0.3, s * 0.22); ctx.lineTo(s * 0.1, s * 0.18); ctx.lineTo(s * 0.42, s * 0.3); ctx.lineTo(s * 0.4, s * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
    // queue
    const tw = Math.sin(t * 3 + st.phase) * 0.25;
    ctx.save(); ctx.translate(s * 0.1, s * 0.2); ctx.rotate(tw);
    ctx.beginPath(); ctx.moveTo(-s * 0.12, 0); ctx.quadraticCurveTo(s * 0.2, s * 0.05, s * 0.32, -s * 0.1); ctx.quadraticCurveTo(s * 0.42, -s * 0.2, s * 0.44, -s * 0.02); ctx.quadraticCurveTo(s * 0.4, s * 0.1, s * 0.3, s * 0.1); ctx.quadraticCurveTo(s * 0.15, s * 0.18, -s * 0.12, s * 0.12); ctx.closePath(); paint(ctx, { base: '#2dd4bf', light: '#99f6e4', dark: '#0f766e' }, s, theme, 0, 0);
    ctx.restore();
    // buste
    ctx.beginPath(); ctx.ellipse(-s * 0.08, 0, s * 0.17, s * 0.22, 0.2, 0, TAU); paint(ctx, C, s, theme, 0, 0);
    // chevelure (ambre, ondulante)
    ctx.fillStyle = theme === 'default' ? '#f59e0b' : C.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.03;
    ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.3); ctx.quadraticCurveTo(-s * 0.1, -s * 0.5, s * 0.1, -s * 0.36); ctx.quadraticCurveTo(s * 0.08, -s * 0.1, s * 0.02 + Math.sin(t * 2) * s * 0.03, s * 0.1); ctx.quadraticCurveTo(-s * 0.1, 0, -s * 0.2 + Math.sin(t * 2 + 1) * s * 0.03, s * 0.12); ctx.quadraticCurveTo(-s * 0.3, -s * 0.1, -s * 0.26, -s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    // tête
    ctx.beginPath(); ctx.arc(-s * 0.08, -s * 0.26, s * 0.15, 0, TAU); paint(ctx, C, s, theme, -s * 0.08, -s * 0.26);
    eye(ctx, -s * 0.13, -s * 0.28, s * 0.04, s * 0.055, t, st.phase, { theme }); eye(ctx, -s * 0.02, -s * 0.28, s * 0.04, s * 0.055, t, st.phase + 1, { theme });
    mouth(ctx, -s * 0.08, -s * 0.17, s * 0.1, 'o', t);
    // notes
    ctx.fillStyle = '#f0abfc'; ctx.font = `${Math.round(s * 0.18)}px "Chakra Petch", sans-serif`; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i += 1) { const k = (t * 0.7 + i * 0.33 + st.phase) % 1; ctx.globalAlpha = 1 - k; ctx.fillText(i % 2 ? '♪' : '♫', s * 0.1 + Math.sin(k * 6 + i) * s * 0.1, -s * 0.4 - k * s * 0.4); }
    ctx.restore();
  }
  function drawKraken(ctx, s, t, st, C, theme) {
    // Colosse : grosse tête de poulpe, tentacules qui rament, regard mauvais.
    const run = st.moving ? 1 : 0, ph = t * (run ? 5 : 1.5) + st.phase;
    ctx.save();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04;
    for (let i = 0; i < 6; i += 1) {
      const x0 = (i - 2.5) * s * 0.14, w = Math.sin(ph + i * 1.1) * s * 0.12;
      ctx.fillStyle = i % 2 ? C.base : C.dark; ctx.beginPath(); ctx.moveTo(x0 - s * 0.06, s * 0.15); ctx.quadraticCurveTo(x0 + w, s * 0.4, x0 + w * 1.4, s * 0.55); ctx.quadraticCurveTo(x0 + w * 0.6, s * 0.42, x0 + s * 0.06, s * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.light; for (let k = 0; k < 2; k += 1) { ctx.beginPath(); ctx.arc(x0 + w * (0.4 + k * 0.4), s * (0.3 + k * 0.12), s * 0.02, 0, TAU); ctx.fill(); }
    }
    ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.2); ctx.quadraticCurveTo(-s * 0.46, -s * 0.4, 0, -s * 0.5); ctx.quadraticCurveTo(s * 0.46, -s * 0.4, s * 0.4, s * 0.2); ctx.quadraticCurveTo(0, s * 0.3, -s * 0.4, s * 0.2); ctx.closePath(); paint(ctx, C, s, theme, 0, -s * 0.1);
    shine(ctx, -s * 0.16, -s * 0.3, s * 0.09, s * 0.05, 0.35);
    eye(ctx, -s * 0.15, -s * 0.05, s * 0.09, s * 0.1, t, st.phase, { theme, white: true, pupil: '#facc15', angry: true }); eye(ctx, s * 0.15, -s * 0.05, s * 0.09, s * 0.1, t, st.phase + 1, { theme, white: true, pupil: '#facc15', angry: true, angrySide: -1 });
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.14); ctx.quadraticCurveTo(0, s * 0.08, s * 0.12, s * 0.14); ctx.stroke();
    ctx.restore();
  }

  const DRAWERS_EXTRA = {};
  // ---------- Créatures 18 à 47 : dessin procédural à partir d'une « fiche d'allure » (corps, parties, visage) ----------
  const LOOK = {
    18: { body: 'egg', w: 0.26, h: 0.3, parts: ['legsLong', 'antenna2'], eyes: { n: 2, w: 0.06, h: 0.08, white: true }, mouth: 'smile', hop: true },
    19: { body: 'twin', w: 0.2, h: 0.22, parts: ['legs'], eyes: { n: 2, w: 0.05, h: 0.06, white: true }, mouth: 'smile' },
    20: { body: 'flame', w: 0.26, h: 0.36, parts: ['sparks'], eyes: { n: 2, w: 0.05, h: 0.08 }, mouth: 'o', float: true },
    21: { body: 'rock', w: 0.34, h: 0.26, parts: ['claws', 'nose'], eyes: { n: 2, w: 0.045, h: 0.045 }, mouth: 'flat' },
    22: { body: 'round', w: 0.3, h: 0.3, parts: ['cannon', 'legs'], eyes: { n: 2, w: 0.06, h: 0.08, angry: true }, mouth: 'grin', pupilLook: 1 },
    23: { body: 'nest', w: 0.42, h: 0.3, parts: ['eggs'], eyes: { n: 0 }, mouth: null },
    24: { body: 'round', w: 0.3, h: 0.3, parts: ['fuse', 'legs'], eyes: { n: 2, w: 0.07, h: 0.09, white: true }, mouth: 'o', shake: true },
    25: { body: 'drop', w: 0.26, h: 0.32, parts: ['hat', 'legsLong', 'bag'], eyes: { n: 2, w: 0.055, h: 0.07 }, mouth: 'grin' },
    26: { body: 'tower', w: 0.3, h: 0.34, parts: ['spikesTop', 'spring'], eyes: { n: 1, w: 0.09, h: 0.09, white: true }, mouth: 'flat', turret: true },
    27: { body: 'cloud', w: 0.44, h: 0.3, parts: ['drip'], eyes: { n: 2, w: 0.05, h: 0.06 }, mouth: 'frown', float: true },
    28: { body: 'snow', w: 0.3, h: 0.34, parts: ['armsStick', 'frostCrown'], eyes: { n: 2, w: 0.05, h: 0.06 }, mouth: 'zigzag' },
    29: { body: 'pick', w: 0.3, h: 0.34, parts: ['legs'], eyes: { n: 2, w: 0.05, h: 0.07, angry: true }, mouth: 'flat' },
    30: { body: 'fountain', w: 0.36, h: 0.3, parts: ['water'], eyes: { n: 2, w: 0.05, h: 0.07 }, mouth: 'smile', turret: true },
    31: { body: 'round', w: 0.36, h: 0.36, parts: ['snowSpots'], eyes: { n: 2, w: 0.05, h: 0.07, white: true }, mouth: 'o', roll: true },
    32: { body: 'balloon', w: 0.3, h: 0.36, parts: ['basket', 'rope'], eyes: { n: 2, w: 0.05, h: 0.07 }, mouth: 'smile', float: true },
    33: { body: 'bat', w: 0.28, h: 0.26, parts: ['wingsBat', 'fangs'], eyes: { n: 2, w: 0.06, h: 0.07, angry: true, pupil: '#ef4444', white: true }, mouth: 'grin' },
    34: { body: 'shell', w: 0.34, h: 0.3, parts: ['legs6', 'horns'], eyes: { n: 2, w: 0.045, h: 0.06 }, mouth: 'flat' },
    35: { body: 'mortar', w: 0.36, h: 0.3, parts: ['wheels', 'smoke'], eyes: { n: 1, w: 0.08, h: 0.08, white: true }, mouth: 'flat', turret: true },
    36: { body: 'hydra', w: 0.3, h: 0.3, parts: ['legs', 'heads'], eyes: { n: 0 }, mouth: null },
    37: { body: 'tower', w: 0.26, h: 0.4, parts: ['beam', 'lamp'], eyes: { n: 2, w: 0.05, h: 0.06 }, mouth: 'smile', turret: true },
    38: { body: 'crystal', w: 0.3, h: 0.4, parts: ['shards', 'cold'], eyes: { n: 1, w: 0.07, h: 0.07, white: true }, mouth: null, turret: true },
    39: { body: 'bird', w: 0.28, h: 0.26, parts: ['wings', 'stick'], eyes: { n: 2, w: 0.05, h: 0.07, white: true }, mouth: 'beak', float: true },
    40: { body: 'eye', w: 0.34, h: 0.34, parts: ['lashes', 'pedestal'], eyes: { n: 1, w: 0.14, h: 0.14, white: true }, mouth: null, turret: true, pupilLook: 1 },
    41: { body: 'rock', w: 0.38, h: 0.36, parts: ['armsRock', 'cracksGlow'], eyes: { n: 2, w: 0.05, h: 0.05, angry: true }, mouth: 'frown', heavy: true },
    42: { body: 'bird', w: 0.3, h: 0.28, parts: ['wingsFire', 'crest', 'tailFire'], eyes: { n: 2, w: 0.05, h: 0.07, angry: true }, mouth: 'beak', float: true },
    43: { body: 'totem', w: 0.28, h: 0.44, parts: ['faces', 'feathers'], eyes: { n: 0 }, mouth: null, turret: true },
    44: { body: 'serpent', w: 0.4, h: 0.3, parts: ['fins', 'teeth', 'shadow'], eyes: { n: 2, w: 0.06, h: 0.06, angry: true, white: true, pupil: '#facc15' }, mouth: null, float: true },
    45: { body: 'box', w: 0.38, h: 0.42, parts: ['helmetSlit', 'armsRock', 'rivets'], eyes: { n: 0 }, mouth: null, heavy: true },
    46: { body: 'swarm', w: 0.2, h: 0.2, parts: [], eyes: { n: 2, w: 0.035, h: 0.045 }, mouth: null, float: true },
    47: { body: 'round', w: 0.38, h: 0.36, parts: ['spikesCrown', 'crownGold', 'legs'], eyes: { n: 2, w: 0.06, h: 0.08, white: true }, mouth: 'smile' },
  };
  function bodyPath(ctx, kind, w, h, s, t, st) {
    const ph = t * 2 + st.phase;
    ctx.beginPath();
    switch (kind) {
      case 'egg': ctx.ellipse(0, 0, w, h, 0, 0, TAU); break;
      case 'drop': ctx.moveTo(0, -h * 1.2); ctx.bezierCurveTo(w * 1.3, -h * 0.4, w * 1.1, h, 0, h); ctx.bezierCurveTo(-w * 1.1, h, -w * 1.3, -h * 0.4, 0, -h * 1.2); break;
      case 'box': rr(ctx, -w, -h, w * 2, h * 2, s * 0.06); break;
      case 'tower': rr(ctx, -w, -h, w * 2, h * 2, s * 0.08); break;
      case 'rock': ctx.moveTo(-w, h * 0.3); ctx.lineTo(-w * 0.7, -h * 0.8); ctx.lineTo(-w * 0.1, -h); ctx.lineTo(w * 0.8, -h * 0.6); ctx.lineTo(w, h * 0.2); ctx.lineTo(w * 0.5, h); ctx.lineTo(-w * 0.6, h); ctx.closePath(); break;
      case 'flame': { const k = 1 + 0.15 * Math.sin(t * 9 + st.phase); ctx.moveTo(0, -h * 1.3 * k); ctx.bezierCurveTo(w * 1.4, -h * 0.3, w * 1.1, h, 0, h); ctx.bezierCurveTo(-w * 1.1, h, -w * 0.6, -h * 0.5, -w * 0.2, -h * 0.4 * k); ctx.bezierCurveTo(-w * 0.1, -h * 0.9, 0, -h, 0, -h * 1.3 * k); break; }
      case 'cloud': for (let i = 0; i < 5; i += 1) { const a = i / 5 * TAU; ctx.moveTo(Math.cos(a) * w * 0.55 + w * 0.3, Math.sin(a) * h * 0.4); ctx.arc(Math.cos(a) * w * 0.55, Math.sin(a) * h * 0.4, w * 0.4 + 0.03 * s * Math.sin(ph + i), 0, TAU); } break;
      case 'crystal': ctx.moveTo(0, -h * 1.1); ctx.lineTo(w, -h * 0.2); ctx.lineTo(w * 0.6, h); ctx.lineTo(-w * 0.6, h); ctx.lineTo(-w, -h * 0.2); ctx.closePath(); break;
      case 'shell': ctx.moveTo(-w, h * 0.5); ctx.bezierCurveTo(-w, -h * 1.3, w, -h * 1.3, w, h * 0.5); ctx.lineTo(-w, h * 0.5); break;
      case 'balloon': ctx.ellipse(0, -h * 0.3, w, h * 0.8, 0, 0, TAU); break;
      case 'bird': ctx.ellipse(0, 0, w, h, 0, 0, TAU); break;
      case 'bat': ctx.ellipse(0, 0, w, h, 0, 0, TAU); break;
      case 'eye': ctx.arc(0, 0, w, 0, TAU); break;
      case 'totem': rr(ctx, -w, -h, w * 2, h * 2, s * 0.04); break;
      case 'serpent': ctx.moveTo(-w * 1.1, h * 0.2); ctx.bezierCurveTo(-w * 0.8, -h * 1.2, w * 0.2, -h * 1.1, w * 0.9, -h * 0.3); ctx.bezierCurveTo(w * 1.2, h * 0.3, w * 0.3, h, -w * 0.4, h * 0.8); ctx.closePath(); break;
      case 'mortar': rr(ctx, -w, -h * 0.4, w * 2, h * 1.4, s * 0.05); break;
      case 'fountain': ctx.ellipse(0, h * 0.4, w, h * 0.5, 0, 0, TAU); break;
      case 'nest': ctx.ellipse(0, h * 0.2, w, h * 0.6, 0, 0, TAU); break;
      case 'snow': ctx.arc(0, h * 0.35, w, 0, TAU); ctx.moveTo(w * 0.7, -h * 0.5); ctx.arc(0, -h * 0.5, w * 0.7, 0, TAU); break;
      case 'pick': rr(ctx, -w * 0.5, -h * 0.6, w, h * 1.7, s * 0.04); break;
      case 'hydra': ctx.ellipse(0, h * 0.2, w, h * 0.8, 0, 0, TAU); break;
      case 'twin': ctx.ellipse(-w * 0.9, 0, w * 0.8, h, 0, 0, TAU); ctx.moveTo(w * 1.7, 0); ctx.ellipse(w * 0.9, 0, w * 0.8, h, 0, 0, TAU); break;
      case 'swarm': for (let i = 0; i < 6; i += 1) { const a = i / 6 * TAU + t * 1.5, r = s * (0.25 + 0.06 * Math.sin(t * 5 + i)); ctx.moveTo(Math.cos(a) * r + w * 0.5, Math.sin(a) * r); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, w * 0.5, 0, TAU); } break;
      default: ctx.arc(0, 0, w, 0, TAU);
    }
  }
  function part(ctx, name, L, s, t, st, C, theme) {
    const w = s * L.w, h = s * L.h, run = st.moving ? 1 : 0, ph = t * 9 + st.phase;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
    switch (name) {
      case 'legs': case 'legsLong': case 'legs6': { const n = name === 'legs6' ? 3 : 1, len = name === 'legsLong' ? 0.22 : 0.14; for (let i = 0; i < n; i += 1) for (const sx of [-1, 1]) { const k = Math.sin(ph + (sx > 0 ? 0 : Math.PI) + i) * run; ctx.beginPath(); ctx.moveTo(sx * w * (0.4 + i * 0.3), h * 0.7); ctx.lineTo(sx * w * (0.5 + i * 0.3) + k * s * 0.07, h * 0.7 + s * len); ctx.stroke(); } break; }
      case 'antenna2': for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * w * 0.3, -h * 0.9); ctx.quadraticCurveTo(sx * w * 0.6, -h * 1.5, sx * w * 0.9, -h * 1.5 + Math.sin(t * 4) * s * 0.02); ctx.stroke(); ctx.fillStyle = C.dark; ctx.beginPath(); ctx.arc(sx * w * 0.9, -h * 1.5, s * 0.03, 0, TAU); ctx.fill(); } break;
      case 'sparks': ctx.fillStyle = '#fff7ed'; for (let i = 0; i < 5; i += 1) { const k = (t * 2 + i * 0.2) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(Math.sin(i * 2.3) * w * 1.2, h * 0.9 + k * s * 0.3, s * 0.025, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; break;
      case 'claws': ctx.fillStyle = C.light; for (const sx of [-1, 1]) for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(sx * w * (0.5 + i * 0.15), h * 0.6); ctx.lineTo(sx * w * (0.6 + i * 0.15), h * 1.1); ctx.lineTo(sx * w * (0.7 + i * 0.15), h * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'nose': ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.ellipse(0, h * 0.25, w * 0.22, h * 0.18, 0, 0, TAU); ctx.fill(); ctx.stroke(); break;
      case 'cannon': ctx.fillStyle = '#374151'; ctx.beginPath(); rr(ctx, -s * 0.08, -h * 1.55, s * 0.16, h * 0.9, s * 0.03); ctx.fill(); ctx.stroke(); if (st.shoot) { ctx.fillStyle = `rgba(253,224,71,${st.shoot})`; ctx.beginPath(); ctx.arc(0, -h * 1.6, s * 0.1 * st.shoot, 0, TAU); ctx.fill(); } break;
      case 'eggs': for (let i = -1; i <= 1; i += 1) { ctx.fillStyle = i ? '#fef3c7' : '#fde68a'; ctx.beginPath(); ctx.ellipse(i * w * 0.5, -h * 0.2 + Math.abs(i) * h * 0.1, w * 0.26, h * 0.4, i * 0.3, 0, TAU); ctx.fill(); ctx.stroke(); } ctx.fillStyle = C.dark; for (let i = 0; i < 7; i += 1) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 0.9) * w * 0.8, h * 0.5 + Math.sin(i * 2) * h * 0.2, s * 0.06, s * 0.012, i * 0.7, 0, TAU); ctx.fill(); } break;
      case 'fuse': ctx.beginPath(); ctx.moveTo(0, -h); ctx.quadraticCurveTo(s * 0.06, -h * 1.5, s * 0.14, -h * 1.5); ctx.stroke(); ctx.fillStyle = Math.sin(t * 20) > 0 ? '#fde047' : '#f97316'; ctx.beginPath(); ctx.arc(s * 0.15, -h * 1.5, s * 0.045, 0, TAU); ctx.fill(); break;
      case 'hat': ctx.fillStyle = C.dark; ctx.beginPath(); ctx.moveTo(-w * 0.9, -h * 0.9); ctx.lineTo(w * 0.2, -h * 2.1); ctx.lineTo(w * 0.9, -h * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'bag': ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.arc(w * 1.1, h * 0.5, s * 0.1, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fde047'; ctx.font = `bold ${Math.round(s * 0.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('$', w * 1.1, h * 0.5 + s * 0.035); break;
      case 'spikesTop': ctx.fillStyle = C.dark; for (let i = -2; i <= 2; i += 1) { const a = -Math.PI / 2 + i * 0.45; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.15) * w * 0.8, -h + Math.sin(a - 0.15) * w * 0.3); ctx.lineTo(Math.cos(a) * w * 1.6, -h + Math.sin(a) * w * 1.2); ctx.lineTo(Math.cos(a + 0.15) * w * 0.8, -h + Math.sin(a + 0.15) * w * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'spring': ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = s * 0.04; ctx.beginPath(); for (let i = 0; i < 4; i += 1) { ctx.moveTo(-w * 0.6, h + i * s * 0.04); ctx.lineTo(w * 0.6, h + i * s * 0.04 + s * 0.02); } ctx.stroke(); break;
      case 'drip': ctx.fillStyle = C.base; for (let i = 0; i < 3; i += 1) { const k = (t * 0.7 + i * 0.33) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse((i - 1) * w * 0.5, h * 0.6 + k * s * 0.25, s * 0.03, s * 0.05, 0, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; break;
      case 'armsStick': for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * w * 0.8, h * 0.1); ctx.lineTo(sx * w * 1.6, -h * 0.4 + Math.sin(t * 3) * s * 0.02); ctx.moveTo(sx * w * 1.3, -h * 0.2); ctx.lineTo(sx * w * 1.5, -h * 0.6); ctx.stroke(); } break;
      case 'frostCrown': frost(ctx, 0, -h * 0.6, s * 0.9, t); break;
      case 'water': ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = s * 0.035; for (let i = 0; i < 3; i += 1) { const k = (t * 0.9 + i * 0.33) % 1; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.moveTo(0, h * 0.2); ctx.quadraticCurveTo((i - 1) * w * 0.8, -h * 0.8 - k * s * 0.2, (i - 1) * w * 1.1, h * 0.3); ctx.stroke(); } ctx.globalAlpha = 1; break;
      case 'snowSpots': ctx.fillStyle = 'rgba(125,211,252,0.5)'; for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.3 + (st.moving ? t * 6 : 0)) * w * 0.6, Math.sin(i * 1.3 + (st.moving ? t * 6 : 0)) * h * 0.6, s * 0.035, 0, TAU); ctx.fill(); } break;
      case 'basket': ctx.fillStyle = '#a16207'; ctx.beginPath(); rr(ctx, -w * 0.5, h * 0.7, w, h * 0.35, s * 0.02); ctx.fill(); ctx.stroke(); break;
      case 'rope': for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * w * 0.6, h * 0.3); ctx.lineTo(sx * w * 0.4, h * 0.7); ctx.stroke(); } break;
      case 'wingsBat': case 'wings': case 'wingsFire': { const flap = Math.sin(t * 12 + st.phase) * 0.5; ctx.fillStyle = name === 'wingsFire' ? '#f97316' : name === 'wingsBat' ? C.dark : C.light; for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * w * 0.8, -h * 0.2); ctx.rotate(sx * (-0.3 + flap)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sx * w * 1.2, -h * 1.2, sx * w * 1.8, -h * 0.2); if (name === 'wingsBat') { ctx.lineTo(sx * w * 1.3, h * 0.1); ctx.lineTo(sx * w * 0.9, h * 0.5); } else ctx.quadraticCurveTo(sx * w * 1.1, h * 0.3, 0, h * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } break; }
      case 'fangs': fangs(ctx, 0, h * 0.35, s * 0.3); break;
      case 'horns': ctx.fillStyle = C.dark; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * w * 0.3, -h * 0.9); ctx.quadraticCurveTo(sx * w * 0.9, -h * 1.6, sx * w * 1.2, -h * 1.2); ctx.lineTo(sx * w * 0.6, -h * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'wheels': ctx.fillStyle = '#292524'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * w * 0.7, h * 0.9, s * 0.1, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.arc(sx * w * 0.7, h * 0.9, s * 0.035, 0, TAU); ctx.fill(); ctx.fillStyle = '#292524'; } ctx.fillStyle = '#44403c'; ctx.save(); ctx.rotate(-0.6); ctx.beginPath(); rr(ctx, -s * 0.07, -h * 1.9, s * 0.14, h * 1.6, s * 0.03); ctx.fill(); ctx.stroke(); ctx.restore(); break;
      case 'smoke': ctx.fillStyle = 'rgba(148,163,184,0.6)'; for (let i = 0; i < 3; i += 1) { const k = (t * 0.5 + i * 0.33) % 1; ctx.globalAlpha = 0.7 * (1 - k); ctx.beginPath(); ctx.arc(w * 0.7 + k * s * 0.1, -h * 1.5 - k * s * 0.3, s * 0.03 + k * s * 0.05, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; break;
      case 'heads': for (let i = -1; i <= 1; i += 1) { const bob = Math.sin(t * 4 + i * 2) * s * 0.02; ctx.beginPath(); ctx.moveTo(i * w * 0.5, -h * 0.2); ctx.quadraticCurveTo(i * w * 1.1, -h * 1.1, i * w * 1.1, -h * 1.5 + bob); ctx.lineWidth = s * 0.1; ctx.strokeStyle = C.base; ctx.stroke(); ctx.lineWidth = s * 0.05; ctx.strokeStyle = OUTLINE; ctx.fillStyle = C.base; ctx.beginPath(); ctx.ellipse(i * w * 1.1, -h * 1.55 + bob, s * 0.085, s * 0.07, 0, 0, TAU); ctx.fill(); ctx.stroke(); eye(ctx, i * w * 1.1 + s * 0.02, -h * 1.58 + bob, s * 0.025, s * 0.03, t, st.phase + i, { theme, angry: true }); } break;
      case 'beam': ctx.save(); ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2); ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.moveTo(0, -h * 0.8); ctx.lineTo(-s * 0.7, -h * 1.6); ctx.lineTo(s * 0.7, -h * 1.6); ctx.closePath(); ctx.fill(); ctx.restore(); break;
      case 'lamp': ctx.fillStyle = `rgba(254,240,138,${0.8 + 0.2 * Math.sin(t * 6)})`; ctx.beginPath(); ctx.arc(0, -h * 0.75, s * 0.09, 0, TAU); ctx.fill(); ctx.stroke(); break;
      case 'shards': ctx.fillStyle = C.light; for (let i = 0; i < 4; i += 1) { const a = -2.2 + i * 1.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * w * 0.9, h * 0.6 + Math.sin(a) * h * 0.2); ctx.lineTo(Math.cos(a) * w * 1.5, h * 0.4 + Math.sin(a) * h * 0.6 - s * 0.15); ctx.lineTo(Math.cos(a + 0.4) * w * 0.9, h * 0.6 + Math.sin(a + 0.4) * h * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'cold': snow(ctx, s, t); break;
      case 'stick': ctx.fillStyle = '#ef4444'; ctx.beginPath(); rr(ctx, -s * 0.04, h * 0.3, s * 0.08, s * 0.26, s * 0.02); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, h * 0.3); ctx.lineTo(s * 0.05, h * 0.18); ctx.stroke(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(s * 0.06, h * 0.16, s * 0.03, 0, TAU); ctx.fill(); break;
      case 'lashes': for (let i = 0; i < 7; i += 1) { const a = Math.PI + i * (Math.PI / 6); ctx.beginPath(); ctx.moveTo(Math.cos(a) * w, Math.sin(a) * w); ctx.lineTo(Math.cos(a) * w * 1.3, Math.sin(a) * w * 1.3); ctx.stroke(); } break;
      case 'pedestal': ctx.fillStyle = C.dark; ctx.beginPath(); rr(ctx, -w * 0.6, h * 0.8, w * 1.2, h * 0.4, s * 0.03); ctx.fill(); ctx.stroke(); break;
      case 'armsRock': ctx.fillStyle = C.base; for (const sx of [-1, 1]) { const k = Math.sin(ph * 0.5 + (sx > 0 ? 0 : Math.PI)) * run * s * 0.04; ctx.beginPath(); rr(ctx, sx * w * 0.9 - s * 0.07, -h * 0.4 + k, s * 0.16, h * 1.1, s * 0.04); ctx.fill(); ctx.stroke(); } break;
      case 'cracksGlow': cracks(ctx, s, t); break;
      case 'crest': ctx.fillStyle = '#fde047'; for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(-w * 0.2 + i * w * 0.2, -h * 0.8); ctx.lineTo(-w * 0.3 + i * w * 0.25, -h * 1.6 - Math.sin(t * 8 + i) * s * 0.03); ctx.lineTo(w * 0.05 + i * w * 0.2, -h * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'tailFire': ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(0, h * 0.7); ctx.quadraticCurveTo(-w * 0.6, h * 1.4 + Math.sin(t * 10) * s * 0.03, -w * 0.2, h * 1.9); ctx.quadraticCurveTo(w * 0.2, h * 1.4, w * 0.5, h * 1.8); ctx.quadraticCurveTo(w * 0.5, h * 1.1, 0, h * 0.7); ctx.fill(); ctx.stroke(); break;
      case 'faces': for (let i = -1; i <= 1; i += 1) { ctx.fillStyle = i ? C.light : C.dark; ctx.beginPath(); rr(ctx, -w * 0.7, i * h * 0.6 - h * 0.25, w * 1.4, h * 0.5, s * 0.02); ctx.fill(); ctx.stroke(); eye(ctx, -w * 0.3, i * h * 0.6, s * 0.03, s * 0.03, t, st.phase + i, { theme, angry: i === 0 }); eye(ctx, w * 0.3, i * h * 0.6, s * 0.03, s * 0.03, t, st.phase + i + 2, { theme, angry: i === 0 }); } break;
      case 'feathers': for (const sx of [-1, 1]) { ctx.fillStyle = sx > 0 ? '#f87171' : '#60a5fa'; ctx.beginPath(); ctx.ellipse(sx * w * 1.3, -h * 0.8, s * 0.05, s * 0.16, sx * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); } break;
      case 'fins': ctx.fillStyle = C.light; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(-w * 0.8 + i * w * 0.5, -h * 0.7); ctx.lineTo(-w * 0.6 + i * w * 0.5, -h * 1.5 + Math.sin(t * 5 + i) * s * 0.02); ctx.lineTo(-w * 0.3 + i * w * 0.5, -h * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'teeth': ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(w * 0.3 + i * w * 0.18, h * 0.1); ctx.lineTo(w * 0.38 + i * w * 0.18, h * 0.45); ctx.lineTo(w * 0.46 + i * w * 0.18, h * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'shadow': ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#0c1a4d'; ctx.beginPath(); ctx.ellipse(0, h * 1.9, w * 1.1, h * 0.35, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
      case 'helmetSlit': ctx.fillStyle = `rgba(239,68,68,${0.7 + 0.3 * Math.sin(t * 3)})`; ctx.beginPath(); rr(ctx, -w * 0.6, -h * 0.5, w * 1.2, h * 0.16, s * 0.02); ctx.fill(); ctx.stroke(); break;
      case 'rivets': ctx.fillStyle = C.light; for (const [x, y] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) { ctx.beginPath(); ctx.arc(x * w, y * h, s * 0.025, 0, TAU); ctx.fill(); } break;
      case 'spikesCrown': ctx.fillStyle = C.dark; for (let i = 0; i < 9; i += 1) { const a = -Math.PI * 1.0 + (i / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a + 0.12) * w * 0.8, Math.sin(a + 0.12) * h * 0.8); ctx.lineTo(Math.cos(a) * w * 1.35, Math.sin(a) * h * 1.35); ctx.lineTo(Math.cos(a - 0.12) * w * 0.8, Math.sin(a - 0.12) * h * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
      case 'crownGold': crown(ctx, 0, -h * 1.05, s * 0.9); break;
      default: break;
    }
  }
  function drawGeneric(ctx, s, t, st, C, theme, L) {
    const run = st.moving ? 1 : 0;
    const w = s * L.w, h = s * L.h;
    ctx.save();
    if (L.float) ctx.translate(0, Math.sin(t * 2.2 + st.phase) * s * 0.04);
    if (L.hop && run) ctx.translate(0, -Math.abs(Math.sin(t * 10 + st.phase)) * s * 0.08);
    if (L.shake) ctx.translate(Math.sin(t * 40) * s * 0.01 * (1 + run), 0);
    if (L.heavy && run) ctx.rotate(Math.sin(t * 4 + st.phase) * 0.06);
    if (L.roll && run) ctx.rotate(t * 6);
    if (L.turret && st.rot !== undefined && L.body !== 'eye') { /* orientation gérée par la partie canon */ }
    // parties arrière
    for (const p of L.parts) if (['wingsBat', 'wings', 'wingsFire', 'tailFire', 'beam', 'shadow', 'heads', 'rope', 'spring', 'wheels', 'pedestal', 'armsRock', 'armsStick', 'horns', 'crest', 'fins', 'spikesTop', 'spikesCrown', 'feathers', 'stick'].includes(p)) part(ctx, p, L, s, t, st, C, theme);
    if (L.roll && run) { /* corps tourne déjà */ }
    if (L.body === 'cloud') { // nuage : bulles peintes une à une, puis remplies sans contour pour fondre les traits intérieurs
      const blobs = [[-w * 0.55, h * 0.2, w * 0.45], [w * 0.55, h * 0.2, w * 0.45], [0, -h * 0.3, w * 0.55], [-w * 0.2, h * 0.4, w * 0.4], [w * 0.25, h * 0.45, w * 0.38]];
      for (const [bx, by, r] of blobs) { ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); paint(ctx, C, s, theme, 0, 0); }
      ctx.save(); ctx.fillStyle = bodyStyle(ctx, C, s, theme, 0, 0); for (const [bx, by, r] of blobs) { ctx.beginPath(); ctx.arc(bx, by, r - s * 0.03, 0, TAU); ctx.fill(); } ctx.restore();
    } else { bodyPath(ctx, L.body, w, h, s, t, st); paint(ctx, C, s, theme, 0, 0); }
    if (L.body !== 'swarm' && L.body !== 'twin' && L.body !== 'nest') shine(ctx, -w * 0.4, -h * 0.45, w * 0.3, h * 0.2);
    // parties avant
    for (const p of L.parts) if (!['wingsBat', 'wings', 'wingsFire', 'tailFire', 'beam', 'shadow', 'heads', 'rope', 'spring', 'wheels', 'pedestal', 'armsRock', 'armsStick', 'horns', 'crest', 'fins', 'spikesTop', 'spikesCrown', 'feathers', 'stick'].includes(p)) part(ctx, p, L, s, t, st, C, theme);
    // visage
    const E = L.eyes || { n: 0 };
    const look = L.pupilLook ? { lookX: Math.cos(st.rot || 0) * 0.6, lookY: Math.sin(st.rot || 0) * 0.6 } : {};
    if (L.body === 'twin') { for (const sx of [-1, 1]) { eye(ctx, sx * w * 0.9 - s * 0.035, -h * 0.1, s * E.w, s * E.h, t, st.phase + sx, { theme, white: E.white }); eye(ctx, sx * w * 0.9 + s * 0.035, -h * 0.1, s * E.w, s * E.h, t, st.phase + sx + 1, { theme, white: E.white }); mouth(ctx, sx * w * 0.9, h * 0.25, s * 0.08, 'smile', t); } }
    else if (L.body === 'swarm') { for (let i = 0; i < 6; i += 1) { const a = i / 6 * TAU + t * 1.5, r = s * (0.25 + 0.06 * Math.sin(t * 5 + i)); eye(ctx, Math.cos(a) * r - s * 0.025, Math.sin(a) * r, s * E.w, s * E.h, t, st.phase + i, { theme }); eye(ctx, Math.cos(a) * r + s * 0.025, Math.sin(a) * r, s * E.w, s * E.h, t, st.phase + i + 3, { theme }); } }
    else if (E.n === 1) eye(ctx, 0, L.body === 'eye' ? 0 : -h * 0.1, s * E.w, s * E.h, t, st.phase, Object.assign({ theme, white: E.white, angry: E.angry, pupil: E.pupil }, look));
    else if (E.n === 2) for (const sx of [-1, 1]) eye(ctx, sx * w * 0.42, -h * 0.15, s * E.w, s * E.h, t, st.phase + (sx > 0 ? 1 : 0), Object.assign({ theme, white: E.white, angry: E.angry, angrySide: sx, pupil: E.pupil }, look));
    if (L.mouth === 'beak') { ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(-s * 0.06, h * 0.2); ctx.lineTo(s * 0.1, h * 0.3); ctx.lineTo(-s * 0.06, h * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (L.mouth) mouth(ctx, 0, h * 0.35, s * 0.16, L.mouth, t);
    ctx.restore();
  }
  for (const id of Object.keys(LOOK)) { const L = LOOK[id]; DRAWERS_EXTRA[id] = (ctx, s, t, st, C, theme) => drawGeneric(ctx, s, t, st, C, theme, L); }

  const DRAWERS = { 1: drawZip, 2: drawGromp, 3: drawKrak, 4: drawRiko, 5: drawBlok, 6: drawMojo, 7: drawZephir, 8: drawPik, 9: drawBulle, 10: drawZazou, 11: drawBoum, 12: drawRafale, 13: drawTiktak, 14: drawFantome, 15: drawGlu, 16: drawSirene, 17: drawKraken };
  Object.assign(DRAWERS, DRAWERS_EXTRA);

  const Creatures = {
    NAMES, ROLES,
    themeOf, colorsFor,
    /*
     * ctx, ogId, skinId, x, y, size, t, state, opts { scaleX, scaleY, alpha, flipV, rot (rotation globale), flash }
     */
    draw(ctx, ogId, skinId, x, y, size, t, state, opts) {
      const o = opts || {}, st = Object.assign({ phase: 0 }, state || {});
      const theme = themeOf(skinId, ogId);
      const C = colorsFor(ogId, theme);
      const drawer = DRAWERS[ogId];
      ctx.save();
      ctx.translate(x, y);
      if (!drawer) { // créature pas encore dessinée (à venir) : silhouette mystère qui respire
        const r = size * 0.4, b = 1 + Math.sin((t || 0) * 2 + ogId) * 0.04;
        ctx.scale(b, b); ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * 0.9;
        ctx.fillStyle = 'rgba(8,18,38,0.95)'; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.bezierCurveTo(r * 1.2, -r, r * 1.1, r, 0, r * 1.05); ctx.bezierCurveTo(-r * 1.1, r, -r * 1.2, -r, 0, -r * 1.1); ctx.fill();
        ctx.strokeStyle = 'rgba(34,227,200,0.7)'; ctx.lineWidth = Math.max(2, size * 0.03); ctx.setLineDash([size * 0.08, size * 0.05]); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(34,227,200,0.9)'; ctx.font = `bold ${Math.round(size * 0.5)}px Bungee, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, size * 0.04);
        ctx.restore(); return;
      }
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale(o.scaleX || 1, (o.flipV ? -1 : 1) * (o.scaleY || 1));
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      drawer(ctx, size, t || 0, st, C, theme);
      if (o.flash) {
        // Flash blanc : on redessine la silhouette en blanc par-dessus.
        ctx.save(); ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * Math.min(1, o.flash) * 0.85; ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, size * 0.42, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.restore();
    },
  };
  window.Creatures = Creatures;
})();
