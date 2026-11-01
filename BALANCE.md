# OGS Online – équilibrage en vigueur

Valeurs dans `shared/sim.js` (`RULES`, `OGS`). Base 30 PV, mana max 70, +2/s (+50 % par Chargeur vivant), orbe +10, partie 3 min.

| Og | Coût | PV | Déplacement | Base | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Zip (jaune) | 10 | 1 | tout droit, ligne du fond uniquement | 1 | meurt sur Défenseur / Éponge / Tourelle / Chargeur ennemis (−1 PV à Tourelle, Chargeur, Éponge) ; rebondit sur Mur ennemi (−1 PV au mur) **et change de camp** ; traverse ses propres murs ; deux Runners adverses s'annulent |
| 2 Défenseur (violet) | 20 | 1 | horizontal, rebonds | 0 | mange les Runners ennemis ; rebondit sur Tourelles / Murs / Chargeurs (toutes équipes) ; destruction mutuelle avec Éponge |
| 3 Krak (orange) | 30 | 2 | statique | 0 | tir toutes les 1,5 s sur la cible la plus proche dans un **carré de 2 cases tout autour d'elle** (devant, derrière, côtés), **jamais dans le camp adverse** ; détruite au contact d'un Riko |
| 4 Riko (rouge) | 40 | 3 | diagonale, rebonds latéraux, ligne du fond uniquement | 2 | tue Tourelle et Chargeur au contact (−1 PV à elle-même) ; **rebondit sur un Mur** (seul Og sur lequel il rebondit, le mur perd 1 PV à chaque rebond) ; destruction mutuelle avec Défenseur / Éponge ; projectiles : −1 PV |
| 5 Mur (bleu) | 50 | 3 | statique | 0 | bloque la case ; renvoie les Runners ennemis ; laisse passer sa propre équipe |
| 6 Chargeur (vert) | 60 | 3 | statique | 0 | +50 % regen mana (cumulable) ; one-shot par Éponge ; −1 PV par Runner ; cible des Ailées |
| 7 Zéphir (orange/noir) | 70 | 2 | aérien tout droit, ligne du fond uniquement | 5 | ignore sol et murs ; tir 0,8 s, 1 case, sur 1 / 3 / 6 / 7, jamais côté adverse (comme Krak : un ennemi devient ciblable dès qu'il franchit la ligne médiane) ; abattue par Tourelles et Ailées |

Scorpion noir : **désactivé** (option `hazard` de `createGame`, conservée pour un éventuel mode « chaos »). Durées : classée 3 min ; entraînement/amical 2, 3, 5 min ou illimité (`RULES.durations`).

Récompenses : voir `shared/catalog.js` (`matchRewards`, `RANKS`, `xpForLevel`).
