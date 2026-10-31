# Glouglou Arena

Duel en ligne de bestioles rigolotes, remake **online** du jeu iPad OGS : un 1 contre 1 en temps réel, chacun sur son ordinateur, avec matchmaking façon Brawl Stars, comptes, trophées, niveaux, pièces et skins.

- `shared/sim.js` – la simulation (règles, collisions, scorpion noir), **déterministe**, utilisée par le serveur (autoritaire) et le client (prédiction d'affichage).
- `shared/ai.js` – l'IA (simple / moyen / difficile), joue n'importe quel camp.
- `shared/catalog.js` – skins, ligues, courbe d'XP, récompenses.
- `server/` – Node.js : Express (API REST), `ws` (WebSocket temps réel), Postgres/Supabase ou fichier JSON.
- `public/` – le client : canvas 3:4, HUD, menus, profil, boutique.
- `legacy/` – l'ancienne version locale (2 joueurs sur le même écran), conservée telle quelle.
- `OGS Skin/` – les sprites sources haute résolution.

## Lancer en local

```bash
npm install
npm start            # http://localhost:3000
```

Sans `DATABASE_URL`, les comptes sont stockés dans `data/store.json` (pratique pour tester). Ouvre deux navigateurs (ou une fenêtre privée), crée deux comptes, clique **JOUER** des deux côtés : la partie démarre.

`npm test` lance les tests de la simulation (déterminisme, règles de placement, rebonds…).

## Brancher Supabase (Postgres)

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string** : copie l'URI du *Transaction pooler* (port 6543) et remplace `[YOUR-PASSWORD]`.
3. Copie `.env.example` en `.env` et renseigne `DATABASE_URL=postgresql://...` (et un `JWT_SECRET` long et aléatoire).
4. `npm start` : les tables sont créées automatiquement (`schema.sql`, idempotent). Tu peux aussi coller `schema.sql` dans l'éditeur SQL de Supabase.

## Déployer sur un VPS Hostinger (recommandé)

L'hébergement web/cloud Hostinger (hPanel « Node.js web app ») **bloque les WebSockets entrants** : le jeu ne peut pas y tourner. Il faut un **VPS**.

1. Pousse le dépôt sur GitHub (`git push`).
2. Dans hPanel → VPS → ton serveur : note l'IP, et dans **Paramètres → Accès SSH** ajoute ta clé publique (ou utilise le mot de passe root).
3. Fais pointer ton domaine vers l'IP du VPS (enregistrement A chez Hostinger → DNS).
4. Connecte-toi (`ssh root@IP`) et lance l'installation en une commande (Node 22, pm2, nginx, HTTPS Let's Encrypt, pare-feu) :
   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/TON_COMPTE/TON_DEPOT/main/deploy/setup-vps.sh) TON_COMPTE/TON_DEPOT jeu.tondomaine.fr
   ```
5. Renseigne `DATABASE_URL` (Supabase) dans `/var/www/ogs/.env` puis `pm2 restart ogs`.

Mises à jour automatiques : le workflow `.github/workflows/deploy.yml` se connecte en SSH au VPS à chaque push sur `main` (`git reset --hard` + `npm install` + `pm2 reload`). Crée les secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` dans GitHub → Settings → Secrets → Actions. Sans GitHub Actions : `ssh root@IP "cd /var/www/ogs && git pull && npm install --omit=dev && pm2 reload ogs"`.

Commandes utiles sur le VPS : `pm2 logs ogs`, `pm2 restart ogs`, `pm2 status`, `nginx -t && systemctl reload nginx`.

## Déployer ailleurs (Render / Railway / Fly / VPS)

Un seul service Node, qui sert le site **et** le WebSocket :

