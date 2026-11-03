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

## Les 30 créatures suivantes (ids 18 à 47, nov. 2026)

Toutes reposent sur des mécaniques génériques de `shared/sim.js` (`extraCreatures`) : tourelle paramétrable (`turretCfg` : portée, cadence, cibles sol/air, impulsion de zone), pondeuse (`spawner`), aura (`aura` : ralentir, accélérer, geler, électriser), soin périodique (`healEvery`), kamikaze, casseuse de structures (`hunter`), carapace (`armor`), croissance (`grow`), rejetons à la mort (`onDeath`), pose multiple (`spawnCount`), vol de mana (`manaOnBase`), furtivité (`stealth`), révélation (`reveal`), bombardière (`wallBreaker`), gel au contact (`freezeOnHit`), soin par victime (`healOnKill`).

| Créature | Coût | PV | Déplacement | Dégât base | Rareté | Pouvoir |
|---|---|---|---|---|---|---|
| Puce | 10 | 1 | sol ×3.2 | 1 | commune | Runner qui se pose n’importe où sur ta moitié, même au front. 1 PV, 1 dégât. |
| Jumeaux | 20 | 1 ×2 | sol ×2.8 | 1 | rare | Deux petits runners d’un coup (1 PV, 1 dégât chacun), un peu lents : parfaits pour stopper des runners adverses. |
| Étincelle | 10 | 1 | aérien ×4 | 1 | commune | Volante rapide qui explose sur le premier ennemi (sol ou air) à 1 case : 2 dégâts autour. Sinon 1 dégât à la base. |
| Taupe | 10 | 2 | sol ×2 | 1 | rare | Runner à 2 PV, invisible pour l’adversaire tant qu’elle est dans ton camp. |
| Canonnier | 20 | 1 | patrouille | 0 | rare | Patrouille sa ligne 45 s comme Gromp mais tire sur le sol (1 case, 3,5 s) au lieu de mordre. 1 PV. |
| Nid | 20 | 1 | structure (30 s) | 0 | epique | Structure (30 s) qui pond un Zip toutes les 10 s. |
| Pétard | 20 | 2 | sol ×3 | 2 | commune | Runner rapide à 2 PV qui explose sur le premier ennemi (sol ou air) : 4 dégâts autour (1,2 case). Sinon 2 dégâts à la base. |
| Lutin | 20 | 2 | sol ×3.2 | 1 | rare | Runner rapide à 2 PV : en atteignant la base adverse, il te rend 20 mana en plus de son dégât. |
| Flak | 20 | 2 | structure (50 s) | 0 | commune | Tourelle (50 s) qui ne tire que sur les volants, vite (1 s) et loin (3 cases) dans ton camp. |
| Nuage | 30 | 2 | structure (60 s) | 0 | commune | Brume (60 s, 2 cases) : les ennemis qui la traversent avancent à 40 % ; les volants y prennent 1 dégât toutes les 2 s. |
| Givre | 30 | 3 | sol ×1.5 | 2 | rare | Brute à 3 PV, 2 dégâts : gèle 1,5 s chaque ennemi au sol qu’elle touche. |
| Pioche | 30 | 4 | sol ×2.5 | 2 | epique | Passe entre les unités et casse toute structure ennemie qu’elle touche (−1 PV pour elle). 4 PV, 2 dégâts. |
| Source | 30 | 3 | structure (60 s) | 0 | rare | Structure (60 s) qui soigne ta base de 1 PV toutes les 15 s. |
| Boule | 40 | 2 | sol ×1.2 | 3 | rare | Roule lentement et grossit : +1 PV toutes les 4 s (jusqu’à 7). 3 dégâts. |
| Ballon | 40 | 2 | structure volante (50 s) | 0 | epique | Structure volante (50 s) : toutes les 2 s, 1 dégât à tous les ennemis au sol à 1,5 case. Seuls les tirs anti-aériens l’atteignent. |
| Vampire | 40 | 3 | sol ×2 | 2 | rare | Brute à 3 PV, 2 dégâts : chaque unité qu’il tue soigne ta base de 1. |
| Scarabée | 40 | 4 | sol ×1.4 | 3 | rare | Runner à 4 PV, 3 dégâts, carapace : un projectile sur deux ricoche. |
| Mortier | 50 | 3 | structure (50 s) | 0 | epique | Structure (50 s) : toutes les 3,5 s, 2 dégâts à tous les ennemis au sol à 3 cases dans ton camp. |
| Hydre | 50 | 3 | sol ×1.5 | 2 | epique | Runner à 3 PV, 2 dégâts : à sa mort, deux Zip sortent de son corps et continuent. |
| Phare | 50 | 3 | structure (45 s) | 0 | rare | Zone (45 s) : tes créatures à 1,5 case avancent 1,3× plus vite. |
| Gel | 50 | 3 | structure (75 s) | 0 | epique | Zone (75 s) : toutes les 5 s, gèle 3,5 s les ennemis au sol à 2 cases. |
| Dynamite | 50 | 2 | aérien ×2 | 2 | rare | Volante à 2 PV : explose sur la première structure ennemie survolée (3 dégâts à 1 case). Sinon 2 dégâts à la base. |
| Oracle | 60 | 5 | structure (70 s) | 0 | epique | Tourelle (70 s, 5 PV) qui révèle mines, fantômes et taupes à 3 cases, et tire loin (3 cases, sol et air, 1,2 s). |
| Golem | 60 | 6 | sol ×1 | 4 | epique | Brute à 6 PV, 4 dégâts, écrase les murs. À sa mort, deux Pik en sortent. |
| Phénix | 60 | 4 | aérien ×2 | 4 | legendaire | Volant à 4 PV, 4 dégâts. À sa mort, il renaît en deux Zazou. |
| Totem | 60 | 3 | structure (60 s) | 0 | epique | Structure (60 s) qui invoque un Gromp toutes les 12 s. |
| Léviathan | 70 | 8 | aérien ×1.2 | 6 | legendaire | Volant à 8 PV, 6 dégâts : toutes les 2 s, 1 dégât aux ennemis au sol sous lui. |
| Titan | 70 | 10 | sol ×0.9 | 6 | legendaire | Brute à 10 PV, 6 dégâts, écrase les murs. Très lent, mais rien ne l’arrête. |
| Essaim | 70 | 1 ×6 | aérien ×4 | 1 | epique | Six moustiques volants d’un coup (1 PV, 1 dégât chacun). |
| Reine | 70 | 5 | structure (60 s) | 0 | legendaire | Structure à 5 PV (60 s) qui pond un Pik toutes les 5 s. |

