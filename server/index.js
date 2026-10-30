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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { OAuth2Client } = require('google-auth-library');

const Catalog = require('../shared/catalog.js');
const Sim = require('../shared/sim.js');
const Features = require('../shared/features.js');
const { createStore } = require('./db.js');
const { publicProfile, applyResult, ownedSkins, equippedOf, questsOf, questsView, isAdmin } = require('./profile.js');
const { Room } = require('./room.js');
const { Matchmaker } = require('./matchmaking.js');

const PORT = Number(process.env.PORT || 3000);
const DAILY_COINS = 25;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const COOKIE = 'ogs_session';
const DUMMY_HASH = bcrypt.hashSync(`dummy-${crypto.randomBytes(8).toString('hex')}`, 12);
const SESSION_DAYS = 30;

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
app.set('trust proxy', 1); // derrière nginx : vraie IP pour le rate limiting, détection https
app.disable('x-powered-by');
// En-têtes de sécurité (CSP : scripts/polices/connexions autorisés uniquement depuis le site, Google Fonts et Google Identity).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://accounts.google.com'],
      frameSrc: ['https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: { maxAge: 15552000, includeSubDomains: true },
}));
app.use(cookieParser());
app.use(express.json({ limit: '120kb' }));
// Anti-CSRF : les requêtes qui modifient quelque chose doivent venir de notre propre origine.
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next();
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && new URL(origin).host !== host) return res.status(403).json({ error: 'Origine non autorisée' });
  next();
});
// Limites de requêtes : connexion/inscription (anti force brute) et API générale.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de tentatives, réessaie dans 15 minutes' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de requêtes' } });
app.use('/api', apiLimiter);
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use((req, res, next) => { if (/\.(js|css|html)$/.test(req.path) || req.path === '/') res.setHeader('Cache-Control', 'no-cache'); next(); });
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Auth REST ----------
const USERNAME_RE = /^[A-Za-z0-9_\-éèêàçùîïôûÉÈÀ]{3,16}$/;
function signToken(user) { return jwt.sign({ uid: user.id, sv: user.session_version || 0 }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` }); }
function decodeToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}
function isSecure(req) { return req.secure || req.headers['x-forwarded-proto'] === 'https'; }
// Session dans un cookie httpOnly (inaccessible au JavaScript de la page => protégé contre le vol par XSS), SameSite=Lax (anti-CSRF).
function setSession(req, res, user) {
  res.cookie(COOKIE, signToken(user), { httpOnly: true, sameSite: 'lax', secure: isSecure(req), maxAge: SESSION_DAYS * 86400 * 1000, path: '/' });
}
function clearSession(req, res) { res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: isSecure(req), path: '/' }); }
async function userFromRequest(reqLike) {
  const cookies = reqLike.cookies || parseCookies(reqLike.headers && reqLike.headers.cookie);
  const payload = decodeToken(cookies[COOKIE] || '');
  if (!payload) return null;
  const user = await db.getUserById(payload.uid);
  if (!user) return null;
  if ((user.session_version || 0) !== (payload.sv || 0)) return null; // déconnecté partout
  return user;
}
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
async function authMiddleware(req, res, next) {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Non connecté' });
  req.user = user;
  next();
}
const wrap = fn => (req, res) => fn(req, res).catch(err => { console.error(err); res.status(500).json({ error: 'Erreur serveur' }); });

const COMMON_PASSWORDS = new Set(['12345678', 'password', 'motdepasse', 'azertyuiop', 'qwertyuiop', '123456789', 'abcdefgh', '00000000']);
function passwordProblem(password, username) {
  if (typeof password !== 'string' || password.length < 8) return 'Mot de passe : 8 caractères minimum';
  if (password.length > 128) return 'Mot de passe trop long';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'Mot de passe trop courant';
  if (username && password.toLowerCase().includes(String(username).toLowerCase())) return 'Le mot de passe ne doit pas contenir le pseudo';
  return null;
}
app.get('/api/config', (req, res) => { res.json({ googleClientId: GOOGLE_CLIENT_ID || null, avatarPresets: Catalog.AVATAR_PRESETS, secure: isSecure(req) }); });

app.post('/api/register', authLimiter, wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ -)' });
  const pb = passwordProblem(password, username);
  if (pb) return res.status(400).json({ error: pb });
  if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
  const user = await db.createUser(username, await bcrypt.hash(password, 12));
  setSession(req, res, user);
  res.json({ profile: publicProfile(user) });
}));

app.post('/api/login', authLimiter, wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const user = typeof username === 'string' ? await db.getUserByUsername(username) : null;
  // Temps de réponse constant (on compare toujours un hash) pour ne pas révéler si le pseudo existe.
  const hash = user && user.password_hash ? user.password_hash : DUMMY_HASH;
  const ok = typeof password === 'string' && (await bcrypt.compare(password, hash));
  if (!user || !user.password_hash || !ok) return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
  setSession(req, res, user);
  res.json({ profile: publicProfile(user) });
}));

app.post('/api/logout', wrap(async (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
}));
// Déconnexion de TOUS les appareils : invalide toutes les sessions existantes.
app.post('/api/logout-all', authMiddleware, wrap(async (req, res) => {
  await db.updateUser(req.user.id, { session_version: (req.user.session_version || 0) + 1 });
  const live = byUser.get(req.user.id); if (live) { live.send({ t: 'kicked', reason: 'Déconnecté de tous les appareils' }); live.ws.close(); }
  clearSession(req, res);
  res.json({ ok: true });
}));

app.post('/api/password', authMiddleware, authLimiter, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  if (req.user.password_hash && !(typeof current === 'string' && (await bcrypt.compare(current, req.user.password_hash)))) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  const pb = passwordProblem(next, req.user.username);
  if (pb) return res.status(400).json({ error: pb });
  const user = await db.updateUser(req.user.id, { password_hash: await bcrypt.hash(next, 12), session_version: (req.user.session_version || 0) + 1 });
  setSession(req, res, user);
  res.json({ ok: true });
}));

// ---------- Connexion Google (Google Identity Services) ----------
async function verifyGoogle(credential) {
  if (!googleClient) throw new Error('Google non configuré');
  const ticket = await googleClient.verifyIdToken({ idToken: String(credential || ''), audience: GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p || !p.sub || !p.email_verified) throw new Error('Compte Google non vérifié');
  return { sub: p.sub, email: p.email, name: p.name || p.given_name || 'Joueur', picture: p.picture || null };
}
app.post('/api/auth/google', authLimiter, wrap(async (req, res) => {
  if (!googleClient) return res.status(400).json({ error: 'Connexion Google non configurée sur ce serveur' });
  let g;
  try { g = await verifyGoogle(req.body && req.body.credential); } catch (e) { return res.status(401).json({ error: 'Jeton Google invalide' }); }
  const existing = await db.getUserByGoogleSub(g.sub);
  if (existing) { setSession(req, res, existing); return res.json({ profile: publicProfile(existing) }); }
  // Premier passage : il faut choisir un pseudo. On rend un ticket court (10 min) signé.
  const ticket = jwt.sign({ g: g.sub, e: g.email, n: g.name }, JWT_SECRET, { expiresIn: '10m' });
  const suggested = g.name.replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 16);
  res.json({ needUsername: true, ticket, suggested: suggested.length >= 3 ? suggested : '' });
}));
app.post('/api/auth/google/complete', authLimiter, wrap(async (req, res) => {
  const { ticket, username } = req.body || {};
  const payload = decodeToken(String(ticket || ''));
  if (!payload || !payload.g) return res.status(401).json({ error: 'Ticket expiré, recommence la connexion Google' });
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ -)' });
  if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
  if (await db.getUserByGoogleSub(payload.g)) return res.status(409).json({ error: 'Ce compte Google est déjà lié' });
  const user = await db.createUser(username, '', { google_sub: payload.g, email: payload.e });
  setSession(req, res, user);
  res.json({ profile: publicProfile(user) });
}));
// Lier un compte Google à un compte pseudo/mot de passe existant.
app.post('/api/auth/google/link', authMiddleware, wrap(async (req, res) => {
  if (!googleClient) return res.status(400).json({ error: 'Connexion Google non configurée' });
  let g;
  try { g = await verifyGoogle(req.body && req.body.credential); } catch (e) { return res.status(401).json({ error: 'Jeton Google invalide' }); }
  if (await db.getUserByGoogleSub(g.sub)) return res.status(409).json({ error: 'Ce compte Google est déjà lié à un autre joueur' });
  const user = await db.updateUser(req.user.id, { google_sub: g.sub, email: g.email });
  res.json({ profile: publicProfile(user) });
}));

// ---------- Avatar : 15 propositions ou photo importée (data URL, redimensionnée côté client) ----------
app.post('/api/avatar', authMiddleware, wrap(async (req, res) => {
  const { avatar } = req.body || {};
  if (avatar === null || avatar === '') { const user = await db.updateUser(req.user.id, { avatar: null }); return res.json({ profile: publicProfile(user) }); }
  if (typeof avatar !== 'string') return res.status(400).json({ error: 'Avatar invalide' });
  if (avatar.startsWith('preset:')) {
    if (!Catalog.AVATAR_PRESETS.includes(avatar.slice(7))) return res.status(400).json({ error: 'Avatar inconnu' });
  } else {
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(avatar);
    if (!m || avatar.length > 90000) return res.status(400).json({ error: 'Image invalide ou trop lourde (max ~64 Ko)' });
    const bytes = Buffer.from(m[2], 'base64');
    const png = bytes[0] === 0x89 && bytes[1] === 0x50, jpg = bytes[0] === 0xff && bytes[1] === 0xd8, webp = bytes.slice(8, 12).toString() === 'WEBP';
    if (!(png || jpg || webp)) return res.status(400).json({ error: 'Format d’image non reconnu' });
  }
  const user = await db.updateUser(req.user.id, { avatar });
  res.json({ profile: publicProfile(user) });
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

app.get('/api/quests', authMiddleware, wrap(async (req, res) => {
  if (!Features.enabled('quests')) return res.json({ quests: null });
  res.json({ quests: questsView(req.user) });
}));
app.post('/api/quests/claim', authMiddleware, wrap(async (req, res) => {
  if (!Features.enabled('quests')) return res.status(400).json({ error: 'Quêtes désactivées' });
  const quests = questsOf(req.user);
  const item = quests.items.find(q => q.id === String(req.body && req.body.id));
  const tpl = item && Catalog.questTemplate(item.id);
  if (!item || !tpl) return res.status(404).json({ error: 'Quête inconnue' });
  if (item.claimed) return res.status(400).json({ error: 'Déjà récupérée' });
  if (item.progress < tpl.goal) return res.status(400).json({ error: 'Quête non terminée' });
  item.claimed = true;
  const user = await db.updateUser(req.user.id, { coins: (req.user.coins || 0) + tpl.coins, quests });
  res.json({ coins: tpl.coins, profile: publicProfile(user), quests: questsView(user) });
}));
app.get('/api/deal', (req, res) => { res.json({ deal: Features.enabled('shopDeals') ? Catalog.weeklyDeal() : null }); });
app.get('/api/features', (req, res) => { res.json({ features: Features.matchFeatures(), survival: Features.enabled('survival'), quests: Features.enabled('quests') }); });
app.get('/api/leaderboard/survival', wrap(async (req, res) => {
  const rows = await db.survivalBoard(50);
  res.json({ leaderboard: rows.map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, score: r.survival_best, level: Catalog.levelFromXp(r.xp || 0).level })) });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  const rows = await db.leaderboard(50);
  res.json({ leaderboard: rows.map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, trophies: r.trophies, wins: r.wins, losses: r.losses, level: Catalog.levelFromXp(r.xp || 0).level, league: Catalog.rankFor(r.trophies).name, avatar: r.avatar || null })) });
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
  const deal = Features.enabled('shopDeals') ? Catalog.weeklyDeal() : null;
  const price = deal && deal.skinId === skin.id ? deal.price : skin.unlock.value;
  if ((req.user.coins || 0) < price) return res.status(400).json({ error: 'Pas assez de pièces' });
  const equipped = equippedOf(req.user); equipped[skin.ogId] = skin.id;
  const user = await db.updateUser(req.user.id, { coins: req.user.coins - price, skins: [...owned, skin.id], equipped });
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

// ---------- Admin ----------
function adminOnly(req, res, next) { if (!isAdmin(req.user)) return res.status(403).json({ error: 'Réservé aux administrateurs' }); next(); }
app.get('/api/admin/overview', authMiddleware, adminOnly, wrap(async (req, res) => {
  res.json({ users: await db.countUsers(), online: clients.size, inQueue: matchmaker.queue.length, rooms: [...rooms].map(r => ({ id: r.id, mode: r.mode, players: r.players.map(p => p.profile.username), time: r.game ? Math.round(r.game.state.time) : 0 })), db: db.kind, uptime: Math.round(process.uptime()), features: Features.FEATURES });
}));
// Donner des pièces / trophées à un joueur (ex. récompense d'un tournoi).
app.post('/api/admin/grant', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { username, coins = 0, trophies = 0 } = req.body || {};
  const user = typeof username === 'string' ? await db.getUserByUsername(username) : null;
  if (!user) return res.status(404).json({ error: 'Joueur introuvable' });
  const patch = { coins: Math.max(0, (user.coins || 0) + (Number(coins) | 0)), trophies: Math.max(0, (user.trophies || 0) + (Number(trophies) | 0)) };
  patch.best_trophies = Math.max(user.best_trophies || 0, patch.trophies);
  const updated = await db.updateUser(user.id, patch);
  const live = byUser.get(user.id); if (live) live.profile = publicProfile(updated);
  res.json({ profile: publicProfile(updated) });
}));

app.get('/api/stats', (req, res) => {
  res.json({ online: clients.size, inQueue: matchmaker.queue.length, inMatch: [...rooms].reduce((n, r) => n + r.humans().filter(p => p.connected).length, 0), friendlyRooms: friendly.size });
});

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 16 * 1024,
  verifyClient: ({ req }) => { // même origine uniquement
    const origin = req.headers.origin; if (!origin) return true;
    try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch (e) { return false; }
  },
});
const clients = new Set();
const rooms = new Set();
const friendly = new Map(); // code -> { host: client, hazard }
const byUser = new Map(); // userId -> client

function pickDuration(v) { const d = Number(v); return Sim.RULES.durations.includes(d) ? d : Sim.RULES.matchDuration; }

function createMatch(entries, { mode, botFill = false, bot = null, duration = Sim.RULES.matchDuration, features = null, survival = false }) {
  const players = entries.map(e => ({ client: e.client, profile: e.profile, bot: null }));
  if (bot) {
    const trophies = entries[0].profile.trophies;
    const names = { simple: 'Bot Oggy', moyen: 'Bot Ogma', difficile: 'Bot Ogzilla' };
    players.push({ client: null, profile: { id: null, username: names[bot], trophies: Math.max(0, trophies + Math.round((Math.random() - 0.5) * 60)), level: bot === 'simple' ? 3 : bot === 'moyen' ? 12 : 30, rank: Catalog.rankFor(trophies).name, equipped: Catalog.DEFAULT_EQUIP, bot: true, difficulty: bot }, bot });
  }
  if (survival) players.push({ client: null, profile: { id: null, username: 'Les Vagues', trophies: 0, level: 0, rank: '', equipped: Catalog.DEFAULT_EQUIP, bot: true }, director: true });
  if (survival) players.reverse(); // le joueur humain est en bas
  else if (Math.random() < 0.5) players.reverse();
  const feats = features || Features.resolveOptions(null, mode === 'ranked');
  const room = new Room({ players, mode, features: feats, duration, botFill, onEnd: endMatch });
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
    const res = room.mode === 'survival' ? 'survival' : result.winner === 'draw' ? 'draw' : result.winner === p.side ? 'win' : 'loss';
    outcome[p.side] = { res, opp };
  }
  const deltas = {};
  const payloads = {};
  for (const p of room.players) {
    if (p.bot || p.director || !p.profile || !p.profile.id) continue;
    const user = await db.getUserById(p.profile.id);
    if (!user) continue;
    const { res, opp } = outcome[p.side];
    const rewardMode = room.mode;
    const applied = applyResult(user, opp.profile, res, rewardMode, { stats: result.stats[p.side], survival: result.survival });
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
    payloads[p.side] = { t: 'match_end', side: p.side, result: res, winner: result.winner, reason: result.reason, duration: Math.round(result.duration), hp: result.hp, points: result.points, stats: result.stats, rewards: applied.rewards, levelUp: applied.levelUp, unlocked: applied.unlocked, newBest: applied.newBest, survival: result.survival, quests: Features.enabled('quests') ? questsView(updated) : null, profile, opponent: opp.profile };
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

wss.on('connection', (ws, req) => {
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
      // La session vient du cookie httpOnly envoyé avec la connexion WebSocket (même origine).
      const user = await userFromRequest(req);
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
        createMatch([{ client, profile: client.profile }], { mode: 'bot', bot: diff, duration: pickDuration(msg.duration), features: Features.resolveOptions(msg.options, false) });
        break;
      }
      case 'survival': {
        if (client.room || !Features.enabled('survival')) return;
        matchmaker.leave(client); leaveFriendly(client);
        createMatch([{ client, profile: client.profile }], { mode: 'survival', survival: true, duration: 0, features: Object.assign(Features.resolveOptions(msg.options, false), { draft: false, kingOfCenter: false, overtime: false }) });
        break;
      }
      case 'friendly_create': {
        if (client.room) return;
        matchmaker.leave(client); leaveFriendly(client);
        const code = makeCode();
        friendly.set(code, { host: client, duration: pickDuration(msg.duration), features: Features.resolveOptions(msg.options, false) });
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
        createMatch([{ client: entry.host, profile: entry.host.profile }, { client, profile: client.profile }], { mode: 'friendly', duration: entry.duration, features: entry.features });
        break;
      }
      case 'friendly_leave': leaveFriendly(client); client.send({ t: 'idle' }); break;
      case 'place': case 'orb': case 'surrender': case 'emote': case 'ability': case 'ban':
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

// Arrêt propre (pm2 reload / Ctrl+C) : on écrit le store JSON en attente avant de quitter.
let stopping = false;
async function shutdown(signal) {
  if (stopping) return; stopping = true;
  console.log(`[serveur] ${signal} : arrêt propre`);
  try { for (const room of rooms) room.destroy(); await db.close(); } catch (e) { console.error(e.message); }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

db.init().then(() => {
  server.listen(PORT, () => console.log(`Glouglou Arena -> http://localhost:${PORT}  (db: ${db.kind})`));
}).catch(err => { console.error('Impossible de démarrer la base :', err.message); process.exit(1); });
