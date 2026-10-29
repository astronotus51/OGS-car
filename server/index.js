'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Catalog = require('../shared/catalog.js');
const { createStore } = require('./db.js');
const { publicProfile, applyResult, ownedSkins, equippedOf } = require('./profile.js');
const { Room } = require('./room.js');
const { Matchmaker } = require('./matchmaking.js');

const PORT = Number(process.env.PORT || 3000);
const DAILY_COINS = 25;

// ---------- Secret JWT (env ou fichier persistant) ----------
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(__dirname, '..', 'data', 'jwt-secret.txt');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (e) { /* créé ci-dessous */ }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, secret);
  return secret;
}
const JWT_SECRET = loadSecret();

const db = createStore();
const app = express();
app.use(express.json({ limit: '32kb' }));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Auth REST ----------
const USERNAME_RE = /^[A-Za-z0-9_\-éèêàçùîïôûÉÈÀ]{3,16}$/;
function signToken(user) { return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' }); }
function userFromToken(token) {
  try { return jwt.verify(token, JWT_SECRET).uid; } catch (e) { return null; }
}
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const uid = userFromToken(h.replace(/^Bearer /, ''));
  if (!uid) return res.status(401).json({ error: 'Non connecté' });
  const user = await db.getUserById(uid);
  if (!user) return res.status(401).json({ error: 'Compte introuvable' });
  req.user = user;
  next();
}
const wrap = fn => (req, res) => fn(req, res).catch(err => { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });

app.post('/api/register', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ -)' });
  if (typeof password !== 'string' || password.length < 4) return res.status(400).json({ error: 'Mot de passe : 4 caractères minimum' });
  if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
  const user = await db.createUser(username, await bcrypt.hash(password, 10));
  res.json({ token: signToken(user), profile: publicProfile(user) });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const user = typeof username === 'string' ? await db.getUserByUsername(username) : null;
  if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
  res.json({ token: signToken(user), profile: publicProfile(user) });
}));

app.get('/api/me', authMiddleware, wrap(async (req, res) => {
  const rank = await db.rankOf(req.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const lastDaily = req.user.last_daily ? String(req.user.last_daily).slice(0, 10) : null;
  res.json({ profile: publicProfile(req.user, { leaderboardRank: rank, dailyAvailable: lastDaily !== today, dailyCoins: DAILY_COINS }) });
}));

app.post('/api/daily', authMiddleware, wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const lastDaily = req.user.last_daily ? String(req.user.last_daily).slice(0, 10) : null;
  if (lastDaily === today) return res.status(400).json({ error: 'Déjà récupéré aujourd’hui' });
  const user = await db.updateUser(req.user.id, { coins: (req.user.coins || 0) + DAILY_COINS, last_daily: today });
  res.json({ coins: DAILY_COINS, profile: publicProfile(user, { dailyAvailable: false, dailyCoins: DAILY_COINS }) });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  const rows = await db.leaderboard(50);
  res.json({ leaderboard: rows.map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, trophies: r.trophies, wins: r.wins, losses: r.losses, level: Catalog.levelFromXp(r.xp || 0).level, league: Catalog.rankFor(r.trophies).name })) });
}));

app.get('/api/history', authMiddleware, wrap(async (req, res) => {
  const rows = await db.matchesForUser(req.user.id, 15);
  res.json({ history: rows.map(m => {
    const isP1 = m.p1_id === req.user.id;
    const result = m.winner === 'draw' ? 'draw' : (m.winner === (isP1 ? 'p1' : 'p2') ? 'win' : 'loss');
    return { id: m.id, mode: m.mode, opponent: isP1 ? m.p2_name : m.p1_name, result, reason: m.reason, duration: m.duration, delta: isP1 ? m.p1_delta : m.p2_delta, at: m.created_at };
  }) });
}));

app.post('/api/skins/buy', authMiddleware, wrap(async (req, res) => {
  const skin = Catalog.SKIN_BY_ID[String(req.body && req.body.skinId)];
  if (!skin) return res.status(404).json({ error: 'Skin inconnu' });
  const owned = ownedSkins(req.user);
  if (owned.includes(skin.id)) return res.status(400).json({ error: 'Déjà possédé' });
  if (skin.unlock.type !== 'coins') return res.status(400).json({ error: 'Ce skin se débloque en jouant' });
  if ((req.user.coins || 0) < skin.unlock.value) return res.status(400).json({ error: 'Pas assez de pièces' });
  const equipped = equippedOf(req.user); equipped[skin.ogId] = skin.id;
  const user = await db.updateUser(req.user.id, { coins: req.user.coins - skin.unlock.value, skins: [...owned, skin.id], equipped });
  res.json({ profile: publicProfile(user) });
}));

