/*
 * Créatures OGS dessinées en vectoriel (canvas), animées par parties.
 * Creatures.draw(ctx, ogId, skinId, size, t, state) dessine la créature centrée en (0,0), face « vers le haut ».
 * state : { moving, vx, vy, hit (0..1), shoot (0..1), bounce (0..1), rot (tourelle/étoile), hpRatio, phase, team }
 */
(function () {
  'use strict';
  const OUTLINE = '#2a2438';
  const TAU = Math.PI * 2;

  const NAMES = { 1: 'Zip', 2: 'Gromp', 3: 'Krak', 4: 'Riko', 5: 'Blok', 6: 'Mojo', 7: 'Zéphir' };
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
  };

  function themeOf(skinId, ogId) {
    const skin = window.OGSCatalog && OGSCatalog.SKIN_BY_ID[skinId];
    if (skin && skin.theme) return skin.theme;
    return 'default';
  }
  function colorsFor(ogId, theme) {
    if (theme === 'halloween') return HALLOWEEN[ogId];
    if (theme === 'neon') return { base: '#111827', light: '#1f2937', dark: '#030712', glow: BASE[ogId].base };
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
    if (theme === 'neon') { ctx.shadowColor = C.glow; ctx.shadowBlur = s * 0.18; }
    if (theme === 'ghost') ctx.globalAlpha *= 0.88;
    ctx.fillStyle = bodyStyle(ctx, C, s, theme, cx || 0, cy || 0);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = s * 0.055; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = theme === 'neon' ? C.glow : OUTLINE;
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

  function accessories(ctx, ogId, theme, s, t, C, top) {
    // top : y du sommet du corps (pour poser un chapeau)
    switch (theme) {
      case 'robot': antenna(ctx, 0, top + s * 0.02, s, t); break;
      case 'ice': frost(ctx, 0, top + s * 0.44, s, t); break;
      case 'gold': sparkles(ctx, s, t, '#fffbeb'); break;
      default: break;
    }
  }

  // ----- Les 7 créatures -----
  // Chaque drawer reçoit (ctx, s, t, st, C, theme) et dessine centré en 0,0, face vers -y.

  function drawZip(ctx, s, t, st, C, theme) {
    const run = st.moving ? 1 : 0;
    const ph = t * 11 + st.phase;
    const bob = run ? -Math.abs(Math.sin(ph)) * s * 0.07 : Math.sin(t * 2 + st.phase) * s * 0.01;
    const sq = run ? 0.08 * Math.sin(ph * 2) : 0.02 * Math.sin(t * 2.5);
    // Pattes
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const swing = run ? Math.sin(ph + (sx > 0 ? 0 : Math.PI)) * s * 0.12 : 0;
      ctx.beginPath(); ctx.moveTo(sx * s * 0.14, s * 0.3 + bob * 0.3); ctx.lineTo(sx * s * 0.14 + swing * 0.3, s * 0.46 - Math.max(0, swing) * 0.5); ctx.stroke();
      ctx.fillStyle = C.dark; ctx.beginPath(); ctx.ellipse(sx * s * 0.14 + swing * 0.3, s * 0.47 - Math.max(0, swing) * 0.5, s * 0.09, s * 0.05, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.035; ctx.stroke(); ctx.lineWidth = s * 0.07;
    }
    ctx.save(); ctx.translate(0, bob); ctx.scale(1 - sq, 1 + sq);
    // Oreilles (se couchent en courant)
    const earTilt = run ? 0.5 + 0.1 * Math.sin(ph) : 0.1;
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.translate(sx * s * 0.17, -s * 0.36); ctx.rotate(sx * earTilt * 0.8);
      ctx.beginPath(); ctx.moveTo(-s * 0.07, 0); ctx.lineTo(0, -s * 0.2); ctx.lineTo(s * 0.07, 0); ctx.closePath(); paint(ctx, C, s, theme);
      ctx.restore();
    }
    // Corps capsule
    const bodyPath = () => rr(ctx, -s * 0.27, -s * 0.42, s * 0.54, s * 0.8, s * 0.26);
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
    if (theme === 'halloween') { // côtes de citrouille
      ctx.save(); ctx.beginPath(); bodyPath(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = s * 0.03; for (const sx of [-0.14, 0, 0.14]) { ctx.beginPath(); ctx.moveTo(sx * s, -s * 0.42); ctx.quadraticCurveTo(sx * s * 1.4, 0, sx * s, s * 0.38); ctx.stroke(); } ctx.restore();
    }
    shine(ctx, s * 0.14, s * 0.2, s * 0.05, s * 0.1);
    // Visage
    if (theme === 'halloween') { pumpkinFace(ctx, 0, -s * 0.05, s, t); stemPumpkin(ctx, 0, -s * 0.42, s); }
    else {
      const look = run ? -0.3 : 0;
      eye(ctx, -s * 0.1, -s * 0.12, s * 0.05, s * 0.09, t, st.phase, { theme, lookY: look });
      eye(ctx, s * 0.1, -s * 0.12, s * 0.05, s * 0.09, t, st.phase, { theme, lookY: look });
      mouth(ctx, 0, s * 0.08, s * 0.2, run ? 'o' : 'smile', t);
    }
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.38, s * 0.54, s, t, C);
    accessories(ctx, 1, theme, s, t, C, -s * 0.42);
    ctx.restore();
    // Traits de vitesse
    if (run) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = s * 0.03; for (let i = 0; i < 2; i += 1) { const y = s * 0.1 + i * s * 0.14, off = ((t * 3 + i * 0.5) % 1) * s * 0.25; ctx.beginPath(); ctx.moveTo(-s * 0.4 - off, y); ctx.lineTo(-s * 0.3 - off, y); ctx.moveTo(s * 0.4 + off, y); ctx.lineTo(s * 0.3 + off, y); ctx.stroke(); } }
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
    ctx.save(); ctx.scale(breathe * (1 - 0.1 * recoil), breathe * (1 + 0.16 * recoil));
    // Pieds
    ctx.fillStyle = C.dark; ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.04;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * 0.22, s * 0.42, s * 0.14, s * 0.06, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    // Corps marmite
    const bodyPath = () => { ctx.moveTo(-s * 0.36, -s * 0.05); ctx.quadraticCurveTo(-s * 0.46, s * 0.42, 0, s * 0.42); ctx.quadraticCurveTo(s * 0.46, s * 0.42, s * 0.36, -s * 0.05); ctx.quadraticCurveTo(s * 0.2, -s * 0.2, 0, -s * 0.2); ctx.quadraticCurveTo(-s * 0.2, -s * 0.2, -s * 0.36, -s * 0.05); ctx.closePath(); };
    ctx.beginPath(); bodyPath(); paint(ctx, C, s, theme, 0, 0);
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
    const ph = t * 14 + st.phase;
    const flap = Math.sin(ph); // -1..1
    const hover = Math.sin(t * 4 + st.phase) * s * 0.05;
    const charge = st.shoot || 0;
    ctx.save(); ctx.translate(0, hover);
    // Queue qui ondule (derrière)
    const tx = Math.sin(t * 5 + 1) * s * 0.14, ty = s * 0.46;
    const tailPath = () => { ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.quadraticCurveTo(Math.sin(t * 5) * s * 0.16, s * 0.36, tx, ty); };
    tailPath(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = s * 0.11; ctx.lineCap = 'round'; ctx.stroke();
    tailPath(); ctx.strokeStyle = C.base; ctx.lineWidth = s * 0.05; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - s * 0.09, ty - s * 0.03); ctx.lineTo(tx + s * 0.09, ty - s * 0.03); ctx.lineTo(tx, ty + s * 0.1); ctx.closePath(); paint(ctx, C, s, theme);
    // Ailes membranées (battement)
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.translate(sx * s * 0.18, -s * 0.05); ctx.scale(sx, 1); ctx.rotate(-0.2 + flap * 0.35);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.62, -s * 0.38); ctx.quadraticCurveTo(s * 0.5, -s * 0.12, s * 0.58, s * 0.02); ctx.quadraticCurveTo(s * 0.4, -s * 0.02, s * 0.42, s * 0.16); ctx.quadraticCurveTo(s * 0.2, s * 0.06, 0, s * 0.12); ctx.closePath();
      const wingC = theme === 'default' ? { base: '#f59e0b', light: '#fde68a', dark: '#b45309' } : C;
      paint(ctx, wingC, s, theme, s * 0.3, -s * 0.2);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = s * 0.025; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.5, -s * 0.3); ctx.moveTo(0, 0); ctx.lineTo(s * 0.48, -s * 0.05); ctx.stroke();
      ctx.restore();
    }
    // Cornes
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * s * 0.1, -s * 0.3); ctx.quadraticCurveTo(sx * s * 0.22, -s * 0.42, sx * s * 0.16, -s * 0.52); ctx.lineTo(sx * s * 0.22, -s * 0.3); ctx.closePath(); paint(ctx, C, s, theme); }
    if (theme === 'halloween') batEars(ctx, s, C);
    // Corps rond
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.34, 0, 0, TAU); paint(ctx, C, s, theme, 0, 0);
    // Ventre lumineux (charge du tir)
    const belly = theme === 'halloween' ? '#7f1d1d' : '#fde68a';
    ctx.save(); ctx.globalAlpha *= 0.9; ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(0, s * 0.13, s * 0.17, s * 0.15, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (charge > 0) { ctx.save(); ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = s * 0.3 * charge; ctx.fillStyle = `rgba(254,243,199,${charge})`; ctx.beginPath(); ctx.arc(0, s * 0.13, s * 0.1 * charge, 0, TAU); ctx.fill(); ctx.restore(); }
    shine(ctx, -s * 0.12, -s * 0.18, s * 0.06, s * 0.04);
    // Visage
    const evil = theme === 'halloween';
    eye(ctx, -s * 0.11, -s * 0.08, s * 0.06, s * 0.08, t, st.phase, evil ? { white: true, pupil: '#dc2626', lookY: 0.2 } : { theme, white: theme !== 'ghost' && theme !== 'robot', pupil: OUTLINE, lookY: -0.3 });
    eye(ctx, s * 0.11, -s * 0.08, s * 0.06, s * 0.08, t, st.phase, evil ? { white: true, pupil: '#dc2626', lookY: 0.2 } : { theme, white: theme !== 'ghost' && theme !== 'robot', pupil: OUTLINE, lookY: -0.3 });
    mouth(ctx, 0, s * 0.03, s * 0.16, charge > 0.3 ? 'o' : 'grin', t);
    // Joues
    ctx.fillStyle = 'rgba(248,113,113,0.45)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * 0.2, s * 0.0, s * 0.05, s * 0.03, 0, 0, TAU); ctx.fill(); }
    if (theme === 'ghost') ghostTail(ctx, 0, s * 0.34, s * 0.5, s, t, C);
    accessories(ctx, 7, theme, s, t, C, -s * 0.5);
    ctx.restore();
  }

  const DRAWERS = { 1: drawZip, 2: drawGromp, 3: drawKrak, 4: drawRiko, 5: drawBlok, 6: drawMojo, 7: drawZephir };

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
      if (!drawer) return;
      ctx.save();
      ctx.translate(x, y);
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