Krak passe à 2,5 s de cadence et 45 s de vie (il restait la meilleure structure à 30 face aux nouvelles). Glu : 2 cases, 60 s. Sirène : toutes les 4,5 s. Pik ×1,9. Bulle soigne 2.

### Taux de victoire mesurés (1000 parties, équipes au hasard parmi les 47, IA difficile des deux côtés)

Tout le monde entre 36 et 60 % : Zip 45, Gromp 59, Krak 56, Riko 48, Blok 53, Mojo 57, Zéphir 49, Pik 47, Bulle 49, Zazou 50, Boum 48, Rafale 45, Tiktak 56, Fantôme 46, Glu 50, Sirène 39, Kraken 58, Puce 53, Jumeaux 46, Étincelle 58, Taupe 48, Canonnier 47, Nid 56, Pétard 40, Lutin 52, Flak 48, Nuage 48, Givre 50, Pioche 48, Source 55, Boule 47, Ballon 47, Vampire 51, Scarabée 55, Mortier 48, Hydre 54, Phare 52, Gel 37, Dynamite 55, Oracle 43, Golem 52, Phénix 49, Totem 58, Léviathan 45, Titan 50, Essaim 52, Reine 45. Gel et Sirène sont des cartes de combinaison (il faut des tireurs à côté) que l'IA exploite mal : leurs chiffres sont sous-estimés.

### Équipes conseillées (`RECOMMENDED_DECKS`, `scripts/ai-decks.js`)

| Équipe | vs équipes au hasard | tournoi (toutes contre toutes) |
|---|---|---|
| Gros bras (Pik, Gromp, Givre, Vampire, Phare, Golem, Titan) | 76 % | 82 % |
| Classique (les 7 de base) | 63 % | 62 % |
| Brise-tours (Zip, Pétard, Pioche, Riko, Dynamite, Golem, Titan) | 64 % | 58 % |
| Feu d'artifice (Étincelle, Pétard, Boum, Tiktak, Dynamite, Phénix, Essaim) | 68 % | 52 % |
| Tireurs (Zip, Canonnier, Krak, Ballon, Mortier, Oracle, Zéphir) | 60 % | 57 % |
| Ciel ouvert (Bulle, Zazou, Krak, Riko, Dynamite, Phénix, Léviathan) | 63 % | 50 % |
| Forteresse (Pik, Flak, Boum, Ballon, Mortier, Oracle, Kraken) | 60 % | 50 % |
| Raz-de-marée (Puce, Jumeaux, Krak, Scarabée, Hydre, Totem, Reine) | 55 % | 50 % |
| Grand froid (Pik, Gromp, Nuage, Givre, Gel, Oracle, Kraken) | 48 % | 49 % |
| Fourberie (Taupe, Lutin, Boum, Fantôme, Glu, Sirène, Zéphir) | 49 % | 32 % |
| Économie (Zip, Lutin, Source, Scarabée, Mortier, Mojo, Léviathan) | 48 % | 27 % |
| Nuée (Puce, Nid, Rafale, Boule, Hydre, Totem, Essaim) | 44 % | 29 % |

Les brutes au contact (Givre, Vampire, Golem, Titan) poussées par un Phare restent l'archétype le plus fort entre IA ; à surveiller avec de vrais joueurs (Titan a perdu sa carapace, Golem un PV, le Phare ne donne plus que ×1,3 sur 1,5 case).
