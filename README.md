# OGS – Versus Tactique à Deux

Jeu jouable à deux sur le même écran : chaque joueur place des Ogs (unités) sur sa moitié de terrain et tente d’atteindre la base adverse tout en défendant la sienne. Le champ est divisé en 9 colonnes et 8 lignes (4 par camp) avec barre de sélection en haut/bas, jauges de mana, points de vie à droite et un bouton Pause. La boucle principale tourne dans `main.js` et affiche le jeu dans le canvas `#gameCanvas`.

## Note de maintenance
- À chaque modification réalisée par Codex, mettre à jour ce README (ajouter ou ajuster les sections concernées) afin qu’il reste parfaitement synchronisé avec l’état du code et des règles de jeu.
- Les skins PNG situés dans `OGS Skin/` sont appliqués aux slots (avec ordre miroir haut/bas) et aux unités en jeu; conserver la cohérence visuelle lors de futures évolutions.
- Les skins sont désormais inversés pour tous les Ogs : le joueur haut voit ses skins retournés verticalement, le joueur bas conserve l’orientation directe, dans les slots comme en jeu.
- Le rendu des skins a été forcé en haute qualité (`imageSmoothingQuality = "high"` et `imageSmoothingEnabled = true`) pour des sprites plus nets même avec les redimensionnements.
- Les slots d’Og sont désormais parfaitement carrés (centrés dans la barre) et la jauge de mana est dessinée derrière eux pour se rapprocher de l’interface de référence.
- La jauge de mana est passée au vert, plus épaisse (hauteur des slots + marge) et positionnée sous les slots; les fonds de slots sont translucides blancs pour laisser la barre visible derrière.
- Ajustement du placement : la bande de mana est réellement derrière et alignée avec les slots (même zone verticale, marge autour) pour les deux joueurs.
- Marges de la bande de mana réduites (divisées par 4) pour la rapprocher du terrain tout en gardant la bande verte derrière les slots.
- Barres de PV réduites (plus fines et plus courtes) et placées sur le terrain, collées à droite.
- Barres de PV rapprochées de la ligne centrale, avec le bouton Pause (réduit) placé entre les deux, sur le terrain à droite.
- Bouton Pause centré sur l’axe des barres de PV (entre les deux verticalement et aligné horizontalement sur leur centre).
- Fond noir retiré du bouton Pause : cercle clair semi-opaque avec icône sombre pour une meilleure lisibilité.
- Barre de mana élargie de 8 px à gauche et à droite (centre conservé) pour mieux couvrir la zone derrière les slots.
- Bouton Pause sans fond dédié (icône noire posée directement sur le décor, sans effacer la zone) pour un rendu minimal.
- Barres de PV et bouton Pause directement sur le terrain (plus de bande latérale), bouton centré entre les deux barres avec un gap, aligné verticalement sur la médiane.
- Les barres de PV sont dessinées au-dessus des entités pour qu’un Og passant derrière soit partiellement masqué.
- Bande de mana statique (plus d’animation électrique).
- Orbes de mana plus psychédéliques (tourbillons lumineux animés).
- Les orbes de mana sont toujours au-dessus des Ogs pour rester visibles et cliquables.
- Barre de mana épaissie et slots agrandis quasi jointifs; barres de PV allongées.
- Fond du terrain animé façon vagues psychédéliques : multiples lignes ondulantes en mouvement continu.
- Défenseurs violets pivotent de 180° uniquement à chaque rebond (mur/obstacle/entre eux) pour un feedback visuel immédiat.
- La pause fige toutes les animations (mana/vagues) et bloque toute action de placement tant qu’elle est active.
- Plages organiques animées entre la barre de mana et le terrain (top/bottom) avec bord ondulé discret, rubans translucides légers et halos doux pour un rendu organique mais sobre.
- Slots : fond blanc un peu plus opaque et contour blanc pour une meilleure lisibilité sur la barre de mana.
- Hitbox des Ogs alignée sur la taille de leur sprite (quasi pleine case).
- Quadrillage de placement se met à jour automatiquement dès qu’un Og libère une case.
- Éponge rouge tourne lentement en continu.
- Tourelle orange tombe en 2 coups de Runner jaune.
- La tourelle orange (Og 3) pivote en douceur vers sa cible avant de tirer (orientation neutre : haut/top vers le bas, bas/bottom vers le haut, interpolation vers la cible puis retour à cette neutralité).
- Og Éponge (rouge) ralenti et tombe après 2 projectiles (au lieu d’être immunisée).
- Og Tourelle (orange) apparaît déjà orientée vers l’adversaire (top -> bas, bottom -> haut) avant même de tirer.
- Tourelles oranges sont détruites immédiatement au contact d’une Éponge rouge (l’Éponge rebondit).
- Écran d’accueil OGSCAR style rétro simple (fond mer animé visible, choix 1v1 ou 1vIA simple/moyen/difficile, scorpion noir activable pour le 1v1).
- Lancement 1v1/IA : compte à rebours 5 s en miroir avant le début du jeu.
- Les Ogs sont rendus presque à la largeur totale de leur case pour remplir visuellement la grille.
- Optimisation iPad : devicePixelRatio clampé à 1.5 max pour limiter la charge GPU.


