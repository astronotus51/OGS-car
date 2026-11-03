'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const Catalog = require('../shared/catalog.js');
const AI = require('../shared/ai.js');
const Sim = require('../shared/sim.js');
const Features = require('../shared/features.js');
const { createStore } = require('./db.js');
const { publicProfile, applyResult, ownedSkins, equippedOf, questsOf, questsView, isAdmin, allSkinIds, collectionOf, deckList } = require('./profile.js');
const { Room } = require('./room.js');
const { Matchmaker } = require('./matchmaking.js');

const PORT = Number(process.env.PORT || 3000);
const DAILY_COINS = 25;
const COOKIE = 'ogs_session';
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
// Clé admin : ADMIN_KEY ou fichier data/admin-key.txt (généré au premier démarrage). À entrer une fois dans le profil.
function loadAdminKey() {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY;
  const file = path.join(__dirname, '..', 'data', 'admin-key.txt');
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (e) { /* créé ci-dessous */ }
  const key = crypto.randomBytes(12).toString('base64url');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, key + '\n');
  return key;
}
const ADMIN_KEY = loadAdminKey();
// Connexion Google (seul moyen de se connecter quand GOOGLE_CLIENT_ID est défini).
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
// E-mails Google administrateurs (ADMIN_EMAILS, séparés par des virgules) : admin d'office à la connexion.
const ADMIN_EMAILS = new Set((process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
function isAdminKey(key) { return typeof key === 'string' && key.length === ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_KEY)); }

const db = createStore();
const app = express();
app.set('trust proxy', 1); // derrière nginx : vraie IP pour le rate limiting, détection https
app.disable('x-powered-by');
// En-têtes de sécurité (CSP : scripts/polices/connexions autorisés uniquement depuis le site, Google Fonts et Google Identity).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://accounts.google.com/gsi/'],
      frameSrc: ['https://accounts.google.com/gsi/'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // Pas de forçage HTTPS tant que le site peut être servi en HTTP (sinon le navigateur tente https:// pour le CSS/JS et la page reste nue).
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
  // La fenêtre de connexion Google doit pouvoir répondre à la page qui l'a ouverte : « same-origin » strict la rend muette (page blanche).
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  // Google vérifie l'origine de la page via le Referer : « no-referrer » (défaut helmet) fait échouer le bouton.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: false,
}));
app.use((req, res, next) => { if (isSecure(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains'); next(); });
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
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de tentatives, réessaie dans 15 minutes' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de requêtes' } });
app.use('/api', apiLimiter);
// ---------- Version de build : empreinte des fichiers du client. Change à chaque déploiement => les navigateurs rechargent les scripts. ----------
function computeBuild() {
  const h = crypto.createHash('sha1');
  const dirs = [path.join(__dirname, '..', 'public'), path.join(__dirname, '..', 'shared')];
  for (const dir of dirs) for (const f of fs.readdirSync(dir, { recursive: true })) { const fp = path.join(dir, String(f)); if (/\.(js|css|html)$/.test(fp)) { try { h.update(fs.readFileSync(fp)); } catch (e) { /* dossier */ } } }
  return h.digest('hex').slice(0, 10);
}
const BUILD = computeBuild();
const INDEX_HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')
  .replace(/\?v=\d+"/g, `?v=${BUILD}"`)
  .replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta name="build" content="${BUILD}">\n  <meta name="google-client-id" content="${GOOGLE_CLIENT_ID}">`);
app.get(['/', '/index.html'], (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.type('html').send(INDEX_HTML); });
app.get('/api/version', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ build: BUILD }); });

app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use((req, res, next) => { if (/\.(js|css|html)$/.test(req.path)) res.setHeader('Cache-Control', 'no-cache'); next(); });
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
// Invité (sans compte Google) alors que le serveur propose les comptes : skins, avatar, quêtes et bonus verrouillés (sauf admins).
function accountOnly(req, res, next) {
  if (googleClient && !req.user.google_sub && !isAdmin(req.user)) return res.status(403).json({ error: 'Réservé aux joueurs avec un compte Google', guest: true });
  next();
}

