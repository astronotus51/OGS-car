/*
 * Arènes (maps) : décor du terrain, dessiné en vectoriel et animé. Le serveur choisit l'arène au début de la partie.
 * Chaque arène : { name, base (fond statique mis en cache), animate (couche animée), edge (bandes du bord), line (ligne centrale), grid }
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  function rng(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return a / 4294967296; }; }

  const MAPS = {
    lagoon: {
      name: 'Lagon', edge: '#f8d99e', edgeLine: 'rgba(255,239,186,0.7)', line: 'rgba(226,232,240,0.7)', grid: 'rgba(255,255,255,0.06)', hud: '#0f172a',
      base(ctx, W, H) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1e40af'); g.addColorStop(0.5, '#2563eb'); g.addColorStop(1, '#1e40af'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); },
      animate(ctx, W, H, t) {
        ctx.lineCap = 'round'; ctx.lineWidth = 16;
        for (let i = 0; i < 12; i += 1) { const yBase = (H / 11) * i; ctx.strokeStyle = i % 2 === 0 ? 'rgba(147,197,253,0.15)' : 'rgba(59,130,246,0.2)'; ctx.beginPath(); for (let x = 0; x <= W; x += 24) { const y = yBase + Math.sin(x / 120 + t * 1.6 + i * 0.6) * 8; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
      },
    },
    space: {
      name: 'Espace', edge: '#1e1b4b', edgeLine: 'rgba(129,140,248,0.6)', line: 'rgba(167,139,250,0.8)', grid: 'rgba(129,140,248,0.12)', hud: '#0b0620',
      base(ctx, W, H) {
        const g = ctx.createRadialGradient(W * 0.3, H * 0.3, 50, W * 0.5, H * 0.5, H); g.addColorStop(0, '#312e81'); g.addColorStop(0.5, '#0f0a2e'); g.addColorStop(1, '#030014'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const r = rng(42); for (let i = 0; i < 260; i += 1) { const x = r() * W, y = r() * H, s = r() * 2.2 + 0.4; ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
        // Nébuleuse
        for (let i = 0; i < 4; i += 1) { const x = W * (0.2 + r() * 0.6), y = H * (0.1 + r() * 0.8); const n = ctx.createRadialGradient(x, y, 0, x, y, 260 + r() * 200); n.addColorStop(0, ['rgba(236,72,153,0.22)', 'rgba(34,211,238,0.18)', 'rgba(168,85,247,0.22)', 'rgba(251,146,60,0.15)'][i]); n.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = n; ctx.fillRect(0, 0, W, H); }
        // Planète
        const px = W * 0.82, py = H * 0.2; const pg = ctx.createRadialGradient(px - 40, py - 40, 10, px, py, 110); pg.addColorStop(0, '#fcd34d'); pg.addColorStop(1, '#b45309'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 110, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(253,230,138,0.6)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(px, py, 175, 40, -0.35, 0, TAU); ctx.stroke();
      },
      animate(ctx, W, H, t) {
        // Étoiles filantes + scintillement
        const r = rng(7); ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 30; i += 1) { const x = r() * W, y = r() * H; const k = (Math.sin(t * (2 + r() * 3) + i) + 1) / 2; ctx.globalAlpha = 0.2 + 0.8 * k; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        const k = (t * 0.25) % 1; const sx = W * 0.1 + k * W * 0.9, sy = H * 0.05 + k * H * 0.5;
        if (k < 0.3) { ctx.strokeStyle = `rgba(255,255,255,${1 - k / 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 120, sy - 60); ctx.stroke(); }
      },
    },
    lava: {
      name: 'Mer de lave', edge: '#3f1d0b', edgeLine: 'rgba(251,146,60,0.7)', line: 'rgba(254,215,170,0.8)', grid: 'rgba(0,0,0,0.18)', hud: '#1a0a05',
      base(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#44403c'); g.addColorStop(0.5, '#292524'); g.addColorStop(1, '#44403c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Dalles de roche volcanique
        const r = rng(99); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6;
        for (let i = 0; i < 70; i += 1) { const x = r() * W, y = r() * H; ctx.beginPath(); for (let k = 0; k < 6; k += 1) { const a = k * TAU / 6 + r() * 0.5; const rad = 40 + r() * 60; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.stroke(); }
        // Mer de lave sur les bords gauche et droit
        for (const side of [-1, 1]) { const x0 = side < 0 ? 0 : W - 140; const lg = ctx.createLinearGradient(x0, 0, x0 + 140, 0); lg.addColorStop(side < 0 ? 0 : 1, '#f97316'); lg.addColorStop(side < 0 ? 1 : 0, 'rgba(249,115,22,0)'); ctx.fillStyle = lg; ctx.fillRect(x0, 0, 140, H); }
      },
      animate(ctx, W, H, t) {
        // Fissures de lave qui pulsent + bulles
        const glow = 0.5 + 0.5 * Math.sin(t * 2);
        ctx.strokeStyle = `rgba(251,146,60,${0.35 + 0.4 * glow})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const r = rng(5); for (let i = 0; i < 9; i += 1) { let x = r() * W, y = r() * H; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 5; k += 1) { x += (r() - 0.5) * 160; y += (r() - 0.5) * 160; ctx.lineTo(x, y); } ctx.stroke(); }
        for (let i = 0; i < 8; i += 1) { const k = ((t * 0.5 + i * 0.125) % 1); const side = i % 2 ? W - 60 - (i * 13) % 50 : 60 + (i * 17) % 50; const y = H - k * H; ctx.fillStyle = `rgba(254,240,138,${(1 - k) * 0.8})`; ctx.beginPath(); ctx.arc(side, y, 6 + (1 - k) * 10, 0, TAU); ctx.fill(); }
        ctx.fillStyle = `rgba(249,115,22,${0.05 + 0.05 * glow})`; ctx.fillRect(0, 0, W, H);
      },
    },
    halloween: {
      name: 'Cimetière', edge: '#1c1917', edgeLine: 'rgba(168,85,247,0.6)', line: 'rgba(192,132,252,0.7)', grid: 'rgba(168,85,247,0.1)', hud: '#0f0a1a',
      base(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2e1065'); g.addColorStop(0.5, '#1e1b2e'); g.addColorStop(1, '#14532d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Lune
        const mg = ctx.createRadialGradient(W * 0.78, H * 0.12, 20, W * 0.78, H * 0.12, 120); mg.addColorStop(0, '#fef3c7'); mg.addColorStop(0.6, '#fde68a'); mg.addColorStop(1, 'rgba(253,230,138,0)'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.12, 120, 0, TAU); ctx.fill();
        // Tombes et citrouilles
        const r = rng(31); ctx.strokeStyle = '#0b0a0f'; ctx.lineWidth = 5;
        for (let i = 0; i < 14; i += 1) { const x = 60 + r() * (W - 120), y = 80 + r() * (H - 160), w = 46, h = 62; ctx.fillStyle = '#57534e'; ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y - h / 4); ctx.arc(x, y - h / 4, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y + h / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#292524'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14); ctx.moveTo(x - 10, y - 2); ctx.lineTo(x + 10, y - 2); ctx.stroke(); ctx.strokeStyle = '#0b0a0f'; ctx.lineWidth = 5; }
        for (let i = 0; i < 6; i += 1) { const x = 60 + r() * (W - 120), y = 80 + r() * (H - 160); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.ellipse(x, y, 26, 20, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(x - 12, y - 4); ctx.lineTo(x - 4, y - 2); ctx.lineTo(x - 10, y + 4); ctx.closePath(); ctx.moveTo(x + 12, y - 4); ctx.lineTo(x + 4, y - 2); ctx.lineTo(x + 10, y + 4); ctx.closePath(); ctx.fill(); }
      },
      animate(ctx, W, H, t) {
        // Brume qui rampe + chauves-souris
        for (let i = 0; i < 5; i += 1) { const x = ((t * 40 * (1 + i * 0.2) + i * 400) % (W + 600)) - 300; const y = H * (0.15 + i * 0.18); const fg = ctx.createRadialGradient(x, y, 0, x, y, 220); fg.addColorStop(0, 'rgba(226,232,240,0.14)'); fg.addColorStop(1, 'rgba(226,232,240,0)'); ctx.fillStyle = fg; ctx.fillRect(x - 220, y - 120, 440, 240); }
        ctx.fillStyle = '#0b0a0f';
        for (let i = 0; i < 4; i += 1) { const k = (t * 0.12 + i * 0.25) % 1; const x = k * (W + 200) - 100, y = H * 0.1 + Math.sin(t * 3 + i) * 40 + i * 60; const f = Math.sin(t * 16 + i) * 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 18, y - 14 + f, x - 34, y + f); ctx.quadraticCurveTo(x - 18, y + 4, x, y + 6); ctx.quadraticCurveTo(x + 18, y + 4, x + 34, y + f); ctx.quadraticCurveTo(x + 18, y - 14 + f, x, y); ctx.fill(); }
      },
    },
    farm: {
      name: 'Ferme', edge: '#92400e', edgeLine: 'rgba(253,224,71,0.7)', line: 'rgba(254,243,199,0.8)', grid: 'rgba(0,0,0,0.08)', hud: '#1c1917',
      base(ctx, W, H) {
        // Bandes de champs (labours) alternées
        const cols = ['#65a30d', '#4d7c0f', '#a16207', '#84cc16', '#ca8a04', '#3f6212'];
        for (let i = 0; i < 8; i += 1) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(0, (H / 8) * i, W, H / 8 + 1); }
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 3;
        for (let y = 0; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        // Chemin de terre vertical et rangées de choux
        ctx.fillStyle = '#b45309'; ctx.fillRect(W * 0.48, 0, W * 0.04, H);
        const r = rng(12); for (let i = 0; i < 120; i += 1) { const x = r() * W, y = r() * H; if (Math.abs(x - W / 2) < W * 0.03) continue; ctx.fillStyle = r() < 0.5 ? '#86efac' : '#fde047'; ctx.beginPath(); ctx.arc(x, y, 7 + r() * 7, 0, TAU); ctx.fill(); }
        // Épouvantail
        const sx = W * 0.9, sy = H * 0.5; ctx.strokeStyle = '#78350f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(sx, sy - 70); ctx.lineTo(sx, sy + 70); ctx.moveTo(sx - 50, sy - 20); ctx.lineTo(sx + 50, sy - 20); ctx.stroke(); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(sx, sy - 80, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#78350f'; ctx.fillRect(sx - 28, sy - 104, 56, 10); ctx.fillRect(sx - 16, sy - 124, 32, 22);
      },
      animate(ctx, W, H, t) {
        // Blé qui ondule sur les bords + papillons
        ctx.strokeStyle = 'rgba(253,224,71,0.8)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (const x0 of [20, 50, 80, W - 20, W - 50, W - 80]) for (let i = 0; i < 12; i += 1) { const y = (H / 12) * i + 40; const sway = Math.sin(t * 2 + i + x0 * 0.01) * 10; ctx.beginPath(); ctx.moveTo(x0, y + 30); ctx.quadraticCurveTo(x0 + sway, y + 10, x0 + sway * 1.5, y - 20); ctx.stroke(); }
        for (let i = 0; i < 3; i += 1) { const x = W * 0.2 + Math.sin(t * 0.7 + i * 2) * W * 0.25 + i * 200, y = H * 0.5 + Math.cos(t * 0.9 + i) * H * 0.3; const f = Math.abs(Math.sin(t * 14 + i)) * 8; ctx.fillStyle = ['#f472b6', '#60a5fa', '#fde047'][i]; ctx.beginPath(); ctx.ellipse(x - 7, y, 7, 4 + f, 0.4, 0, TAU); ctx.ellipse(x + 7, y, 7, 4 + f, -0.4, 0, TAU); ctx.fill(); }
      },
    },
    ice: {
      name: 'Banquise', edge: '#e0f2fe', edgeLine: 'rgba(14,165,233,0.6)', line: 'rgba(14,116,144,0.7)', grid: 'rgba(14,165,233,0.12)', hud: '#0c2033',
      base(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#bae6fd'); g.addColorStop(0.5, '#e0f2fe'); g.addColorStop(1, '#bae6fd'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const r = rng(77); ctx.strokeStyle = 'rgba(14,165,233,0.35)'; ctx.lineWidth = 4;
        for (let i = 0; i < 40; i += 1) { let x = r() * W, y = r() * H; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k += 1) { x += (r() - 0.5) * 220; y += (r() - 0.5) * 220; ctx.lineTo(x, y); } ctx.stroke(); }
        // Trous d'eau
        for (let i = 0; i < 5; i += 1) { const x = 100 + r() * (W - 200), y = 100 + r() * (H - 200); ctx.fillStyle = '#0369a1'; ctx.beginPath(); ctx.ellipse(x, y, 60 + r() * 40, 35 + r() * 20, r(), 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - 15, y - 8, 20, 8, 0, 0, TAU); ctx.fill(); }
      },
      animate(ctx, W, H, t) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const r = rng(3); for (let i = 0; i < 70; i += 1) { const k = ((t * (0.08 + r() * 0.08) + r()) % 1); const x = (r() * W + Math.sin(t + i) * 30 + W) % W, y = k * H; ctx.beginPath(); ctx.arc(x, y, 2 + r() * 3, 0, TAU); ctx.fill(); }
        // Aurore boréale
        for (let i = 0; i < 3; i += 1) { ctx.strokeStyle = ['rgba(74,222,128,0.25)', 'rgba(167,139,250,0.22)', 'rgba(34,211,238,0.22)'][i]; ctx.lineWidth = 50; ctx.beginPath(); for (let x = 0; x <= W; x += 32) { const y = 120 + i * 70 + Math.sin(x / 200 + t * 0.6 + i) * 40; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
      },
    },
    candy: {
      name: 'Pays des bonbons', edge: '#fbcfe8', edgeLine: 'rgba(219,39,119,0.6)', line: 'rgba(190,24,93,0.7)', grid: 'rgba(219,39,119,0.1)', hud: '#3b0a22',
      base(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fbcfe8'); g.addColorStop(0.5, '#f9a8d4'); g.addColorStop(1, '#fbcfe8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const r = rng(8); const cols = ['#f472b6', '#60a5fa', '#fde047', '#4ade80', '#fb923c', '#a78bfa'];
        for (let i = 0; i < 120; i += 1) { ctx.save(); ctx.translate(r() * W, r() * H); ctx.rotate(r() * TAU); ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.roundRect(-14, -5, 28, 10, 5); ctx.fill(); ctx.restore(); }
        for (let i = 0; i < 8; i += 1) { const x = 80 + r() * (W - 160), y = 80 + r() * (H - 160); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke(); }
      },
      animate(ctx, W, H, t) {
        for (let i = 0; i < 10; i += 1) { const k = ((t * 0.15 + i * 0.1) % 1); const x = (i * 157) % W + Math.sin(t + i) * 20, y = H - k * H; ctx.fillStyle = `rgba(255,255,255,${(1 - k) * 0.6})`; ctx.beginPath(); ctx.arc(x, y, 8 + 12 * (1 - k), 0, TAU); ctx.fill(); }
      },
    },
  };
  const MAP_IDS = Object.keys(MAPS);

  window.OGSMaps = { MAPS, MAP_IDS, get(id) { return MAPS[id] || MAPS.lagoon; } };
})();