- **Render** : *New → Web Service* depuis le dépôt GitHub, build `npm install`, start `npm start`, variables `DATABASE_URL`, `JWT_SECRET`. Le plan gratuit s'endort après 15 min d'inactivité (premier chargement lent).
- **Railway** : *Deploy from GitHub*, mêmes variables. `PORT` est fourni automatiquement.
- **VPS** : `node server/index.js` derrière Nginx (penser à proxifier `/ws` avec `Upgrade`/`Connection` headers).

## Joueurs (sans compte) et sécurité

Il n'y a **aucun compte** : pas d'inscription, pas de mot de passe, pas de connexion Google. À la première visite, le joueur choisit un pseudo (unique) et joue. Sa progression (trophées, niveau, pièces, skins, avatar) est liée à l'appareil par un cookie de session sécurisé (`httpOnly`, `SameSite=Lax`, `Secure` en HTTPS, signé, 30 jours).

- **Changer de joueur** (lobby ou profil) oublie le joueur sur cet appareil.
- **Transfert** : dans le profil, « Générer un code » donne un code à usage unique valable 24 h ; sur l'autre appareil, « J'ai un code de transfert » à l'accueil récupère la progression (l'ancien appareil est déconnecté).
- **Admin** : une clé secrète, dans `data/admin-key.txt` (générée au premier démarrage) ou la variable `ADMIN_KEY`. Un joueur l'entre une fois dans son profil → badge ADMIN, tous les skins, panneau d'administration (comptes, joueurs en ligne, parties en cours, don de pièces/trophées). Les pseudos `ADMIN_NAMES` (par défaut **Aluego** et Alugo) sont réservés : on ne peut les prendre qu'en entrant la clé admin sur l'écran d'accueil, et on est alors admin d'office.
- **Tout effacer** : `node scripts/wipe-all.js --oui` supprime tous les joueurs et toutes les parties (puis `pm2 restart ogs`).
- Protections serveur : en-têtes helmet (CSP stricte, pas de framing), limite de requêtes (anti-abus), vérification d'origine sur l'API et le WebSocket, validation des entrées, avatars vérifiés (format, taille ≤ 64 Ko).
- **HTTPS** : il reste à mettre un domaine + `certbot` (voir le déploiement) pour chiffrer le trafic et marquer le cookie `Secure`.

## Arènes

Le décor change à chaque partie : **Lagon**, **Espace** (nébuleuses, planète, étoiles filantes), **Mer de lave** (fissures qui pulsent, bulles), **Cimetière** (lune, brume, chauves-souris), **Ferme** (champs, blé qui ondule, papillons), **Banquise** (aurore boréale, neige) et **Pays des bonbons**. Le serveur tire l'arène au sort ; en entraînement, amical et survie on peut la choisir dans le lobby. Les arènes sont dessinées en vectoriel dans `public/js/maps.js` (fond statique mis en cache + couche animée) ; la liste est dans `Catalog.MAPS`. Pour en ajouter une : une entrée dans les deux.

## Avatars, musique et sons

- **Avatar** : profil → avatar : 15 propositions dessinées (créatures et skins) ou une photo importée. Affiché dans le lobby, le profil, le classement et en match.
- **Musique** : techno acid générative façon TB-303 (basse saw + filtre résonant modulé, slides et accents), kick, hats, clap, nappe profonde et sub, délai et réverb, 126 BPM ; les patterns se régénèrent toutes les 4–8 mesures et le filtre balaie lentement (hypnotique). Intensité selon l'écran (menu / match / mort subite). 100 % synthétisée en Web Audio, aucun fichier.
- **Sons** : pose, sélection, orbe, tir, impact, élimination, rebond, dégât à la base, capacité, gel, évolution, soin, compte à rebours, GO, victoire/défaite, vague, mort subite, emotes, pièces.
- Réglages (musique / sons / volumes) dans la barre du lobby et en match ; mémorisés dans le navigateur.

## Jouer

