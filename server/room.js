'use strict';
const Sim = require('../shared/sim.js');
const AI = require('../shared/ai.js');
const Catalog = require('../shared/catalog.js');

const TICK_RATE = 30;
const DISCONNECT_GRACE = 20; // s avant forfait
const DRAFT_SECONDS = 12;
const SIDES = ['top', 'bottom'];

let nextRoomId = 1;

// Vagues du mode Survie : liste d'unités par vague (ogId), de plus en plus fortes.
function waveComposition(n, rng) {
  const units = [];
  const count = 2 + Math.floor(n * 1.2);
  const pool = n < 3 ? [1, 1, 1, 2] : n < 6 ? [1, 1, 2, 2, 4] : n < 10 ? [1, 2, 4, 4, 7, 2] : [1, 2, 4, 7, 7, 4, 3];
  for (let i = 0; i < count; i += 1) units.push(rng.pick(pool));
  if (n % 4 === 0) units.push(6); // un Mojo de temps en temps pour corser (il faut aller le chercher)
  return units;
}

/*
 * players: [{ client, profile, bot: null | 'simple'|'moyen'|'difficile' }, ...] (index 0 = top, 1 = bottom)
 * mode: 'ranked' | 'bot' | 'friendly' | 'survival'
 * features: objet booléen (shared/features.js, resolveOptions)
 */
class Room {
  constructor({ players, mode, features = {}, duration = Sim.RULES.matchDuration, botFill = false, map = 'random', onEnd }) {
    this.id = nextRoomId++;
    this.map = Catalog.MAPS.some(m => m.id === map) ? map : Catalog.MAPS[Math.floor(Math.random() * Catalog.MAPS.length)].id;
    this.mode = mode;
    this.botFill = botFill;
    this.features = features;
    this.duration = mode === 'survival' ? 0 : duration;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.players = players.map((p, i) => ({
      side: SIDES[i], client: p.client || null, profile: p.profile, bot: p.bot || null, director: !!p.director,
      ai: null, connected: !!p.client, disconnectedAt: null, emoteCooldown: 0, ban: null,
    }));
    this.onEnd = onEnd;
    this.game = null;
    this.phase = features.draft ? 'draft' : 'countdown';
    this.draftTimer = DRAFT_SECONDS;
    this.countdown = Sim.RULES.countdown;
    this.timer = null;
    this.last = Date.now();
    this.acc = 0;
    this.ended = false;
    this.startedAt = Date.now();
    this.survival = mode === 'survival' ? { wave: 0, timer: 6, score: 0, kills: 0 } : null;
    if (this.phase !== 'draft') this.initGame();
  }

  initGame() {
    const bans = { top: [], bottom: [] };
    // Le bannissement choisi par un joueur s'applique à son adversaire.
    for (const p of this.players) if (p.ban) bans[Sim.other(p.side)].push(p.ban);
    this.game = Sim.createGame({ seed: this.seed, hazard: false, duration: this.duration, features: this.features, bans });
    for (const p of this.players) if (p.bot) p.ai = AI.createAI(this.game, p.side, p.bot);
    if (this.survival) this.waveRng = Sim.createRng(this.seed ^ 0x5151);
  }

  playerBySide(side) { return this.players.find(p => p.side === side); }
  playerByClient(client) { return this.players.find(p => p.client === client); }
  humans() { return this.players.filter(p => !p.bot && !p.director); }

  send(p, msg) { if (p.client && p.connected) p.client.send(msg); }
  broadcast(msg) { for (const p of this.players) this.send(p, msg); }

  start() {
    for (const p of this.players) {
      if (p.client) p.client.room = this;
      this.send(p, this.startMessage(p));
    }
    // Les bots bannissent au hasard.
    if (this.phase === 'draft') for (const p of this.players) if (p.bot) p.ban = 1 + Math.floor(Math.random() * 7);
    this.last = Date.now();
    this.timer = setInterval(() => this.loop(), 1000 / TICK_RATE);
  }

  startMessage(p) {
    const opp = this.players.find(x => x !== p);
    return {
      t: 'match_start', roomId: this.id, mode: this.mode, side: p.side, seed: this.seed, map: this.map,
      phase: this.phase, draftSeconds: this.phase === 'draft' ? Math.ceil(this.draftTimer) : 0,
      countdown: this.countdown, duration: this.duration, features: this.features,
      bans: this.game ? this.game.bans : { top: [], bottom: [] },
      me: p.profile, opponent: opp.profile, opponentIsBot: !!opp.bot || !!opp.director,
      survival: this.survival ? { wave: this.survival.wave, score: this.survival.score } : null,
    };
  }

  attach(client, userId) {
    const p = this.players.find(x => x.profile && x.profile.id === userId && !x.bot && !x.director);
    if (!p) return false;
    p.client = client; p.connected = true; p.disconnectedAt = null; client.room = this;
    this.send(p, Object.assign(this.startMessage(p), { reconnect: true, countdown: this.phase === 'countdown' ? this.countdown : 0 }));
    if (this.game) this.send(p, { t: 'snap', s: this.game.snapshot(), ev: [], sv: this.survivalInfo() });
    this.broadcast({ t: 'presence', side: p.side, connected: true });
    return true;
  }

