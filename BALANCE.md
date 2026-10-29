# OGS Online – équilibrage en vigueur

Valeurs dans `shared/sim.js` (`RULES`, `OGS`). Base 30 PV, mana max 70, +2/s (+50 % par Chargeur vivant), orbe +10, partie 3 min.

| Og | Coût | PV | Déplacement | Base | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Runner (jaune) | 10 | 1 | tout droit, posable partout sur sa moitié | 1 | meurt sur Défenseur / Éponge / Tourelle / Chargeur ennemis (−1 PV à Tourelle, Chargeur, Éponge) ; rebondit sur Mur ennemi (−1 PV au mur) **et change de camp** ; traverse ses propres murs ; deux Runners adverses s'annulent |
| 2 Défenseur (violet) | 20 | 1 | horizontal, rebonds | 0 | mange les Runners ennemis ; rebondit sur Tourelles / Murs / Chargeurs (toutes équipes) ; destruction mutuelle avec Éponge |
| 3 Tourelle (orange) | 30 | 2 | statique | 0 | tir vers l'avant, 1 case, 1,5 s ; dans sa moitié, ou sur 1/4/7 de l'autre côté ; détruite au contact d'une Éponge |
| 4 Éponge (rouge) | 40 | 3 | diagonale, rebonds latéraux, ligne avant | 2 | tue Tourelle et Chargeur au contact (−1 PV à elle-même) ; casse un Mur mais meurt ; destruction mutuelle avec Défenseur / Éponge ; projectiles : −1 PV |
| 5 Mur (bleu) | 50 | 3 | statique | 0 | bloque la case ; renvoie les Runners ennemis ; laisse passer sa propre équipe |
| 6 Chargeur (vert) | 60 | 3 | statique | 0 | +50 % regen mana (cumulable) ; one-shot par Éponge ; −1 PV par Runner ; cible des Ailées |
| 7 Ailée (orange/noir) | 70 | 2 | aérien tout droit, ligne avant | 5 | ignore sol et murs ; tir 0,8 s, 1 case, sur 1 / 3 / 6 / 7 ; abattue par Tourelles et Ailées |

Scorpion noir : **désactivé** (option `hazard` de `createGame`, conservée pour un éventuel mode « chaos »). Durées : classée 3 min ; entraînement/amical 2, 3, 5 min ou illimité (`RULES.durations`).

Récompenses : voir `shared/catalog.js` (`matchRewards`, `RANKS`, `xpForLevel`).