app.get('/api/config', (req, res) => { res.json({ avatarPresets: Catalog.AVATAR_PRESETS, secure: isSecure(req), google: !!GOOGLE_CLIENT_ID }); });

// ---------- Identité joueur : pas de compte. Un pseudo + un cookie sécurisé sur cet appareil. ----------
// ---------- Connexion Google (en plus du mode sans compte) ----------
// Vérifie un jeton d'identité Google Identity Services côté serveur (signature Google, audience = notre client id).
async function verifyGoogle(req, res) {
  if (!googleClient) { res.status(503).json({ error: 'Connexion Google non configurée sur ce serveur (GOOGLE_CLIENT_ID)' }); return null; }
  const credential = req.body && req.body.credential;
  if (typeof credential !== 'string' || credential.length > 4096) { res.status(400).json({ error: 'Jeton Google manquant' }); return null; }
  let info = null;
  try { info = (await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })).getPayload(); } catch (e) { /* invalide */ }
  if (!info || !info.sub) { res.status(401).json({ error: 'Jeton Google invalide ou expiré, réessaie' }); return null; }
  const email = String(info.email || '').toLowerCase();
  return { info, email, admin: !!(email && info.email_verified && ADMIN_EMAILS.has(email)) };
}
// Lier le joueur courant (sans compte) à un compte Google : il garde toute sa progression.
app.post('/api/auth/google/link', authMiddleware, authLimiter, wrap(async (req, res) => {
  const g = await verifyGoogle(req, res); if (!g) return;
  if (req.user.google_sub) return res.status(400).json({ error: 'Ce joueur est déjà lié à un compte Google' });
  const taken = await db.getUserByGoogleSub(g.info.sub);
  if (taken) {
    // Ce compte Google a déjà un joueur : on bascule dessus (toute sa progression est reprise), l'invité courant est abandonné.
    const user = g.admin && !taken.is_admin ? await db.updateUser(taken.id, { is_admin: true }) : taken;
    const prev = byUser.get(user.id); if (prev) { prev.send({ t: 'kicked', reason: 'Connecté depuis un autre appareil' }); prev.ws.close(); }
    setSession(req, res, user);
    return res.json({ profile: publicProfile(user), switched: true });
  }
  const patch = { google_sub: g.info.sub, email: g.email, is_admin: req.user.is_admin || g.admin };
  // Nouveau pseudo choisi à la création du compte (facultatif : sinon on garde l'actuel).
  const username = req.body && req.body.username;
  if (typeof username === 'string' && username && username.toLowerCase() !== req.user.username.toLowerCase()) {
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ -)' });
    if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris, choisis-en un autre' });
    patch.username = username;
  }
  const user = await db.updateUser(req.user.id, patch);
  res.json({ profile: refreshLiveProfile(user) });
}));
// Connexion avec Google. 1re connexion : on demande un pseudo, puis on crée le joueur.
app.post('/api/auth/google', authLimiter, wrap(async (req, res) => {
  const g = await verifyGoogle(req, res); if (!g) return;
  const { info, email, admin } = g;
  const { username } = req.body || {};
  let user = await db.getUserByGoogleSub(info.sub);
  if (!user) {
    if (typeof username !== 'string' || !username) {
      // 1re connexion : le client doit proposer un pseudo. On en suggère un à partir du prénom Google.
      const base = String(info.given_name || info.name || 'Joueur').normalize('NFD').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'Joueur';
      let suggested = base; for (let i = 2; await db.getUserByUsername(suggested); i += 1) suggested = `${base}${i}`;
      return res.json({ needUsername: true, suggested, admin });
    }
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ -)' });
    if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris, choisis-en un autre' });
    user = await db.createUser(username, { google_sub: info.sub, email, is_admin: admin });
  } else if (admin && !user.is_admin) {
    user = await db.updateUser(user.id, { is_admin: true, email });
  }
  setSession(req, res, user);
  res.json({ profile: publicProfile(user) });
}));