| Action | Clavier | Souris |
| --- | --- | --- |
| Choisir un Og | `A Z E R T Y U` ou `1`–`7` (QWERTY : `Q W E R T Y U`) | clic sur un slot |
| Déplacer le curseur | flèches (↑ = vers l'ennemi) | survol d'une case |
| Poser | `Entrée` / `Espace` | clic sur une case |
| Ramasser une orbe (+10 mana) | `O` (ou `Espace` sans sélection) | clic sur l'orbe |
| Annuler la sélection | `Échap` | – |

Chaque joueur se voit **toujours en bas** de l'écran (le monde est retourné pour le joueur du haut).

### Modes

- **JOUER** – partie classée : file d'attente par trophées (fenêtre qui s'élargit avec l'attente). Au bout de `BOT_FILL_SECONDS` (15 s par défaut) sans adversaire, un bot de niveau adapté complète la partie (gain de trophées divisé par 2).
- **Entraînement vs IA** – XP et pièces réduits, pas de trophées. Durée au choix (2/3/5 min ou illimitée).
- **Partie amicale** – un code à 5 caractères à partager, pas de trophées. Durée au choix.

Une partie dure **3 minutes** max ; ensuite, celui qui a le plus de PV gagne. Un joueur déconnecté a 20 s pour revenir (rafraîchir la page reprend la partie en cours).

### Progression

- **Trophées** : +4 à +16 par victoire selon l'écart, −2 à −12 par défaite (pertes réduites sous 100). Ligues : Bronze 0, Argent 200, Or 500, Diamant 900, Mythique 1400, Légendaire 2000.
- **XP / niveau** : 40 XP par victoire, 15 par défaite, 20 par égalité, bonus de série (dès 2 victoires d'affilée). Niveau n → n+1 : `100 + 60·(n−1)` XP.
- **Pièces** : 20 / 6 / 10 par partie, +25 avec la récompense quotidienne, pour la boutique de skins.
- **Skins** : 5 variantes par Og (classique, néon, doré, ombre, prisme) + 2 légendaires. Débloqués par pièces, niveau, trophées ou victoires.

## Options de gameplay (expérimentations à cocher)

Tout est piloté par `shared/features.js` : un interrupteur `enabled` par fonctionnalité. **Pour retirer une fonctionnalité, mets `enabled: false`** (elle disparaît du lobby, du serveur et des règles) ; le code reste en place, chaque fonctionnalité est isolée derrière `if (F.xxx)` dans `shared/sim.js` et `if (view.features.xxx)` dans le client. Les cases à cocher du lobby s'appliquent à l'entraînement, l'amical et la survie ; en classée, c'est la colonne `ranked` qui décide.

| Clé | Quoi | Classée |
| --- | --- | --- |
| `abilities` | Capacités actives : Maj + touche ou ⚡ sur le slot (10 mana, 20 s). Zip Sprint, Gromp Rage, Krak Tir triple, Riko Rebond fou, Blok Mur de glace (gel), Mojo Burst de mana, Zéphir Bombe | oui |
| `evolution` | Reposer Krak / Blok / Mojo sur lui-même : niveau 2 puis 3 (+1 PV, Krak tire plus vite, Mojo régénère plus) | oui |
| `overtime` | Mort subite en cas d'égalité au temps : mana ×3, premier dégât = défaite | oui |
| `powerPatches` | Gromp renvoie Riko (−1 PV) au lieu de mourir avec ; Mojo soigne +1 PV ses voisins toutes les 5 s ; Zéphir bombarde (−1 PV) chaque Blok ennemi qu'il survole | oui |
| `draft` | 12 s avant la partie : chacun bannit une créature chez l'adversaire | non |
| `kingOfCenter` | Les unités dans les deux lignes centrales marquent 1 pt/s, 60 pts = victoire | non |
| `manaX2`, `fastUnits`, `fog`, `zigzag` | Mutateurs : mana doublée, unités ×1,5, brouillard de guerre (moitié adverse masquée), Zip en zigzag | non |
| `survival` | Mode Survie solo : vagues croissantes, score = éliminations ×10 + vagues ×50 + secondes, record et classement dédié | – |
| `quests` | 3 quêtes du jour (pièces à récupérer dans le lobby) | – |
| `shopDeals` | Un skin payant à −50 % par semaine | – |

Non fait, volontairement : le 2v2 (il faudrait 4 clients par salle et une file d'attente séparée) et le passe de saison.

## Les créatures

Dessinées en vectoriel dans `public/js/creatures.js` (plus de PNG), animées par parties : Zip court et couche ses oreilles, Gromp claque des griffes, Krak oriente son canon et recule au tir, Riko tourne et a le tournis, Blok se fissure quand il perd des PV, Mojo fait tourner ses étincelles de mana, Zéphir bat des ailes et charge sa boule de feu dans son ventre.

| Og | Nom | Rôle |
| --- | --- | --- |
| 1 | **Zip** | Runner |
| 2 | **Gromp** | Défenseur |
| 3 | **Krak** | Tourelle |
| 4 | **Riko** | Étoile rebondissante |
| 5 | **Blok** | Mur |
| 6 | **Mojo** | Chargeur de mana |
| 7 | **Zéphir** | Dragonnet volant |

Skins = thèmes dessinés par le même code : classique, **Halloween** (Zip Citrouille, Gromp Vampire, Krak Sorcière, Riko Momie, Blok Frankenstein, Mojo Zombie, Zéphir Chauve-souris), Fantôme, Néon, Robo, Givré, Doré.

## Ajouter tes propres skins

1. Ajoute un thème dans `THEMES` de `shared/catalog.js` (nom, rareté, déblocage).
2. Dans `public/js/creatures.js`, ajoute sa palette (`THEME_PALETTE`) et, si tu veux, ses accessoires dans `accessories()` ou directement dans le drawer d'une créature (`drawZip`, `drawGromp`, …) avec `if (theme === 'pirate') ...`.
3. `test/creatures-sheet.js` génère une planche de toutes les créatures × thèmes pour vérifier le rendu.

## Règles (résumé) et changements d'équilibrage

Les règles du jeu d'origine sont conservées (`legacy/README.md`, `legacy/BALANCE.md`), avec les correctifs notés dans `BALANCE.md` :

- le Runner jaune **passe au-dessus de ses propres Murs** et ne rebondit que sur les Murs ennemis (en changeant de camp) ;
- l'Éponge rouge **casse un Mur ennemi mais meurt** sur le coup ; elle **encaisse maintenant les projectiles** (3 PV) au lieu d'y être immunisée ;
- Tourelle et Tourelle ailée ont **2 PV** ; l'Ailée cible aussi les Ailées adverses (1 / 3 / 6 / 7) ;
- le scorpion noir est **désactivé** (il cassait le gameplay ; le code reste dans `sim.js`, option `hazard`) ;
- Zip, Riko et Zéphir se posent **uniquement sur la ligne du fond** (la plus éloignée de l'adversaire) ; Gromp, Krak, Blok et Mojo n'importe où sur sa moitié ;
- classée : 3 min ; entraînement et amical : 2, 3, 5 min ou illimité (KO seulement).

Tout est réglable dans `RULES` et `OGS` en tête de `shared/sim.js` (le serveur et le client utilisent le même fichier).

## Architecture réseau

- Le serveur fait tourner la simulation à 30 ticks/s et diffuse un snapshot compact à chaque tick ; le client interpole entre deux snapshots (≈85 ms de retard) pour un mouvement fluide à 60+ fps.
- Les entrées (`place`, `orb`, `surrender`, `emote`) sont validées côté serveur : impossible de tricher sur la mana ou les cases.
- Les sprites sont pré-rendus en 256 px (effets de skin inclus) : pas de redimensionnement de PNG 2400 px à chaque frame.
