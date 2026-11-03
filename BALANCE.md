# OGS Online – équilibrage en vigueur

Valeurs dans `shared/sim.js` (`RULES`, `OGS`). Base 30 PV, mana max 70, +2/s (+50 % par Chargeur vivant), orbe +10, partie 3 min.

| Og | Coût | PV | Déplacement | Base | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 Zip (jaune) | 10 | 1 | tout droit (×3,5), ligne du fond uniquement | 1 | meurt sur Défenseur / Éponge / Tourelle / Chargeur ennemis (−1 PV à Tourelle, Chargeur, Éponge) ; rebondit sur Mur ennemi (−1 PV au mur) **et change de camp** ; traverse ses propres murs ; deux Runners adverses s'annulent |
| 2 Défenseur (violet) | 20 | 1 | horizontal, rebonds | 0 | mange les Runners ennemis ; rebondit sur Tourelles / Murs / Chargeurs (toutes équipes) ; destruction mutuelle avec Éponge |
| 3 Krak (orange) | 30 | 2 | statique, **vit 60 s** | 0 | tir toutes les 2,2 s sur la cible la plus proche dans un **carré de 2 cases tout autour d'elle** (devant, derrière, côtés), **jamais dans le camp adverse** ; détruite au contact d'un Riko, écrasée par Kraken |
| 4 Riko (rouge) | 40 | 5 | diagonale, rebonds latéraux, ligne du fond uniquement | 3 | tue Tourelle et Chargeur au contact (−1 PV à elle-même) ; **rebondit sur tout Mur, le sien compris** (un mur ennemi perd 1 PV) ; **devient ennemi** s'il repasse la frontière à contresens ; destruction mutuelle avec Défenseur / Éponge ; projectiles : −1 PV |
| 5 Mur (bleu) | 50 | 5 | statique, **vit 45 s** | 0 | bloque la case ; renvoie les Runners, Riko et Tiktak (les siens compris) ; un runner ennemi renvoyé change de camp à la frontière |
| 6 Chargeur (vert) | 60 | 3 | statique, **vit 90 s** | 0 | +50 % regen mana (cumulable) ; one-shot par Éponge ; −1 PV par Runner ; cible des Ailées |
| 7 Zéphir (orange/noir) | 70 | 6 | aérien tout droit (×2,2), ligne du fond uniquement | 6 | ignore sol et murs ; tir 0,8 s, 1 case, sur 1 / 3 / 6 / 7, jamais côté adverse (comme Krak : un ennemi devient ciblable dès qu'il franchit la ligne médiane) ; abattue par Tourelles et Ailées |

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
| Pik (hérisson) | 10 | 2 | droit (×2,1) | 1 | encaisse un choc (0,5 s d'invulnérabilité + recul) puis continue ; runner contre runner = destruction mutuelle |
| Bulle | 10 | 2 | aérien (×2,2) | 0 | atteindre la base adverse soigne ta base de 1 |
| Zazou (moustique) | 20 | 2 | aérien, ultra rapide (×5,5) | 2 | ignore sol et murs ; abattu par Krak, Rafale, Boum, Zéphir |
| Boum (mine) | 30 | 2 charges | statique, invisible pour l'adversaire, vit 60 s | 0 | saute au passage d'un ennemi (sol ou air, 1,1 case) : 2 dégâts dans 1,5 case (volants compris) ; réarmement 4 s ; chaque explosion coûte 1 PV |
| Rafale (ventilo) | 30 | 2 | statique, vit 60 s | 0 | toutes les 1,5 s, souffle les ennemis (sol et air) dans les 3 cases devant, **dans son camp** : recul ¾ case (½ pour les volants, aucun pour les brutes) + 1 dégât ; un même ennemi n'est soufflé qu'une fois par 1,5 s (plusieurs Rafales ne se cumulent pas) |
| Tiktak (bombe) | 40 | 4 | droit (×1,5) | 4 | frappe les ennemis au sol touchés ; explose à sa mort (1 dégât autour) ; rebondit sur les murs ; insensible au recul |
| Fantôme | 40 | 4 | droit (×2,5) | 3 | invisible dans son camp ; traverse murs et unités ; seuls projectiles, vent, mines et Riko le touchent |
| Glu | 50 | 3 | statique, traversable, vit 45 s | 0 | flaque de 1,5 case : les ennemis au sol y avancent à 40 % de leur vitesse |
| Sirène | 60 | 2 | statique, vit 50 s | 0 | toutes les 6 s, l'ennemi au sol le plus proche (2,5 cases, pas les brutes) change de camp |
| Kraken | 70 | 8 | droit (×1,3) | 5 | écrase murs et tourelles, tue toute unité au sol touchée (−1 PV par choc) ; survit à une tourelle seule |

Toutes obéissent aux règles communes : changement de camp à la frontière, rebond sur ses propres Blok (runners), Krak tire sur toute créature ennemie dans sa zone.

## Structures éphémères (option `lifetime`, active en classée)

Krak 60 s, Rafale 60 s, Boum 60 s, Sirène 50 s, Blok 45 s, Glu 45 s, Mojo 90 s. Faire évoluer une structure relance sa durée. Sans cette règle, deux ou trois tourelles verrouillaient définitivement un camp et les parties finissaient 29–28 : la défense doit se payer comme l'attaque.

## Comment l'équilibrage a été mesuré (nov. 2026)

`node scripts/ai-arena.js --games 600 --a difficile --b difficile --balance` fait jouer l'IA v2 contre elle-même avec des équipes tirées au hasard (camps alternés) et donne, pour chaque créature, le taux de victoire des parties où **un seul** camp l'a dans son équipe. `--deckA 1,2,3,4,5,6,7 --deckB 1,2,12,4,5,6,7` compare deux équipes fixes (ici : Rafale à la place de Krak), `--set og10.hp=3` ou `--set orangeCooldown=2.5` essaie un réglage sans toucher au code, `--fates` liste de quoi meurt chaque créature.

Avant équilibrage : Krak gagnait **98 %** des parties où un seul camp l'avait, Boum 22 %, Rafale 33 %, Bulle 30 %, Zazou 45 %, Zéphir 42 %, Kraken et Zéphir n'étaient quasiment jamais rentables. Après (600 parties) : toutes les créatures entre **40 et 57 %** (Zip 53, Gromp 56, Krak 51, Riko 57, Blok 49, Mojo 54, Zéphir 47, Pik 56, Bulle 41, Zazou 44, Boum 57, Rafale 41, Tiktak 40, Fantôme 53, Glu 51, Sirène 46, Kraken 53).

Changements principaux : Krak tire moins vite (2,2 s) et vit 60 s ; les gros (Zéphir, Kraken, Tiktak, Fantôme, Riko) ont plus de PV et de dégâts pour survivre à une tourelle seule ; Rafale blesse et touche les volants ; Boum a 2 charges, un rayon de déclenchement de 1 case et saute aussi sur les volants ; Pik plus rapide mais runner contre runner = destruction mutuelle ; Zazou 2 PV / 2 dégâts, ultra rapide ; Glu plus large et plus collante ; Sirène plus fréquente.