## Objectif de la partie
- Déployer des Ogs sur ta moitié de terrain pour faire descendre (joueur haut) ou monter (joueur bas) tes unités jusqu’à la base ennemie.
- Chaque Og qui atteint la base ennemie inflige des dégâts selon son type. Réduis la vie adverse à 0 avant que la tienne (30 PV) ne tombe.
- Un bloc noir (hazard) traverse périodiquement le centre puis fonce vers un bord infligeant 7 dégâts au joueur touché. Pendant son passage, la pose d’unités est bloquée.

## Mana et économie
- Mana max : 70. Régénération de base : 2 mana/s.
- Orbes de mana : apparaissent aléatoirement sur chaque moitié. Cliquer une orbe de ton côté donne +10 mana (disparition après 5 s).
- Chargeurs verts (Og 6) : chaque Chargeur vivant augmente la régénération de mana de son propriétaire de +50 %.
- Coût d’un Og = `og.cost × 10` (ex. 1 → 10 mana, 4 → 40 mana).

## Liste des Ogs (même niveau de puissance de base)
Les coûts et comportements sont définis dans `main.js` (constante `OGS`). Santé par défaut : 1 PV sauf mention contraire. Rayon de collision commun aux unités.

1. **Og Runner** (Jaune) – Coût 10 mana  
   - Rôle : marqueur de points.  
   - Mouvement : tout droit vers la base ennemie (première ligne de son camp uniquement).  
   - Dégâts base : 1.  
   - Interactions : rebondit sur murs bleus, meurt au contact des violets/rouges/greens ennemis.

2. **Og Défenseur** (Violet) – Coût 20 mana  
   - Rôle : anti-runner mobile.  
   - Mouvement : horizontal avec rebonds gauche/droite; rebond immédiat et séparation sur contact avec violets/obstacles (pas de chevauchement).  
   - Dégâts base : n’en inflige pas en bout de carte, sert surtout à éliminer les jaunes adverses.

3. **Og Tourelle** (Orange) – Coût 30 mana  
   - Rôle : contrôle de zone au sol.  
   - Mouvement : statique.  
   - Tire périodiquement vers l’avant sur les ennemis dans sa moitié (portée 1 case autour seulement, cadence ralentie) avec projectiles à 3 PV.  
   - PV : 3. Détruite instantanément par l’Éponge rouge au contact.

4. **Og Éponge** (Rouge) – Coût 40 mana  
   - Rôle : anti-structure rebondissante.  
   - Mouvement : diagonale avec rebonds murs/gauche/droite (pas de rebond haut/bas).  
   - Dégâts base : 2 en bout de ligne.  
   - Détruit les Tourelles oranges, se suicide contre Défenseurs violets/Éponges rouges adverses; tue les Chargeurs verts ennemis.

5. **Og Mur** (Bleu) – Coût 50 mana  
   - Rôle : obstacle statique.  
   - Mouvement : statique.  
   - Blocage : empêche les placements sur sa case; fait rebondir les Runners jaunes.

6. **Og Chargeur** (Vert) – Coût 60 mana  
   - Rôle : support économique.  
   - Mouvement : statique.  
   - Effet : +50 % regen mana tant qu’il est en vie (cumulatif).  
   - PV : 3 (affaibli par Runners jaunes, one-shot par Éponge rouge, ciblé par Tourelle ailée).

7. **Og Tourelle ailée** (Orange/Noir) – Coût 70 mana  
   - Rôle : aérien offensif / anti-sol ciblé.  
   - Mouvement : aérien tout droit (ignore murs/unités au sol).  
   - Dégâts base : 5 en bout de ligne.  
   - Tire vers l’avant uniquement sur Og 1/3/6/7 adverses (portée 1 case).  
   - PV : 3. Résiste aux projectiles standards jusqu’à 3 touches.

## Hazard : Bloc noir
- Apparition aléatoire (60–90 s). Arrive par la droite, se place au centre, pause 5 s puis fonce vers le haut ou le bas sous forme d’un simple carré noir.
- Détruit toute unité sur sa trajectoire. S’il sort côté haut, le joueur haut prend 7 dégâts; côté bas, le joueur bas prend 7.
- Pendant qu’il est actif, la pose d’unités est verrouillée.

## Commandes et interaction
- Cliquer sur un slot en haut (joueur top) ou bas (joueur bottom) pour sélectionner un Og, puis cliquer une case autorisée de ta moitié pour le poser. Certains Ogs ne se posent que sur la première ligne de leur camp (1, 4, 7).
- Les sélections top/bottom sont indépendantes : un clic côté adverse ne désélectionne pas ton slot.
- Cliquer sur une orbe de ton côté pour la ramasser.  
- Bouton pause à droite : met le jeu en pause/reprise. Quand le jeu est en pause, deux boutons apparaissent au centre : « Continuer » (reprend la partie) et « Recommencer » (relance immédiatement la partie avec la même configuration). Ils disparaissent dès que la pause est quittée.

## Lancement rapide
Ouvre `index.html` dans un navigateur moderne. Le canvas se redimensionne pour garder le ratio 3:4 (plein écran iPad vertical). Toute la logique côté client est dans `main.js`, le style dans `style.css`.
