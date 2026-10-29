'use strict';
const Sim = require('../shared/sim.js');
const AI = require('../shared/ai.js');

const TICK_RATE = 30;
const SNAP_EVERY = 1; // snapshots par tick (1 = 30 Hz)
const DISCONNECT_GRACE = 20; // s avant forfait
const SIDES = ['top', 'bottom'];

let nextRoomId = 1;

/*
 * players: [{ client, profile, bot: null | 'simple'|'moyen'|'difficile' }, ...] (index 0 = top, 1 = bottom)
 * mode: 'ranked' | 'bot' | 'friendly'
 * onEnd(room, result) appelé une fois à la fin.
 */
class Room {
  constructor({ players, mode, hazard = false, duration = Sim.RULES.matchDuration, botFill = false, onEnd }) {
    this.id = nextRoomId++;
    this.mode = mode;
    this.botFill = botFill;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.game = Sim.createGame({ seed: this.seed, hazard, duration });
    this.players = players.map((p, i) => ({
      side: SIDES[i], client: p.client || null, profile: p.profile, bot: p.bot || null,
      ai: p.bot ? AI.createAI(this.game, SIDES[i], p.bot) : null,
      connected: !!p.client, disconnectedAt: null, emoteCooldown: 0,
    }));
    this.onEnd = onEnd;
    this.phase = 'countdown';
    this.countdown = Sim.RULES.countdown;
    this.timer = null;
    this.last = Date.now();
    this.acc = 0;
    this.tickCount = 0;
    this.ended = false;
    this.startedAt = Date.now();
  }

  playerBySide(side) { return this.players.find(p => p.side === side); }
  playerByClient(client) { return this.players.find(p => p.client === client); }
  humans() { return this.players.filter(p => !p.bot); }

  send(p, msg) { if (p.client && p.connected) p.client.send(msg); }
  broadcast(msg) { for (const p of this.players) this.send(p, msg); }

  start() {
    for (const p of this.players) {
      if (p.client) p.client.room = this;
      this.send(p, this.startMessage(p));
    }
    this.last = Date.now();
    this.timer = setInterval(() => this.loop(), 1000 / TICK_RATE);
  }

  startMessage(p) {
    const opp = this.players.find(x => x !== p);
    return {
      t: 'match_start', roomId: this.id, mode: this.mode, side: p.side, seed: this.seed,
      countdown: this.countdown, duration: this.game.opts.duration, hazard: this.game.state.hazard.enabled,
      me: p.profile, opponent: opp.profile, opponentIsBot: !!opp.bot,
    };
  }

  // Reconnexion d'un joueur (refresh de page).
  attach(client, userId) {
    const p = this.players.find(x => x.profile && x.profile.id === userId && !x.bot);
    if (!p) return false;
    p.client = client; p.connected = true; p.disconnectedAt = null; client.room = this;
    this.send(p, Object.assign(this.startMessage(p), { reconnect: true, countdown: this.phase === 'countdown' ? this.countdown : 0 }));
    this.send(p, { t: 'snap', s: this.game.snapshot(), ev: [] });
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
      case 'place': {
        if (this.phase !== 'playing') return this.send(p, { t: 'place_rejected', reason: 'countdown', col: msg.col, row: msg.row });
        const r = g.place(p.side, msg.og | 0, msg.col | 0, msg.row | 0);
        if (!r.ok) this.send(p, { t: 'place_rejected', reason: r.reason, og: msg.og, col: msg.col, row: msg.row });
        break;
      }
      case 'orb':
        if (this.phase === 'playing') g.collectOrb(p.side, msg.id | 0);
        break;
      case 'surrender':
        if (this.phase === 'playing') g.surrender(p.side);
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

  loop() {
    const now = Date.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25; // évite les sauts après une pause du process
    const step = 1 / TICK_RATE;

    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'playing'; this.broadcast({ t: 'go' }); }
      return;
    }

    // Forfait sur déconnexion prolongée.
    for (const p of this.players) {
      if (!p.bot && !p.connected && p.disconnectedAt && now - p.disconnectedAt > DISCONNECT_GRACE * 1000) {
        this.game.state.endReason = 'disconnect';
        this.game.surrender(p.side);
        this.game.state.endReason = 'disconnect';
      }
    }

    this.acc += dt;
    let events = [];
    while (this.acc >= step && !this.game.state.over) {
      for (const p of this.players) if (p.ai) p.ai.update(step);
      this.game.step(step);
      events = events.concat(this.game.drainEvents());
      this.acc -= step;
      this.tickCount += 1;
    }
    if (this.tickCount % SNAP_EVERY === 0 || events.length || this.game.state.over) {
      this.broadcast({ t: 'snap', s: this.game.snapshot(), ev: events });
    }
    if (this.game.state.over) this.finish();
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const S = this.game.state;
    const result = { winner: S.winner, reason: S.endReason, duration: S.time, stats: S.stats, hp: S.hp };
    Promise.resolve(this.onEnd ? this.onEnd(this, result) : null).catch(err => console.error('[room] onEnd', err));
  }

  destroy() {
    clearInterval(this.timer);
    for (const p of this.players) if (p.client && p.client.room === this) p.client.room = null;
  }
}

module.exports = { Room, TICK_RATE, DISCONNECT_GRACE };
