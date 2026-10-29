/*
 * Sprites : chargement des PNG, variantes de skins pré-rendues (cache 256 px => rendu fluide),
 * effets de skin (fx) appliqués même sans PNG dédié.
 */
(function () {
  'use strict';
  const BASE = 256;
  const GLOW_PAD = 28;
  const images = {}; // url -> HTMLImageElement | null (échec)
  const variants = {}; // key -> [canvas, ...] (plusieurs frames pour les fx animés)
  const pending = {};
  const supportsFilter = (() => { try { const c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string'; } catch (e) { return false; } })();

  function loadImage(url) {
    if (url in images) return Promise.resolve(images[url]);
    if (pending[url]) return pending[url];
    pending[url] = new Promise(resolve => {
      const img = new Image();
      img.onload = () => { images[url] = img; delete pending[url]; resolve(img); };
      img.onerror = () => { images[url] = null; delete pending[url]; resolve(null); };
      img.src = url;
    });
    return pending[url];
  }

  function defaultUrl(ogId) { return `assets/skins/og${ogId}_default.png`; }
  function skinUrl(skinId) { return `assets/skins/${skinId}.png`; }

  function makeCanvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

  // Dessine `img` centré dans un canvas de taille `size` avec marge `pad`.
  function baseDraw(img, size, pad, filter, glow) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const inner = size - pad * 2;
    const scale = inner / Math.max(img.width, img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (glow) { ctx.shadowColor = glow.color; ctx.shadowBlur = glow.blur; }
    if (filter && supportsFilter) ctx.filter = filter;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    ctx.filter = 'none'; ctx.shadowBlur = 0;
    return c;
  }
  function tint(canvas, color, alpha) {
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    return canvas;
  }
  function sparkles(canvas, count, color, seed) {
    const ctx = canvas.getContext('2d');
    let s = seed || 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < count; i += 1) {
      const x = 30 + rnd() * (canvas.width - 60), y = 30 + rnd() * (canvas.height - 60), r = 3 + rnd() * 6;
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) { const a = (Math.PI / 4) * k; const rr = k % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    return canvas;
  }

  // Construit les frames d'un skin à partir de son image (dédiée ou défaut) et de son fx.
  function buildVariant(img, fx) {
    const size = BASE + GLOW_PAD * 2, pad = GLOW_PAD;
    switch (fx) {
      case 'neon': {
        const c = baseDraw(img, size, pad, 'saturate(1.7) brightness(1.12)', { color: 'rgba(34,211,238,0.95)', blur: 22 });
        return [supportsFilter ? c : tint(c, '#22d3ee', 0.25)];
      }
      case 'gold': {
        const c = baseDraw(img, size, pad, 'sepia(1) saturate(2.6) hue-rotate(-8deg) brightness(1.08)', { color: 'rgba(251,191,36,0.8)', blur: 14 });
        return [supportsFilter ? c : tint(c, '#f59e0b', 0.55)];
      }
      case 'shadow': {
        const c = baseDraw(img, size, pad, 'brightness(0.32) contrast(1.25) saturate(0.6)', { color: 'rgba(168,85,247,0.9)', blur: 24 });
        return [supportsFilter ? c : tint(c, '#1e1033', 0.7)];
      }
      case 'prism': {
        const frames = [];
        for (let i = 0; i < 12; i += 1) {
          const hue = i * 30;
          const c = baseDraw(img, size, pad, `hue-rotate(${hue}deg) saturate(1.5)`, { color: `hsla(${hue}, 90%, 60%, 0.9)`, blur: 18 });
          frames.push(supportsFilter ? c : tint(c, `hsl(${hue}, 90%, 55%)`, 0.35));
        }
        return frames;
      }
      case 'champion': {
        const c = baseDraw(img, size, pad, 'sepia(1) saturate(3) hue-rotate(-10deg) brightness(1.15)', { color: 'rgba(255,255,255,0.9)', blur: 20 });
        return [sparkles(supportsFilter ? c : tint(c, '#f59e0b', 0.55), 7, 'rgba(255,255,255,0.95)', 11)];
      }
      case 'nova': {
        const c = baseDraw(img, size, pad, 'saturate(1.8) brightness(1.2) contrast(1.1)', { color: 'rgba(249,115,22,1)', blur: 30 });
        return [sparkles(supportsFilter ? c : tint(c, '#f97316', 0.3), 5, 'rgba(254,240,138,0.95)', 23)];
      }
      default:
        return [baseDraw(img, size, pad, null, null)];
    }
  }

  // Silhouette blanche d'une frame (flash de dégâts), mise en cache sur la frame.
  function whiteOf(frame) {
    if (frame._white) return frame._white;
    const c = makeCanvas(frame.width);
    const ctx = c.getContext('2d');
    ctx.drawImage(frame, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    frame._white = c;
    return c;
  }

  const Sprites = {
    BASE, GLOW_PAD, ready: false,
    async preload(skinIds) {
      await Promise.all([1, 2, 3, 4, 5, 6, 7].map(id => loadImage(defaultUrl(id))));
      Sprites.ready = true;
      if (skinIds) await Promise.all(skinIds.map(id => Sprites.ensure(id)));
    },
    // Garantit que les frames d'un skin sont prêtes (asynchrone, idempotent).
    async ensure(skinId) {
      if (variants[skinId]) return variants[skinId];
      const skin = (window.OGSCatalog && OGSCatalog.SKIN_BY_ID[skinId]) || null;
      const ogId = skin ? skin.ogId : parseInt(String(skinId).replace(/^og(\d).*/, '$1'), 10) || 1;
      let img = skin && skin.unlock.type !== 'default' ? await loadImage(skinUrl(skinId)) : null;
      const dedicated = !!img;
      if (!img) img = await loadImage(defaultUrl(ogId));
      if (!img) return null;
      variants[skinId] = buildVariant(img, dedicated ? null : (skin ? skin.fx : null));
      return variants[skinId];
    },
    frames(skinId) {
      if (variants[skinId]) return variants[skinId];
      Sprites.ensure(skinId);
      return null;
    },
    frame(skinId, time) {
      const fr = Sprites.frames(skinId);
      if (!fr) return null;
      if (fr.length === 1) return fr[0];
      return fr[Math.floor(((time || 0) * 8) % fr.length)];
    },
    /*
     * Dessine un Og. opts : { rot, flipV, flipH, alpha, scaleX, scaleY, flash, time, fallbackColor }
     * `size` = taille visuelle du sprite (sans la marge de glow).
     */
    draw(ctx, ogId, skinId, x, y, size, opts) {
      const o = opts || {};
      const fr = Sprites.frame(skinId || `og${ogId}_default`, o.time) || Sprites.frame(`og${ogId}_default`, o.time);
      ctx.save();
      ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale((o.flipH ? -1 : 1) * (o.scaleX || 1), (o.flipV ? -1 : 1) * (o.scaleY || 1));
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      if (fr) {
        const full = size * (fr.width / BASE);
        ctx.drawImage(fr, -full / 2, -full / 2, full, full);
        if (o.flash) {
          ctx.globalAlpha = (o.alpha !== undefined ? o.alpha : 1) * Math.min(1, o.flash);
          ctx.drawImage(whiteOf(fr), -full / 2, -full / 2, full, full);
        }
      } else {
        ctx.fillStyle = o.fallbackColor || '#fff';
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return !!fr;
    },
  };
  window.Sprites = Sprites;
})();
