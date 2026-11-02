'use strict';
/*
 * File d'attente façon Brawl Stars, une file par taille d'équipe (1v1, 2v2, 3v3) :
 *  - on apparie des joueurs dont l'écart de trophées tient dans une fenêtre qui s'élargit avec l'attente ;
 *  - au-delà de BOT_FILL_SECONDS sans assez de monde, des bots de niveau adapté complètent la partie.
 */
const BOT_FILL_SECONDS = Number(process.env.BOT_FILL_SECONDS || 15);
const TICK_MS = 1000;
const MODE_BY_TEAM = { 1: 'ranked', 2: 'duo', 3: 'trio' };

function bandFor(waitSec) { return Math.min(3000, 100 + Math.floor(waitSec / 3) * 75); }
function botDifficultyFor(trophies) { return trophies < 200 ? 'simple' : trophies < 700 ? 'moyen' : 'difficile'; }

class Matchmaker {
  constructor({ createMatch }) {
    this.queue = []; // { client, profile, since, team }
    this.createMatch = createMatch;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  join(client, profile, team = 1) {
    if (this.queue.some(e => e.client === client)) return;
    this.queue.push({ client, profile, since: Date.now(), team: Math.max(1, Math.min(3, team | 0)) });
    client.send({ t: 'queued', size: this.queue.length, botFillIn: BOT_FILL_SECONDS, team });
  }

  leave(client) {
    const i = this.queue.findIndex(e => e.client === client);
    if (i !== -1) this.queue.splice(i, 1);
  }

  has(client) { return this.queue.some(e => e.client === client); }

  tick() {
    const now = Date.now();
    this.queue = this.queue.filter(e => e.client.alive); // sockets fermés
    for (const team of [1, 2, 3]) this.tickPool(team, now);
  }

  tickPool(team, now) {
    const need = team * 2;
    const q = this.queue.filter(e => e.team === team).sort((a, b) => a.since - b.since);
    if (!q.length) return;
    const mode = MODE_BY_TEAM[team];
    const matched = new Set();
    for (const a of q) {
      if (matched.has(a)) continue;
      const waitA = (now - a.since) / 1000;
      // Candidats : joueurs différents, dans la fenêtre de trophées de a (élargie par l'attente de chacun), les plus proches d'abord.
      const cands = q.filter(b => b !== a && !matched.has(b) && b.profile.id !== a.profile.id
        && Math.abs(a.profile.trophies - b.profile.trophies) <= Math.max(bandFor(waitA), bandFor((now - b.since) / 1000)))
        .sort((x, y) => Math.abs(a.profile.trophies - x.profile.trophies) - Math.abs(a.profile.trophies - y.profile.trophies));
      const group = [a, ...cands.slice(0, need - 1)];
      if (group.length === need) {
        for (const e of group) { matched.add(e); this.leave(e.client); }
        this.createMatch(group.map(e => ({ client: e.client, profile: e.profile })), { mode, teamSize: team });
      } else if (waitA >= BOT_FILL_SECONDS) {
        // Pas assez de monde : on part avec ceux qui sont là, le reste en bots.
        for (const e of group) { matched.add(e); this.leave(e.client); }
        const avg = group.reduce((n, e) => n + e.profile.trophies, 0) / group.length;
        this.createMatch(group.map(e => ({ client: e.client, profile: e.profile })), { mode, teamSize: team, botFill: true, bot: botDifficultyFor(avg) });
      } else {
        a.client.send({ t: 'queued', size: q.length, wait: Math.round(waitA), band: bandFor(waitA), botFillIn: Math.max(0, Math.round(BOT_FILL_SECONDS - waitA)), team, found: group.length, need });
      }
    }
  }
}

module.exports = { Matchmaker, BOT_FILL_SECONDS, botDifficultyFor, MODE_BY_TEAM };
