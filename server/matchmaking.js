'use strict';
/*
 * File d'attente façon Brawl Stars :
 *  - on apparie deux joueurs dont l'écart de trophées tient dans une fenêtre qui s'élargit avec l'attente ;
 *  - au-delà de BOT_FILL_SECONDS sans adversaire, un bot de niveau adapté complète la partie.
 */
const BOT_FILL_SECONDS = Number(process.env.BOT_FILL_SECONDS || 15);
const TICK_MS = 1000;

function bandFor(waitSec) { return Math.min(3000, 100 + Math.floor(waitSec / 3) * 75); }
function botDifficultyFor(trophies) { return trophies < 200 ? 'simple' : trophies < 700 ? 'moyen' : 'difficile'; }

class Matchmaker {
  constructor({ createMatch }) {
    this.queue = []; // { client, profile, since }
    this.createMatch = createMatch;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  join(client, profile) {
    if (this.queue.some(e => e.client === client)) return;
    this.queue.push({ client, profile, since: Date.now() });
    client.send({ t: 'queued', size: this.queue.length, botFillIn: BOT_FILL_SECONDS });
  }

  leave(client) {
    const i = this.queue.findIndex(e => e.client === client);
    if (i !== -1) this.queue.splice(i, 1);
  }

  has(client) { return this.queue.some(e => e.client === client); }

  tick() {
    const now = Date.now();
    // Nettoyage des sockets fermés.
    this.queue = this.queue.filter(e => e.client.alive);
    const q = [...this.queue].sort((a, b) => a.since - b.since);
    const matched = new Set();
    for (let i = 0; i < q.length; i += 1) {
      const a = q[i];
      if (matched.has(a)) continue;
      const waitA = (now - a.since) / 1000;
      let best = null, bestDiff = Infinity;
      for (let j = i + 1; j < q.length; j += 1) {
        const b = q[j];
        if (matched.has(b)) continue;
        if (a.profile.id === b.profile.id) continue;
        const waitB = (now - b.since) / 1000;
        const diff = Math.abs(a.profile.trophies - b.profile.trophies);
        if (diff <= Math.max(bandFor(waitA), bandFor(waitB)) && diff < bestDiff) { best = b; bestDiff = diff; }
      }
      if (best) {
        matched.add(a); matched.add(best);
        this.leave(a.client); this.leave(best.client);
        this.createMatch([{ client: a.client, profile: a.profile }, { client: best.client, profile: best.profile }], { mode: 'ranked' });
      } else if (waitA >= BOT_FILL_SECONDS) {
        matched.add(a);
        this.leave(a.client);
        this.createMatch([{ client: a.client, profile: a.profile }], { mode: 'ranked', botFill: true, bot: botDifficultyFor(a.profile.trophies) });
      } else {
        a.client.send({ t: 'queued', size: this.queue.length, wait: Math.round(waitA), band: bandFor(waitA), botFillIn: Math.max(0, Math.round(BOT_FILL_SECONDS - waitA)) });
      }
    }
  }
}

module.exports = { Matchmaker, BOT_FILL_SECONDS, botDifficultyFor };
