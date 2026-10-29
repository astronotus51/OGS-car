/*
 * Contrôleur de match côté client : réception des snapshots, interpolation, entrées clavier/souris.
 */
(function () {
  'use strict';
  const Sim = window.OGSSim;
  const { FIELD, COLS, ROWS, ROWS_PER_SIDE, CELL_W, CELL_H, RADIUS, OGS, RULES } = Sim;
  const INTERP_DELAY = 0.085; // s de retard de rendu pour lisser les snapshots (30 Hz)
  const KEY_TO_OG = { a: 1, q: 1, z: 2, w: 2, e: 3, r: 4, t: 5, y: 6, u: 7 };
  const REJECT_TEXT = { mana: 'Pas assez de mana', occupied: 'Case occupée', front: 'Cet Og se pose sur la ligne avant', hazard: 'Scorpion noir : placement bloqué', side: 'Pas de ton côté', countdown: 'Attends le départ', over: 'Partie terminée', cell: 'Case invalide', banned: 'Créature bannie par ton adversaire' };
  const ABILITY_TEXT = { cooldown: 'Capacité en recharge', mana: 'Pas assez de mana (10)', none: 'Aucune créature de ce type en jeu', disabled: 'Capacités désactivées dans cette partie' };

  function createGame(canvas, renderer, net, ui) {
    let active = false, raf = 0;
    let me = 'bottom', opp = 'top';
    let snaps = []; // { recv, s }
    let latest = null;
    let phase = 'countdown', countdown = 3, goTimer = 0, result = null;
    let selection = null, cursor = null, pending = [];
    let equipped = { top: {}, bottom: {} }, profiles = { me: null, opp: null }, presence = { top: true, bottom: true };
    let duration = RULES.matchDuration, startTime = 0, mouseInField = false, mode = 'ranked';
    let features = {}, bans = { top: [], bottom: [] }, draftTimer = 0, myBan = null, oppBan = null, survival = null;
    const view = {};

    function start(msg) {
      active = true;
      me = msg.side; opp = Sim.other(me);
      snaps = []; latest = null; pending = []; selection = null; result = null;
      phase = msg.phase === 'draft' ? 'draft' : (msg.countdown > 0 ? 'countdown' : 'playing'); countdown = msg.countdown || 0; goTimer = 0;
      features = msg.features || {}; bans = msg.bans || { top: [], bottom: [] }; draftTimer = msg.draftSeconds || 0; myBan = null; oppBan = null; survival = msg.survival || null;
      duration = msg.duration === 0 ? 0 : (msg.duration || RULES.matchDuration); mode = msg.mode || 'ranked';
      profiles = { me: msg.me, opp: msg.opponent };
      equipped[me] = Object.assign({}, OGSCatalog.DEFAULT_EQUIP, msg.me.equipped || {});
      equipped[opp] = Object.assign({}, OGSCatalog.DEFAULT_EQUIP, msg.opponent.equipped || {});
      presence = { top: true, bottom: true }; mouseInField = false;
      renderer.reset();
      cursor = { col: Math.floor(COLS / 2), row: frontRow() };
      startTime = performance.now() / 1000;
      canvas.classList.remove('hidden');
      renderer.resize();
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function stop() {
      active = false; canvas.classList.add('hidden');
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function frontRow() { return me === 'top' ? ROWS_PER_SIDE - 1 : ROWS_PER_SIDE; }
    function myRows() { return me === 'top' ? [0, ROWS_PER_SIDE - 1] : [ROWS_PER_SIDE, ROWS - 1]; }

    // ----- Réseau -----
    function onSnap(msg) {
      const now = performance.now() / 1000;
      const s = Sim.decodeSnapshot(msg.s);
      snaps.push({ recv: now, s });
      if (snaps.length > 12) snaps.shift();
      latest = s;
      if (msg.sv) survival = msg.sv;
      for (const ev of msg.ev || []) {
        renderer.onEvent(ev, now);
        if (ev.type === 'overtime') ui.toast('MORT SUBITE : mana ×3, premier dégât = défaite', 'warn');
        if (ev.type === 'ability' && ev.player === me && !ev.passive) ui.toast(`${Sim.ABILITIES[ev.ogId].name} !`, 'ok');
        if (ev.type === 'evolve' && ev.player === me) ui.toast(`${OGSCatalog.OG_NAMES[ev.ogId]} niveau ${ev.level} !`, 'ok');
        if (ev.type === 'place' && ev.player === me) pending = pending.filter(p => !(Sim.cellOf(ev.x, ev.y).col === p.col && Sim.cellOf(ev.x, ev.y).row === p.row));
        if (ev.type === 'end') finish(ev.winner);
        if (ev.type === 'base' && ev.target === me) ui.toast(`-${ev.amount} PV !`, 'bad');
        if (ev.type === 'hazard' && ev.phase === 'approach') ui.toast('Scorpion noir en approche !', 'warn');
      }
      if (s.over && phase !== 'over') finish(s.over.winner);
    }
    function onGo() { phase = 'go'; goTimer = 0.9; countdown = 0; }
    function onDraftPick(msg) { if (msg.side === me) myBan = msg.og; else oppBan = msg.og; }
    function onDraftEnd(msg) { bans = msg.bans || bans; phase = 'countdown'; countdown = msg.countdown || RULES.countdown; }
    function onAbilityRejected(msg) { ui.toast(ABILITY_TEXT[msg.reason] || 'Capacité refusée', 'bad'); }
    function onWave(msg) { renderer.onEvent({ type: 'wave', wave: msg.wave, count: msg.count }, performance.now() / 1000); ui.toast(`Vague ${msg.wave} : ${msg.count} ennemis !`, 'warn'); }
    function useAbility(ogId) {
      if (!features.abilities) return ui.toast('Capacités désactivées dans cette partie', 'warn');
      if (phase !== 'playing' && phase !== 'go') return;
      const cd = latest && latest.abilities[me] && latest.abilities[me][ogId];
      if (cd) return ui.toast(`${Sim.ABILITIES[ogId].name} : recharge ${Math.ceil(cd)} s`, 'warn');
      net.send({ t: 'ability', og: ogId });
    }
    function pickBan(ogId) { if (phase !== 'draft' || myBan) return; myBan = ogId; net.send({ t: 'ban', og: ogId }); ui.toast(`Tu bannis ${OGSCatalog.OG_NAMES[ogId]}`, 'ok'); }
    function finish(winner) { phase = 'over'; result = mode === 'survival' ? 'survival' : winner === 'draw' ? 'draw' : winner === me ? 'win' : 'loss'; selection = null; }
    function onRejected(msg) { pending = pending.filter(p => !(p.col === msg.col && p.row === msg.row)); ui.toast(REJECT_TEXT[msg.reason] || 'Placement refusé', 'bad'); }
    function onPresence(msg) { presence[msg.side] = msg.connected; }
    function onEmote(msg) { renderer.addEmote(msg.side, msg.id); }

    // ----- Interpolation -----
    function interpolated(now) {
      if (!snaps.length) return null;
      const rt = now - INTERP_DELAY;
      let a = snaps[0], b = snaps[0];
      for (let i = 0; i < snaps.length; i += 1) { if (snaps[i].recv <= rt) a = snaps[i]; if (snaps[i].recv >= rt) { b = snaps[i]; break; } b = snaps[i]; }
      if (a === b || b.recv <= a.recv) return finalize(b.s, b.s, 1, 0);
      const k = Math.max(0, Math.min(1, (rt - a.recv) / (b.recv - a.recv)));
      return finalize(a.s, b.s, k, b.s.t - a.s.t);
    }
    function lerpAngle(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
    function finalize(A, B, k, dtSim) {
      const prev = new Map(A.entities.map(e => [e.id, e]));
      const entities = B.entities.map(e => {
        const p = prev.get(e.id);
        if (!p) return Object.assign({ vx: 0, vy: 0 }, e);
        const vx = dtSim > 0 ? (e.x - p.x) / dtSim : 0, vy = dtSim > 0 ? (e.y - p.y) / dtSim : 0;
        return { id: e.id, ogId: e.ogId, player: e.player, owner: e.owner, hp: e.hp, hpMax: e.hpMax, level: e.level, frozen: e.frozen, boosted: e.boosted, x: p.x + (e.x - p.x) * k, y: p.y + (e.y - p.y) * k, rot: lerpAngle(p.rot, e.rot, k), vx, vy };
      });
      const prevP = new Map(A.projectiles.map(p => [p.id, p]));
      const projectiles = B.projectiles.map(p => { const q = prevP.get(p.id); return q ? Object.assign({}, p, { x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k }) : p; });
      const prevH = A.hazard, H = B.hazard;
      const hazard = H ? (prevH ? { phase: H.phase, x: prevH.x + (H.x - prevH.x) * k, y: prevH.y + (H.y - prevH.y) * k } : H) : null;
      return { t: A.t + (B.t - A.t) * k, hp: B.hp, mana: { top: A.mana.top + (B.mana.top - A.mana.top) * k, bottom: A.mana.bottom + (B.mana.bottom - A.mana.bottom) * k }, entities, projectiles, orbs: B.orbs, hazard, abilities: B.abilities, points: B.points, overtime: B.overtime };
    }

    // ----- Placement -----
    function cellOccupied(col, row) {
      if (!latest) return false;
      const rx = col * CELL_W, ry = row * CELL_H;
      return latest.entities.some(e => {
        const nx = Math.max(rx, Math.min(e.x, rx + CELL_W)), ny = Math.max(ry, Math.min(e.y, ry + CELL_H));
        return (e.x - nx) ** 2 + (e.y - ny) ** 2 <= RADIUS * RADIUS;
      }) || pending.some(p => p.col === col && p.row === row);
    }
    function evolvableAt(ogId, col, row) {
      if (!features.evolution || !latest || !Sim.EVOLVABLE.has(ogId)) return null;
      const c = Sim.cellCenter(col, row);
      return latest.entities.find(e => e.player === me && e.ogId === ogId && (e.level || 1) < Sim.MAX_LEVEL && Math.abs(e.x - c.x) < 1 && Math.abs(e.y - c.y) < 1) || null;
    }
    function isBanned(ogId) { return (bans[me] || []).includes(ogId); }
    function availableCells() {
      if (!selection || isBanned(selection)) return [];
      const og = OGS[selection];
      const [r0, r1] = myRows();
      const cells = [];
      for (let row = r0; row <= r1; row += 1) {
        if (og.frontOnly && row !== frontRow()) continue;
        for (let col = 0; col < COLS; col += 1) {
          if (!cellOccupied(col, row)) cells.push({ col, row });
          else if (evolvableAt(selection, col, row)) cells.push({ col, row, evolve: true });
        }
      }
      return cells;
    }
    function select(ogId) {
      if (phase === 'over') return;
      if (phase === 'draft') return pickBan(ogId);
      if (isBanned(ogId)) return ui.toast(`${OGSCatalog.OG_NAMES[ogId]} est banni dans cette partie`, 'bad');
      selection = selection === ogId ? null : ogId;
      if (selection && OGS[selection].frontOnly) cursor.row = frontRow();
      ui.onSelection && ui.onSelection(selection);
    }
    function tryPlace(col, row) {
      if (!selection || phase === 'over') return;
      if (phase === 'countdown') return ui.toast('Attends le départ !', 'warn');
      const og = OGS[selection];
      const [r0, r1] = myRows();
      if (row < r0 || row > r1) return ui.toast('Pas de ton côté', 'bad');
      if (og.frontOnly && row !== frontRow()) return ui.toast('Cet Og se pose sur la ligne avant', 'bad');
      if (cellOccupied(col, row) && !evolvableAt(selection, col, row)) return ui.toast('Case occupée', 'bad');
      if (latest && latest.mana[me] < og.cost) return ui.toast(`Pas assez de mana (${og.cost})`, 'bad');
      if (latest && latest.hazard) return ui.toast('Scorpion noir : placement bloqué', 'bad');
      net.send({ t: 'place', og: selection, col, row });
      pending.push({ col, row, ogId: selection, t: performance.now() / 1000 });
      selection = null;
      ui.onSelection && ui.onSelection(null);
    }
    function collectOrb(id) { net.send({ t: 'orb', id }); }
    function collectNearestOrb() {
      if (!latest) return;
      const mine = latest.orbs.filter(o => o.player === me);
      if (!mine.length) return ui.toast('Aucune orbe de ton côté', 'warn');
      mine.sort((a, b) => a.life - b.life);
      collectOrb(mine[0].id);
    }
    function moveCursor(dcol, dforward) {
      if (!cursor) return;
      const [r0, r1] = myRows();
      cursor.col = Math.max(0, Math.min(COLS - 1, cursor.col + dcol));
      const drow = me === 'top' ? dforward : -dforward; // "avant" = vers l'ennemi
      cursor.row = Math.max(r0, Math.min(r1, cursor.row + drow));
      if (selection && OGS[selection].frontOnly) cursor.row = frontRow();
    }

    // ----- Entrées -----
    function onKey(ev) {
      if (!active) return;
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      const key = ev.key.toLowerCase();
      let handled = true;
      const ogKey = /^Digit[1-7]$/.test(ev.code) ? Number(ev.code.slice(5)) : (KEY_TO_OG[key] && !ev.ctrlKey && !ev.metaKey ? KEY_TO_OG[key] : 0);
      if (ogKey && ev.shiftKey) useAbility(ogKey);
      else if (ogKey) select(ogKey);
      else if (key === 'arrowleft') moveCursor(-1, 0);
      else if (key === 'arrowright') moveCursor(1, 0);
      else if (key === 'arrowup') moveCursor(0, 1);
      else if (key === 'arrowdown') moveCursor(0, -1);
      else if (key === 'enter' || key === ' ') { if (selection && cursor) tryPlace(cursor.col, cursor.row); else if (!selection) collectNearestOrb(); }
      else if (key === 'escape') { selection = null; ui.onSelection && ui.onSelection(null); }
      else if (key === 'o') collectNearestOrb();
      else handled = false;
      if (handled) ev.preventDefault();
    }
    function pointerCell(ev) {
      const p = renderer.screenToLogical(ev.clientX, ev.clientY);
      if (p.y < renderer.FIELD_Y || p.y > renderer.FIELD_Y + FIELD.h) return { p, cell: null };
      const w = renderer.logicalToWorld(p);
      return { p, w, cell: Sim.cellOf(w.x, w.y) };
    }
    function onPointerMove(ev) {
      if (!active) return;
      const { cell } = pointerCell(ev);
      const [r0, r1] = myRows();
      if (cell && cell.row >= r0 && cell.row <= r1) { mouseInField = true; cursor.col = cell.col; cursor.row = (selection && OGS[selection].frontOnly) ? frontRow() : cell.row; }
      else mouseInField = false;
    }
    function onPointerDown(ev) {
      if (!active) return;
      ev.preventDefault();
      const { p, w, cell } = pointerCell(ev);
      // Slots (bande du bas).
      if (p.y > renderer.H - renderer.BAND + renderer.BEACH) {
        const slot = Math.min(7, Math.max(1, Math.floor(p.x / (renderer.W / 7)) + 1));
        const slotW = renderer.W / 7, inSlotX = p.x - (slot - 1) * slotW;
        if (features.abilities && phase !== 'draft' && inSlotX > slotW * 0.66 && p.y < renderer.H - renderer.BAND + renderer.BEACH + 80) useAbility(slot); else select(slot);
        return;
      }
      if (!cell) return;
      // Orbe ?
      if (latest) {
        const orb = latest.orbs.find(o => o.player === me && (o.x - w.x) ** 2 + (o.y - w.y) ** 2 <= (RULES.orbRadius * 1.4) ** 2);
        if (orb) { collectOrb(orb.id); return; }
      }
      if (selection) tryPlace(cell.col, cell.row);
    }
    function onEmoteClick(id) { net.send({ t: 'emote', id }); }

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', ev => ev.preventDefault());

    // ----- Boucle de rendu -----
    let lastFrame = 0;
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!active) return;
      const now = performance.now() / 1000;
      const dt = lastFrame ? Math.min(0.1, now - lastFrame) : 0; lastFrame = now;
      if (phase === 'draft') { draftTimer = Math.max(0, draftTimer - dt); }
      if (phase === 'countdown') { countdown = Math.max(0, countdown - dt); }
      if (phase === 'go') { goTimer -= dt; if (goTimer <= 0) phase = 'playing'; }
      pending = pending.filter(p => now - p.t < 0.6);
      const state = interpolated(now) || { t: 0, hp: { top: RULES.healthMax, bottom: RULES.healthMax }, mana: { top: 0, bottom: 0 }, entities: [], projectiles: [], orbs: [], hazard: null };
      view.me = me; view.time = now - startTime; view.state = state; view.phase = phase; view.countdown = countdown; view.goTimer = goTimer; view.result = result;
      view.selection = selection; view.cursor = (selection || mouseInField) ? cursor : null; view.availableCells = availableCells(); view.pending = pending;
      view.equipped = equipped; view.opponent = profiles.opp; view.meProfile = profiles.me; view.presence = presence;
      view.timeLeft = duration ? Math.max(0, duration - (latest ? latest.t : 0)) : Infinity; view.elapsed = latest ? latest.t : 0; view.mode = mode; view.latency = net.latency;
      view.features = features; view.bans = bans; view.draft = phase === 'draft' ? { timer: draftTimer, myBan, oppBan } : null; view.survival = survival;
      renderer.render(view);
      ui.onFrame && ui.onFrame(view);
    }

    return { start, stop, onSnap, onGo, onRejected, onPresence, onEmote, onEmoteClick, onDraftPick, onDraftEnd, onAbilityRejected, onWave, useAbility, get active() { return active; }, get phase() { return phase; }, get side() { return me; } };
  }

  window.OGSGame = { createGame };
})();