app.post('/api/skins/equip', authMiddleware, wrap(async (req, res) => {
  const skin = Catalog.SKIN_BY_ID[String(req.body && req.body.skinId)];
  if (!skin) return res.status(404).json({ error: 'Skin inconnu' });
  if (!ownedSkins(req.user).includes(skin.id)) return res.status(403).json({ error: 'Skin non possédé' });
  const equipped = equippedOf(req.user); equipped[skin.ogId] = skin.id;
  const user = await db.updateUser(req.user.id, { equipped });
  res.json({ profile: publicProfile(user) });
}));

app.get('/api/stats', (req, res) => {
  res.json({ online: clients.size, inQueue: matchmaker.queue.length, inMatch: [...rooms].reduce((n, r) => n + r.humans().filter(p => p.connected).length, 0), friendlyRooms: friendly.size });
});

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();
const rooms = new Set();
const friendly = new Map(); // code -> { host: client, hazard }
const byUser = new Map(); // userId -> client

function createMatch(entries, { mode, botFill = false, bot = null, hazard = true }) {
  const players = entries.map(e => ({ client: e.client, profile: e.profile, bot: null }));
  if (bot) {
    const trophies = entries[0].profile.trophies;
    const names = { simple: 'Bot Oggy', moyen: 'Bot Ogma', difficile: 'Bot Ogzilla' };
    players.push({ client: null, profile: { id: null, username: names[bot], trophies: Math.max(0, trophies + Math.round((Math.random() - 0.5) * 60)), level: bot === 'simple' ? 3 : bot === 'moyen' ? 12 : 30, rank: Catalog.rankFor(trophies).name, equipped: Catalog.DEFAULT_EQUIP, bot: true, difficulty: bot }, bot });
  }
  if (Math.random() < 0.5) players.reverse();
  const room = new Room({ players, mode, hazard, botFill, onEnd: endMatch });
  rooms.add(room);
  for (const p of room.players) if (p.client) { matchmaker.leave(p.client); p.client.room = room; }
  room.start();
  console.log(`[match] #${room.id} ${mode}${botFill ? ' (bot-fill)' : ''} : ${room.players.map(p => `${p.profile.username}(${p.side})`).join(' vs ')}`);
}

async function endMatch(room, result) {
  rooms.delete(room);
  const [a, b] = room.players;
  const outcome = {};
  for (const p of room.players) {
    const opp = room.players.find(x => x !== p);
    const res = result.winner === 'draw' ? 'draw' : result.winner === p.side ? 'win' : 'loss';
    outcome[p.side] = { res, opp };
  }
  const deltas = {};
  const payloads = {};
  for (const p of room.players) {
    if (p.bot || !p.profile || !p.profile.id) continue;
    const user = await db.getUserById(p.profile.id);
    if (!user) continue;
    const { res, opp } = outcome[p.side];
    const rewardMode = room.mode;
    const applied = applyResult(user, opp.profile, res, rewardMode);
    if (room.botFill && applied.rewards.trophies > 0) {
      applied.rewards.trophies = Math.ceil(applied.rewards.trophies / 2);
      applied.patch.trophies = (user.trophies || 0) + applied.rewards.trophies;
      applied.patch.best_trophies = Math.max(user.best_trophies || 0, applied.patch.trophies);
    }
    const updated = await db.updateUser(user.id, applied.patch);
    deltas[p.side] = applied.rewards.trophies;
    const profile = publicProfile(updated);
    if (p.client) p.client.profile = profile;
    const live = byUser.get(user.id);
    if (live) live.profile = profile;
    payloads[p.side] = { t: 'match_end', side: p.side, result: res, winner: result.winner, reason: result.reason, duration: Math.round(result.duration), hp: result.hp, stats: result.stats, rewards: applied.rewards, levelUp: applied.levelUp, unlocked: applied.unlocked, profile, opponent: opp.profile };
  }
  for (const p of room.players) if (payloads[p.side]) room.send(p, payloads[p.side]);
  try {
    await db.recordMatch({
      mode: room.mode + (room.botFill ? '-botfill' : ''), p1_id: a.profile.id || null, p2_id: b.profile.id || null,
      p1_name: a.profile.username, p2_name: b.profile.username,
      winner: result.winner === 'draw' ? 'draw' : result.winner === a.side ? 'p1' : 'p2',
      reason: result.reason, duration: Math.round(result.duration), p1_delta: deltas[a.side] || 0, p2_delta: deltas[b.side] || 0, stats: result.stats,
    });
  } catch (err) { console.error('[db] recordMatch', err.message); }
  room.destroy();
}

