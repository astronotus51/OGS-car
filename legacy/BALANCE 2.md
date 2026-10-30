OGS – Notes de balance (influences croisées)
============================================

Référence rapide pour ajuster les stats/effets en gardant la lisibilité des contre-interactions. Chaque Og est listé avec ce qu’il subit et ce qu’il provoque sur les autres.

1) Og Runner (Jaune)
- Inflige 1 dégât à la base adverse s’il atteint le bord.
- Rebonds sur les Murs bleus (reste en vie, repart).
- Meurt instantanément au contact des Défenseurs violets, Éponges rouges et Chargeurs verts ennemis.
- Enlève 1 PV aux Chargeurs verts adverses (3 PV au total) ; détruit le Chargeur au 3e contact, le Runner meurt aussi sur le coup fatal.
- Aucun impact sur Tourelles; pris pour cible par Tourelles ailées. 
- passe au dessus des murs mais uniquement les mur de sa propre team

2) Og Défenseur (Violet)
- Tue les Runners jaunes adverses au contact.
- Rebonds horizontaux et rebonds contre Murs / Tourelles / Chargeurs (sans dégâts infligés).
- Élimine et est éliminé par Éponge rouge sur contact (mutuelle destruction).
- N’inflige pas de dégâts de base en fin de lane (sert surtout d’anti-runner mobile).

3) Og Tourelle (Orange, sol)
- Statique, 2 PV, tir vers l’avant uniquement, portée 1 case, cadence 1,5 s.
- Est détruite au contact par Éponge rouge (l’éponge rebondit).
- Est ciblée et peut être détruite par Tourelle ailée (projectiles).
- Encas­se 3 projectiles standards avant destruction (sauf contact d’Éponge rouge).

4) Og Éponge (Rouge)
- Mouvement diagonal rebond, 3 PV contre projectiles.
- Détruit Tourelles oranges en 1 coup au  contact; continue son chemin après impact.met le rouge perd 1 Pv a chaque destruction
- Tue Chargeurs verts en un coup. continue son chemin après impact. le rouge perd 1 Pv a chaque destruction
- casse un mur bleu mais meurre direct. 
- Se détruit mutuellement avec Défenseurs violets ou autres Éponges rouges.
- Inflige 2 dégâts à la base en bout de ligne si elle survit.

5) Og Mur (Bleu)
-pv 3
- Statique, bloque le placement sur sa case.
- Fait rebondir les Runners jaunes perd 1 PV.
- Sert d’obstacle pour les Défenseurs 3.
- laisse passer tout les ogs de sa propre team

6) Og Chargeur (Vert)
- Statique, 3 PV. Boost de mana : +50 % regen tant qu’il est en vie, cumulatif par Chargeur.
- Pris pour cible par Tourelle ailée (projectiles).
- Tué instantanément par Éponge rouge; Runners jaunes retirent 1 PV par contact (rebond du Runner si PV restants).
- Rebonds des Défenseurs (pas de dégâts subis de leur part).

7) Og Tourelle ailée (Orange/Noir, aérien)
- Statique, 2 PV, tir vers l’avant uniquement, portée 1 case, cadence 1,5 s.
- Aérienne, avance tout droit, inflige 5 dégâts en base.
- Tire vers l’avant uniquement, portée 1 cases, cible seulement Ogs 1/3/6/7 adverses.
- Ignore les Murs et unités au sol pour son déplacement.

Hazard : Bloc noir
- Tue toute unité sur sa trajectoire, bloque les placements tant qu’actif, inflige 0 dégâts au joueur touché en sortie.
- stop le ogs noir sur une varabiable alétoire (pas forcement au milieu) pour créer plus de surprise

Rappels généraux
- Base : 30 PV. Mana max 70, regen 2 mana/s + bonus Chargeurs.
- Coût mana = og.cost × 10 (Runner 10, Défenseur 20, …, Ailée 70).
