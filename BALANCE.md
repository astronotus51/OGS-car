# OGS Online – équilibrage en vigueur

Valeurs dans `shared/sim.js` (`RULES`, `OGS`). Base 30 PV, mana max 70, +2/s (+50 % par Chargeur vivant), orbe +10, partie 3 min.

| Og | Coût | PV | Déplacement | Base | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Zip (jaune) | 10 | 1 | tout droit, ligne du fond uniquement | 1 | meurt sur Défenseur / Éponge / Tourelle / Chargeur ennemis (−1 PV à Tourelle, Chargeur, Éponge) ; rebondit sur Mur ennemi (−1 PV au mur) **et change de camp** ; traverse ses propres murs ; deux Runners adverses s'annulent |
| 2 Défenseur (violet) | 20 | 1 | horizontal, rebonds | 0 | mange les Runners ennemis ; rebondit sur Tourelles / Murs / Chargeurs (toutes équipes) ; destruction mutuelle avec Éponge |
| 3 Krak (orange) | 30 | 2 | statique | 0 | tir toutes les 1,5 s sur la cible la plus proche dans un **carré de 2 cases tout autour d'elle** (devant, derrière, côtés), **jamais dans le camp adverse** ; détruite au contact d'un Riko |
| 4 Riko (rouge) | 40 | 3 | diagonale, rebonds latéraux, ligne du fond uniquement | 2 | tue Tourelle et Chargeur au contact (−1 PV à elle-même) ; **rebondit sur tout Mur, le sien compris** (un mur ennemi perd 1 PV) ; **devient ennemi** s'il repasse la frontière à contresens ; destruction mutuelle avec Défenseur / Éponge ; projectiles : −1 PV |
| 5 Mur (bleu) | 50 | 3 | statique | 0 | bloque la case ; renvoie les Runners ennemis ; laisse passer sa propre équipe |
| 6 Chargeur (vert) | 60 | 3 | statique | 0 | +50 % regen mana (cumulable) ; one-shot par Éponge ; −1 PV par Runner ; cible des Ailées |
| 7 Zéphir (orange/noir) | 70 | 2 | aérien tout droit, ligne du fond uniquement | 5 | ignore sol et murs ; tir 0,8 s, 1 case, sur 1 / 3 / 6 / 7, jamais côté adverse (comme Krak : un ennemi devient ciblable dès qu'il franchit la ligne médiane) ; abattue par Tourelles et Ailées |

Scorpion noir : **désactivé** (option `hazard` de `createGame`, conservée pour un éventuel mode « chaos »). Durées : classée 3 min ; entraînement/amical 2, 3, 5 min ou illimité (`RULES.durations`).

Récompenses : voir `shared/catalog.js` (`matchRewards`, `RANKS`, `xpForLevel`).


## Règles transversales (nov. 2026)

- **Rebond sur ses propres Blok** : Zip et Riko rebondissent aussi sur les murs de leur camp (sans les abîmer). Il faut laisser des allées à ses alliés.
- **Changement de camp à la frontière** : une créature rebondie (qui avance à contresens) qui est allée chez l'adversaire puis repasse la frontière vers son camp devient une créature **ennemie** (tourelles, collisions, dégâts à la base de son ancien maître). Une créature qui rebondit dans son propre camp et atteint sa propre base **sort sans dégât**.
- **Pose rapprochée** (option, active en classée) : une case se libère dès que la créature précédente s'en est un peu écartée (rayon de blocage ×0,35).
- **Clic droit** annule la sélection, clic gauche pose.

## Les 10 nouvelles créatures

| Créature | Coût | PV | Déplacement | Dégât base | Pouvoir |
|---|---|---|---|---|---|
| Pik (hérisson) | 10 | 2 | droit, lent (×0,6 Zip) | 1 | encaisse un choc (0,5 s d'invulnérabilité + recul) puis continue |
| Bulle | 10 | 1 | aérien, lent | 0 | atteindre la base adverse soigne ta base de 1 |
| Zazou (moustique) | 20 | 1 | aérien, très rapide | 1 | ignore sol et murs ; abattu par tourelles et Zéphir |
| Boum (mine) | 30 | 1 | statique, invisible pour l'adversaire | 0 | explose au premier contact ennemi au sol : 2 dégâts dans 1 case |
| Rafale (ventilo) | 30 | 2 | statique | 0 | toutes les 2 s, repousse d'une case les ennemis au sol dans les 2 cases devant |
| Tiktak (bombe) | 40 | 3 | droit, lent | 4 | frappe les ennemis au sol touchés ; explose à sa mort (1 dégât autour) ; rebondit sur les murs |
| Fantôme | 40 | 2 | droit, rapide | 2 | invisible dans son camp ; traverse murs et unités ; seuls projectiles et Riko le touchent |
| Glu | 50 | 3 | statique, traversable | 0 | ralentit de moitié les ennemis au sol qui la traversent |
| Sirène | 60 | 2 | statique | 0 | toutes les 8 s, l'ennemi au sol le plus proche (2 cases, pas les brutes) change de camp |
| Kraken | 70 | 6 | droit, très lent | 3 | écrase les murs et tue toute unité au sol touchée (−1 PV par choc) |

Toutes obéissent aux règles communes : changement de camp à la frontière, rebond sur ses propres Blok (runners), Krak tire sur toute créature ennemie dans sa zone.
