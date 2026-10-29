/* Application : écrans, compte, lobby, matchmaking, profil, skins, classement. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Catalog = window.OGSCatalog;
  const Sim = window.OGSSim;
  let profile = null;
  let current = 'auth';
  let queueStart = 0, queueTimer = null, queueMode = null;
  let lastMatchKind = null; // { t:'queue' } | { t:'bot', difficulty } pour "Rejouer"
  let pendingResult = null;

  // ----- Fond animé (menus) -----
  const bg = $('bg'), bctx = bg.getContext('2d');
  function drawBg(ts) {
    const w = bg.width = window.innerWidth, h = bg.height = window.innerHeight;
    const g = bctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0f1b3d'); g.addColorStop(1, '#1d4ed8');
    bctx.fillStyle = g; bctx.fillRect(0, 0, w, h);
    const t = ts / 1000;
    bctx.lineCap = 'round'; bctx.lineWidth = 18;
    for (let i = 0; i < 14; i += 1) {
      const yBase = (h / 13) * i;
      bctx.strokeStyle = i % 2 ? 'rgba(147,197,253,0.10)' : 'rgba(59,130,246,0.14)';
      bctx.beginPath();
      for (let x = 0; x <= w; x += 28) { const y = yBase + Math.sin(x / 140 + t * 1.2 + i * 0.6) * 10; if (x === 0) bctx.moveTo(x, y); else bctx.lineTo(x, y); }
      bctx.stroke();
    }
    if (current !== 'game') requestAnimationFrame(drawBg);
    else setTimeout(() => requestAnimationFrame(drawBg), 500);
  }
  requestAnimationFrame(drawBg);

  // ----- Écrans -----
  const SCREENS = ['auth', 'lobby', 'queue', 'game', 'result', 'profile', 'skins', 'leaderboard', 'rules'];
  function show(name) {
    current = name;
    for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
    if (name === 'lobby') { refreshLobby(); }
  }
  document.querySelectorAll('[data-screen]').forEach(btn => btn.addEventListener('click', () => {
    const target = btn.dataset.screen;
    if (target === 'profile') openProfile();
    else if (target === 'skins') openSkins();
    else if (target === 'leaderboard') openLeaderboard();
    else if (target === 'rules') { renderRules(); show('rules'); }
    else show(target);
  }));

  // ----- Toasts -----
  let toastTimer = null;
  function toast(text, kind) {
    const el = $('gameToast');
    el.textContent = text; el.className = `toast ${kind || ''}`;
    el.style.borderColor = kind === 'bad' ? '#ef4444' : kind === 'warn' ? '#f59e0b' : '#22c55e';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 1600);
  }

  // ----- Jeu -----
  const canvas = $('gameCanvas');
  const renderer = OGSRender.createRenderer(canvas);
  const game = OGSGame.createGame(canvas, renderer, Net, { toast, onFrame: onGameFrame });
  document.querySelectorAll('.emote').forEach(b => b.addEventListener('click', () => game.onEmoteClick(b.dataset.emote)));
  $('btnSurrender').addEventListener('click', () => { if (confirm('Abandonner la partie ?')) Net.send({ t: 'surrender' }); });
  function onGameFrame(view) {
    const left = Math.max(0, Math.ceil(view.timeLeft));
    const el = $('hudTimer'); el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('hurry', left <= 20 && view.phase !== 'over');
  }

  // ----- Auth -----
  $('authForm').addEventListener('submit', (ev) => { ev.preventDefault(); auth('login'); });
  document.querySelector('[data-action="register"]').addEventListener('click', () => auth('register'));
  async function auth(kind) {
    $('authError').textContent = '';
    try {
      const data = await Net.api(`/api/${kind}`, { username: $('authUser').value.trim(), password: $('authPass').value });
      Net.setToken(data.token); profile = data.profile;
      enterLobby();
    } catch (err) { $('authError').textContent = err.message; }
  }
  $('btnLogout').addEventListener('click', () => { Net.disconnect(); Net.setToken(null); profile = null; show('auth'); });

  async function tryResume() {
    if (!Net.getToken()) return show('auth');
    try { const data = await Net.api('/api/me'); profile = data.profile; enterLobby(); }
    catch (e) { Net.setToken(null); show('auth'); }
  }
  function enterLobby() {
    Sprites.preload(profile.skins);
    show('lobby');
    Net.connect();
  }

  // ----- Lobby -----
  async function refreshLobby() {
    if (!profile) return;
    try { const data = await Net.api('/api/me'); profile = data.profile; } catch (e) { /* hors-ligne : on garde le profil connu */ }
    $('lobbyName').textContent = profile.username;
    $('lobbyLevel').textContent = profile.level;
    $('lobbyTrophies').textContent = profile.trophies;
    $('lobbyRank').textContent = profile.rank;
    $('lobbyCoins').textContent = profile.coins;
    $('lobbyXp').style.width = `${Math.round(profile.xpInto / profile.xpNeed * 100)}%`;
    $('lobbyXpText').textContent = `Niv. ${profile.level} · ${profile.xpInto}/${profile.xpNeed} XP`;
    $('btnDaily').classList.toggle('hidden', !profile.dailyAvailable);
    const next = profile.nextRank;
    $('lobbyLeague').innerHTML = `<span style="color:${profile.rankColor}">${profile.rank}</span><small>${next ? `${next.min - profile.trophies} trophées avant ${next.name}` : 'Ligue maximale !'}${profile.leaderboardRank ? ` · #${profile.leaderboardRank} mondial` : ''}</small>`;
    try {
      const { leaderboard } = await Net.api('/api/leaderboard');
      $('lobbyTop').innerHTML = leaderboard.slice(0, 5).map(r => `<li><span>${esc(r.username)}</span><span class="t">${r.trophies}</span></li>`).join('') || '<li>Personne encore… sois le premier !</li>';
    } catch (e) { /* ignore */ }
  }
  setInterval(() => { if (current === 'lobby') $('onlineCount').textContent = Net.online; }, 1000);
  $('btnDaily').addEventListener('click', async () => {
    try { const d = await Net.api('/api/daily', {}); profile = d.profile; $('lobbyMsg').textContent = `+${d.coins} pièces récupérées !`; refreshLobby(); }
    catch (e) { $('lobbyMsg').textContent = e.message; }
  });
  $('lobbyProfile').addEventListener('click', openProfile);

  $('btnPlay').addEventListener('click', () => { lastMatchKind = { t: 'queue' }; Net.send({ t: 'queue' }); openQueue('Recherche d’un adversaire…', 'queue'); });
  $('btnBot').addEventListener('click', () => { const difficulty = $('botLevel').value; lastMatchKind = { t: 'bot', difficulty }; Net.send({ t: 'bot', difficulty, hazard: $('chkHazard').checked }); openQueue('Préparation de l’IA…', 'bot'); });
  $('btnFriendlyCreate').addEventListener('click', () => { Net.send({ t: 'friendly_create', hazard: $('chkHazard').checked }); openQueue('Partie amicale : partage ce code', 'friendly'); });
  $('btnFriendlyJoin').addEventListener('click', () => { const code = $('friendlyCode').value.trim().toUpperCase(); if (code.length < 4) return ($('lobbyMsg').textContent = 'Entre le code à 5 caractères'); Net.send({ t: 'friendly_join', code }); $('lobbyMsg').textContent = 'Connexion à la salle…'; });
  $('btnCancelQueue').addEventListener('click', () => { Net.send({ t: queueMode === 'friendly' ? 'friendly_leave' : 'cancel' }); closeQueue(); });

  function openQueue(title, mode) {
    queueMode = mode; queueStart = Date.now();
    $('queueTitle').textContent = title; $('queueSub').textContent = '0 s'; $('queueCode').classList.add('hidden');
    show('queue');
    clearInterval(queueTimer);
    queueTimer = setInterval(() => { const s = Math.floor((Date.now() - queueStart) / 1000); $('queueSub').textContent = mode === 'friendly' ? 'En attente de ton ami…' : `${s} s`; }, 500);
  }
  function closeQueue() { clearInterval(queueTimer); queueTimer = null; queueMode = null; show('lobby'); }

  // ----- Événements réseau -----
  Net.on('auth_ok', (msg) => { profile = msg.profile; if (current === 'lobby') refreshLobby(); });
  Net.on('auth_error', () => { Net.disconnect(); Net.setToken(null); show('auth'); $('authError').textContent = 'Session expirée, reconnecte-toi'; });
  Net.on('kicked', (msg) => { Net.disconnect(); alert(msg.reason || 'Déconnecté'); show('auth'); });
  Net.on('queued', (msg) => { if (current === 'queue' && queueMode === 'queue') $('queueSub').textContent = `${msg.wait || 0} s · fenêtre ±${msg.band || 100} 🏆${msg.botFillIn ? ` · bot dans ${msg.botFillIn} s` : ''}`; });
  Net.on('friendly_created', (msg) => { $('queueCode').textContent = msg.code; $('queueCode').classList.remove('hidden'); });
  Net.on('error', (msg) => { $('lobbyMsg').textContent = msg.error; toast(msg.error, 'bad'); });
  Net.on('idle', () => { if (current === 'queue') closeQueue(); });
  Net.on('match_start', (msg) => {
    clearInterval(queueTimer); pendingResult = null;
    $('hudOppName').textContent = msg.opponent.username;
    $('hudOppSub').textContent = `🏆 ${msg.opponent.trophies} · ${msg.opponent.rank || ''}${msg.opponentIsBot ? ' · IA' : ''}`;
    $('hudMeName').textContent = msg.me.username; $('hudMeSub').textContent = `🏆 ${msg.me.trophies} · ${msg.me.rank}`;
    show('game'); game.start(msg);
  });
  Net.on('go', () => game.onGo());
  Net.on('snap', (msg) => game.onSnap(msg));
  Net.on('place_rejected', (msg) => game.onRejected(msg));
  Net.on('presence', (msg) => { game.onPresence(msg); if (!msg.connected) toast('Adversaire déconnecté…', 'warn'); });
  Net.on('emote', (msg) => game.onEmote(msg));
  Net.on('match_end', (msg) => { pendingResult = msg; setTimeout(() => showResult(msg), 1800); });
  Net.on('disconnected', () => { if (current === 'game') toast('Connexion perdue… reconnexion', 'warn'); if (current === 'queue') closeQueue(); });

  // ----- Résultat -----
  function showResult(msg) {
    if (pendingResult !== msg) return;
    game.stop();
    profile = msg.profile;
    const title = $('resultTitle');
    title.textContent = msg.result === 'win' ? 'VICTOIRE' : msg.result === 'loss' ? 'DÉFAITE' : 'ÉGALITÉ';
    title.className = `result-title ${msg.result}`;
    const reasons = { ko: 'Base détruite', time: 'Temps écoulé', surrender: 'Abandon', disconnect: 'Déconnexion' };
    $('resultSub').textContent = `${reasons[msg.reason] || msg.reason} · contre ${msg.opponent.username} · ${Math.floor(msg.duration / 60)}:${String(msg.duration % 60).padStart(2, '0')}`;
    const r = msg.rewards;
    $('resTrophies').textContent = `${r.trophies >= 0 ? '+' : ''}${r.trophies}`;
    $('resXp').textContent = `+${r.xp}`; $('resCoins').textContent = `+${r.coins}`;
    $('resXpFill').style.width = `${Math.round(profile.xpInto / profile.xpNeed * 100)}%`;
    $('resXpText').textContent = `Niveau ${profile.level} · ${profile.xpInto}/${profile.xpNeed} XP`;
    const extra = [];
    if (msg.levelUp) extra.push(`⬆ Niveau ${msg.levelUp} !`);
    if (r.streakBonus) extra.push(`🔥 Série de victoires : +${r.streakBonus} XP`);
    if (msg.unlocked && msg.unlocked.length) extra.push(`🎁 Débloqué : ${msg.unlocked.map(id => Catalog.SKIN_BY_ID[id] ? Catalog.SKIN_BY_ID[id].name : id).join(', ')}`);
    $('resExtra').innerHTML = extra.map(esc).join('<br>');
    const side = msg.side || 'bottom', oppSide = Sim.other(side);
    const mine = msg.stats[side], theirs = msg.stats[oppSide];
    $('resStats').innerHTML = `<div>Ogs posés : <b>${mine.placed}</b> (adv. ${theirs.placed})</div><div>Éliminations : <b>${mine.kills}</b> (adv. ${theirs.kills})</div><div>Dégâts à la base : <b>${mine.damage}</b> (adv. ${theirs.damage})</div><div>Orbes ramassées : <b>${mine.orbs}</b> (adv. ${theirs.orbs})</div><div>PV restants : <b>${msg.hp[side]}</b> (adv. ${msg.hp[oppSide]})</div><div>Mana dépensée : <b>${mine.manaSpent}</b></div>`;
    show('result');
  }
  $('btnResultMenu').addEventListener('click', () => show('lobby'));
  $('btnResultReplay').addEventListener('click', () => {
    show('lobby');
    if (lastMatchKind && lastMatchKind.t === 'bot') $('btnBot').click();
    else $('btnPlay').click();
  });

  // ----- Profil -----
  async function openProfile() {
    show('profile');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    $('profileName').textContent = profile.username;
    $('profileLevel').textContent = profile.level;
    $('profileSub').innerHTML = `<span style="color:${profile.rankColor}">${profile.rank}</span> · 🏆 ${profile.trophies} (record ${profile.bestTrophies})${profile.leaderboardRank ? ` · #${profile.leaderboardRank} mondial` : ''} · membre depuis ${new Date(profile.createdAt).toLocaleDateString('fr-FR')}`;
    $('profileXp').style.width = `${Math.round(profile.xpInto / profile.xpNeed * 100)}%`;
    $('profileXpText').textContent = `Niveau ${profile.level} · ${profile.xpInto}/${profile.xpNeed} XP`;
    const wr = profile.games ? Math.round(profile.wins / profile.games * 100) : 0;
    const stats = [['Parties', profile.games], ['Victoires', profile.wins], ['Défaites', profile.losses], ['Égalités', profile.draws], ['Taux de victoire', `${wr} %`], ['Série en cours', profile.streak], ['Pièces', profile.coins], ['Skins', profile.skins.length]];
    $('profileStats').innerHTML = stats.map(([l, v]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    try {
      const { history } = await Net.api('/api/history');
      const labels = { win: 'Victoire', loss: 'Défaite', draw: 'Égalité' };
      $('profileHistory').innerHTML = history.map(h => `<li><span class="${h.result}">${labels[h.result]}</span><span>vs ${esc(h.opponent)}</span><span>${h.mode.replace('-botfill', ' (bot)')}</span><span>${h.delta >= 0 ? '+' : ''}${h.delta} 🏆</span><span>${new Date(h.at).toLocaleString('fr-FR')}</span></li>`).join('') || '<li>Aucune partie jouée pour l’instant.</li>';
    } catch (e) { $('profileHistory').innerHTML = '<li>Historique indisponible.</li>'; }
  }

  // ----- Skins -----
  let skinTab = 1;
  async function openSkins() {
    show('skins');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    $('skinsCoins').textContent = profile.coins;
    $('skinTabs').innerHTML = [1, 2, 3, 4, 5, 6, 7].map(og => `<button class="og-tab ${og === skinTab ? 'active' : ''}" data-og="${og}">${Catalog.OG_NAMES[og]}</button>`).join('');
    $('skinTabs').querySelectorAll('.og-tab').forEach(b => b.addEventListener('click', () => { skinTab = Number(b.dataset.og); openSkins(); }));
    const owned = new Set(profile.skins);
    const skins = Catalog.SKINS.filter(s => s.ogId === skinTab);
    const grid = $('skinGrid'); grid.innerHTML = '';
    for (const skin of skins) {
      const card = document.createElement('div');
      const isOwned = owned.has(skin.id), isEq = profile.equipped[skin.ogId] === skin.id;
      card.className = `skin-card ${isEq ? 'equipped' : ''}`;
      const unlock = Catalog.canUnlock(skin, profile);
      let action = '';
      if (isEq) action = '<div class="skin-lock">✔ Équipé</div>';
      else if (isOwned) action = `<button class="btn primary" data-equip="${skin.id}">Équiper</button>`;
      else if (skin.unlock.type === 'coins') action = `<button class="btn gold" data-buy="${skin.id}" ${unlock.ok ? '' : 'disabled'}>${skin.unlock.value} pièces</button>`;
      else action = `<div class="skin-lock">🔒 ${unlock.label}</div>`;
      card.innerHTML = `<canvas width="240" height="240"></canvas><div class="skin-name">${esc(skin.name)}</div><div class="skin-rarity r-${skin.rarity}">${skin.rarity}</div>${action}`;
      grid.appendChild(card);
      const c = card.querySelector('canvas');
      Sprites.ensure(skin.id).then(() => { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 240, 240); Sprites.draw(ctx, skin.ogId, skin.id, 120, 120, 170, { time: 0, alpha: isOwned ? 1 : 0.55 }); });
    }
    grid.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', async () => { try { profile = (await Net.api('/api/skins/equip', { skinId: b.dataset.equip })).profile; openSkins(); } catch (e) { alert(e.message); } }));
    grid.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', async () => { try { profile = (await Net.api('/api/skins/buy', { skinId: b.dataset.buy })).profile; openSkins(); } catch (e) { alert(e.message); } }));
  }

  // ----- Classement -----
  async function openLeaderboard() {
    show('leaderboard');
    try {
      const { leaderboard } = await Net.api('/api/leaderboard');
      $('boardTable').querySelector('tbody').innerHTML = leaderboard.map(r => `<tr class="${profile && r.id === profile.id ? 'me' : ''}"><td>${r.rank}</td><td>${esc(r.username)}</td><td>${r.league}</td><td>${r.level}</td><td>🏆 ${r.trophies}</td><td>${r.wins} / ${r.losses}</td></tr>`).join('') || '<tr><td colspan="6">Aucun joueur classé.</td></tr>';
    } catch (e) { /* ignore */ }
  }

  // ----- Règles -----
  function renderRules() {
    const og = Sim.OGS;
    const lines = [
      [1, 'Fonce tout droit vers la base ennemie (1 dégât). Meurt au contact des Défenseurs, Éponges, Tourelles et Chargeurs adverses. Rebondit sur un Mur ennemi en changeant de camp ! Passe au-dessus de tes propres Murs.'],
      [2, 'Patrouille horizontalement, rebondit sur les bords et les obstacles. Mange les Runners adverses. Destruction mutuelle avec une Éponge.'],
      [3, 'Statique, 2 PV. Tire vers l’avant sur les ennemis à 1 case. Détruite au contact d’une Éponge.'],
      [4, 'Avance en diagonale en rebondissant sur les côtés, 3 PV. Détruit Tourelles et Chargeurs au contact (perd 1 PV à chaque fois), casse un Mur mais meurt. 2 dégâts à la base.'],
      [5, 'Mur statique, 3 PV. Renvoie les Runners ennemis (−1 PV par rebond). Tes propres Ogs le traversent.'],
      [6, 'Statique, 3 PV. +50 % de régénération de mana tant qu’il est en vie (cumulable). Cible préférée des Éponges et Ailées.'],
      [7, 'Vole tout droit au-dessus de tout. Tire sur les Runners, Tourelles, Chargeurs et Ailées à 1 case. 5 dégâts à la base. 2 PV.'],
    ];
    $('rulesPage').innerHTML = `
      <h3>But</h3><p>Chaque joueur a <b>30 PV</b>. Pose des Ogs sur ta moitié pour atteindre la base adverse. Après <b>3 minutes</b>, celui qui a le plus de PV gagne.</p>
      <h3>Mana</h3><p>Max 70, +2 / s. Clique (ou touche <kbd>O</kbd>) sur les orbes de ton côté : +10 mana. Chaque Chargeur vivant accélère ta régénération de 50 %.</p>
      <h3>Contrôles</h3><p><kbd>A</kbd> <kbd>Z</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd> (ou <kbd>1</kbd>–<kbd>7</kbd>, ou clic sur un slot) pour choisir un Og · flèches pour déplacer le curseur · <kbd>Entrée</kbd> / <kbd>Espace</kbd> ou clic pour poser · <kbd>Échap</kbd> annule. Runner, Éponge et Ailée se posent uniquement sur la ligne avant.</p>
      <h3>Les Ogs</h3>
      ${lines.map(([id, txt]) => `<div class="og-line"><canvas width="112" height="112" data-og="${id}"></canvas><div><b>${esc(og[id].name)}</b> · ${og[id].cost} mana<br>${txt}</div></div>`).join('')}
      <h3>Scorpion noir</h3><p>Toutes les 60 à 90 s, un bloc noir traverse le centre, s’arrête, puis fonce vers un camp en détruisant tout sur son passage. Les placements sont bloqués pendant son passage.</p>
      <h3>Progression</h3><p>Partie classée : trophées gagnés/perdus selon l’écart (style Brawl Stars), ligues Bronze → Légendaire. XP à chaque partie (niveau), pièces pour la boutique de skins, bonus de série, récompense quotidienne.</p>`;
    $('rulesPage').querySelectorAll('canvas[data-og]').forEach(c => { const id = Number(c.dataset.og); Sprites.ensure(`og${id}_default`).then(() => Sprites.draw(c.getContext('2d'), id, `og${id}_default`, 56, 56, 90, { time: 0 })); });
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

  // ----- Vitrine des Ogs équipés (lobby) -----
  const showcase = $('lobbyShowcase'), sctx = showcase.getContext('2d');
  function drawShowcase(ts) {
    requestAnimationFrame(drawShowcase);
    if (current !== 'lobby' || !profile) return;
    const t = ts / 1000, w = showcase.width, h = showcase.height;
    sctx.clearRect(0, 0, w, h);
    const slot = w / 7;
    for (let i = 0; i < 7; i += 1) {
      const og = i + 1, x = slot * i + slot / 2, base = h * 0.62;
      let bob = 0, sx = 1, sy = 1, rot = 0;
      if (og === 1) { bob = -Math.abs(Math.sin(t * 6 + i)) * 18; sy = 1 + 0.08 * Math.sin(t * 12 + i); sx = 2 - sy; }
      else if (og === 2) { rot = Math.sin(t * 9) * 0.08; bob = -Math.abs(Math.sin(t * 4.5)) * 8; }
      else if (og === 4) { rot = t * 0.6; sx = sy = 1 + 0.05 * Math.sin(t * 4); }
      else if (og === 7) { bob = Math.sin(t * 3 + i) * 14; sx = 1 + 0.1 * Math.sin(t * 16); }
      else { sx = sy = 1 + 0.03 * Math.sin(t * 2 + i); }
      sctx.fillStyle = 'rgba(0,0,0,0.25)'; sctx.beginPath(); sctx.ellipse(x, base + 70, 50 * (1 + bob / 80), 14, 0, 0, Math.PI * 2); sctx.fill();
      Sprites.draw(sctx, og, profile.equipped[og], x, base + bob, 150, { time: t, rot, scaleX: sx, scaleY: sy });
      sctx.fillStyle = '#e2e8f0'; sctx.font = 'bold 22px Fredoka, sans-serif'; sctx.textAlign = 'center';
      sctx.fillText(`${['A', 'Z', 'E', 'R', 'T', 'Y', 'U'][i]} · ${Sim.OGS[og].cost}`, x, h - 14);
    }
  }
  requestAnimationFrame(drawShowcase);

  Sprites.preload();
  tryResume();
})();
