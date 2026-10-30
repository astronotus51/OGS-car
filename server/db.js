/*
 * Accès données : Postgres (Supabase) via DATABASE_URL, sinon fichier JSON local (data/store.json).
 * Même interface dans les deux cas.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const USER_COLUMNS = `id, username, password_hash, trophies, best_trophies, xp, coins, wins, losses, draws, streak, equipped, skins, created_at, last_daily, survival_best, quests, google_sub, email, avatar, session_version`;

function defaultUser(username, passwordHash, extra) {
  return Object.assign({
    username, password_hash: passwordHash || '',
    trophies: 0, best_trophies: 0, xp: 0, coins: 50, wins: 0, losses: 0, draws: 0, streak: 0,
    equipped: {}, skins: [], created_at: new Date().toISOString(), last_daily: null, survival_best: 0, quests: {},
    google_sub: null, email: null, avatar: null, session_version: 0,
  }, extra || {});
}

// ---------- Postgres ----------
function createPgStore(url) {
  const { Pool } = require('pg');
  const ssl = /supabase|render|railway|neon|amazonaws/.test(url) || process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl, max: 8 });

  async function init() {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('[db] Postgres prêt');
  }
  const q = (text, params) => pool.query(text, params).then(r => r.rows);
  return {
    kind: 'postgres',
    init,
    async close() { await pool.end(); },
    async getUserByUsername(username) { return (await q(`SELECT ${USER_COLUMNS} FROM users WHERE lower(username) = lower($1)`, [username]))[0] || null; },
    async getUserById(id) { return (await q(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]))[0] || null; },
    async createUser(username, passwordHash, extra) {
      const u = defaultUser(username, passwordHash, extra);
      return (await q(`INSERT INTO users (username, password_hash, coins, equipped, skins, google_sub, email) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${USER_COLUMNS}`,
        [u.username, u.password_hash, u.coins, JSON.stringify(u.equipped), JSON.stringify(u.skins), u.google_sub, u.email]))[0];
    },
    async getUserByGoogleSub(sub) { return (await q(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = $1`, [sub]))[0] || null; },
    async updateUser(id, patch) {
      const keys = Object.keys(patch);
      if (!keys.length) return this.getUserById(id);
      const sets = keys.map((k, i) => `${k} = $${i + 2}`);
      const vals = keys.map(k => (typeof patch[k] === 'object' && patch[k] !== null ? JSON.stringify(patch[k]) : patch[k]));
      return (await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${USER_COLUMNS}`, [id, ...vals]))[0];
    },
    async leaderboard(limit = 50) {
      return q(`SELECT id, username, trophies, best_trophies, xp, wins, losses, survival_best, avatar FROM users ORDER BY trophies DESC, wins DESC LIMIT $1`, [limit]);
    },
    async survivalBoard(limit = 50) {
      return q(`SELECT id, username, trophies, xp, survival_best FROM users WHERE survival_best > 0 ORDER BY survival_best DESC LIMIT $1`, [limit]);
    },
    async countUsers() { return Number((await q(`SELECT count(*)::int AS c FROM users`))[0].c); },
    async rankOf(id) {
      const r = await q(`SELECT 1 + count(*)::int AS rank FROM users u, users me WHERE me.id = $1 AND (u.trophies > me.trophies OR (u.trophies = me.trophies AND u.wins > me.wins))`, [id]);
      return r[0] ? r[0].rank : null;
    },
    async recordMatch(m) {
      return (await q(`INSERT INTO matches (mode, p1_id, p2_id, p1_name, p2_name, winner, reason, duration, p1_delta, p2_delta, stats)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [m.mode, m.p1_id, m.p2_id, m.p1_name, m.p2_name, m.winner, m.reason, m.duration, m.p1_delta, m.p2_delta, JSON.stringify(m.stats || {})]))[0];
    },
    async matchesForUser(id, limit = 10) {
      return q(`SELECT id, mode, p1_id, p2_id, p1_name, p2_name, winner, reason, duration, p1_delta, p2_delta, created_at FROM matches WHERE p1_id = $1 OR p2_id = $1 ORDER BY created_at DESC LIMIT $2`, [id, limit]);
    },
  };
}

// ---------- JSON local ----------
function createJsonStore(file) {
  let data = { users: [], matches: [], nextUser: 1, nextMatch: 1 };
  let saveTimer = null;
  function load() {
    try { if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.warn('[db] store illisible, reset', e.message); }
  }
  function writeNow() {
    clearTimeout(saveTimer); saveTimer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); // écriture atomique
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeNow, 150);
  }
  const clone = (x) => (x ? JSON.parse(JSON.stringify(x)) : x);
  return {
    kind: 'json',
    async init() { load(); console.log(`[db] store JSON : ${file} (${data.users.length} comptes)`); },
    async close() { if (saveTimer) writeNow(); },
    async getUserByUsername(username) { return clone(data.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null); },
    async getUserById(id) { return clone(data.users.find(u => u.id === id) || null); },
    async createUser(username, passwordHash, extra) {
      const u = Object.assign({ id: data.nextUser++ }, defaultUser(username, passwordHash, extra));
      data.users.push(u); save(); return clone(u);
    },
    async getUserByGoogleSub(sub) { return clone(data.users.find(u => u.google_sub === sub) || null); },
    async updateUser(id, patch) {
      const u = data.users.find(x => x.id === id);
      if (!u) return null;
      Object.assign(u, clone(patch)); save(); return clone(u);
    },
    async leaderboard(limit = 50) {
      return clone([...data.users].sort((a, b) => b.trophies - a.trophies || b.wins - a.wins).slice(0, limit)
        .map(u => ({ id: u.id, username: u.username, trophies: u.trophies, best_trophies: u.best_trophies, xp: u.xp, wins: u.wins, losses: u.losses, survival_best: u.survival_best || 0, avatar: u.avatar || null })));
    },
    async survivalBoard(limit = 50) {
      return clone(data.users.filter(u => (u.survival_best || 0) > 0).sort((a, b) => b.survival_best - a.survival_best).slice(0, limit)
        .map(u => ({ id: u.id, username: u.username, trophies: u.trophies, xp: u.xp, survival_best: u.survival_best })));
    },
    async countUsers() { return data.users.length; },
    async rankOf(id) {
      const me = data.users.find(u => u.id === id); if (!me) return null;
      return 1 + data.users.filter(u => u.trophies > me.trophies || (u.trophies === me.trophies && u.wins > me.wins)).length;
    },
    async recordMatch(m) {
      const rec = Object.assign({ id: data.nextMatch++, created_at: new Date().toISOString() }, clone(m));
      data.matches.push(rec); if (data.matches.length > 5000) data.matches.splice(0, data.matches.length - 5000); save(); return { id: rec.id };
    },
    async matchesForUser(id, limit = 10) {
      return clone(data.matches.filter(m => m.p1_id === id || m.p2_id === id).slice(-limit).reverse());
    },
  };
}

function createStore() {
  const url = process.env.DATABASE_URL;
  if (url) return createPgStore(url);
  return createJsonStore(process.env.JSON_STORE || path.join(__dirname, '..', 'data', 'store.json'));
}

module.exports = { createStore };