  detach(client) {
    const p = this.playerByClient(client);
    if (!p) return;
    p.connected = false; p.client = null; p.disconnectedAt = Date.now();
    this.broadcast({ t: 'presence', side: p.side, connected: false, grace: DISCONNECT_GRACE });
  }

  handle(client, msg) {
    const p = this.playerByClient(client);
    if (!p || this.ended) return;
    const g = this.game;
    switch (msg.t) {
      case 'ban': {
        if (this.phase !== 'draft') return;
        const og = msg.og | 0;
        if (og >= 1 && og <= 7) { p.ban = og; this.broadcast({ t: 'draft_pick', side: p.side, og: og }); }
        break;
      }
      case 'place': {
        if (this.phase !== 'playing' || !g) return this.send(p, { t: 'place_rejected', reason: 'countdown', col: msg.col, row: msg.row });
        const r = g.place(p.side, msg.og | 0, msg.col | 0, msg.row | 0);
        if (!r.ok) this.send(p, { t: 'place_rejected', reason: r.reason, og: msg.og, col: msg.col, row: msg.row });
        break;
      }
      case 'ability': {
        if (this.phase !== 'playing' || !g) return;
        const r = g.useAbility(p.side, msg.og | 0);
        if (!r.ok) this.send(p, { t: 'ability_rejected', reason: r.reason, og: msg.og });
        break;
      }
      case 'orb':
        if (this.phase === 'playing' && g) g.collectOrb(p.side, msg.id | 0);
        break;
      case 'surrender':
        if (this.phase === 'playing' && g) g.surrender(p.side);
        else if (this.phase !== 'playing') { this.initGameIfNeeded(); this.game.surrender(p.side); this.phase = 'playing'; }
        break;
      case 'emote': {
        const now = Date.now();
        if (now < p.emoteCooldown) return;
        p.emoteCooldown = now + 2500;
        this.broadcast({ t: 'emote', side: p.side, id: String(msg.id || '').slice(0, 24) });
        break;
      }
      default: break;
    }
  }

  initGameIfNeeded() { if (!this.game) this.initGame(); }

  survivalInfo() { return this.survival ? { wave: this.survival.wave, score: Math.round(this.survival.score), next: Math.max(0, Math.round(this.survival.timer)) } : undefined; }

  runSurvival(step) {
    const sv = this.survival;
    sv.timer -= step;
    if (sv.timer <= 0) {
      sv.wave += 1;
      sv.timer = Math.max(7, 16 - sv.wave * 0.6);
      const units = waveComposition(sv.wave, this.waveRng);
      for (const og of units) {
        this.game.setMana('top', 70);
        const cells = this.game.availableCells('top', og);
        if (!cells.length) continue;
        const cell = this.waveRng.pick(cells);
        this.game.place('top', og, cell.col, cell.row);
      }
      this.broadcast({ t: 'wave', wave: sv.wave, count: units.length });
    }
  }

  loop() {
    const now = Date.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    const step = 1 / TICK_RATE;

    if (this.phase === 'draft') {
      this.draftTimer -= dt;
      const allPicked = this.players.every(p => p.ban || p.director);
      if (this.draftTimer <= 0 || allPicked) {
        this.initGame();
        this.phase = 'countdown';
        this.broadcast({ t: 'draft_end', bans: this.game.bans, countdown: this.countdown });
      }
      return;
    }
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'playing'; this.broadcast({ t: 'go' }); }
      return;
    }

    for (const p of this.players) {
      if (!p.bot && !p.director && !p.connected && p.disconnectedAt && now - p.disconnectedAt > DISCONNECT_GRACE * 1000) {
        this.game.surrender(p.side);
        this.game.state.endReason = 'disconnect';
      }
    }

    this.acc += dt;
    let events = [];
    while (this.acc >= step && !this.game.state.over) {
      for (const p of this.players) if (p.ai) p.ai.update(step);
      if (this.survival) this.runSurvival(step);
      this.game.step(step);
      const ev = this.game.drainEvents();
      if (this.survival) for (const e of ev) if (e.type === 'kill' && e.player === 'top') { this.survival.kills += 1; this.survival.score += 10; }
      events = events.concat(ev);
      this.acc -= step;
    }
    if (this.survival) this.survival.score = this.survival.kills * 10 + this.survival.wave * 50 + Math.floor(this.game.state.time);
    this.broadcast({ t: 'snap', s: this.game.snapshot(), ev: events, sv: this.survivalInfo() });
    if (this.game.state.over) this.finish();
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const S = this.game.state;
    const result = { winner: S.winner, reason: S.endReason, duration: S.time, stats: S.stats, hp: S.hp, points: S.points, survival: this.survival ? { wave: this.survival.wave, score: Math.round(this.survival.score), kills: this.survival.kills } : null };
    Promise.resolve(this.onEnd ? this.onEnd(this, result) : null).catch(err => console.error('[room] onEnd', err));
  }

  destroy() {
    clearInterval(this.timer);
    for (const p of this.players) if (p.client && p.client.room === this) p.client.room = null;
  }
}

module.exports = { Room, TICK_RATE, DISCONNECT_GRACE, DRAFT_SECONDS };