const matchmaker = new Matchmaker({ createMatch });

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) code += alphabet[crypto.randomInt(alphabet.length)];
  return friendly.has(code) ? makeCode() : code;
}

wss.on('connection', (ws) => {
  const client = {
    ws, alive: true, user: null, profile: null, room: null, friendlyCode: null,
    send(msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); },
  };
  clients.add(client);
  let authed = false;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;

    if (!authed) {
      if (msg.t !== 'auth') return client.send({ t: 'auth_error', error: 'Authentification requise' });
      const uid = userFromToken(String(msg.token || ''));
      const user = uid ? await db.getUserById(uid) : null;
      if (!user) return client.send({ t: 'auth_error', error: 'Session expirée, reconnecte-toi' });
      authed = true;
      client.user = user; client.profile = publicProfile(user);
      // Une seule connexion par compte : on ferme l'ancienne.
      const prev = byUser.get(user.id);
      if (prev && prev !== client) { prev.send({ t: 'kicked', reason: 'Connecté ailleurs' }); prev.ws.close(); }
      byUser.set(user.id, client);
      client.send({ t: 'auth_ok', profile: client.profile, online: clients.size });
      // Reprise d'une partie en cours.
      for (const room of rooms) if (!room.ended && room.attach(client, user.id)) break;
      return;
    }

    switch (msg.t) {
      case 'ping': client.send({ t: 'pong', ts: msg.ts, online: clients.size }); break;
      case 'queue':
        if (client.room) return;
        leaveFriendly(client);
        matchmaker.join(client, client.profile);
        break;
      case 'cancel':
        matchmaker.leave(client);
        client.send({ t: 'idle' });
        break;
      case 'bot': {
        if (client.room) return;
        matchmaker.leave(client); leaveFriendly(client);
        const diff = ['simple', 'moyen', 'difficile'].includes(msg.difficulty) ? msg.difficulty : 'moyen';
        createMatch([{ client, profile: client.profile }], { mode: 'bot', bot: diff, hazard: msg.hazard !== false });
        break;
      }
      case 'friendly_create': {
        if (client.room) return;
        matchmaker.leave(client); leaveFriendly(client);
        const code = makeCode();
        friendly.set(code, { host: client, hazard: msg.hazard !== false });
        client.friendlyCode = code;
        client.send({ t: 'friendly_created', code });
        break;
      }
      case 'friendly_join': {
        if (client.room) return;
        const code = String(msg.code || '').toUpperCase().trim();
        const entry = friendly.get(code);
        if (!entry || !entry.host.alive) return client.send({ t: 'error', error: 'Code introuvable' });
        if (entry.host === client) return client.send({ t: 'error', error: 'C’est ta propre salle' });
        matchmaker.leave(client); leaveFriendly(client);
        friendly.delete(code); entry.host.friendlyCode = null;
        createMatch([{ client: entry.host, profile: entry.host.profile }, { client, profile: client.profile }], { mode: 'friendly', hazard: entry.hazard });
        break;
      }
      case 'friendly_leave': leaveFriendly(client); client.send({ t: 'idle' }); break;
      case 'place': case 'orb': case 'surrender': case 'emote':
        if (client.room) client.room.handle(client, msg);
        break;
      default: break;
    }
  });

  ws.on('close', () => {
    client.alive = false;
    clients.delete(client);
    matchmaker.leave(client);
    leaveFriendly(client);
    if (client.room) client.room.detach(client);
    if (client.user && byUser.get(client.user.id) === client) byUser.delete(client.user.id);
  });
  ws.on('error', () => {});
});

function leaveFriendly(client) {
  if (client.friendlyCode) { friendly.delete(client.friendlyCode); client.friendlyCode = null; }
}

// Heartbeat WS.
setInterval(() => {
  for (const c of clients) {
    if (c.ws.readyState !== 1) continue;
    if (c.pingPending) { c.ws.terminate(); continue; }
    c.pingPending = true;
    c.ws.ping(() => {});
  }
}, 30000);
wss.on('connection', (ws) => { ws.on('pong', () => { for (const c of clients) if (c.ws === ws) c.pingPending = false; }); });

db.init().then(() => {
  server.listen(PORT, () => console.log(`OGS Online -> http://localhost:${PORT}  (db: ${db.kind})`));
}).catch(err => { console.error('Impossible de démarrer la base :', err.message); process.exit(1); });
