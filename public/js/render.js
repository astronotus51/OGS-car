/*
 * Rendu canvas : terrain, HUD, Ogs animés, effets. Espace logique 1536 x 2048 (portrait 3:4).
 * Le joueur local est TOUJOURS dessiné en bas (le monde est retourné pour le joueur "top").
 */
(function () {
  'use strict';
  const Sim = window.OGSSim;
  const { FIELD, COLS, ROWS, CELL_W, CELL_H, RADIUS, OGS, RULES } = Sim;
  const W = 1536, H = 2048, BAND = 280, BEACH = 26;
  const FIELD_Y = BAND;
  const KEY_LABELS = ['A', 'Z', 'E', 'R', 'T', 'Y', 'U'];
  const MAX_DPR = 2;
  const EMOTE_TEXT = { gg: 'GG !', wow: '😮', lol: '😂', rage: '😡', love: '💛' };

  function createRenderer(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    let scale = 1, cssW = W, cssH = H;
    const anim = new Map(); // id -> état d'animation
    let particles = [], floaters = [], rings = [], emotes = [];
    let shake = 0, flashHp = { top: 0, bottom: 0 }, hazardWarn = 0;
    let me = 'bottom';
    let waterCache = null;

    function resize() {
      const ratio = W / H;
      const maxW = window.innerWidth, maxH = window.innerHeight;
      cssW = maxW; cssH = cssW / ratio;
      if (cssH > maxH) { cssH = maxH; cssW = cssH * ratio; }
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
      canvas.style.left = `${(maxW - cssW) / 2}px`; canvas.style.top = `${(maxH - cssH) / 2}px`;
      canvas.width = Math.round(W * (cssW / W) * dpr); canvas.height = Math.round(H * (cssH / H) * dpr);
      scale = canvas.width / W;
      waterCache = null;
    }

    // ----- Transformations monde -> vue -----
    const vy = (y) => FIELD_Y + (me === 'top' ? FIELD.h - y : y);
    const vx = (x) => x;
    const vrot = (r) => (me === 'top' ? -r : r);
    function cellRect(col, row) {
      const y0 = me === 'top' ? FIELD.h - (row + 1) * CELL_H : row * CELL_H;
      return { x: col * CELL_W, y: FIELD_Y + y0, w: CELL_W, h: CELL_H };
    }
    function screenToLogical(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H };
    }
    function logicalToWorld(p) {
      const y = p.y - FIELD_Y;
      return { x: p.x, y: me === 'top' ? FIELD.h - y : y };
    }

    // ----- Effets -----
    function burst(x, y, color, n, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2, s = (o.speed || 260) * (0.4 + Math.random());
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: (o.life || 0.6) * (0.6 + Math.random() * 0.6), color, size: (o.size || 9) * (0.5 + Math.random()), grav: o.grav || 0, shape: o.shape || 'circle' });
      }
    }
    function floater(x, y, text, color, size) { floaters.push({ x, y, text, color: color || '#fff', size: size || 44, t: 0 }); }
    function ring(x, y, color, maxR, dur) { rings.push({ x, y, color, maxR: maxR || 120, dur: dur || 0.5, t: 0 }); }
    function animOf(id) { let a = anim.get(id); if (!a) { a = { spawn: performance.now() / 1000, hit: -9, bounce: -9, shot: -9, seen: 0, died: false }; anim.set(id, a); } return a; }

    // Reçoit les événements de la simulation (côté monde).
    function onEvent(ev, now) {
      switch (ev.type) {
        case 'place': { const a = animOf(ev.id); a.spawn = now; ring(ev.x, ev.y, OGS[ev.ogId].color, 90, 0.4); break; }
        case 'hit': { const a = animOf(ev.id); a.hit = now; burst(ev.x, ev.y, '#fff', 6, { speed: 160, life: 0.3, size: 6 }); break; }
        case 'kill': {
          const a = animOf(ev.id); a.died = true;
          const color = OGS[ev.ogId].color;
          burst(ev.x, ev.y, color, ev.cause === 'hazard' ? 22 : 16, { speed: 300, life: 0.7, size: 12, grav: 400 });
          burst(ev.x, ev.y, '#ffffff', 6, { speed: 120, life: 0.4, size: 5 });
          ring(ev.x, ev.y, color, 110, 0.35);
          if (ev.cause !== 'base') shake = Math.max(shake, 4);
          break;
        }
        case 'shot': { const a = animOf(ev.id); a.shot = now; break; }
        case 'bounce': { const a = animOf(ev.id); a.bounce = now; if (ev.flip) { floater(ev.x, ev.y, '↩', '#fde68a', 56); ring(ev.x, ev.y, '#93c5fd', 100, 0.3); } break; }
        case 'base': {
          const target = ev.target;
          flashHp[target] = 1; shake = Math.max(shake, 10 + ev.amount * 2);
          const edgeY = target === 'top' ? 0 : FIELD.h;
          floater(ev.x, edgeY + (target === 'top' ? 90 : -90), `-${ev.amount}`, '#fca5a5', 76);
          burst(ev.x, edgeY, '#ef4444', 24, { speed: 380, life: 0.8, size: 12, grav: 300 });
          break;
        }
        case 'orb': { burst(ev.x, ev.y, '#a7f3d0', 14, { speed: 220, life: 0.5, size: 7 }); floater(ev.x, ev.y, `+${ev.mana}`, '#86efac', 52); ring(ev.x, ev.y, '#5eead4', 80, 0.35); break; }
        case 'hazard': { if (ev.phase === 'approach') hazardWarn = 3; if (ev.phase === 'dash') shake = Math.max(shake, 12); break; }
        default: break;
      }
    }
    function addEmote(side, id) { emotes.push({ side, id, t: 0 }); }

    function stepFx(dt) {
      for (const p of particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.96; }
      particles = particles.filter(p => p.life < p.max);
      for (const f of floaters) f.t += dt;
      floaters = floaters.filter(f => f.t < 1.1);
      for (const r of rings) r.t += dt;
      rings = rings.filter(r => r.t < r.dur);
      for (const e of emotes) e.t += dt;
      emotes = emotes.filter(e => e.t < 2.6);
      shake = Math.max(0, shake - dt * 40);
      flashHp.top = Math.max(0, flashHp.top - dt * 2.5); flashHp.bottom = Math.max(0, flashHp.bottom - dt * 2.5);
      hazardWarn = Math.max(0, hazardWarn - dt);
    }

    // ----- Décor -----
    function drawWater(time) {
      // Fond bleu + vagues (cache du fond pour alléger).
      if (!waterCache) {
        waterCache = document.createElement('canvas'); waterCache.width = Math.round(W * scale); waterCache.height = Math.round(FIELD.h * scale);
        const c = waterCache.getContext('2d'); c.scale(scale, scale);
        const g = c.createLinearGradient(0, 0, 0, FIELD.h); g.addColorStop(0, '#1e40af'); g.addColorStop(0.5, '#2563eb'); g.addColorStop(1, '#1e40af');
        c.fillStyle = g; c.fillRect(0, 0, W, FIELD.h);
        c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 2;
        for (let i = 1; i < COLS; i += 1) { c.beginPath(); c.moveTo(i * CELL_W, 0); c.lineTo(i * CELL_W, FIELD.h); c.stroke(); }
        for (let i = 1; i < ROWS; i += 1) { c.beginPath(); c.moveTo(0, i * CELL_H); c.lineTo(W, i * CELL_H); c.stroke(); }
      }
      ctx.drawImage(waterCache, 0, FIELD_Y, W, FIELD.h);
      ctx.save(); ctx.beginPath(); ctx.rect(0, FIELD_Y, W, FIELD.h); ctx.clip();
      ctx.lineCap = 'round'; ctx.lineWidth = 16;
      const phase = time * 1.6;
      for (let i = 0; i < 12; i += 1) {
        const yBase = FIELD_Y + (FIELD.h / 11) * i;
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(147,197,253,0.15)' : 'rgba(59,130,246,0.2)';
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) {
          const y = yBase + Math.sin(x / 120 + phase + i * 0.6) * 8;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      // Ligne centrale.
      ctx.fillStyle = 'rgba(226,232,240,0.7)'; ctx.fillRect(0, FIELD_Y + FIELD.h / 2 - 3, W, 6);
      // Zones de base (dégradé rouge côté ennemi, vert côté moi).
      const gTop = ctx.createLinearGradient(0, FIELD_Y, 0, FIELD_Y + 120); gTop.addColorStop(0, 'rgba(248,113,113,0.35)'); gTop.addColorStop(1, 'rgba(248,113,113,0)');
      ctx.fillStyle = gTop; ctx.fillRect(0, FIELD_Y, W, 120);
      const gBot = ctx.createLinearGradient(0, FIELD_Y + FIELD.h - 120, 0, FIELD_Y + FIELD.h); gBot.addColorStop(0, 'rgba(74,222,128,0)'); gBot.addColorStop(1, 'rgba(74,222,128,0.35)');
      ctx.fillStyle = gBot; ctx.fillRect(0, FIELD_Y + FIELD.h - 120, W, 120);
      // Plages.
      for (const b of [{ y: FIELD_Y - BEACH, dir: 1 }, { y: FIELD_Y + FIELD.h, dir: -1 }]) {
        ctx.fillStyle = '#f8d99e'; ctx.fillRect(0, b.y, W, BEACH);
        ctx.strokeStyle = 'rgba(255,239,186,0.7)'; ctx.lineWidth = 2; ctx.beginPath();
        const edge = b.dir === 1 ? b.y + BEACH : b.y;
        for (let x = 0; x <= W; x += 16) { const y = edge + Math.sin(x / 120 + time * 0.55) * 5 * b.dir; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }

    function drawHints(view) {
      const sel = view.selection;
      if (sel) {
        ctx.save();
        for (const c of view.availableCells) {
          const r = cellRect(c.col, c.row);
          ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
          ctx.strokeStyle = OGS[sel].color; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
          const L = 16;
          ctx.beginPath();
          ctx.moveTo(r.x + 6, r.y + 6 + L); ctx.lineTo(r.x + 6, r.y + 6); ctx.lineTo(r.x + 6 + L, r.y + 6);
          ctx.moveTo(r.x + r.w - 6 - L, r.y + 6); ctx.lineTo(r.x + r.w - 6, r.y + 6); ctx.lineTo(r.x + r.w - 6, r.y + 6 + L);
          ctx.moveTo(r.x + 6, r.y + r.h - 6 - L); ctx.lineTo(r.x + 6, r.y + r.h - 6); ctx.lineTo(r.x + 6 + L, r.y + r.h - 6);
          ctx.moveTo(r.x + r.w - 6 - L, r.y + r.h - 6); ctx.lineTo(r.x + r.w - 6, r.y + r.h - 6); ctx.lineTo(r.x + r.w - 6, r.y + r.h - 6 - L);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
      if (view.cursor) {
        const r = cellRect(view.cursor.col, view.cursor.row);
        const ok = !sel || view.availableCells.some(c => c.col === view.cursor.col && c.row === view.cursor.row);
        ctx.save();
        ctx.strokeStyle = ok ? '#fde68a' : '#f87171'; ctx.lineWidth = 6; ctx.setLineDash([18, 10]); ctx.lineDashOffset = -view.time * 60;
        ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
        ctx.restore();
        if (sel && ok) {
          // Fantôme de l'Og sélectionné.
          Sprites.draw(ctx, sel, view.equipped[me][sel], r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.8, { alpha: 0.45 + 0.1 * Math.sin(view.time * 6), time: view.time });
        }
      }
      for (const p of view.pending) {
        const r = cellRect(p.col, p.row);
        Sprites.draw(ctx, p.ogId, view.equipped[me][p.ogId], r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.85, { alpha: 0.6, time: view.time });
      }
    }

    function drawOrbs(view) {
      for (const o of view.state.orbs) {
        const x = vx(o.x), y = vy(o.y);
        const mine = o.player === me;
        const pulse = 1 + 0.12 * Math.sin(view.time * 5 + o.id);
        const fade = o.life < 1 ? Math.max(0.25, o.life) : 1;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.rotate(view.time * 2.4);
        const R = RULES.orbRadius * pulse;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);
        g.addColorStop(0, mine ? 'rgba(187,247,208,0.95)' : 'rgba(203,213,225,0.7)'); g.addColorStop(0.6, mine ? 'rgba(45,212,191,0.5)' : 'rgba(148,163,184,0.3)'); g.addColorStop(1, 'rgba(6,182,212,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = mine ? 'rgba(236,253,245,0.9)' : 'rgba(226,232,240,0.5)'; ctx.lineWidth = 3; ctx.beginPath();
        for (let t = 0; t <= Math.PI * 5; t += 0.2) { const r = R * 0.15 + (t / (Math.PI * 5)) * R * 0.85; const px = Math.cos(t) * r, py = Math.sin(t) * r; if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.stroke();
        ctx.restore();
        if (mine) {
          ctx.save(); ctx.font = 'bold 26px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(236,253,245,0.9)'; ctx.globalAlpha = fade;
          ctx.fillText('+10', x, y - RULES.orbRadius - 12); ctx.restore();
        }
      }
    }

    function drawEntity(e, view, now) {
      const a = animOf(e.id);
      if (!a.seen) { a.seen = 1; if (now - a.spawn > 1) a.spawn = now - 1; }
      const t = view.time;
      const og = OGS[e.ogId];
      const x = vx(e.x), y = vy(e.y);
      const size = Math.min(CELL_W, CELL_H) * 0.9;
      const enemy = e.player !== me;
      const skin = view.equipped[e.owner] ? view.equipped[e.owner][e.ogId] : undefined;
      let sx = 1, sy = 1, rot = 0, bob = 0, dx = 0, alpha = 1;
      const moving = og.movement !== 'static';
      switch (e.ogId) {
        case 1: { const ph = t * 9 + e.id; bob = -Math.abs(Math.sin(ph)) * 12; sy = 1 + 0.1 * Math.sin(ph * 2); sx = 1 - 0.1 * Math.sin(ph * 2); break; }
        case 2: { rot = Math.sin(t * 14 + e.id) * 0.07; bob = -Math.abs(Math.sin(t * 7 + e.id)) * 5; break; }
        case 3: { const s = 1 + 0.025 * Math.sin(t * 2.5 + e.id); sx = sy = s; const k = now - a.shot; if (k < 0.22) { const r = 1 - k / 0.22; sx *= 1 - 0.12 * r; sy *= 1 + 0.22 * r; } break; }
        case 4: { const s = 1 + 0.06 * Math.sin(t * 6 + e.id); sx = sy = s; break; }
        case 5: { break; }
        case 6: { const s = 1 + 0.05 * Math.sin(t * 3 + e.id); sx = sy = s; break; }
        case 7: { bob = Math.sin(t * 4 + e.id) * 12; sx = 1 + 0.1 * Math.sin(t * 22 + e.id); break; }
        default: break;
      }
      // Rebond : écrasement.
      const kb = now - a.bounce; if (kb < 0.18) { const r = 1 - kb / 0.18; sx *= 1 + 0.25 * r; sy *= 1 - 0.25 * r; }
      // Apparition : pop.
      const ks = Math.min(1, (now - a.spawn) / 0.32);
      const pop = ks < 1 ? (1 - Math.pow(1 - ks, 3)) + 0.28 * Math.sin(ks * Math.PI) : 1;
      sx *= pop; sy *= pop;
      // Dégât : flash + tremblement.
      const kh = now - a.hit; let flash = 0;
      if (kh < 0.16) { flash = 1 - kh / 0.16; dx = (Math.random() - 0.5) * 10 * flash; }
      // Orientation de la tourelle / éponge.
      let spriteRot = 0;
      if (e.ogId === 3) spriteRot = vrot(e.rot) + Math.PI / 2;
      else if (e.ogId === 4) spriteRot = vrot(e.rot);
      else if (e.ogId === 2) spriteRot = e.rot;

      // Ombre.
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      const shadowY = y + size * 0.42 + (og.air ? 28 : 0);
      ctx.ellipse(x, shadowY, size * (og.air ? 0.32 : 0.4) * (1 + bob / 60), size * (og.air ? 0.09 : 0.13), 0, 0, Math.PI * 2);
      ctx.fill();
      // Anneau d'équipe.
      ctx.strokeStyle = enemy ? 'rgba(248,113,113,0.75)' : 'rgba(74,222,128,0.75)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, shadowY, size * 0.42, size * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // Aura du Chargeur (régénération).
      if (e.ogId === 6) {
        const k = (t * 0.9 + e.id * 0.3) % 1;
        ctx.save(); ctx.strokeStyle = `rgba(134,239,172,${(1 - k) * 0.7})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(x, y, size * 0.35 + k * size * 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      // Traînée de l'éponge.
      if (e.ogId === 4 && moving) {
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = og.color; ctx.beginPath(); ctx.arc(x - (e.vx || 0) * 0.04, y - vrot(1) * (e.vy || 0) * 0.04, size * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }

      Sprites.draw(ctx, e.ogId, skin, x + dx, y + bob, size, { rot: spriteRot + rot, flipV: enemy && e.ogId !== 3, scaleX: sx, scaleY: sy, flash, alpha, time: t, fallbackColor: og.color });

      // Flash de tir.
      const kf = now - a.shot;
      if (kf < 0.12 && (e.ogId === 3 || e.ogId === 7)) {
        ctx.save(); ctx.globalAlpha = 1 - kf / 0.12; ctx.fillStyle = '#fef3c7';
        const dir = (e.player === me) ? -1 : 1; ctx.beginPath(); ctx.arc(x, y + dir * size * 0.5, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      // Points de vie.
      if (e.hpMax > 1) {
        const pipW = 18, gap = 6, total = e.hpMax * pipW + (e.hpMax - 1) * gap;
        const px0 = x - total / 2, py = y + size * 0.52;
        for (let i = 0; i < e.hpMax; i += 1) {
          ctx.fillStyle = i < e.hp ? (enemy ? '#fca5a5' : '#86efac') : 'rgba(15,23,42,0.6)';
          ctx.fillRect(px0 + i * (pipW + gap), py, pipW, 7);
        }
      }
    }

    function drawProjectiles(view) {
      for (const p of view.state.projectiles) {
        const x = vx(p.x), y = vy(p.y);
        const mine = p.player === me;
        ctx.save();
        const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
        g.addColorStop(0, '#fff7ed'); g.addColorStop(0.4, p.winged ? '#fb923c' : '#fde047'); g.addColorStop(1, 'rgba(249,115,22,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = mine ? '#fde68a' : '#fdba74'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    function drawHazard(view) {
      const h = view.state.hazard;
      if (!h) return;
      const x = vx(h.x), y = vy(h.y) + (h.phase === 'pause' ? (Math.random() - 0.5) * 6 : 0);
      const s = RULES.hazardRadius * 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#05060a'; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ef4444';
      const blink = Math.sin(view.time * 10) > 0.6 ? 2 : 7;
      ctx.beginPath(); ctx.arc(x - 14, y - 8, blink, 0, Math.PI * 2); ctx.arc(x + 14, y - 8, blink, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, s * 0.9 + 10 * Math.sin(view.time * 8), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    function drawFx() {
      for (const r of rings) {
        const k = r.t / r.dur;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.color; ctx.lineWidth = 6 * (1 - k) + 2;
        ctx.beginPath(); ctx.arc(vx(r.x), vy(r.y), r.maxR * k, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      for (const p of particles) {
        const k = p.life / p.max;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color;
        const s = p.size * (1 - k * 0.5);
        if (p.shape === 'square') ctx.fillRect(vx(p.x) - s / 2, vy(p.y) - s / 2, s, s);
        else { ctx.beginPath(); ctx.arc(vx(p.x), vy(p.y), s / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      for (const f of floaters) {
        const k = f.t / 1.1;
        ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.font = `bold ${f.size}px Fredoka, sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.fillStyle = f.color;
        const y = vy(f.y) - k * 90;
        ctx.strokeText(f.text, vx(f.x), y); ctx.fillText(f.text, vx(f.x), y); ctx.restore();
      }
    }

    // ----- HUD -----
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function drawHud(view) {
      const S = view.state;
      const opp = Sim.other(me);
      // Bande du bas : ma mana + mes slots.
      const bandY = H - BAND + BEACH;
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, bandY, W, BAND - BEACH);
      const manaRatio = Math.max(0, Math.min(1, S.mana[me] / RULES.manaMax));
      const g = ctx.createLinearGradient(0, bandY, 0, H); g.addColorStop(0, '#86efac'); g.addColorStop(1, '#10b981');
      ctx.fillStyle = g; ctx.fillRect(0, bandY + 10, W * manaRatio, BAND - BEACH - 20);
      // Reflets sur la barre de mana.
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i += 1) { const x = ((view.time * 120 + i * 300) % (W + 200)) - 100; ctx.fillRect(x, bandY + 10, 30, BAND - BEACH - 20); }
      ctx.restore();
      ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${Math.floor(S.mana[me])} / ${RULES.manaMax}`, W - 14, H - 14);

      const slotW = W / 7, slotSize = 190;
      for (let i = 0; i < 7; i += 1) {
        const ogId = i + 1, og = OGS[ogId];
        const cx = i * slotW + slotW / 2, cy = bandY + (BAND - BEACH) / 2;
        const affordable = S.mana[me] >= og.cost;
        const selected = view.selection === ogId;
        const lift = selected ? -10 : 0;
        ctx.save();
        ctx.globalAlpha = affordable ? 1 : 0.5;
        ctx.fillStyle = selected ? 'rgba(254,243,199,0.6)' : 'rgba(255,255,255,0.35)';
        roundRect(cx - slotSize / 2, cy - slotSize / 2 + lift, slotSize, slotSize, 18); ctx.fill();
        ctx.lineWidth = selected ? 7 : 4; ctx.strokeStyle = selected ? '#fde047' : '#ffffff'; ctx.stroke();
        // Remplissage progressif (mana manquante) en bas du slot.
        if (!affordable) { ctx.fillStyle = 'rgba(15,23,42,0.45)'; const k = 1 - S.mana[me] / og.cost; roundRect(cx - slotSize / 2, cy - slotSize / 2 + lift, slotSize, slotSize * k, 18); ctx.fill(); }
        Sprites.draw(ctx, ogId, view.equipped[me][ogId], cx, cy + lift, slotSize * 0.78, { time: view.time, scaleX: selected ? 1.06 : 1, scaleY: selected ? 1.06 : 1 });
        // Touche + coût.
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0b1021'; roundRect(cx - slotSize / 2 + 6, cy - slotSize / 2 + 6 + lift, 44, 40, 8); ctx.fill();
        ctx.fillStyle = '#fef3c7'; ctx.font = 'bold 26px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(KEY_LABELS[i], cx - slotSize / 2 + 28, cy - slotSize / 2 + 35 + lift);
        ctx.fillStyle = affordable ? '#14532d' : '#7f1d1d'; roundRect(cx + slotSize / 2 - 70, cy + slotSize / 2 - 46 + lift, 64, 40, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Fredoka, sans-serif'; ctx.fillText(String(og.cost), cx + slotSize / 2 - 38, cy + slotSize / 2 - 17 + lift);
        ctx.restore();
      }

      // Bande du haut : adversaire.
      const topH = BAND - BEACH;
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, topH);
      // Mana adverse : barre fine en bas de la bande, se remplit depuis la droite.
      const oppRatio = Math.max(0, Math.min(1, S.mana[opp] / RULES.manaMax));
      const mbY = topH - 52, mbH = 30;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(16, mbY, W - 32, mbH, 10); ctx.fill();
      const g2 = ctx.createLinearGradient(0, mbY, 0, mbY + mbH); g2.addColorStop(0, '#fca5a5'); g2.addColorStop(1, '#dc2626');
      ctx.fillStyle = g2;
      if (oppRatio > 0.01) { roundRect(16 + (W - 32) * (1 - oppRatio), mbY, (W - 32) * oppRatio, mbH, 10); ctx.fill(); }
      ctx.font = 'bold 24px Fredoka, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.fillText(`Mana adverse ${Math.floor(S.mana[opp])} / ${RULES.manaMax}`, 30, mbY + 23);
      // Nom de l'adversaire.
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Fredoka, sans-serif';
      const oppName = view.opponent ? view.opponent.username : 'Adversaire';
      ctx.fillText(oppName, W / 2, 86);
      ctx.font = '28px Fredoka, sans-serif'; ctx.fillStyle = '#fde68a';
      const oppLine = view.opponent ? `🏆 ${view.opponent.trophies}  ·  ${view.opponent.rank || ''}${view.opponent.bot ? '  ·  IA' : ''}` : '';
      ctx.fillText(oppLine, W / 2, 130);
      if (view.presence && view.presence[opp] === false) { ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 28px Fredoka, sans-serif'; ctx.fillText('Adversaire déconnecté… (forfait dans 20 s)', W / 2, 172); }
      // Timer (en haut à gauche) et ping.
      const unlimited = !isFinite(view.timeLeft);
      const left = unlimited ? Math.floor(view.elapsed || 0) : Math.max(0, Math.ceil(view.timeLeft));
      const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(24, 24, 230, 120, 18); ctx.fill();
      ctx.fillStyle = !unlimited && left <= 20 && Math.sin(view.time * 8) > 0 ? '#fca5a5' : '#fef3c7';
      ctx.font = 'bold 54px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${mm}:${ss}`, 139, 112);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(W - 254, 24, 230, 120, 18); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Fredoka, sans-serif';
      ctx.fillText(view.mode === 'ranked' ? 'CLASSÉE' : view.mode === 'bot' ? 'ENTRAÎNEMENT' : 'AMICALE', W - 139, 74);
      ctx.font = '26px Fredoka, sans-serif'; ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${Math.round(view.latency || 0)} ms`, W - 139, 118);

      // Barres de vie (à droite du terrain) + timer.
      const barW = 30, barH = 300, bx = W - barW - 14, midY = FIELD_Y + FIELD.h / 2;
      const bars = [{ y: midY - 60 - barH, hp: S.hp[opp], flash: flashHp[opp], color: ['#fca5a5', '#dc2626'], label: 'ADV' }, { y: midY + 60, hp: S.hp[me], flash: flashHp[me], color: ['#86efac', '#15803d'], label: 'MOI' }];
      for (const b of bars) {
        ctx.fillStyle = '#0b0f1a'; roundRect(bx - 4, b.y - 4, barW + 8, barH + 8, 8); ctx.fill();
        const ratio = Math.max(0, Math.min(1, b.hp / RULES.healthMax));
        const gg = ctx.createLinearGradient(0, b.y, 0, b.y + barH); gg.addColorStop(0, b.color[0]); gg.addColorStop(1, b.color[1]);
        ctx.fillStyle = gg;
        const fillH = barH * ratio;
        const fy = b.label === 'MOI' ? b.y + barH - fillH : b.y; // ma barre se vide par le haut, la sienne par le bas
        ctx.fillRect(bx, fy, barW, fillH);
        if (b.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`; ctx.fillRect(bx, b.y, barW, barH); }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const ty = b.label === 'MOI' ? b.y + barH + 36 : b.y - 14;
        ctx.strokeText(String(b.hp), bx + barW / 2, ty); ctx.fillText(String(b.hp), bx + barW / 2, ty);
      }
      // Alerte scorpion.
      if (hazardWarn > 0 || (S.hazard && S.hazard.phase !== 'dash')) {
        ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(view.time * 12);
        ctx.font = 'bold 52px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#111827';
        ctx.lineWidth = 8; ctx.strokeStyle = '#fde047';
        ctx.strokeText('SCORPION NOIR', W / 2, midY - 200); ctx.fillText('SCORPION NOIR', W / 2, midY - 200);
        ctx.font = '26px Fredoka, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
        ctx.strokeText('Placement bloqué !', W / 2, midY - 150); ctx.fillText('Placement bloqué !', W / 2, midY - 150);
        ctx.restore();
      }

      // Emotes.
      for (const e of emotes) {
        const k = e.t / 2.6, mineE = e.side === me;
        const x = mineE ? 200 : W - 200, y = mineE ? H - BAND - 60 - Math.min(1, e.t * 3) * 30 : FIELD_Y + 70 + Math.min(1, e.t * 3) * 30;
        ctx.save(); ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        ctx.fillStyle = '#fff'; roundRect(x - 90, y - 44, 180, 88, 24); ctx.fill();
        ctx.fillStyle = '#0b1021'; ctx.font = 'bold 52px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(EMOTE_TEXT[e.id] || e.id, x, y + 18); ctx.restore();
      }
    }

    function drawOverlay(view) {
      if (view.phase === 'countdown') {
        ctx.save(); ctx.fillStyle = 'rgba(5,8,20,0.45)'; ctx.fillRect(0, FIELD_Y, W, FIELD.h);
        const n = Math.ceil(view.countdown);
        const frac = view.countdown - Math.floor(view.countdown);
        const s = 1 + (1 - frac) * 0.6;
        ctx.translate(W / 2, FIELD_Y + FIELD.h / 2); ctx.scale(s, s);
        ctx.font = 'bold 220px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fef3c7'; ctx.lineWidth = 14; ctx.strokeStyle = '#1e293b';
        ctx.strokeText(n > 0 ? String(n) : 'GO', 0, 80); ctx.fillText(n > 0 ? String(n) : 'GO', 0, 80);
        ctx.restore();
        ctx.font = 'bold 40px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.fillText(`${view.opponent ? view.opponent.username : '?'}  contre  ${view.meProfile ? view.meProfile.username : 'toi'}`, W / 2, FIELD_Y + FIELD.h / 2 + 220);
      } else if (view.phase === 'go' && view.goTimer > 0) {
        ctx.save(); ctx.globalAlpha = Math.min(1, view.goTimer * 2);
        ctx.font = 'bold 200px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#4ade80'; ctx.lineWidth = 14; ctx.strokeStyle = '#14532d';
        ctx.strokeText('GO!', W / 2, FIELD_Y + FIELD.h / 2 + 70); ctx.fillText('GO!', W / 2, FIELD_Y + FIELD.h / 2 + 70); ctx.restore();
      } else if (view.phase === 'over' && view.result) {
        ctx.save(); ctx.fillStyle = 'rgba(5,8,20,0.5)'; ctx.fillRect(0, FIELD_Y, W, FIELD.h);
        const txt = view.result === 'win' ? 'VICTOIRE' : view.result === 'loss' ? 'DÉFAITE' : 'ÉGALITÉ';
        ctx.font = 'bold 120px "Press Start 2P", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = view.result === 'win' ? '#4ade80' : view.result === 'loss' ? '#f87171' : '#fde68a'; ctx.lineWidth = 14; ctx.strokeStyle = '#0b1021';
        ctx.strokeText(txt, W / 2, FIELD_Y + FIELD.h / 2 + 40); ctx.fillText(txt, W / 2, FIELD_Y + FIELD.h / 2 + 40); ctx.restore();
      }
    }

    let lastNow = performance.now() / 1000;
    function render(view) {
      const now = performance.now() / 1000;
      const dt = Math.min(0.1, now - lastNow); lastNow = now;
      me = view.me;
      stepFx(dt);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = '#0b1021'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawWater(view.time);
      drawHints(view);
      drawOrbs(view);
      const ground = [], air = [];
      for (const e of view.state.entities) (OGS[e.ogId].air ? air : ground).push(e);
      ground.sort((a, b) => vy(a.y) - vy(b.y));
      for (const e of ground) drawEntity(e, view, now);
      drawProjectiles(view);
      for (const e of air) drawEntity(e, view, now);
      drawHazard(view);
      drawFx();
      ctx.restore();
      drawHud(view);
      drawOverlay(view);
    }

    function reset() { anim.clear(); particles = []; floaters = []; rings = []; emotes = []; shake = 0; hazardWarn = 0; flashHp = { top: 0, bottom: 0 }; }

    resize();
    window.addEventListener('resize', resize);
    return { render, resize, onEvent, addEmote, reset, screenToLogical, logicalToWorld, cellRect, W, H, FIELD_Y, BAND, BEACH, get me() { return me; } };
  }

  window.OGSRender = { createRenderer, W, H, FIELD_Y, BAND, BEACH };
})();
