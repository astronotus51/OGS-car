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
  // Fond « abysses » : nuit marine, rais de lumière qui descendent, plancton et bulles qui montent.
  const BUBBLES = Array.from({ length: 46 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 5, v: 0.012 + Math.random() * 0.03, w: Math.random() * 6.28, big: i % 9 === 0 }));
  const PLANKTON = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28 }));
  function drawBg(ts) {
    const w = bg.width = window.innerWidth, h = bg.height = window.innerHeight;
    const t = ts / 1000;
    const g = bctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#071a33'); g.addColorStop(0.45, '#04101f'); g.addColorStop(1, '#02070f');
    bctx.fillStyle = g; bctx.fillRect(0, 0, w, h);
    // Rais de lumière (god rays) depuis la surface.
    bctx.save(); bctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i += 1) {
      const x0 = w * (0.1 + i * 0.14) + Math.sin(t * 0.15 + i) * 60, sway = Math.sin(t * 0.22 + i * 1.7) * 120;
      const rg = bctx.createLinearGradient(x0, 0, x0 + sway, h); rg.addColorStop(0, `rgba(34,227,200,${0.07 + 0.03 * Math.sin(t * 0.5 + i)})`); rg.addColorStop(0.7, 'rgba(34,227,200,0.012)'); rg.addColorStop(1, 'rgba(34,227,200,0)');
      bctx.fillStyle = rg; bctx.beginPath(); bctx.moveTo(x0 - 22, 0); bctx.lineTo(x0 + 22, 0); bctx.lineTo(x0 + sway + 150, h); bctx.lineTo(x0 + sway - 150, h); bctx.closePath(); bctx.fill();
    }
    bctx.restore();
    // Plancton.
    for (const p of PLANKTON) { const a = 0.25 + 0.25 * Math.sin(t * 1.3 + p.p); bctx.fillStyle = `rgba(143,183,201,${a})`; bctx.fillRect(p.x * w + Math.sin(t * 0.3 + p.p) * 8, (p.y * h + t * 6 * (0.3 + (p.p % 1))) % h, 1.5, 1.5); }
    // Bulles.
    for (const b of BUBBLES) {
      b.y -= b.v * 0.016; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
      const x = b.x * w + Math.sin(t * 1.2 + b.w) * 6 * (b.big ? 2 : 1), y = b.y * h, r = b.r * (b.big ? 2.4 : 1);
      bctx.strokeStyle = 'rgba(34,227,200,0.35)'; bctx.lineWidth = 1; bctx.beginPath(); bctx.arc(x, y, r, 0, Math.PI * 2); bctx.stroke();
      bctx.fillStyle = 'rgba(239,230,207,0.5)'; bctx.beginPath(); bctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2); bctx.fill();
    }
    // Vignette.
    const v = bctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    bctx.fillStyle = v; bctx.fillRect(0, 0, w, h);
    if (current !== 'game') requestAnimationFrame(drawBg);
    else setTimeout(() => requestAnimationFrame(drawBg), 500);
  }
  requestAnimationFrame(drawBg);

  // ----- Écrans -----
  const SCREENS = ['auth', 'lobby', 'queue', 'game', 'result', 'profile', 'skins', 'leaderboard', 'rules', 'avatar', 'collection', 'capsules', 'road'];
  function show(name) {
    current = name;
    if (window.OGSAudio && name !== 'game' && name !== 'result') OGSAudio.setScene('menu');
    for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
    if (name === 'lobby') { refreshLobby(); }
  }
  document.querySelectorAll('[data-screen]').forEach(btn => btn.addEventListener('click', () => {
    const target = btn.dataset.screen;
    if (target === 'profile') openProfile();
    else if (target === 'skins') openSkins();
    else if (target === 'collection') openCollection();
    else if (target === 'capsules') openCapsules();
    else if (target === 'road') openRoad();
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
    const el = $('hudTimer');
    if (!isFinite(view.timeLeft)) { const e = Math.floor(view.elapsed || 0); el.textContent = `${Math.floor(e / 60)}:${String(e % 60).padStart(2, '0')}`; el.classList.remove('hurry'); return; }
    const left = Math.max(0, Math.ceil(view.timeLeft));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('hurry', left <= 20 && view.phase !== 'over');
  }

  // ----- Compte Google (quand le serveur a un GOOGLE_CLIENT_ID) ou invité sans compte -----
  const GOOGLE_CLIENT_ID = (document.querySelector('meta[name="google-client-id"]') || {}).content || '';
  const GOOGLE_MODE = !!GOOGLE_CLIENT_ID;
  let googleCredential = null;
  let googleIntent = 'login'; // 'login' (accueil) ou 'link' (créer son compte à partir du joueur invité courant)
  let gsiReady = false;
  const GOOGLE_BTN = { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', locale: 'fr' };
  // Invité verrouillé : pas de compte Google alors que le serveur le propose (les admins ne sont jamais verrouillés).
  const isLocked = () => GOOGLE_MODE && profile && profile.guest && !profile.admin;
  function renderGoogleButton(el, intent) {
    if (!gsiReady || !el) return;
    el.innerHTML = ''; el.dataset.intent = intent;
    google.accounts.id.renderButton(el, Object.assign({}, GOOGLE_BTN, { click_listener: () => { googleIntent = intent; } }));
  }
  if (GOOGLE_MODE) {
    $('googleAuth').hidden = false;
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = () => {
      if (!window.google) return;
      gsiReady = true;
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential, ux_mode: 'popup', auto_select: true, cancel_on_tap_outside: false, itp_support: true });
      renderGoogleButton($('googleBtn'), 'login');
      // Déjà connu de Google sur cet appareil : la bulle « Continuer en tant que … » reconnecte en un clic (ou automatiquement),
      // sans redemander de pseudo : toute la progression du compte est reprise.
      if (current === 'auth') { googleIntent = 'login'; try { google.accounts.id.prompt(); } catch (e) { /* ignore */ } }
      if (current === 'profile') renderGoogleButton($('googleLinkBtn'), 'link');
      if (current === 'skins') renderGoogleButton($('googleSkinsBtn'), 'link');
    };
    s.onerror = () => { $('googleError').textContent = 'Impossible de charger la connexion Google (réseau ?)'; };
    document.head.appendChild(s);
  } else {
    $('guestInfo').textContent = 'Pour jouer tout de suite, avec un pseudo d’invité. Ta progression reste sur cet appareil.';
  }
  async function onGoogleCredential(resp) {
    googleCredential = resp.credential;
    if (googleIntent === 'link') {
      // Création du compte à partir du joueur invité : on garde sa progression, on prend le pseudo choisi (profil) s'il y en a un.
      const msgEl = current === 'skins' ? $('googleSkinsMsg') : $('googleLinkMsg'); msgEl.textContent = '';
      const username = current === 'profile' ? $('googleLinkUser').value.trim() : '';
      try {
        const d = await Net.api('/api/auth/google/link', Object.assign({ credential: googleCredential }, username ? { username } : {}));
        profile = d.profile;
        if (d.switched) { toast(`Ce compte Google existait déjà : te revoilà ${profile.username}, avec toute ta progression`, 'good'); Net.disconnect(); enterLobby(); return; }
        toast('Compte créé ! Skins, avatar et quêtes débloqués', 'good');
        if (current === 'skins') openSkins(); else openProfile();
      } catch (err) { msgEl.textContent = err.message; }
      return;
    }
    $('googleError').textContent = '';
    try {
      const d = await Net.api('/api/auth/google', { credential: googleCredential });
      if (d.needUsername) { $('googleNameForm').hidden = false; $('guestAuth').hidden = true; $('googleBtn').hidden = true; $('googleUser').value = d.suggested || ''; $('googleUser').focus(); return; }
      profile = d.profile; enterLobby();
    } catch (err) { $('googleError').textContent = err.message; }
  }
  function closeGoogleName() { $('googleNameForm').hidden = true; $('guestAuth').hidden = false; $('googleBtn').hidden = false; }
  $('googleNameForm').addEventListener('submit', async (ev) => {
    ev.preventDefault(); $('googleError').textContent = '';
    try { profile = (await Net.api('/api/auth/google', { credential: googleCredential, username: $('googleUser').value.trim() })).profile; closeGoogleName(); enterLobby(); }
    catch (err) { $('googleError').textContent = err.message; if (err.status === 401) closeGoogleName(); }
  });
  $('googleNameCancel').addEventListener('click', () => { closeGoogleName(); googleCredential = null; });

  // Invité : un clic, le serveur attribue un pseudo « Invité-1234 ».
  $('btnGuest').addEventListener('click', async () => {
    $('authError').textContent = ''; $('btnGuest').disabled = true;
    try { profile = (await Net.api('/api/guest', {})).profile; enterLobby(); }
    catch (err) { $('authError').textContent = err.message; }
    $('btnGuest').disabled = false;
  });
  function goUpgrade() { show('profile'); setTimeout(() => { const c = $('googleCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('googleLinkUser').focus(); }, 300); }
  $('btnGuestUpgrade').addEventListener('click', goUpgrade);
  async function logout() {
    const linked = profile && profile.google;
    if (!confirm(linked ? 'Se déconnecter de cet appareil ? (tu retrouveras ta progression en te reconnectant avec Google)' : 'Quitter ? Ce joueur invité sera oublié sur cet appareil (crée un compte Google avant si tu veux garder ta progression)')) return;
    if (GOOGLE_MODE && window.google) try { google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    try { await Net.api('/api/logout', {}); } catch (e) { /* ignore */ }
    Net.disconnect(); profile = null; show('auth');
  }
  $('btnLogout').addEventListener('click', logout);
  $('btnLogout2').addEventListener('click', logout);
  $('adminKeyForm').addEventListener('submit', async (ev) => {
    ev.preventDefault(); $('adminKeyMsg').textContent = '';
    try { profile = (await Net.api('/api/admin/activate', { key: $('adminKey').value })).profile; $('adminKey').value = ''; $('adminKeyMsg').textContent = 'Mode admin activé !'; $('adminKeyCard').classList.add('hidden'); closeModal('settingsModal'); refreshLobby(); toast('Tu es maintenant ADMIN', 'good'); }
    catch (e) { $('adminKeyMsg').textContent = e.message; }
  });

  async function tryResume() {
    try { const data = await Net.api('/api/me'); profile = data.profile; enterLobby(); }
    catch (e) { show('auth'); }
  }
  function enterLobby() {
    show('lobby');
    Net.connect();
  }
  let config = { avatarPresets: [] };

  // ----- Avatars -----
  function renderAvatar(el, p, level) {
    el.querySelectorAll('img, canvas').forEach(n => n.remove());
    const span = el.querySelector('span:not(.avatar-edit)');
    const av = p && p.avatar;
    if (av && av.startsWith('preset:') && window.Creatures) {
      const skinId = av.slice(7), og = Number(skinId.replace(/^og(\d).*/, '$1')) || 1;
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0, 0, 128, 128);
      Creatures.draw(ctx, og, skinId, 64, 70, 92, 0, { moving: false, phase: og });
      el.appendChild(c); if (span) span.style.visibility = 'hidden';
    } else if (av && av.startsWith('data:image/')) {
      const img = document.createElement('img'); img.src = av; img.alt = ''; el.appendChild(img); if (span) span.style.visibility = 'hidden';
    } else if (span) { span.style.visibility = 'visible'; if (level !== undefined) span.textContent = level; }
  }
  function avatarHtml(av, fallback) {
    if (av && av.startsWith('data:image/')) return `<span class="avatar"><img src="${av}" alt=""></span>`;
    return `<span class="avatar"><span>${fallback || ''}</span></span>`;
  }
  async function openAvatar() {
    if (isLocked()) { toast('L’avatar est réservé aux joueurs avec un compte', 'bad'); return goUpgrade(); }
    show('avatar');
    const grid = $('avatarGrid'); grid.innerHTML = '';
    for (const id of config.avatarPresets) {
      const d = document.createElement('div'); d.className = `avatar ${profile.avatar === `preset:${id}` ? 'selected' : ''}`; d.innerHTML = '<span></span>';
      renderAvatar(d, { avatar: `preset:${id}` });
      d.addEventListener('click', () => setAvatar(`preset:${id}`));
      grid.appendChild(d);
    }
  }
  async function setAvatar(value) {
    try { profile = (await Net.api('/api/avatar', { avatar: value })).profile; $('avatarMsg').textContent = 'Avatar mis à jour !'; OGSAudio.sfx('coin'); openAvatar(); renderAllAvatars(); }
    catch (e) { $('avatarMsg').textContent = e.message; }
  }
  $('avatarFile').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) return ($('avatarMsg').textContent = 'Choisis une image');
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      // Recadrage carré + réduction à 128 px, JPEG : légère et sans métadonnées (la photo originale ne quitte jamais ton ordinateur telle quelle).
      const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d');
      const m = Math.min(img.width, img.height); ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      let q = 0.86, data = c.toDataURL('image/jpeg', q);
      while (data.length > 60000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
      setAvatar(data);
    };
    img.onerror = () => { $('avatarMsg').textContent = 'Image illisible'; };
    img.src = url;
    ev.target.value = '';
  });
  $('btnAvatarNone').addEventListener('click', () => setAvatar(null));
  $('btnAvatarClose').addEventListener('click', () => { openProfile(); });
  $('btnAvatar').addEventListener('click', openAvatar);
  $('profileAvatar').addEventListener('click', openAvatar);
  function renderAllAvatars() { if (!profile) return; renderAvatar($('lobbyAvatar'), profile, profile.level); renderAvatar($('profileAvatar'), profile, profile.level); }

  // ----- Audio -----
  const Audio = window.OGSAudio;
  function syncAudioUi() {
    for (const id of ['btnMusic', 'btnMusicGame']) $(id).classList.toggle('off', !Audio.settings.music);
    for (const id of ['btnSfx', 'btnSfxGame']) $(id).classList.toggle('off', !Audio.settings.sfx);
    $('musicVol').value = Audio.settings.musicVol; $('sfxVol').value = Audio.settings.sfxVol;
  }
  for (const id of ['btnMusic', 'btnMusicGame']) $(id).addEventListener('click', () => { Audio.init(); Audio.setMusic(!Audio.settings.music); syncAudioUi(); });
  for (const id of ['btnSfx', 'btnSfxGame']) $(id).addEventListener('click', () => { Audio.init(); Audio.setSfx(!Audio.settings.sfx); syncAudioUi(); Audio.sfx('ui'); });
  $('musicVol').addEventListener('input', () => Audio.setMusicVol(Number($('musicVol').value)));
  $('sfxVol').addEventListener('input', () => { Audio.setSfxVol(Number($('sfxVol').value)); Audio.sfx('ui'); });
  const unlockAudio = () => { Audio.init(); const h = $('soundHint'); if (h) h.textContent = Audio.ready ? (Audio.settings.music ? '♪ Musique activée (réglages dans le lobby)' : '♪ Musique coupée (réglages dans le lobby)') : ''; };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  document.addEventListener('click', (ev) => { if (ev.target.closest('.btn, .og-tab, .emote, .icon-btn')) Audio.sfx('ui'); });
  syncAudioUi();

  // ----- Lobby -----
  async function refreshLobby() {
    if (!profile) return;
    try { const data = await Net.api('/api/me'); profile = data.profile; } catch (e) { /* hors-ligne : on garde le profil connu */ }
    $('lobbyName').innerHTML = esc(profile.username) + badgeOf(profile);
    $('lobbyLevel').textContent = profile.level; renderAvatar($('lobbyAvatar'), profile, profile.level);
    $('lobbyTrophies').textContent = profile.trophies;
    $('lobbyRank').textContent = profile.rank;
    $('lobbyCoins').textContent = profile.coins;
    $('lobbyXp').style.width = `${Math.round(profile.xpInto / profile.xpNeed * 100)}%`;
    $('lobbyXpText').textContent = `Niv. ${profile.level} · ${profile.xpInto}/${profile.xpNeed} XP`;
    $('btnDaily').classList.toggle('hidden', !profile.dailyAvailable || isLocked());
    const ownedN = Object.keys(profile.collection || {}).length;
    $('collectionTileHint').textContent = `${ownedN}/${Catalog.CREATURES.length} créatures`;
    $('capsuleTileHint').textContent = profile.capsules ? `${profile.capsules} à ouvrir !` : 'une par victoire';
    const claimable = Catalog.TROPHY_ROAD.filter(r => r.trophies <= (profile.bestTrophies || 0) && !(profile.road || []).includes(r.trophies)).length;
    $('roadTileHint').textContent = claimable ? `${claimable} récompense(s) !` : `${profile.bestTrophies || 0} 🏆`;
    $('capsuleTileHint').parentElement.classList.toggle('pulse', !!profile.capsules); $('roadTileHint').parentElement.classList.toggle('pulse', !!claimable);
    $('guestBanner').classList.toggle('hidden', !isLocked());
    const next = profile.nextRank;
    $('lobbyLeague').innerHTML = `<span style="color:${profile.rankColor}">${profile.rank}</span><small>${next ? `${next.min - profile.trophies} trophées avant ${next.name}` : 'Ligue maximale !'}${profile.leaderboardRank ? ` · #${profile.leaderboardRank} mondial` : ''}</small>`;
    try {
      const { leaderboard } = await Net.api('/api/leaderboard');
      $('lobbyTop').innerHTML = leaderboard.slice(0, 5).map(r => `<li><span>${esc(r.username)}</span><span class="t">${r.trophies}</span></li>`).join('') || '<li>Personne encore… sois le premier !</li>';
    } catch (e) { /* ignore */ }
    refreshQuests();
  }
  setInterval(() => { if (current === 'lobby') $('onlineCount').textContent = Net.online; }, 1000);
  $('btnDaily').addEventListener('click', async () => {
    try { const d = await Net.api('/api/daily', {}); profile = d.profile; $('lobbyMsg').textContent = `+${d.coins} pièces récupérées !`; refreshLobby(); }
    catch (e) { $('lobbyMsg').textContent = e.message; }
  });
  $('lobbyProfile').addEventListener('click', openProfile);

  // ----- Options de partie (features) -----
  const Features = window.OGSFeatures;
  function loadOptions() { try { return JSON.parse(localStorage.getItem('ogs_options') || '{}'); } catch (e) { return {}; } }
  function saveOptions(o) { try { localStorage.setItem('ogs_options', JSON.stringify(o)); } catch (e) { /* ignore */ } }
  function currentOptions() {
    const out = {};
    $('featureList').querySelectorAll('input[data-feature]').forEach(i => { out[i.dataset.feature] = i.checked; });
    return out;
  }
  function renderFeatureList() {
    const saved = loadOptions();
    const feats = Features.matchFeatures();
    const groups = [...new Set(feats.map(f => f.group))];
    $('featureList').innerHTML = groups.map(g => `<div class="feature-group">${esc(g)}</div>` + feats.filter(f => f.group === g).map(f => `<label class="feature"><input type="checkbox" data-feature="${f.key}" ${(typeof saved[f.key] === 'boolean' ? saved[f.key] : f.default) ? 'checked' : ''}><span>${esc(f.label)}${f.ranked ? ' <small style="display:inline;color:#4ade80">· actif en classée</small>' : ''}<small>${esc(f.desc)}</small></span></label>`).join('')).join('');
    $('featureList').querySelectorAll('input').forEach(i => i.addEventListener('change', () => saveOptions(currentOptions())));
    $('optionsBox').classList.toggle('hidden', !feats.length);
    $('tileSurvival').classList.toggle('hidden', !Features.enabled('survival'));
    $('btnQuests').classList.toggle('hidden', !Features.enabled('quests'));
  }
  renderFeatureList();
  $('mapSelect').innerHTML = '<option value="random">Aléatoire</option>' + Catalog.MAPS.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');

  // ----- Quêtes du jour -----
  async function refreshQuests() {
    if (!Features.enabled('quests')) return;
    if (isLocked()) { $('questList').innerHTML = '<li class="info">🔒 Les quêtes sont réservées aux joueurs avec un compte Google.</li>'; return; }
    try {
      const { quests } = await Net.api('/api/quests');
      if (!quests) return;
      const doneN = quests.items.filter(q => q.done).length, claimable = quests.items.filter(q => q.done && !q.claimed).length;
      $('questsHint').textContent = claimable ? `${claimable} à récupérer !` : `${doneN}/${quests.items.length} terminées`;
      $('questList').innerHTML = quests.items.map(q => `<li><div class="row"><span>${esc(q.label)}</span><span>${q.claimed ? '✔' : q.done ? `<button class="btn gold" data-claim="${q.id}">+${q.coins} 🪙</button>` : `${q.progress}/${q.goal}`}</span></div><div class="bar"><div style="width:${Math.round(q.progress / q.goal * 100)}%"></div></div></li>`).join('');
      $('questList').querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', async () => { try { const d = await Net.api('/api/quests/claim', { id: b.dataset.claim }); profile = d.profile; $('lobbyMsg').textContent = `+${d.coins} pièces !`; refreshLobby(); } catch (e) { $('lobbyMsg').textContent = e.message; } }));
    } catch (e) { /* ignore */ }
  }

  $('btnSurvival').addEventListener('click', () => { lastMatchKind = { t: 'survival' }; Net.send({ t: 'survival', options: currentOptions(), map: $('mapSelect').value }); openQueue('Les vagues arrivent…', 'bot'); });
  // ----- Modes de jeu (façon Brawl : une carte « mode » + un gros bouton JOUER) -----
  const MODES = {
    ranked: { icon: '⚔️', name: 'Classée 1v1', desc: 'Trophées · adversaire de ton niveau', sub: 'Partie classée' },
    duo: { icon: '🤝', name: 'Duo 2v2', desc: 'Grande arène (13 colonnes), trophées', sub: 'Duo 2v2 · classée', team: 2 },
    trio: { icon: '👥', name: 'Trio 3v3', desc: 'Arène géante (17 colonnes), trophées', sub: 'Trio 3v3 · classée', team: 3 },
    bot: { icon: '🤖', name: 'Entraînement', desc: 'Contre l’IA, sans enjeu', sub: 'Contre l’IA' },
    survival: { icon: '🌊', name: 'Survie', desc: 'Vagues · solo · record', sub: 'Survie' },
    friendly: { icon: '🎟️', name: 'Amical', desc: 'Crée une salle, partage le code', sub: 'Créer une salle amicale' },
  };
  let selectedMode = (() => { try { return localStorage.getItem('ogs_mode') || 'ranked'; } catch (e) { return 'ranked'; } })();
  if (!MODES[selectedMode] || MODES[selectedMode].soon) selectedMode = 'ranked';
  function applyMode() {
    const m = MODES[selectedMode];
    $('modeIcon').textContent = m.icon; $('modeName').textContent = m.name; $('modeDesc').textContent = m.desc; $('playSub').textContent = m.sub;
    $('modeGrid').querySelectorAll('.mode-tile').forEach(t => { t.classList.toggle('active', t.dataset.mode === selectedMode); t.classList.toggle('soon-tile', !!(MODES[t.dataset.mode] || {}).soon); });
    document.querySelectorAll('#modeModal .mode-opt, #modeModal [data-for]').forEach(el => el.classList.toggle('show', el.dataset.for.split(' ').includes(selectedMode)));
    document.querySelectorAll('#modeModal label[data-for]').forEach(el => { el.style.display = el.dataset.for.split(' ').includes(selectedMode) ? '' : 'none'; });
    try { localStorage.setItem('ogs_mode', selectedMode); } catch (e) { /* ignore */ }
  }
  $('modeGrid').addEventListener('click', (ev) => {
    const t = ev.target.closest('.mode-tile'); if (!t) return;
    if ((MODES[t.dataset.mode] || {}).soon) return toast('Ce mode arrive bientôt !', 'warn');
    selectedMode = t.dataset.mode; applyMode(); Audio.sfx('ui');
  });
  const openModal = (id) => { $(id).classList.remove('hidden'); Audio.sfx('ui'); };
  const closeModal = (id) => $(id).classList.add('hidden');
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', (ev) => { if (ev.target === m) m.classList.add('hidden'); }));
  $('modeCard').addEventListener('click', () => openModal('modeModal'));
  $('btnModeOk').addEventListener('click', () => closeModal('modeModal'));
  $('btnSettings').addEventListener('click', () => { $('adminKeyCard').classList.toggle('hidden', !!(profile && profile.admin)); openModal('settingsModal'); });
  $('btnQuests').addEventListener('click', () => { refreshQuests(); openModal('questsModal'); });
  applyMode();
  $('btnPlay').addEventListener('click', () => {
    closeModal('modeModal');
    if (selectedMode === 'bot') return $('btnBot').click();
    if (selectedMode === 'survival') return $('btnSurvival').click();
    if (selectedMode === 'friendly') return $('btnFriendlyCreate').click();
    const team = MODES[selectedMode].team || 1;
    lastMatchKind = { t: 'queue', team }; Net.send({ t: 'queue', team }); openQueue(team > 1 ? `Recherche de ${team * 2 - 1} joueurs…` : 'Recherche d’un adversaire…', 'queue');
  });
  $('btnBot').addEventListener('click', () => { const difficulty = $('botLevel').value; lastMatchKind = { t: 'bot', difficulty }; Net.send({ t: 'bot', difficulty, team: Number($('teamSelect').value) || 1, duration: Number($('durationSelect').value), options: currentOptions(), map: $('mapSelect').value }); openQueue('Préparation de l’IA…', 'bot'); });
  $('btnFriendlyCreate').addEventListener('click', () => { Net.send({ t: 'friendly_create', team: Number($('teamSelect').value) || 1, duration: Number($('durationSelect').value), options: currentOptions(), map: $('mapSelect').value }); openQueue('Partie amicale : partage ce code', 'friendly'); });
  $('btnFriendlyJoin').addEventListener('click', () => { const code = $('friendlyCode').value.trim().toUpperCase(); if (code.length < 4) return toast('Entre le code à 5 caractères', 'bad'); closeModal('modeModal'); Net.send({ t: 'friendly_join', code }); $('lobbyMsg').textContent = 'Connexion à la salle…'; });
  $('btnFriendlyStart').addEventListener('click', () => Net.send({ t: 'friendly_start' }));
  $('btnCancelQueue').addEventListener('click', () => { Net.send({ t: queueMode === 'friendly' ? 'friendly_leave' : 'cancel' }); closeQueue(); });

  function openQueue(title, mode) {
    queueMode = mode; queueStart = Date.now();
    $('queueTitle').textContent = title; $('queueSub').textContent = '0 s'; delete $('queueSub').dataset.lobby; delete $('queueSub').dataset.server; $('queueCode').classList.add('hidden'); $('btnFriendlyStart').classList.add('hidden');
    show('queue');
    clearInterval(queueTimer);
    queueTimer = setInterval(() => { const s = Math.floor((Date.now() - queueStart) / 1000); if (mode === 'friendly') { if (!$('queueSub').dataset.lobby) $('queueSub').textContent = 'En attente de tes amis…'; } else if (!$('queueSub').dataset.server) $('queueSub').textContent = `${s} s`; }, 500);
  }
  function closeQueue() { clearInterval(queueTimer); queueTimer = null; queueMode = null; show('lobby'); }

  // ----- Événements réseau -----
  Net.on('auth_ok', (msg) => { profile = msg.profile; if (current === 'lobby') refreshLobby(); });
  // Un admin a modifié mon profil (modo, skins, pièces…) : mise à jour en direct.
  Net.on('profile', (msg) => { const was = profile; profile = msg.profile; if (current === 'lobby') refreshLobby(); if (current === 'profile') openProfile(); if (current === 'skins') openSkins(); if (was && !was.modo && profile.modo) toast('Tu es maintenant MODO : tous les skins débloqués !', 'good'); });
  Net.on('auth_error', () => { Net.disconnect(); Net.setToken(null); show('auth'); $('authError').textContent = 'Session expirée, reconnecte-toi'; });
  Net.on('kicked', (msg) => { Net.disconnect(); profile = null; show('auth'); $('authError').textContent = msg.reason || 'Déconnecté'; });
  Net.on('queued', (msg) => { if (current === 'queue' && queueMode === 'queue') $('queueSub').dataset.server = '1', $('queueSub').textContent = `${msg.wait || 0} s${msg.need > 2 ? ` · ${msg.found || 1}/${msg.need} joueurs` : ''} · fenêtre ±${msg.band || 100} 🏆${msg.botFillIn ? ` · bots dans ${msg.botFillIn} s` : ''}`; });
  // Salle amicale en équipe : liste des joueurs présents, l'hôte peut lancer avec des bots.
  Net.on('friendly_lobby', (msg) => {
    if (current !== 'queue') return;
    $('queueSub').dataset.lobby = '1'; $('queueSub').innerHTML = `${msg.members.length}/${msg.need} joueurs : ${msg.members.map(m => esc(m.username) + (m.host ? ' (hôte)' : '')).join(', ')}`;
    $('btnFriendlyStart').classList.toggle('hidden', !(msg.host && msg.need > 2 && msg.members.length >= 1));
  });
  Net.on('friendly_created', (msg) => { $('queueCode').textContent = msg.code; $('queueCode').classList.remove('hidden'); });
  Net.on('error', (msg) => { $('lobbyMsg').textContent = msg.error; toast(msg.error, 'bad'); });
  Net.on('idle', () => { if (current === 'queue') closeQueue(); });
  Net.on('match_start', (msg) => {
    clearInterval(queueTimer); pendingResult = null;
    const opps = (msg.players || []).filter(p => p.side !== msg.side).map(p => p.profile), mates = (msg.players || []).filter(p => p.side === msg.side && p.key !== (msg.key || msg.side)).map(p => p.profile);
    $('hudOppName').textContent = opps.length > 1 ? opps.map(o => o.username).join(' & ') : msg.opponent.username;
    $('hudOppSub').textContent = opps.length > 1 ? `🏆 ${Math.round(opps.reduce((n, o) => n + (o.trophies || 0), 0) / opps.length)} · équipe adverse` : `🏆 ${msg.opponent.trophies} · ${msg.opponent.rank || ''}${msg.opponentIsBot ? ' · IA' : ''}`;
    $('hudMeName').textContent = mates.length ? `${msg.me.username} & ${mates.map(m => m.username).join(' & ')}` : msg.me.username; $('hudMeSub').textContent = mates.length ? `🏆 ${msg.me.trophies} · ton équipe` : `🏆 ${msg.me.trophies} · ${msg.me.rank}`;
    $('hudMeAvatar').innerHTML = '<span></span>'; renderAvatar($('hudMeAvatar'), msg.me, msg.me.level); $('hudOppAvatar').innerHTML = '<span></span>'; renderAvatar($('hudOppAvatar'), msg.opponent, msg.opponent.level || '?');
    Audio.setScene('match'); Audio.sfx('match');
    show('game'); game.start(msg); toast(`Arène : ${(OGSMaps.get(msg.map) || {}).name || msg.map}`, 'ok');
  });
  Net.on('go', () => { game.onGo(); Audio.sfx('go'); });
  Net.on('draft_pick', (msg) => game.onDraftPick(msg));
  Net.on('draft_end', (msg) => { game.onDraftEnd(msg); const mine = (msg.bans && msg.bans[game.side] || []); if (mine.length) toast(`Banni pour toi : ${mine.map(o => Catalog.OG_NAMES[o]).join(', ')}`, 'warn'); });
  Net.on('ability_rejected', (msg) => game.onAbilityRejected(msg));
  Net.on('wave', (msg) => game.onWave(msg));
  Net.on('snap', (msg) => game.onSnap(msg));
  Net.on('place_rejected', (msg) => game.onRejected(msg));
  Net.on('presence', (msg) => { game.onPresence(msg); if (msg.surrendered) toast('Un joueur a abandonné', 'warn'); else if (msg.connected === false) toast('Un joueur s’est déconnecté…', 'warn'); });
  Net.on('emote', (msg) => game.onEmote(msg));
  Net.on('match_end', (msg) => { pendingResult = msg; Audio.sfx(msg.result === 'win' ? 'win' : msg.result === 'loss' ? 'loss' : 'draw'); Audio.setScene('result'); setTimeout(() => showResult(msg), 1800); });
  Net.on('disconnected', () => { if (current === 'game') toast('Connexion perdue… reconnexion', 'warn'); if (current === 'queue') closeQueue(); });

  // ----- Résultat -----
  function showResult(msg) {
    if (pendingResult !== msg) return;
    game.stop();
    profile = msg.profile;
    const title = $('resultTitle');
    const isSurvival = msg.result === 'survival';
    title.textContent = isSurvival ? 'SURVIE' : msg.result === 'win' ? 'VICTOIRE' : msg.result === 'loss' ? 'DÉFAITE' : 'ÉGALITÉ';
    title.className = `result-title ${isSurvival ? 'draw' : msg.result}`;
    const reasons = { ko: 'Base détruite', time: 'Temps écoulé', surrender: 'Abandon', disconnect: 'Déconnexion', overtime: 'Mort subite', points: 'Roi du centre' };
    if (isSurvival && msg.survival) $('resultSub').textContent = `Vague ${msg.survival.wave} · ${msg.survival.kills} éliminations · score ${msg.survival.score}${msg.newBest ? ' · 🏅 NOUVEAU RECORD' : ` · record ${profile.survivalBest}`}`;
    else $('resultSub').textContent = `${reasons[msg.reason] || msg.reason} · contre ${msg.opponent.username} · ${Math.floor(msg.duration / 60)}:${String(msg.duration % 60).padStart(2, '0')}`;
    const r = msg.rewards;
    $('resTrophies').textContent = `${r.trophies >= 0 ? '+' : ''}${r.trophies}`;
    $('resXp').textContent = `+${r.xp}`; $('resCoins').textContent = `+${r.coins}`;
    $('resXpFill').style.width = `${Math.round(profile.xpInto / profile.xpNeed * 100)}%`;
    $('resXpText').textContent = `Niveau ${profile.level} · ${profile.xpInto}/${profile.xpNeed} XP`;
    const extra = [];
    if (r.capsule) extra.push('🫧 +1 capsule à ouvrir !');
    if (msg.levelUp) extra.push(`⬆ Niveau ${msg.levelUp} !`);
    if (r.streakBonus) extra.push(`🔥 Série de victoires : +${r.streakBonus} XP`);
    if (msg.unlocked && msg.unlocked.length) extra.push(`🎁 Débloqué : ${msg.unlocked.map(id => Catalog.SKIN_BY_ID[id] ? Catalog.SKIN_BY_ID[id].name : id).join(', ')}`);
    if (msg.quests) { const done = msg.quests.items.filter(q => q.done && !q.claimed); if (done.length) extra.push(`📜 Quête terminée : ${done.map(q => q.label).join(', ')} (à récupérer dans le lobby)`); }
    if (msg.points) extra.push(`👑 Points : ${Math.round(msg.points[msg.side])} contre ${Math.round(msg.points[Sim.other(msg.side)])}`);
    $('resExtra').innerHTML = extra.map(esc).join('<br>');
    const side = msg.side || 'bottom', oppSide = Sim.other(side);
    const mine = msg.stats[side], theirs = msg.stats[oppSide];
    $('resStats').innerHTML = `<div>Ogs posés : <b>${mine.placed}</b> (adv. ${theirs.placed})</div><div>Éliminations : <b>${mine.kills}</b> (adv. ${theirs.kills})</div><div>Dégâts à la base : <b>${mine.damage}</b> (adv. ${theirs.damage})</div><div>Orbes ramassées : <b>${mine.orbs}</b> (adv. ${theirs.orbs})</div><div>PV restants : <b>${msg.hp[side]}</b> (adv. ${msg.hp[oppSide]})</div><div>Mana dépensée : <b>${mine.manaSpent}</b></div><div>Capacités : <b>${mine.abilities || 0}</b> · Évolutions : <b>${mine.evolutions || 0}</b></div>`;
    show('result');
  }
  $('btnResultMenu').addEventListener('click', () => show('lobby'));
  $('btnResultReplay').addEventListener('click', () => {
    show('lobby');
    if (lastMatchKind && lastMatchKind.t === 'bot') $('btnBot').click();
    else if (lastMatchKind && lastMatchKind.t === 'survival') $('btnSurvival').click();
    else { const team = (lastMatchKind && lastMatchKind.team) || 1; lastMatchKind = { t: 'queue', team }; Net.send({ t: 'queue', team }); openQueue(team > 1 ? `Recherche de ${team * 2 - 1} joueurs…` : 'Recherche d’un adversaire…', 'queue'); }
  });

  // ----- Collection & équipe (façon Clash Royale) -----
  let rarityFilter = 'all';
  const collectionCanvases = []; // { canvas, ogId, skin, size }
  function drawCollectionCanvases() {
    if (current !== 'collection') return;
    const t = performance.now() / 1000;
    for (const c of collectionCanvases) { const ctx = c.canvas.getContext('2d'); ctx.clearRect(0, 0, c.canvas.width, c.canvas.height); Creatures.draw(ctx, c.ogId, c.skin, c.canvas.width / 2, c.canvas.height / 2 + 6, c.size, t, { moving: false, phase: c.ogId }, { alpha: c.alpha }); }
  }
  setInterval(drawCollectionCanvases, 1000 / 30);
  function starsHtml(n) { return '★'.repeat(n) + '<span class="dim">' + '★'.repeat(5 - n) + '</span>'; }
  async function openCollection() {
    show('collection');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    collectionCanvases.length = 0;
    const col = profile.collection || {}, deck = profile.deck || Catalog.DEFAULT_DECK;
    $('collectionCount').textContent = `${Object.keys(col).length} / ${Catalog.CREATURES.length}`;
    $('capsuleCount2').textContent = profile.capsules || 0;
    // Équipe : 7 cases par coût
    $('deckStrip').innerHTML = Catalog.DECK_COSTS.map((cost, i) => { const c = Catalog.CREATURE_BY_ID[deck[cost]]; return `<button class="deck-slot" data-cost="${cost}"><canvas width="120" height="120"></canvas><span class="deck-key">${['A', 'Z', 'E', 'R', 'T', 'Y', 'U'][i]}</span><span class="deck-cost">${cost}</span><b>${esc(c.name)}</b></button>`; }).join('');
    $('deckStrip').querySelectorAll('.deck-slot').forEach(b => { const cost = Number(b.dataset.cost), id = deck[cost]; collectionCanvases.push({ canvas: b.querySelector('canvas'), ogId: id, skin: profile.equipped[id] || `og${id}_default`, size: 78, alpha: 1 }); b.addEventListener('click', () => openCreature(id, cost)); });
    // Grille
    const list = Catalog.CREATURES.filter(c => rarityFilter === 'all' || c.rarity === rarityFilter);
    $('creatureGrid').innerHTML = list.map(c => { const owned = !!col[c.id], R = Catalog.RARITIES[c.rarity], inDeck = deck[c.cost] === c.id; return `<button class="ccard rarity-${c.rarity} ${owned ? '' : 'locked'} ${inDeck ? 'in-deck' : ''}" data-id="${c.id}" style="--rc:${R.color}">
      <span class="ccard-cost">${c.cost}</span>${inDeck ? '<span class="ccard-deck">ÉQUIPE</span>' : ''}${!c.playable ? '<span class="ccard-soon">BIENTÔT</span>' : ''}
      <canvas width="150" height="150"></canvas>
      <b>${esc(c.name)}</b><small>${R.name}</small>
      <span class="ccard-stars">${owned ? starsHtml(Catalog.cardStars(c, col[c.id])) : '<span class="dim">verrouillée</span>'}</span></button>`; }).join('');
    $('creatureGrid').querySelectorAll('.ccard').forEach(b => { const id = Number(b.dataset.id); collectionCanvases.push({ canvas: b.querySelector('canvas'), ogId: id, skin: profile.equipped[id] || `og${id}_default`, size: 96, alpha: col[id] ? 1 : 0.35 }); b.addEventListener('click', () => openCreature(id)); });
    $('rarityTabs').querySelectorAll('.rtab').forEach(t => t.classList.toggle('active', t.dataset.rarity === rarityFilter));
    drawCollectionCanvases();
  }
  $('rarityTabs').addEventListener('click', (ev) => { const t = ev.target.closest('.rtab'); if (!t) return; rarityFilter = t.dataset.rarity; openCollection(); });
  $('btnCapsulesFromCollection').addEventListener('click', openCapsules);
  let detailCanvas = null;
  function openCreature(id, pickForCost) {
    const c = Catalog.CREATURE_BY_ID[id], col = profile.collection || {}, R = Catalog.RARITIES[c.rarity], deck = profile.deck || Catalog.DEFAULT_DECK;
    const owned = !!col[c.id];
    $('creatureName').innerHTML = `${esc(c.name)} <span class="rarity-pill" style="--rc:${R.color}">${R.name}</span>`;
    $('creatureMeta').innerHTML = `${esc(c.role)} · <b>${c.cost}</b> mana${c.playable ? '' : ' · <span class="soon-txt">jouable bientôt</span>'}`;
    $('creaturePower').textContent = c.power;
    const ns = owned ? Catalog.nextStarCopies(c, col[c.id]) : null;
    $('creatureStars').innerHTML = owned ? `${starsHtml(Catalog.cardStars(c, col[c.id]))} <small>${col[c.id]} exemplaire(s)${ns ? ` · prochaine étoile : ${ns.have}/${ns.need}` : ' · niveau max'}</small>` : '<small>Pas encore dans ta collection : capsules ou route des trophées.</small>';
    const inDeck = deck[c.cost] === c.id;
    let actions = '';
    if (owned && c.playable && !inDeck) actions += `<button class="btn primary" id="btnPutInDeck">Mettre dans l’équipe (case ${c.cost})</button>`;
    if (inDeck) actions += '<span class="info">Dans ton équipe</span>';
    if (pickForCost) { // choix pour une case : lister les alternatives possédées du même coût
      const alts = Catalog.CREATURES.filter(x => x.cost === pickForCost && col[x.id] && x.playable && x.id !== c.id);
      actions += alts.length ? `<div class="alt-row"><span class="muted">Remplacer par :</span>${alts.map(a => `<button class="btn small" data-alt="${a.id}">${esc(a.name)}</button>`).join('')}</div>` : '<span class="muted">Aucune autre créature à ce coût dans ta collection.</span>';
    }
    $('creatureActions').innerHTML = actions;
    const put = $('btnPutInDeck'); if (put) put.addEventListener('click', () => setDeckSlot(c.cost, c.id));
    $('creatureActions').querySelectorAll('[data-alt]').forEach(b => b.addEventListener('click', () => setDeckSlot(pickForCost, Number(b.dataset.alt))));
    detailCanvas = { canvas: $('creatureCanvas'), ogId: c.id, skin: profile.equipped[c.id] || `og${c.id}_default`, size: 150, alpha: owned ? 1 : 0.5 };
    const i = collectionCanvases.findIndex(x => x.canvas === $('creatureCanvas')); if (i >= 0) collectionCanvases.splice(i, 1); collectionCanvases.push(detailCanvas);
    openModal('creatureModal');
  }
  async function setDeckSlot(cost, id) {
    const deck = Object.assign({}, profile.deck || Catalog.DEFAULT_DECK, { [cost]: id });
    try { profile = (await Net.api('/api/deck', { deck })).profile; toast(`${Catalog.CREATURE_BY_ID[id].name} rejoint ton équipe`, 'good'); Audio.sfx('coin'); closeModal('creatureModal'); openCollection(); }
    catch (e) { toast(e.message, 'bad'); }
  }

  // ----- Capsules -----
  async function openCapsules() {
    show('capsules');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    $('capsuleCount').textContent = profile.capsules || 0;
    $('btnOpenCapsule').disabled = !(profile.capsules > 0) || isLocked();
    $('btnOpenCapsule').textContent = isLocked() ? '🔒 Réservé aux comptes' : profile.capsules > 0 ? 'Ouvrir une capsule' : 'Gagne une partie classée pour en obtenir';
    $('capsulePity').textContent = `Garanties : une Épique au plus tard toutes les ${Catalog.CAPSULE.pityEpic} cartes, une Légendaire toutes les ${Catalog.CAPSULE.pityLegendary}.`;
    $('capsuleResult').classList.add('hidden'); $('capsuleVisual').classList.remove('opening');
  }
  $('btnOpenCapsule').addEventListener('click', async () => {
    if (isLocked()) return goUpgrade();
    $('btnOpenCapsule').disabled = true; $('capsuleVisual').classList.add('opening'); Audio.sfx('match');
    try {
      const d = await Net.api('/api/capsule/open', {});
      await new Promise(r => setTimeout(r, 900));
      profile = d.profile; const o = d.opened;
      $('capsuleCount').textContent = profile.capsules;
      const cards = o.cards.map(card => { const c = Catalog.CREATURE_BY_ID[card.id], R = Catalog.RARITIES[card.rarity]; return `<div class="loot rarity-${card.rarity}" style="--rc:${R.color}"><canvas width="140" height="140" data-og="${card.id}"></canvas><b>${esc(c.name)}</b><small>${R.name} · ×${card.copies}${card.isNew ? ' · <span class="new">NOUVEAU !</span>' : ''}</small></div>`; });
      const skin = o.skin ? `<div class="loot skin"><canvas width="140" height="140" data-og="${Catalog.SKIN_BY_ID[o.skin].ogId}" data-skin="${o.skin}"></canvas><b>${esc(Catalog.SKIN_BY_ID[o.skin].name)}</b><small>Skin débloqué !</small></div>` : '';
      $('capsuleResult').innerHTML = `<div class="loot-row">${cards.join('')}${skin}<div class="loot coins"><span class="coin big"></span><b>+${o.coins}</b><small>pièces</small></div></div><div class="row"><button class="btn primary" id="btnCapsuleAgain">${profile.capsules > 0 ? 'Encore une !' : 'Voir ma collection'}</button></div>`;
      $('capsuleResult').classList.remove('hidden'); Audio.sfx('win');
      const t0 = performance.now();
      const anim = () => { if (current !== 'capsules') return; const t = (performance.now() - t0) / 1000; $('capsuleResult').querySelectorAll('canvas[data-og]').forEach((cv, i) => { const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 140, 140); const k = Math.min(1, Math.max(0, (t - i * 0.25) * 2)); Creatures.draw(ctx, Number(cv.dataset.og), cv.dataset.skin || profile.equipped[cv.dataset.og] || `og${cv.dataset.og}_default`, 70, 76, 90 * (0.5 + 0.5 * k), t, { moving: false }, { alpha: k }); }); requestAnimationFrame(anim); };
      requestAnimationFrame(anim);
      $('btnCapsuleAgain').addEventListener('click', () => profile.capsules > 0 ? openCapsules() : openCollection());
      refreshLobbyHints();
    } catch (e) { toast(e.message, 'bad'); $('btnOpenCapsule').disabled = false; $('capsuleVisual').classList.remove('opening'); }
  });
  function refreshLobbyHints() { try { $('capsuleTileHint').textContent = profile.capsules ? `${profile.capsules} à ouvrir !` : 'une par victoire'; } catch (e) { /* ignore */ } }

  // ----- Route des trophées : un sentier sinueux dans les abysses, des médaillons, ton avatar qui avance -----
  const roadCanvases = [];
  function drawRoadCanvases() { if (current !== 'road') return; const t = performance.now() / 1000; for (const c of roadCanvases) { const ctx = c.canvas.getContext('2d'); ctx.clearRect(0, 0, c.canvas.width, c.canvas.height); Creatures.draw(ctx, c.ogId, `og${c.ogId}_default`, c.canvas.width / 2, c.canvas.height / 2 + 4, c.size, t, { moving: false, phase: c.ogId }, { alpha: c.alpha }); } }
  setInterval(drawRoadCanvases, 1000 / 30);
  async function openRoad() {
    show('road');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    const best = profile.bestTrophies || 0, claimed = profile.road || [];
    const steps = Catalog.TROPHY_ROAD;
    $('roadProgress').textContent = `Record : ${best} 🏆 · ${claimed.length}/${steps.length} récompenses prises`;
    const STEP = 118, W = $('roadWrap').clientWidth || 800, PAD = 70;
    const xAt = (i) => W * (0.5 + 0.3 * Math.sin(i * 0.9)); // sentier sinueux
    const yAt = (i) => PAD + i * STEP;
    const pts = steps.map((_, i) => ({ x: xAt(i), y: yAt(i) }));
    const total = PAD * 2 + (steps.length - 1) * STEP + 140;
    $('roadWrap').style.height = `${total}px`;
    // Sentier (courbe lisse passant par chaque médaillon) + portion « parcourue » en teal.
    const svg = $('roadSvg'); svg.setAttribute('viewBox', `0 0 ${W} ${total}`); svg.setAttribute('width', W); svg.setAttribute('height', total);
    const d = pts.map((p, i) => i === 0 ? `M ${p.x} ${p.y - 60}` : `C ${pts[i - 1].x} ${pts[i - 1].y + STEP * 0.55}, ${p.x} ${p.y - STEP * 0.55}, ${p.x} ${p.y}`).join(' ');
    const reachedN = steps.filter(r => r.trophies <= best).length;
    const dDone = pts.slice(0, Math.max(1, reachedN)).map((p, i) => i === 0 ? `M ${p.x} ${p.y - 60}` : `C ${pts[i - 1].x} ${pts[i - 1].y + STEP * 0.55}, ${p.x} ${p.y - STEP * 0.55}, ${p.x} ${p.y}`).join(' ');
    svg.innerHTML = `<path d="${d}" class="road-path"/><path d="${d}" class="road-path dashed"/>${reachedN ? `<path d="${dDone}" class="road-path done"/>` : ''}`;
    // Bannières de ligue aux changements de rang.
    const banners = Catalog.RANKS.filter(r => r.min > 0 && r.min <= steps[steps.length - 1].trophies).map(r => { const idx = steps.findIndex(s => s.trophies >= r.min); return `<div class="road-banner" style="top:${yAt(idx) - STEP * 0.62}px;--rc:${r.color}"><span>${esc(r.name)}</span></div>`; }).join('');
    roadCanvases.length = 0;
    const nodes = steps.map((r, i) => {
      const reached = best >= r.trophies, done = claimed.includes(r.trophies), rw = r.reward;
      const kind = rw.type, side = pts[i].x < W / 2 ? 'left' : 'right';
      const icon = kind === 'creature' ? `<canvas width="120" height="120"></canvas>` : `<span class="road-emoji">${kind === 'capsule' ? '🫧' : kind === 'skin' ? '🎨' : '🪙'}</span>`;
      const label = Catalog.roadLabel(rw);
      const action = done ? '<span class="road-stamp">PRIS</span>' : reached ? `<button class="btn small gold" data-claim="${r.trophies}">Réclamer</button>` : '<span class="road-lock">🔒</span>';
      return `<div class="road-node kind-${kind} ${reached ? 'reached' : ''} ${done ? 'done' : ''} ${side}" style="left:${pts[i].x}px;top:${pts[i].y}px" data-i="${i}">
        <div class="road-medal">${icon}</div>
        <div class="road-info"><span class="road-t">${r.trophies} 🏆</span><b>${esc(label)}</b>${action}</div></div>`;
    }).join('');
    // Marqueur du joueur : entre le dernier palier atteint et le suivant.
    let markerY = PAD - 60, markerX = pts[0].x;
    if (reachedN > 0) { const a = pts[reachedN - 1], b = pts[reachedN] || { x: a.x, y: a.y + STEP }; const from = steps[reachedN - 1].trophies, to = steps[reachedN] ? steps[reachedN].trophies : from + 50; const k = Math.max(0, Math.min(1, (best - from) / (to - from))); markerX = a.x + (b.x - a.x) * k; markerY = a.y + (b.y - a.y) * k; }
    else { const k = Math.min(1, best / steps[0].trophies); markerY = PAD - 60 + (pts[0].y - (PAD - 60)) * k; }
    const marker = `<div class="road-you" style="left:${markerX}px;top:${markerY}px"><div class="avatar" id="roadAvatar"><span>${profile.level}</span></div><small>toi · ${best} 🏆</small></div>`;
    $('roadList').innerHTML = banners + nodes + marker;
    renderAvatar($('roadAvatar'), profile, profile.level);
    $('roadList').querySelectorAll('.road-node.kind-creature').forEach(n => { const i = Number(n.dataset.i); const id = steps[i].reward.id; roadCanvases.push({ canvas: n.querySelector('canvas'), ogId: id, size: 80, alpha: n.classList.contains('reached') ? 1 : 0.45 }); });
    $('roadList').querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', async () => {
      if (isLocked()) return goUpgrade();
      try { const d = await Net.api('/api/road/claim', { trophies: Number(b.dataset.claim) }); profile = d.profile; const g = d.got; toast(g.type === 'coins' ? `+${g.count} pièces` : g.type === 'capsule' ? `+${g.count} capsule(s)` : g.type === 'creature' ? `${g.name} rejoint ta collection !` : `Skin ${g.name} débloqué !`, 'good'); Audio.sfx('coin'); openRoad(); }
      catch (e) { toast(e.message, 'bad'); }
    }));
    drawRoadCanvases();
    setTimeout(() => { const you = $('roadAvatar'); if (you) you.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
  }

  // ----- Profil -----
  async function openProfile() {
    show('profile');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    $('profileName').innerHTML = esc(profile.username) + badgeOf(profile);
    $('adminCard').classList.toggle('hidden', !profile.admin); if (profile.admin) loadAdmin();
    // Compte Google : lié ou proposition de liaison (si le serveur le permet).
    $('googleCard').classList.toggle('hidden', !GOOGLE_MODE);
    $('googleLinked').hidden = !profile.google; $('googleUnlinked').hidden = !!profile.google;
    if (profile.google) $('googleLinkedInfo').textContent = `Compte Google ${profile.email || ''}. Connecte-toi avec Google sur n’importe quel appareil pour retrouver cette progression.`;
    else { if (!$('googleLinkUser').value) $('googleLinkUser').value = /^Invité/.test(profile.username) ? '' : profile.username; renderGoogleButton($('googleLinkBtn'), 'link'); }
    $('deviceInfo').textContent = profile.google
      ? 'Tu es connecté avec ton compte Google. « Se déconnecter » ferme ta session sur cet appareil ; ta progression reste liée à ton compte.'
      : 'Tu joues en invité : ce joueur est mémorisé sur cet appareil seulement. « Quitter » l’oublie (crée ton compte Google avant si tu veux garder ta progression).';
    $('btnLogout2').textContent = profile.google ? 'Se déconnecter' : 'Quitter'; $('btnLogout').textContent = profile.google ? 'Se déconnecter' : 'Quitter';
    $('btnAvatar').textContent = isLocked() ? '🔒 Avatar (réservé aux comptes)' : 'Choisir un avatar ou une photo';
    $('profileLevel').textContent = profile.level; renderAvatar($('profileAvatar'), profile, profile.level);

    $('profileSub').innerHTML = `<span style="color:${profile.rankColor}">${profile.rank}</span> · 🏆 ${profile.trophies} (record ${profile.bestTrophies})${profile.leaderboardRank ? ` · #${profile.leaderboardRank} mondial` : ''} · membre depuis ${new Date(profile.createdAt).toLocaleDateString('fr-FR')}`;
    $('profileXp').style.width = `${Math.round(profile.xpInto / profile.xpNeed * 100)}%`;
    $('profileXpText').textContent = `Niveau ${profile.level} · ${profile.xpInto}/${profile.xpNeed} XP`;
    const wr = profile.games ? Math.round(profile.wins / profile.games * 100) : 0;
    const stats = [['Parties', profile.games], ['Victoires', profile.wins], ['Défaites', profile.losses], ['Égalités', profile.draws], ['Taux de victoire', `${wr} %`], ['Série en cours', profile.streak], ['Pièces', profile.coins], ['Skins', profile.skins.length], ['Record Survie', profile.survivalBest || 0]];
    $('profileStats').innerHTML = stats.map(([l, v]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    try {
      const { history } = await Net.api('/api/history');
      const labels = { win: 'Victoire', loss: 'Défaite', draw: 'Égalité', survival: 'Survie' };
      $('profileHistory').innerHTML = history.map(h => `<li><span class="${h.result}">${labels[h.result]}</span><span>vs ${esc(h.opponent)}</span><span>${h.mode.replace('-botfill', ' (bot)')}</span><span>${h.delta >= 0 ? '+' : ''}${h.delta} 🏆</span><span>${new Date(h.at).toLocaleString('fr-FR')}</span></li>`).join('') || '<li>Aucune partie jouée pour l’instant.</li>';
    } catch (e) { $('profileHistory').innerHTML = '<li>Historique indisponible.</li>'; }
  }

  async function loadAdmin() {
    try {
      const o = await Net.api('/api/admin/overview');
      loadAdminPlayers();
      $('adminInfo').innerHTML = `${o.users} comptes · ${o.online} en ligne · ${o.inQueue} en file · ${o.rooms.length} partie(s) en cours · en ligne depuis ${Math.round(o.uptime / 60)} min<br>${o.rooms.map(r => `#${r.id} ${r.mode} : ${r.players.map(esc).join(' vs ')} (${r.time}s)`).join('<br>')}`;
    } catch (e) { $('adminInfo').textContent = e.message; }
  }
  function badgeOf(p) { return p.admin ? ' <span class="badge-admin">ADMIN</span>' : p.modo ? ' <span class="badge-modo">MODO</span>' : (GOOGLE_MODE && p.guest) ? ' <span class="badge-guest">INVITÉ</span>' : ''; }
  // Liste des joueurs du panneau admin : nommer modo, débloquer tous les skins, donner des pièces.
  async function loadAdminPlayers() {
    try {
      const { players } = await Net.api(`/api/admin/players?q=${encodeURIComponent($('adminSearch').value.trim())}`);
      $('adminPlayers').innerHTML = players.length ? players.map(p => `<div class="admin-row" data-user="${esc(p.username)}">
        <span class="admin-name">${p.online ? '<span class="dot on"></span>' : '<span class="dot"></span>'}${esc(p.username)}${badgeOf(p)}</span>
        <span class="admin-stats">🏆 ${p.trophies} · 🪙 ${p.coins} · ${p.wins}V/${p.losses}D · skins ${p.skins}/${p.skinsTotal}</span>
        <span class="admin-actions">${p.admin ? '' : `<button class="btn small" data-act="modo" data-on="${p.modo ? 0 : 1}">${p.modo ? 'Retirer modo' : 'Nommer modo'}</button>
        <button class="btn small gold" data-act="skins" ${p.skins >= p.skinsTotal ? 'disabled' : ''}>Tous les skins</button>
        <button class="btn small" data-act="coins">+500 🪙</button>`}</span></div>`).join('') : '<div class="info">Aucun joueur</div>';
    } catch (e) { $('adminPlayers').innerHTML = `<div class="info">${esc(e.message)}</div>`; }
  }
  $('adminSearch').addEventListener('input', () => { clearTimeout(window.__adminT); window.__adminT = setTimeout(loadAdminPlayers, 250); });
  $('adminPlayers').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-act]'); if (!b) return;
    const username = b.closest('.admin-row').dataset.user; b.disabled = true;
    try {
      if (b.dataset.act === 'modo') { const d = await Net.api('/api/admin/role', { username, modo: b.dataset.on === '1' }); toast(`${d.profile.username} : ${d.profile.modo ? 'MODO' : 'joueur normal'}`, 'good'); }
      else if (b.dataset.act === 'skins') { const d = await Net.api('/api/admin/skins', { username }); toast(`${d.profile.username} : tous les skins débloqués`, 'good'); }
      else if (b.dataset.act === 'coins') { const d = await Net.api('/api/admin/grant', { username, coins: 500 }); toast(`${d.profile.username} : ${d.profile.coins} pièces`, 'good'); }
      loadAdminPlayers();
    } catch (e) { toast(e.message, 'bad'); b.disabled = false; }
  });
  $('adminGrant').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { const d = await Net.api('/api/admin/grant', { username: $('grantUser').value.trim(), coins: Number($('grantCoins').value || 0), trophies: Number($('grantTrophies').value || 0) }); $('adminMsg').textContent = `${d.profile.username} : ${d.profile.coins} pièces, ${d.profile.trophies} trophées`; }
    catch (e) { $('adminMsg').textContent = e.message; }
  });
  // ----- Skins -----
  let skinTab = 1, previews = [];
  function drawPreviews(ts) {
    requestAnimationFrame(drawPreviews);
    if (current !== 'skins') return;
    const t = ts / 1000;
    for (const p of previews) { const ctx = p.canvas.getContext('2d'); ctx.clearRect(0, 0, 240, 240); Creatures.draw(ctx, p.skin.ogId, p.skin.id, 120, 125, 150, t, { moving: true, vx: 1, phase: p.skin.ogId }, { alpha: p.owned ? 1 : 0.55 }); }
  }
  requestAnimationFrame(drawPreviews);
  async function openSkins() {
    show('skins');
    try { profile = (await Net.api('/api/me')).profile; } catch (e) { /* ignore */ }
    $('skinsCoins').textContent = profile.coins;
    const locked = isLocked();
    $('skinsLocked').classList.toggle('hidden', !locked); $('skinTabs').classList.toggle('hidden', locked); $('skinGrid').classList.toggle('hidden', locked);
    if (locked) { renderGoogleButton($('googleSkinsBtn'), 'link'); return; }
    const ownedOgs = Catalog.CREATURES.filter(c => (profile.collection || {})[c.id]).map(c => c.id);
    if (!ownedOgs.includes(skinTab)) skinTab = ownedOgs[0] || 1;
    $('skinTabs').innerHTML = ownedOgs.map(og => `<button class="og-tab ${og === skinTab ? 'active' : ''}" data-og="${og}">${Catalog.OG_NAMES[og]}</button>`).join('');
    $('skinTabs').querySelectorAll('.og-tab').forEach(b => b.addEventListener('click', () => { skinTab = Number(b.dataset.og); openSkins(); }));
    const owned = new Set(profile.skins);
    let deal = null; try { deal = (await Net.api('/api/deal')).deal; } catch (e) { /* ignore */ }
    const dealEl = document.querySelector('#screen-skins .deal') || (() => { const d = document.createElement('div'); d.className = 'deal'; $('skinTabs').parentNode.insertBefore(d, $('skinTabs')); return d; })();
    if (deal && Catalog.SKIN_BY_ID[deal.skinId]) { const ds = Catalog.SKIN_BY_ID[deal.skinId]; dealEl.textContent = `🔥 Offre de la semaine : ${ds.name} à ${deal.price} pièces au lieu de ${ds.unlock.value} (onglet ${Catalog.OG_NAMES[ds.ogId]})`; dealEl.classList.remove('hidden'); } else dealEl.classList.add('hidden');
    const skins = Catalog.SKINS.filter(s => s.ogId === skinTab && !s.hidden);
    const grid = $('skinGrid'); grid.innerHTML = ''; previews = [];
    for (const skin of skins) {
      const card = document.createElement('div');
      const isOwned = owned.has(skin.id), isEq = profile.equipped[skin.ogId] === skin.id;
      card.className = `skin-card ${isEq ? 'equipped' : ''}`;
      const unlock = Catalog.canUnlock(skin, profile);
      let action = '';
      if (isEq) action = '<div class="skin-lock">✔ Équipé</div>';
      else if (isOwned) action = `<button class="btn primary" data-equip="${skin.id}">Équiper</button>`;
      else if (skin.unlock.type === 'coins') { const price = deal && deal.skinId === skin.id ? deal.price : skin.unlock.value; action = `<button class="btn gold" data-buy="${skin.id}" ${profile.coins >= price ? '' : 'disabled'}>${price} pièces${price !== skin.unlock.value ? ` <s>${skin.unlock.value}</s>` : ''}</button>`; }
      else action = `<div class="skin-lock">🔒 ${unlock.label}</div>`;
      card.innerHTML = `${deal && deal.skinId === skin.id && !isOwned ? '<span class="deal-tag">-50 %</span>' : ''}<canvas width="240" height="240"></canvas><div class="skin-name">${esc(skin.name)}</div><div class="skin-rarity r-${skin.rarity}">${skin.rarity}</div>${action}`;
      grid.appendChild(card);
      const c = card.querySelector('canvas');
      previews.push({ canvas: c, skin, owned: isOwned });
    }
    grid.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', async () => { try { profile = (await Net.api('/api/skins/equip', { skinId: b.dataset.equip })).profile; openSkins(); } catch (e) { alert(e.message); } }));
    grid.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', async () => { try { profile = (await Net.api('/api/skins/buy', { skinId: b.dataset.buy })).profile; openSkins(); } catch (e) { alert(e.message); } }));
  }

  // ----- Classement -----
  let boardKind = 'ranked';
  document.querySelectorAll('[data-board]').forEach(b => b.addEventListener('click', () => { boardKind = b.dataset.board; openLeaderboard(); }));
  async function openLeaderboard() {
    show('leaderboard');
    document.querySelectorAll('[data-board]').forEach(b => b.classList.toggle('active', b.dataset.board === boardKind));
    const thead = $('boardTable').querySelector('thead');
    try {
      if (boardKind === 'survival') {
        thead.innerHTML = '<tr><th>#</th><th>Joueur</th><th>Niv.</th><th>Record Survie</th></tr>';
        const { leaderboard } = await Net.api('/api/leaderboard/survival');
        $('boardTable').querySelector('tbody').innerHTML = leaderboard.map(r => `<tr class="${profile && r.id === profile.id ? 'me' : ''}"><td>${r.rank}</td><td>${esc(r.username)}</td><td>${r.level}</td><td>${r.score}</td></tr>`).join('') || '<tr><td colspan="4">Personne n’a encore survécu…</td></tr>';
      } else {
        thead.innerHTML = '<tr><th>#</th><th>Joueur</th><th>Ligue</th><th>Niv.</th><th>Trophées</th><th>V / D</th></tr>';
        const { leaderboard } = await Net.api('/api/leaderboard');
        $('boardTable').querySelector('tbody').innerHTML = leaderboard.map(r => `<tr class="${profile && r.id === profile.id ? 'me' : ''}"><td>${r.rank}</td><td>${avatarHtml(r.avatar, r.level)}${esc(r.username)}</td><td>${r.league}</td><td>${r.level}</td><td>🏆 ${r.trophies}</td><td>${r.wins} / ${r.losses}</td></tr>`).join('') || '<tr><td colspan="6">Aucun joueur classé.</td></tr>';
      }
    } catch (e) { /* ignore */ }
  }

  // ----- Règles -----
  function renderRules() {
    const og = Sim.OGS;
    const lines = [
      [1, 'Se pose sur la ligne du fond et fonce tout droit vers la base ennemie (1 dégât). Meurt au contact des Défenseurs, Éponges, Tourelles et Chargeurs adverses. Rebondit sur tous les Murs, les tiens compris (laisse des allées !) : s’il revient de chez l’adversaire et repasse la frontière, il change de camp et devient ennemi.'],
      [2, 'Patrouille horizontalement, rebondit sur les bords et les obstacles. Mange les Runners adverses. Destruction mutuelle avec une Éponge.'],
      [3, 'Statique, 2 PV. Tire sur tout ennemi qui entre dans un carré de 2 cases autour d’elle (devant, derrière, côtés), uniquement dans ton camp (zone affichée à la pose). Détruite au contact d’un Riko.'],
      [4, 'Avance en diagonale en rebondissant sur les côtés, 3 PV. Détruit Tourelles et Chargeurs au contact (perd 1 PV à chaque fois). Rebondit sur tous les Murs (un mur ennemi perd 1 PV). S’il repart à contresens et repasse la frontière, il change de camp : les tourelles de son ancien maître le prennent pour cible et il attaque sa base. 2 dégâts.'],
      [5, 'Mur statique, 3 PV. Renvoie les Runners et les Éponges, les tiens compris (ils ne le traversent plus : laisse des allées à tes alliés). Un ennemi qui rebondit dessus lui fait perdre 1 PV.'],
      [6, 'Statique, 3 PV. +50 % de régénération de mana tant qu’il est en vie (cumulable). Cible préférée des Éponges et Ailées.'],
      [7, 'Vole tout droit au-dessus de tout. Tire sur les Runners, Tourelles, Chargeurs et Ailées à 1 case. 5 dégâts à la base. 2 PV.'],
      [8, 'Runner lent à 2 PV : il encaisse un premier choc (Gromp, tourelle, Riko…) et continue. 1 dégât à la base.'],
      [9, 'Flotte lentement au-dessus de tout, 1 PV, aucun dégât : si elle atteint la base adverse, ta base récupère 1 PV.'],
      [10, 'Moustique volant très rapide, 1 PV : ignore les unités au sol et les murs. 1 dégât à la base. Abattu par Krak et Zéphir.'],
      [11, 'Mine invisible pour l’adversaire, 1 PV : explose au premier contact d’une unité ennemie au sol, 2 dégâts dans la case autour.'],
      [12, 'Tourelle à vent, 2 PV : toutes les 2 s, repousse d’une case les ennemis au sol dans les 2 cases devant elle. Détruite par Riko.'],
      [13, 'Marche lentement, 3 PV, explose à l’arrivée (4 dégâts) ou à sa mort (1 dégât autour). Frappe tout ennemi au sol qu’il touche.'],
      [14, 'Invisible tant qu’il est dans ton camp, traverse murs et unités au sol. 2 PV, 2 dégâts. Seuls les projectiles et Riko l’atteignent.'],
      [15, 'Flaque, 3 PV, qui ne bloque pas : les ennemis au sol qui la traversent sont ralentis de moitié.'],
      [16, 'Toutes les 8 s, charme l’ennemi au sol le plus proche (2 cases) : il change de camp et repart frapper son ancien maître. 2 PV.'],
      [17, 'Colosse lent, 6 PV, 3 dégâts : écrase les murs (−1 PV pour lui) et tue toute unité au sol qu’il touche (−1 PV par choc).'],
    ];
    $('rulesPage').innerHTML = `
      <h3>But</h3><p>Chaque joueur a <b>30 PV</b>. Pose des Ogs sur ta moitié pour atteindre la base adverse. En classée, après <b>3 minutes</b>, celui qui a le plus de PV gagne. En entraînement et en amical, tu choisis la durée (2, 3, 5 min ou illimitée : seul un KO termine la partie).</p>
      <h3>Mana</h3><p>Max 70, +2 / s. Clique (ou touche <kbd>O</kbd>) sur les orbes de ton côté : +10 mana. Chaque Chargeur vivant accélère ta régénération de 50 %.</p>
      <h3>Contrôles</h3><p>Clic gauche sur une case : poser la créature choisie · clic droit : annuler. Une créature rebondie qui repasse la frontière vers son camp <b>change de camp</b>. <kbd>A</kbd> <kbd>Z</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd> (ou <kbd>1</kbd>–<kbd>7</kbd>, ou clic sur un slot) pour choisir un Og · flèches pour déplacer le curseur · <kbd>Entrée</kbd> / <kbd>Espace</kbd> ou clic pour poser · <kbd>Échap</kbd> annule. Zip, Riko et Zéphir se posent <b>uniquement sur la ligne du fond</b> (la plus éloignée de l’adversaire) ; les autres n’importe où sur ta moitié.</p>
      <h3>Les Ogs</h3>
      ${lines.map(([id, txt]) => `<div class="og-line"><canvas width="112" height="112" data-og="${id}"></canvas><div><b>${esc(Catalog.OG_NAMES[id])}</b> <span style="color:var(--muted)">· ${esc(Catalog.OG_ROLES[id])} · ${og[id].cost} mana</span><br><i style="color:#94a3b8">${esc(Catalog.OG_LORE[id])}</i><br>${txt}</div></div>`).join('')}
      
      <h3>Capacités actives (Maj + touche, ou ⚡ sur le slot)</h3><p>10 mana, 20 s de recharge, il faut au moins une créature de ce type en jeu.</p>
      ${[1, 2, 3, 4, 5, 6, 7].map(id => `<p><b>${esc(Catalog.OG_NAMES[id])} – ${esc(Sim.ABILITIES[id].name)}</b> : ${esc(Sim.ABILITIES[id].desc)}</p>`).join('')}<p class="muted">Les 10 nouvelles créatures n’ont pas de capacité active : leur pouvoir est passif.</p>
      <h3>Collection, équipe, capsules</h3><p>Chaque créature a un <b>coût</b> (10 à 70 mana) et une <b>rareté</b>. Ton <b>équipe</b> contient une créature par coût : ce sont les 7 cases de ta barre en partie (touches A Z E R T Y U). Les nouvelles créatures se gagnent dans les <b>capsules</b> (une par victoire classée, duo ou trio, 5 en stock maximum ; tirage par rareté avec garanties) et sur la <b>route des trophées</b> (paliers de ton record). Les exemplaires en double donnent des étoiles à la carte.</p>
      <h3>Modes</h3><p><b>Classée 1v1</b> : trophées et ligues. <b>Duo 2v2</b> et <b>Trio 3v3</b> : classés aussi, sur une arène de 13 ou 17 colonnes ; chaque joueur a sa propre mana, les PV de la base sont partagés par l’équipe, les capacités profitent à toute l’équipe, et l’abandon n’est effectif que si tous les coéquipiers abandonnent. S’il manque des joueurs après quelques secondes, des bots complètent les équipes (trophées divisés par 2). <b>Entraînement</b> et <b>Amical</b> existent aussi en 2v2 / 3v3 (format dans les options : en amical, l’hôte peut lancer avec des bots aux places vides).</p>
      <h3>Options de partie</h3>
      ${Features.matchFeatures().map(f => `<p><b>${esc(f.label)}</b>${f.ranked ? ' (actif en classée)' : ''} : ${esc(f.desc)}</p>`).join('')}
      <p><b>Survie</b> : seul contre des vagues de plus en plus nombreuses, sans limite de temps. Score = éliminations ×10 + vagues ×50 + secondes. XP et pièces selon le score, record sauvegardé, classement dédié.</p>
      <h3>Progression</h3><p>Partie classée : trophées gagnés/perdus selon l’écart de niveau, ligues Bronze → Légendaire. XP à chaque partie (niveau), pièces pour la boutique de skins, bonus de série, récompense quotidienne.</p>`;
    $('rulesPage').querySelectorAll('canvas[data-og]').forEach(c => { const id = Number(c.dataset.og); Creatures.draw(c.getContext('2d'), id, profile ? profile.equipped[id] : `og${id}_default`, 56, 60, 84, 0, { moving: false }); });
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
      const og = (profile.deck && profile.deck[Catalog.DECK_COSTS[i]]) || i + 1, x = slot * i + slot / 2, base = h * 0.62;
      sctx.fillStyle = 'rgba(0,0,0,0.25)'; sctx.beginPath(); sctx.ellipse(x, base + 66, 50, 14, 0, 0, Math.PI * 2); sctx.fill();
      Creatures.draw(sctx, og, profile.equipped[og] || `og${og}_default`, x, base, 140, t, { moving: true, vx: 1, phase: i }, {});
      sctx.fillStyle = '#e2e8f0'; sctx.font = 'bold 22px "Chakra Petch", sans-serif'; sctx.textAlign = 'center';
      sctx.fillText(`${Catalog.OG_NAMES[og]}`, x, h - 40); sctx.fillStyle = '#94a3b8'; sctx.font = '18px "Chakra Petch", sans-serif'; sctx.fillText(`${['A', 'Z', 'E', 'R', 'T', 'Y', 'U'][i]} · ${Sim.OGS[og].cost} mana`, x, h - 14);
    }
  }
  requestAnimationFrame(drawShowcase);

  Net.api('/api/config').then(c => { config = c; }).catch(() => {});
  // Mise à jour automatique : si le serveur a une nouvelle version, on recharge la page (hors partie en cours).
  const myBuild = (document.querySelector('meta[name="build"]') || {}).content || null;
  async function checkBuild() {
    if (!myBuild) return;
    try { const { build } = await Net.api('/api/version'); if (build && build !== myBuild && current !== 'game') location.reload(); } catch (e) { /* hors-ligne */ }
  }
  setInterval(checkBuild, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkBuild(); });
  tryResume();
})();