app.post('/api/guest', authLimiter, wrap(async (req, res) => {
  let { username } = req.body || {};
  if (username === undefined || username === null || username === '') {
    // Invité en un clic : pseudo « Invité-1234 » attribué par le serveur.
    do { username = `Invité-${crypto.randomInt(1000, 10000)}`; } while (await db.getUserByUsername(username));
  }
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ -)' });
  if (await db.getUserByUsername(username)) return res.status(409).json({ error: 'Ce pseudo est déjà pris, choisis-en un autre' });
  const user = await db.createUser(username);
  setSession(req, res, user);
  res.json({ profile: publicProfile(user) });
}));

// Oublier ce joueur sur cet appareil.
app.post('/api/logout', wrap(async (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
}));

// ---------- Transfert de progression vers un autre appareil (code à usage unique, 24 h) ----------
function makeTransferCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 8; i += 1) c += a[crypto.randomInt(a.length)]; return `${c.slice(0, 4)}-${c.slice(4)}`; }
app.post('/api/transfer/code', authMiddleware, wrap(async (req, res) => {
  const code = makeTransferCode();
  await db.updateUser(req.user.id, { transfer_code: code, transfer_expires: new Date(Date.now() + 86400 * 1000).toISOString() });
  res.json({ code });
}));
app.post('/api/transfer/claim', authLimiter, wrap(async (req, res) => {
  const code = String((req.body && req.body.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) return res.status(400).json({ error: 'Code invalide' });
  const user = await db.getUserByTransferCode(`${code.slice(0, 4)}-${code.slice(4)}`);
  if (!user || !user.transfer_expires || new Date(user.transfer_expires) < new Date()) return res.status(404).json({ error: 'Code inconnu ou expiré' });
  const updated = await db.updateUser(user.id, { transfer_code: null, transfer_expires: null, session_version: (user.session_version || 0) + 1 }); // l'ancien appareil est déconnecté
  const prev = byUser.get(user.id); if (prev) { prev.send({ t: 'kicked', reason: 'Progression transférée sur un autre appareil' }); prev.ws.close(); }
  setSession(req, res, updated);
  res.json({ profile: publicProfile(updated) });
}));

// ---------- Clé admin ----------
app.post('/api/admin/activate', authMiddleware, authLimiter, wrap(async (req, res) => {
  const key = String((req.body && req.body.key) || '');
  if (!isAdminKey(key)) return res.status(403).json({ error: 'Clé incorrecte' });
  const user = await db.updateUser(req.user.id, { is_admin: true });
  res.json({ profile: refreshLiveProfile(user) });
}));

// ---------- Avatar : 15 propositions ou photo importée (data URL, redimensionnée côté client) ----------
app.post('/api/avatar', authMiddleware, accountOnly, wrap(async (req, res) => {
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
  res.json({ profile: refreshLiveProfile(user) });
}));

app.get('/api/me', authMiddleware, wrap(async (req, res) => {
  const rank = await db.rankOf(req.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const lastDaily = req.user.last_daily ? String(req.user.last_daily).slice(0, 10) : null;
  res.json({ profile: publicProfile(req.user, { leaderboardRank: rank, dailyAvailable: lastDaily !== today, dailyCoins: DAILY_COINS }) });
}));

app.post('/api/daily', authMiddleware, accountOnly, wrap(async (req, res) => {
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
app.post('/api/quests/claim', authMiddleware, accountOnly, wrap(async (req, res) => {
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

app.post('/api/skins/buy', authMiddleware, accountOnly, wrap(async (req, res) => {
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
  res.json({ profile: refreshLiveProfile(user) });
}));

app.post('/api/skins/equip', authMiddleware, accountOnly, wrap(async (req, res) => {
  const skin = Catalog.SKIN_BY_ID[String(req.body && req.body.skinId)];
  if (!skin) return res.status(404).json({ error: 'Skin inconnu' });
  if (!ownedSkins(req.user).includes(skin.id)) return res.status(403).json({ error: 'Skin non possédé' });
  const equipped = equippedOf(req.user); equipped[skin.ogId] = skin.id;
  const user = await db.updateUser(req.user.id, { equipped });
  res.json({ profile: refreshLiveProfile(user) });
}));

// ---------- Collection, équipe, capsules, route des trophées ----------
// Équipe : { "10": id, "20": id, … } — une créature possédée et jouable par coût.
app.post('/api/deck', authMiddleware, wrap(async (req, res) => {
  const col = collectionOf(req.user);
  const incoming = (req.body && req.body.deck) || {};
  const deck = {};
  for (const cost of Catalog.DECK_COSTS) {
    const id = Number(incoming[cost]);
    const c = Catalog.CREATURE_BY_ID[id];
    if (!c || c.cost !== cost) return res.status(400).json({ error: `Case ${cost} : créature invalide` });
    if (!col[c.id]) return res.status(403).json({ error: `${c.name} n’est pas dans ta collection` });
    if (!c.playable) return res.status(400).json({ error: `${c.name} n’est pas encore jouable` });
    deck[cost] = c.id;
  }
  const user = await db.updateUser(req.user.id, { deck });
  res.json({ profile: refreshLiveProfile(user) });
}));
// Ouvre une capsule : cartes (créatures) par rareté avec garanties, pièces, parfois un skin.
app.post('/api/capsule/open', authMiddleware, accountOnly, wrap(async (req, res) => {
  if ((req.user.capsules || 0) < 1 && !isAdmin(req.user)) return res.status(400).json({ error: 'Aucune capsule à ouvrir' });
  const collection = collectionOf(req.user);
  const owned = ownedSkins(req.user);
  const rng = () => crypto.randomInt(0, 1 << 30) / (1 << 30);
  const result = Catalog.openCapsule(rng, collection, owned, req.user.pity || {});
  const col = Object.assign({}, req.user.collection || {});
  for (const card of result.cards) { card.isNew = !collection[card.id] && !col[card.id]; col[card.id] = (col[card.id] || collection[card.id] || 0) + card.copies; card.total = col[card.id]; }
  const patch = { capsules: Math.max(0, (req.user.capsules || 0) - (isAdmin(req.user) ? 0 : 1)), collection: col, coins: (req.user.coins || 0) + result.coins, pity: result.pity };
  if (result.skin) patch.skins = [...owned, result.skin];
  const user = await db.updateUser(req.user.id, patch);
  res.json({ profile: refreshLiveProfile(user), opened: result });
}));
// Route des trophées : réclame un palier atteint (meilleurs trophées).
app.post('/api/road/claim', authMiddleware, accountOnly, wrap(async (req, res) => {
  const t = Number(req.body && req.body.trophies);
  const step = Catalog.TROPHY_ROAD.find(r => r.trophies === t);
  if (!step) return res.status(404).json({ error: 'Palier inconnu' });
  const claimed = Array.isArray(req.user.road) ? req.user.road : [];
  if (claimed.includes(t)) return res.status(400).json({ error: 'Déjà réclamé' });
  if ((req.user.best_trophies || 0) < t) return res.status(403).json({ error: `Il te faut ${t} trophées` });
  const patch = { road: [...claimed, t] };
  const r = step.reward; let got = { type: r.type };
  if (r.type === 'coins') { patch.coins = (req.user.coins || 0) + r.count; got.count = r.count; }
  else if (r.type === 'capsule') { patch.capsules = Math.min(Catalog.CAPSULE.max + 2, (req.user.capsules || 0) + r.count); got.count = r.count; }
  else if (r.type === 'creature') { const col = Object.assign({}, req.user.collection || {}); col[r.id] = (col[r.id] || 0) + 1; patch.collection = col; got.id = r.id; got.name = Catalog.CREATURE_BY_ID[r.id].name; }
  else if (r.type === 'skin') {
    const owned = ownedSkins(req.user);
    const candidates = Catalog.SKINS.filter(s => !s.hidden && s.unlock.type !== 'default' && !owned.includes(s.id));
    if (candidates.length) { const skin = candidates[crypto.randomInt(candidates.length)]; patch.skins = [...owned, skin.id]; got.skin = skin.id; got.name = skin.name; }
    else { patch.coins = (req.user.coins || 0) + 150; got = { type: 'coins', count: 150 }; }
  }
  const user = await db.updateUser(req.user.id, patch);
  res.json({ profile: refreshLiveProfile(user), got });
}));

// ---------- Admin ----------
function adminOnly(req, res, next) { if (!isAdmin(req.user)) return res.status(403).json({ error: 'Réservé aux administrateurs' }); next(); }
app.get('/api/admin/overview', authMiddleware, adminOnly, wrap(async (req, res) => {
  res.json({ users: await db.countUsers(), online: clients.size, inQueue: matchmaker.queue.length, rooms: [...rooms].map(r => ({ id: r.id, mode: r.mode, players: r.players.map(p => p.profile.username), time: r.game ? Math.round(r.game.state.time) : 0 })), db: db.kind, uptime: Math.round(process.uptime()), features: Features.FEATURES });
}));
// Liste / recherche des joueurs (pour le panneau d'administration).
app.get('/api/admin/players', authMiddleware, adminOnly, wrap(async (req, res) => {
  const list = await db.searchUsers(String(req.query.q || '').slice(0, 16), 30);
  const total = Catalog.SKINS.filter(s => !s.hidden).length;
  res.json({ players: list.map(u => ({ id: u.id, username: u.username, trophies: u.trophies || 0, coins: u.coins || 0, wins: u.wins || 0, losses: u.losses || 0, admin: !!u.is_admin, modo: !!u.is_modo, online: byUser.has(u.id), skins: (u.is_admin || u.is_modo) ? total : new Set([...(u.skins || []), 'og1_default', 'og2_default', 'og3_default', 'og4_default', 'og5_default', 'og6_default', 'og7_default']).size, skinsTotal: total })) });
}));
// Applique une modification à un joueur et met à jour son profil s'il est en ligne.
async function adminPatch(username, patch) {
  const user = typeof username === 'string' ? await db.getUserByUsername(username) : null;
  if (!user) return null;
  const updated = await db.updateUser(user.id, typeof patch === 'function' ? patch(user) : patch);
  const live = byUser.get(user.id); if (live) { live.profile = publicProfile(updated); live.send({ t: 'profile', profile: live.profile }); }
  return updated;
}
// Donner des pièces / trophées à un joueur (ex. récompense d'un tournoi).
app.post('/api/admin/grant', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { username, coins = 0, trophies = 0 } = req.body || {};
  const updated = await adminPatch(username, user => {
    const patch = { coins: Math.max(0, (user.coins || 0) + (Number(coins) | 0)), trophies: Math.max(0, (user.trophies || 0) + (Number(trophies) | 0)) };
    patch.best_trophies = Math.max(user.best_trophies || 0, patch.trophies);
    return patch;
  });
  if (!updated) return res.status(404).json({ error: 'Joueur introuvable' });
  res.json({ profile: publicProfile(updated) });
}));
// Nommer / retirer un modérateur (badge MODO + tous les skins). Un admin ne peut pas être rétrogradé ici.
app.post('/api/admin/role', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { username, modo } = req.body || {};
  const target = typeof username === 'string' ? await db.getUserByUsername(username) : null;
  if (!target) return res.status(404).json({ error: 'Joueur introuvable' });
  if (target.is_admin) return res.status(400).json({ error: 'Ce joueur est déjà administrateur' });
  const updated = await adminPatch(username, { is_modo: !!modo });
  res.json({ profile: publicProfile(updated) });
}));
// Débloquer tous les skins d'un joueur (sans le nommer modo).
app.post('/api/admin/skins', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { username } = req.body || {};
  const updated = await adminPatch(username, { skins: allSkinIds() });
  if (!updated) return res.status(404).json({ error: 'Joueur introuvable' });
  res.json({ profile: publicProfile(updated) });
}));

app.get('/api/stats', (req, res) => {
  res.json({ online: clients.size, inQueue: matchmaker.queue.length, inMatch: [...rooms].reduce((n, r) => n + r.humans().filter(p => p.connected).length, 0), friendlyRooms: friendly.size });
});

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 16 * 1024, perMessageDeflate: false, // pas de compression : moins de CPU et de latence
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

// Met à jour le profil vivant (session WebSocket) d'un joueur après un changement (skin, avatar, pièces…).
function refreshLiveProfile(user) {
  const profile = publicProfile(user);
  const live = byUser.get(user.id);
  if (live) live.profile = profile;
  return profile;
}

// Skins aléatoires (mais stables) pour les bots, pour que les parties contre l'IA soient variées.
function botEquipped(seed) {
  const themes = Catalog.THEMES.map(t => t.suffix).filter(t => t !== 'default');
  const eq = {};
  for (let og = 1; og <= 7; og += 1) { const r = (Math.imul((seed + og) * 2654435761, 1) >>> 0) % (themes.length + 2); eq[og] = r < themes.length ? `og${og}_${themes[r]}` : `og${og}_default`; }
  return eq;
}

const BOT_NAMES = { simple: ['Bot Oggy', 'Bot Pipo', 'Bot Lulu', 'Bot Nino', 'Bot Tao', 'Bot Fifi'], moyen: ['Bot Ogma', 'Bot Zorg', 'Bot Mimi', 'Bot Kiko', 'Bot Rolf', 'Bot Suzu'], difficile: ['Bot Ogzilla', 'Bot Krakor', 'Bot Vex', 'Bot Nyx', 'Bot Tyr', 'Bot Ash'] };
// Équipe d'un bot : une créature par coût, tirée parmi les 17 (les bots classés jouent toutes les créatures) ; plus le bot est fort, plus il sort des nouvelles.
function botDeck(difficulty, seed) {
  const rng = Sim.createRng(seed >>> 0);
  const list = AI.randomDeck(rng, difficulty === 'simple' ? 0.5 : difficulty === 'moyen' ? 0.65 : 0.8);
  return Object.fromEntries(Catalog.DECK_COSTS.map((cost, i) => [cost, list[i]]));
}
function makeBot(difficulty, trophies, i) {
  const name = BOT_NAMES[difficulty][i % 6];
  const deck = botDeck(difficulty, Date.now() + i * 7919);
  return { client: null, profile: { id: null, username: name, trophies: Math.max(0, trophies + Math.round((Math.random() - 0.5) * 60)), level: difficulty === 'simple' ? 3 : difficulty === 'moyen' ? 12 : 30, rank: Catalog.rankFor(trophies).name, equipped: botEquipped((Date.now() + i * 97) % 1000), avatar: `preset:og${deck[70] || 7}_default`, bot: true, difficulty, deck }, bot: difficulty };
}

async function createMatch(entries, { mode, botFill = false, bot = null, duration = Sim.RULES.matchDuration, features = null, survival = false, map = 'random', teamSize = 1 }) {
  // Profils relus en base : skins équipés, avatar et trophées à jour au moment du match.
  const humans = [];
  for (const e of entries) {
    let profile = e.profile;
    if (profile && profile.id) { const fresh = await db.getUserById(profile.id); if (fresh) profile = refreshLiveProfile(fresh); }
    humans.push({ client: e.client, profile, bot: null });
  }
  const players = [];
  if (survival) {
    players.push({ client: null, profile: { id: null, username: 'Les Vagues', trophies: 0, level: 0, rank: '', equipped: botEquipped(Date.now() % 1000), avatar: 'preset:og7_halloween', bot: true }, director: true, side: 'top' });
    players.push(Object.assign(humans[0], { side: 'bottom' })); // le joueur humain est en bas
  } else {
    // Répartition : les humains alternent entre les deux camps (équilibre), puis des bots complètent chaque camp.
    const firstSide = Math.random() < 0.5 ? 'top' : 'bottom';
    const sides = [firstSide, firstSide === 'top' ? 'bottom' : 'top'];
    const count = { top: 0, bottom: 0 };
    humans.forEach((h, i) => { const side = mode === 'bot' ? 'bottom' : sides[i % 2]; count[side] += 1; players.push(Object.assign(h, { side })); });
    const avg = humans.reduce((n, h) => n + (h.profile.trophies || 0), 0) / Math.max(1, humans.length);
    let bi = 0;
    for (const side of ['top', 'bottom']) {
      while (count[side] < teamSize) {
        const diff = bot || 'moyen';
        players.push(Object.assign(makeBot(diff, avg, bi++), { side })); count[side] += 1;
      }
    }
  }
  const feats = features || Features.resolveOptions(null, ['ranked', 'duo', 'trio'].includes(mode));
  const room = new Room({ players, mode, features: feats, duration, botFill, map, teamSize, onEnd: endMatch });
  rooms.add(room);
  for (const p of room.players) if (p.client) { matchmaker.leave(p.client); p.client.room = room; }
  room.start();
  console.log(`[match] #${room.id} ${mode}${botFill ? ' (bot-fill)' : ''} : ${room.players.map(p => `${p.profile.username}(${p.side})`).join(' vs ')}`);
}

async function endMatch(room, result) {
  rooms.delete(room);
  const a = room.players.find(p => p.side === 'top') || room.players[0], b = room.players.find(p => p.side === 'bottom') || room.players[1];
  const teamName = (side) => room.players.filter(p => p.side === side).map(p => p.profile.username).join(' & ');
  const outcome = {};
  for (const side of ['top', 'bottom']) {
    const opps = room.players.filter(x => x.side !== side);
    const res = room.mode === 'survival' ? 'survival' : result.winner === 'draw' ? 'draw' : result.winner === side ? 'win' : 'loss';
    // Profil « adversaire » synthétique pour les récompenses : moyenne des trophées de l'équipe adverse.
    const opp = { profile: Object.assign({}, opps[0].profile, { username: teamName(opps[0].side), trophies: Math.round(opps.reduce((n, o) => n + (o.profile.trophies || 0), 0) / opps.length) }) };
    outcome[side] = { res, opp };
  }
  const deltas = {};
  const payloads = {};
  for (const p of room.players) {
    if (p.bot || p.director || !p.profile || !p.profile.id) continue;
    const user = await db.getUserById(p.profile.id);
    if (!user) continue;
    const { res, opp } = outcome[p.side];
    const rewardMode = room.mode === 'duo' || room.mode === 'trio' ? 'ranked' : room.mode;
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
    payloads[p.key] = { t: 'match_end', side: p.side, key: p.key, result: res, winner: result.winner, reason: result.reason, duration: Math.round(result.duration), hp: result.hp, points: result.points, stats: result.stats, rewards: applied.rewards, levelUp: applied.levelUp, unlocked: applied.unlocked, newBest: applied.newBest, survival: result.survival, quests: Features.enabled('quests') ? questsView(updated) : null, profile, opponent: opp.profile };
  }
  for (const p of room.players) if (payloads[p.key]) room.send(p, payloads[p.key]);
  try {
    await db.recordMatch({
      mode: room.mode + (room.botFill ? '-botfill' : ''), p1_id: a.profile.id || null, p2_id: b.profile.id || null,
      p1_name: teamName('top'), p2_name: teamName('bottom'),
      winner: result.winner === 'draw' ? 'draw' : result.winner === a.side ? 'p1' : 'p2',
      reason: result.reason, duration: Math.round(result.duration), p1_delta: deltas[a.side] || 0, p2_delta: deltas[b.side] || 0, stats: result.stats,
    });
  } catch (err) { console.error('[db] recordMatch', err.message); }
  room.destroy();
}

const matchmaker = new Matchmaker({ createMatch: (entries, opts) => createMatch(entries, opts).catch(err => console.error('[match]', err)) });

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
    sendRaw(str) { if (ws.readyState === 1 && ws.bufferedAmount < 64 * 1024) ws.send(str); }, // saute l'envoi si le tuyau est déjà plein (connexion lente)
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
      case 'queue': {
        if (client.room) return;
        leaveFriendly(client);
        const team = Math.max(1, Math.min(3, Number(msg.team) || 1)); // 1 = classée 1v1, 2 = duo, 3 = trio
        matchmaker.join(client, client.profile, team);
        break;
      }
      case 'cancel':
        matchmaker.leave(client);
        client.send({ t: 'idle' });
        break;
      case 'bot': {
        if (client.room) return;
        matchmaker.leave(client); leaveFriendly(client);
        const diff = ['simple', 'moyen', 'difficile'].includes(msg.difficulty) ? msg.difficulty : 'moyen';
        await createMatch([{ client, profile: client.profile }], { mode: 'bot', bot: diff, duration: pickDuration(msg.duration), features: Features.resolveOptions(msg.options, false), map: String(msg.map || 'random'), teamSize: Math.max(1, Math.min(3, Number(msg.team) || 1)) });
        break;
      }
      case 'survival': {
        if (client.room || !Features.enabled('survival')) return;
        matchmaker.leave(client); leaveFriendly(client);
        await createMatch([{ client, profile: client.profile }], { mode: 'survival', survival: true, duration: 0, features: Object.assign(Features.resolveOptions(msg.options, false), { draft: false, kingOfCenter: false, overtime: false }), map: String(msg.map || 'random') });
        break;
      }
      case 'friendly_create': {
        if (client.room) return;
        matchmaker.leave(client); leaveFriendly(client);
        const code = makeCode();
        const team = Math.max(1, Math.min(3, Number(msg.team) || 1));
        friendly.set(code, { code, host: client, members: [client], team, duration: pickDuration(msg.duration), features: Features.resolveOptions(msg.options, false), map: String(msg.map || 'random') });
        client.friendlyCode = code;
        client.send({ t: 'friendly_created', code, team });
        sendFriendlyLobby(friendly.get(code));
        break;
      }
      case 'friendly_join': {
        if (client.room) return;
        const code = String(msg.code || '').toUpperCase().trim();
        const entry = friendly.get(code);
        if (!entry || !entry.host.alive) return client.send({ t: 'error', error: 'Code introuvable' });
        if (entry.members.includes(client)) return client.send({ t: 'error', error: 'Tu es déjà dans cette salle' });
        matchmaker.leave(client); leaveFriendly(client);
        entry.members = entry.members.filter(m => m.alive);
        if (entry.members.length >= entry.team * 2) return client.send({ t: 'error', error: 'Salle pleine' });
        entry.members.push(client); client.friendlyCode = code;
        if (entry.members.length === entry.team * 2) await startFriendly(entry);
        else sendFriendlyLobby(entry);
        break;
      }
      case 'friendly_start': { // l'hôte lance la partie, les places vides sont prises par des bots
        const entry = client.friendlyCode && friendly.get(client.friendlyCode);
        if (!entry || entry.host !== client) return;
        await startFriendly(entry);
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

function sendFriendlyLobby(entry) {
  const members = entry.members.filter(m => m.alive).map(m => ({ username: m.profile.username, host: m === entry.host }));
  for (const m of entry.members) if (m.alive) m.send({ t: 'friendly_lobby', code: entry.code, team: entry.team, members, need: entry.team * 2, host: m === entry.host });
}
async function startFriendly(entry) {
  friendly.delete(entry.code);
  const members = entry.members.filter(m => m.alive);
  for (const m of members) m.friendlyCode = null;
  if (members.length < 2 && entry.team === 1) return members.forEach(m => m.send({ t: 'error', error: 'Il faut un adversaire' }));
  await createMatch(members.map(m => ({ client: m, profile: m.profile })), { mode: 'friendly', duration: entry.duration, features: entry.features, map: entry.map, teamSize: entry.team, bot: members.length < entry.team * 2 ? 'moyen' : null });
}
function leaveFriendly(client) {
  if (!client.friendlyCode) return;
  const entry = friendly.get(client.friendlyCode);
  client.friendlyCode = null;
  if (!entry) return;
  if (entry.host === client) { // l'hôte part : la salle ferme
    friendly.delete(entry.code);
    for (const m of entry.members) if (m !== client && m.alive) { m.friendlyCode = null; m.send({ t: 'error', error: 'L’hôte a fermé la salle' }); m.send({ t: 'idle' }); }
  } else {
    entry.members = entry.members.filter(m => m !== client);
    sendFriendlyLobby(entry);
  }
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
  server.listen(PORT, () => console.log(`Glouglou Arena -> http://localhost:${PORT}  (db: ${db.kind}, build ${BUILD}, connexion : ${GOOGLE_CLIENT_ID ? 'sans compte ou Google' : 'sans compte (GOOGLE_CLIENT_ID non défini)'}, admins : ${[...ADMIN_EMAILS].join(', ') || 'clé admin'})`));
}).catch(err => { console.error('Impossible de démarrer la base :', err.message); process.exit(1); });
