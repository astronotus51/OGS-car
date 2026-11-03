/*
 * Catalogue partagé : créatures, skins (thèmes dessinés en vectoriel par public/js/creatures.js),
 * ligues (trophées), niveaux (XP), récompenses.
 * Pour ajouter un skin : une entrée dans SKINS avec un `theme` géré par creatures.js (ou un nouveau thème à y dessiner).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OGSCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OG_NAMES = { 1: 'Zip', 2: 'Gromp', 3: 'Krak', 4: 'Riko', 5: 'Blok', 6: 'Mojo', 7: 'Zéphir', 8: 'Pik', 9: 'Bulle', 10: 'Zazou', 11: 'Boum', 12: 'Rafale', 13: 'Tiktak', 14: 'Fantôme', 15: 'Glu', 16: 'Sirène', 17: 'Kraken', 18: 'Puce', 19: 'Jumeaux', 20: 'Étincelle', 21: 'Taupe', 22: 'Canonnier', 23: 'Nid', 24: 'Pétard', 25: 'Lutin', 26: 'Flak', 27: 'Nuage', 28: 'Givre', 29: 'Pioche', 30: 'Source', 31: 'Boule', 32: 'Ballon', 33: 'Vampire', 34: 'Scarabée', 35: 'Mortier', 36: 'Hydre', 37: 'Phare', 38: 'Gel', 39: 'Dynamite', 40: 'Oracle', 41: 'Golem', 42: 'Phénix', 43: 'Totem', 44: 'Léviathan', 45: 'Titan', 46: 'Essaim', 47: 'Reine' };
  const OG_ROLES = { 1: 'Runner', 2: 'Défenseur', 3: 'Tourelle', 4: 'Étoile rebondissante', 5: 'Mur', 6: 'Chargeur de mana', 7: 'Dragonnet volant', 8: 'Hérisson à ressort', 9: 'Bulle de soin', 10: 'Moustique', 11: 'Mine', 12: 'Ventilo', 13: 'Bombe à retardement', 14: 'Spectre', 15: 'Flaque gluante', 16: 'Charmeuse', 17: 'Colosse', 18: 'Sauteuse', 19: 'Duo de runners', 20: 'Kamikaze volante', 21: 'Fouisseuse', 22: 'Patrouilleur armé', 23: 'Pondeuse', 24: 'Kamikaze', 25: 'Pickpocket', 26: 'Anti-aérien', 27: 'Brume collante', 28: 'Brute glacée', 29: 'Casseuse de structures', 30: 'Fontaine', 31: 'Boule de neige', 32: 'Bombardier fixe', 33: 'Brute vorace', 34: 'Cuirassé', 35: 'Artillerie', 36: 'Têtes multiples', 37: 'Balise', 38: 'Piège glacé', 39: 'Bombardière', 40: 'Œil', 41: 'Brute de pierre', 42: 'Oiseau de feu', 43: 'Totem gardien', 44: 'Monstre volant', 45: 'Cuirassé colossal', 46: 'Nuée', 47: 'Pondeuse royale' };
  const OG_LORE = {
    1: 'Petite boule d’énergie qui ne sait faire qu’une chose : foncer. Tout droit. Toujours.',
    2: 'Grincheux à griffes qui patrouille sa ligne et croque tout Zip qui passe.',
    3: 'Marmite à canon. Vise, grogne, tire. Ne bouge jamais, par principe.',
    4: 'Étoile qui rebondit sur les murs en riant. Casse ce qu’elle touche, puis se fait mal.',
    5: 'Bloc têtu avec des dents. Ne parle pas, ne bouge pas, encaisse.',
    6: 'Trèfle à quatre branches qui ronronne de mana. Fragile, mais précieux.',
    7: 'Dragonnet rondouillard qui vole au-dessus de tout et crache des boules de feu.',
    8: 'Boule de piquants sur ressort. Pas rapide, mais il en faut deux pour l’arrêter.',
    9: 'Bulle rêveuse qui flotte jusqu’à l’autre bout et soigne ta base en éclatant.',
    10: 'Moustique insupportable : trop rapide, trop petit, pique la base et s’en va.',
    11: 'Mine boudeuse enfouie dans le sable. Clignote. Attend. Boum.',
    12: 'Ventilateur grincheux qui souffle tout ce qui s’approche vers l’arrière.',
    13: 'Bombe pressée avec un réveil dans le ventre. Compte à rebours ambulant.',
    14: 'Drap qui hante son propre camp, invisible, et passe au travers des murs.',
    15: 'Flaque de bave verte. Tout ce qui marche dedans y reste collé un moment.',
    16: 'Chanteuse des abysses : qui l’entend change de camp.',
    17: 'Le seigneur des profondeurs. Lent, immense, et il n’aime pas les murs.',
    18: 'Puce de sable qui bondit si loin qu’elle atterrit n’importe où.',
    19: 'Deux frères qui ne font jamais rien l’un sans l’autre. Même courir.',
    20: 'Petite flamme pressée. Elle ne vit qu’une seconde, mais quelle seconde.',
    21: 'Creuse sous le sable et ne sort le nez qu’une fois chez l’ennemi.',
    22: 'Gromp qui a trouvé un canon. Il patrouille, mais de loin.',
    23: 'Nid tressé de coquillages. Ça couine, ça éclôt, ça court.',
    24: 'Crapaud rouge bourré de poudre. Ne pas secouer.',
    25: 'Petit voleur vert : il court, il pique la caisse, il revient fêter ça.',
    26: 'Oursin monté sur ressort qui crache des piquants sur tout ce qui vole.',
    27: 'Nuage boudeur et collant. Les volants y restent empêtrés.',
    28: 'Bonhomme de givre : tout ce qu’il touche claque des dents.',
    29: 'Pioche vivante qui ne voit que les murs et les tours. Les autres, elle passe.',
    30: 'Source chaude des abysses. Elle chante, et ta base respire.',
    31: 'Boule de neige des profondeurs : plus elle roule, plus elle est grosse.',
    32: 'Ballon de baudruche armé. Il reste là, et il lâche des trucs.',
    33: 'Chauve-souris des abysses. Chaque proie lui rend des couleurs… à ta base.',
    34: 'Scarabée cuirassé : la moitié des tirs glissent sur sa carapace.',
    35: 'Vieux canon rouillé qui tousse des boulets sur tout le camp.',
    36: 'Coupe une tête, deux repoussent. Et elles courent.',
    37: 'Phare des abysses : sa lumière donne des ailes aux pieds.',
    38: 'Cristal qui respire du froid. Autour de lui, tout s’immobilise.',
    39: 'Oiseau avec un bâton de dynamite dans le bec. Il vise les tours.',
    40: 'Œil ancien qui voit ce qui se cache, et qui le vise.',
    41: 'Rocher qui marche. Quand il tombe, des cailloux en sortent.',
    42: 'Oiseau de feu : il meurt en braises, et les braises s’envolent.',
    43: 'Totem sculpté qui appelle des gardiens à la rescousse.',
    44: 'Serpent de mer volant. Son ombre seule fait des dégâts.',
    45: 'Statue de guerre réveillée. Rien ne l’arrête, rien ne le presse.',
    46: 'Nuée de moustiques en colère. Bonne chance.',
    47: 'La reine des hérissons. Elle règne, et elle pond.',
  };

  // ----- Collection de créatures (façon Clash Royale) -----
  // Les 7 de base sont acquises. Les suivantes arrivent par capsules et route des trophées (`playable:false` servirait à en annoncer une avant sa sortie).
  const RARITIES = {
    commune: { name: 'Commune', color: '#8fb7c9', weight: 70, copiesPerStar: 2 },
    rare: { name: 'Rare', color: '#22e3c8', weight: 22, copiesPerStar: 2 },
    epique: { name: 'Épique', color: '#c084fc', weight: 7, copiesPerStar: 1 },
    legendaire: { name: 'Légendaire', color: '#ffc14d', weight: 1, copiesPerStar: 1 },
  };
  const CREATURES = [
    { id: 1, name: 'Zip', role: 'Runner', cost: 10, rarity: 'commune', kind: 'attaque', base: true, playable: true, power: 'Fonce tout droit vers la base ennemie. Rebondit sur les murs.' },
    { id: 2, name: 'Gromp', role: 'Défenseur', cost: 20, rarity: 'commune', kind: 'défense', base: true, playable: true, power: 'Patrouille sa ligne et croque les Runners adverses.' },
    { id: 3, name: 'Krak', role: 'Tourelle', cost: 30, rarity: 'rare', kind: 'défense', base: true, playable: true, power: 'Tire (2,5 s) sur tout ennemi dans un carré de 2 cases autour de lui, dans ton camp. 45 s.' },
    { id: 4, name: 'Riko', role: 'Étoile rebondissante', cost: 40, rarity: 'rare', kind: 'attaque', base: true, playable: true, power: 'Avance en diagonale, détruit tourelles et chargeurs, rebondit sur les murs. 5 PV, 3 dégâts.' },
    { id: 5, name: 'Blok', role: 'Mur', cost: 50, rarity: 'commune', kind: 'défense', base: true, playable: true, power: 'Bloque et renvoie les créatures qui avancent (un runner ennemi renvoyé change de camp). 5 PV, 45 s.' },
    { id: 6, name: 'Mojo', role: 'Chargeur de mana', cost: 60, rarity: 'rare', kind: 'soutien', base: true, playable: true, power: '+50 % de régénération de mana pour toute ton équipe pendant 90 s.' },
    { id: 7, name: 'Zéphir', role: 'Dragonnet volant', cost: 70, rarity: 'epique', kind: 'attaque', base: true, playable: true, power: 'Vole au-dessus de tout, tire à 1 case, 6 dégâts à la base, 6 PV.' },
    // --- 10 nouveaux types (pouvoirs inédits), jouables à la prochaine mise à jour ---
    { id: 8, name: 'Pik', role: 'Hérisson à ressort', cost: 10, rarity: 'commune', kind: 'attaque', playable: true, power: 'Runner lent mais à 2 PV : il encaisse un coup et continue.' },
    { id: 9, name: 'Bulle', role: 'Bulle de soin', cost: 10, rarity: 'rare', kind: 'soutien', playable: true, power: 'Flotte au-dessus de tout, 1 PV. Si elle atteint la base ennemie, ta base récupère 2 PV.' },
    { id: 10, name: 'Zazou', role: 'Moustique', cost: 20, rarity: 'commune', kind: 'attaque', playable: true, power: 'Minuscule volant ultra rapide, 2 PV : ignore les unités au sol, 2 dégâts à la base.' },
    { id: 11, name: 'Boum', role: 'Mine', cost: 30, rarity: 'rare', kind: 'défense', playable: true, power: 'Mine invisible (60 s) : saute au passage d’un ennemi, sol ou air, 2 dégâts à 1,5 case. 2 charges.' },
    { id: 12, name: 'Rafale', role: 'Ventilo', cost: 30, rarity: 'epique', kind: 'défense', playable: true, power: 'Tourelle à vent (60 s) : toutes les 1,5 s, souffle et blesse les ennemis (sol et air) dans les 3 cases devant elle.' },
    { id: 13, name: 'Tiktak', role: 'Bombe à retardement', cost: 40, rarity: 'rare', kind: 'attaque', playable: true, power: 'Brute lente, 4 PV. Explose à l’arrivée (4 dégâts) ou à sa mort (1 dégât autour).' },
    { id: 14, name: 'Fantôme', role: 'Spectre', cost: 40, rarity: 'epique', kind: 'attaque', playable: true, power: 'Invisible tant qu’il est dans ton camp, traverse murs et unités. 4 PV, 3 dégâts.' },
    { id: 15, name: 'Glu', role: 'Flaque gluante', cost: 50, rarity: 'commune', kind: 'défense', playable: true, power: 'Flaque (60 s, 2 cases) : les ennemis au sol qui la traversent avancent à 40 % de leur vitesse.' },
    { id: 16, name: 'Sirène', role: 'Charmeuse', cost: 60, rarity: 'legendaire', kind: 'défense', playable: true, power: 'Toutes les 4,5 s, charme l’ennemi au sol le plus proche (2,5 cases) : il change de camp. 50 s.' },
    { id: 17, name: 'Kraken', role: 'Colosse', cost: 70, rarity: 'legendaire', kind: 'attaque', playable: true, power: 'Lent, 8 PV, 5 dégâts. Écrase les murs et les tourelles en passant (−1 PV pour lui).' },
    // --- 30 créatures de plus (ids 18 à 47) ---
    { id: 18, name: 'Puce', role: 'Sauteuse', cost: 10, rarity: 'commune', playable: true, kind: 'attaque', power: 'Runner qui se pose n’importe où sur ta moitié, même au front. 1 PV, 1 dégât.' },
    { id: 19, name: 'Jumeaux', role: 'Duo de runners', cost: 20, rarity: 'rare', playable: true, kind: 'attaque', power: 'Deux petits runners d’un coup (1 PV, 1 dégât chacun), un peu lents : parfaits pour stopper des runners adverses.' },
    { id: 20, name: 'Étincelle', role: 'Kamikaze volante', cost: 10, rarity: 'commune', playable: true, kind: 'attaque', power: 'Volante rapide qui explose sur le premier ennemi (sol ou air) à 1 case : 2 dégâts autour. Sinon 1 dégât à la base.' },
    { id: 21, name: 'Taupe', role: 'Fouisseuse', cost: 10, rarity: 'rare', playable: true, kind: 'attaque', power: 'Runner à 2 PV, invisible pour l’adversaire tant qu’elle est dans ton camp.' },
    { id: 22, name: 'Canonnier', role: 'Patrouilleur armé', cost: 20, rarity: 'rare', playable: true, kind: 'défense', power: 'Patrouille sa ligne 45 s comme Gromp mais tire sur le sol (1 case, 3,5 s) au lieu de mordre. 1 PV.' },
    { id: 23, name: 'Nid', role: 'Pondeuse', cost: 20, rarity: 'epique', playable: true, kind: 'attaque', power: 'Structure (30 s) qui pond un Zip toutes les 10 s.' },
    { id: 24, name: 'Pétard', role: 'Kamikaze', cost: 20, rarity: 'commune', playable: true, kind: 'attaque', power: 'Runner rapide à 2 PV qui explose sur le premier ennemi (sol ou air) : 4 dégâts autour (1,2 case). Sinon 2 dégâts à la base.' },
    { id: 25, name: 'Lutin', role: 'Pickpocket', cost: 20, rarity: 'rare', playable: true, kind: 'attaque', power: 'Runner rapide à 2 PV : en atteignant la base adverse, il te rend 20 mana en plus de son dégât.' },
    { id: 26, name: 'Flak', role: 'Anti-aérien', cost: 20, rarity: 'commune', playable: true, kind: 'défense', power: 'Tourelle (50 s) qui ne tire que sur les volants, vite (1 s) et loin (3 cases) dans ton camp.' },
    { id: 27, name: 'Nuage', role: 'Brume collante', cost: 30, rarity: 'commune', playable: true, kind: 'défense', power: 'Brume (60 s, 2 cases) : les ennemis qui la traversent avancent à 40 % ; les volants y prennent 1 dégât toutes les 2 s.' },
    { id: 28, name: 'Givre', role: 'Brute glacée', cost: 30, rarity: 'rare', playable: true, kind: 'attaque', power: 'Brute à 3 PV, 2 dégâts : gèle 1,5 s chaque ennemi au sol qu’elle touche.' },
    { id: 29, name: 'Pioche', role: 'Casseuse de structures', cost: 30, rarity: 'epique', playable: true, kind: 'attaque', power: 'Passe entre les unités et casse toute structure ennemie qu’elle touche (−1 PV pour elle). 4 PV, 2 dégâts.' },
    { id: 30, name: 'Source', role: 'Fontaine', cost: 30, rarity: 'rare', playable: true, kind: 'soutien', power: 'Structure (60 s) qui soigne ta base de 1 PV toutes les 15 s.' },
    { id: 31, name: 'Boule', role: 'Boule de neige', cost: 40, rarity: 'rare', playable: true, kind: 'attaque', power: 'Roule lentement et grossit : +1 PV toutes les 4 s (jusqu’à 7). 3 dégâts.' },
    { id: 32, name: 'Ballon', role: 'Bombardier fixe', cost: 40, rarity: 'epique', playable: true, kind: 'défense', power: 'Structure volante (50 s) : toutes les 2 s, 1 dégât à tous les ennemis au sol à 1,5 case. Seuls les tirs anti-aériens l’atteignent.' },
    { id: 33, name: 'Vampire', role: 'Brute vorace', cost: 40, rarity: 'rare', playable: true, kind: 'attaque', power: 'Brute à 3 PV, 2 dégâts : chaque unité qu’il tue soigne ta base de 1.' },
    { id: 34, name: 'Scarabée', role: 'Cuirassé', cost: 40, rarity: 'rare', playable: true, kind: 'attaque', power: 'Runner à 4 PV, 3 dégâts, carapace : un projectile sur deux ricoche.' },
    { id: 35, name: 'Mortier', role: 'Artillerie', cost: 50, rarity: 'epique', playable: true, kind: 'défense', power: 'Structure (50 s) : toutes les 3,5 s, 2 dégâts à tous les ennemis au sol à 3 cases dans ton camp.' },
    { id: 36, name: 'Hydre', role: 'Têtes multiples', cost: 50, rarity: 'epique', playable: true, kind: 'attaque', power: 'Runner à 3 PV, 2 dégâts : à sa mort, deux Zip sortent de son corps et continuent.' },
    { id: 37, name: 'Phare', role: 'Balise', cost: 50, rarity: 'rare', playable: true, kind: 'soutien', power: 'Zone (45 s) : tes créatures à 1,5 case avancent 1,3× plus vite.' },
    { id: 38, name: 'Gel', role: 'Piège glacé', cost: 50, rarity: 'epique', playable: true, kind: 'défense', power: 'Zone (75 s) : toutes les 5 s, gèle 3,5 s les ennemis au sol à 2 cases.' },
    { id: 39, name: 'Dynamite', role: 'Bombardière', cost: 50, rarity: 'rare', playable: true, kind: 'attaque', power: 'Volante à 2 PV : explose sur la première structure ennemie survolée (3 dégâts à 1 case). Sinon 2 dégâts à la base.' },
    { id: 40, name: 'Oracle', role: 'Œil', cost: 60, rarity: 'epique', playable: true, kind: 'défense', power: 'Tourelle (70 s, 5 PV) qui révèle mines, fantômes et taupes à 3 cases, et tire loin (3 cases, sol et air, 1,2 s).' },
    { id: 41, name: 'Golem', role: 'Brute de pierre', cost: 60, rarity: 'epique', playable: true, kind: 'attaque', power: 'Brute à 6 PV, 4 dégâts, écrase les murs. À sa mort, deux Pik en sortent.' },
    { id: 42, name: 'Phénix', role: 'Oiseau de feu', cost: 60, rarity: 'legendaire', playable: true, kind: 'attaque', power: 'Volant à 4 PV, 4 dégâts. À sa mort, il renaît en deux Zazou.' },
    { id: 43, name: 'Totem', role: 'Totem gardien', cost: 60, rarity: 'epique', playable: true, kind: 'défense', power: 'Structure (60 s) qui invoque un Gromp toutes les 12 s.' },
    { id: 44, name: 'Léviathan', role: 'Monstre volant', cost: 70, rarity: 'legendaire', playable: true, kind: 'attaque', power: 'Volant à 8 PV, 6 dégâts : toutes les 2 s, 1 dégât aux ennemis au sol sous lui.' },
    { id: 45, name: 'Titan', role: 'Cuirassé colossal', cost: 70, rarity: 'legendaire', playable: true, kind: 'attaque', power: 'Brute à 10 PV, 6 dégâts, écrase les murs. Très lent, mais rien ne l’arrête.' },
    { id: 46, name: 'Essaim', role: 'Nuée', cost: 70, rarity: 'epique', playable: true, kind: 'attaque', power: 'Six moustiques volants d’un coup (1 PV, 1 dégât chacun).' },
    { id: 47, name: 'Reine', role: 'Pondeuse royale', cost: 70, rarity: 'legendaire', playable: true, kind: 'soutien', power: 'Structure à 5 PV (60 s) qui pond un Pik toutes les 5 s.' },
  ];
  const CREATURE_BY_ID = Object.fromEntries(CREATURES.map(c => [c.id, c]));
  // Équipes conseillées (archétypes), testées en arène (scripts/ai-decks.js) ; `wr` = victoires contre des équipes au hasard.
  const RECOMMENDED_DECKS = [
    { name: 'Classique', wr: 63, rr: 62, style: 'équilibré', desc: 'Les 7 créatures de base : un runner, une patrouille, une tourelle, un casseur de tours, un mur, de l’économie et un gros volant.', deck: { 10: 1, 20: 2, 30: 3, 40: 4, 50: 5, 60: 6, 70: 7 } },
    { name: 'Raz-de-marée', wr: 55, rr: 50, style: 'rush au sol', desc: 'Du monde, tout le temps : Puce au front, Jumeaux, une Reine qui pond, et Hydre qui se démultiplie.', deck: { 10: 18, 20: 19, 30: 3, 40: 34, 50: 36, 60: 43, 70: 47 } },
    { name: 'Ciel ouvert', wr: 63, rr: 50, style: 'aérien', desc: 'Tout passe au-dessus : Bulle, Zazou, Dynamite, Phénix et Léviathan ; Krak et Riko gardent la maison.', deck: { 10: 9, 20: 10, 30: 3, 40: 4, 50: 39, 60: 42, 70: 44 } },
    { name: 'Forteresse', wr: 60, rr: 50, style: 'défense', desc: 'On tient, on soigne, on contre : Flak, Boum, Source, Mortier, Oracle, et Kraken pour finir.', deck: { 10: 8, 20: 26, 30: 11, 40: 32, 50: 35, 60: 40, 70: 17 } },
    { name: 'Brise-tours', wr: 64, rr: 58, style: 'anti-structures', desc: 'Casse tout ce qui est posé : Pioche, Riko, Dynamite, Golem et Titan.', deck: { 10: 1, 20: 24, 30: 29, 40: 4, 50: 39, 60: 41, 70: 45 } },
    { name: 'Grand froid', wr: 48, rr: 49, style: 'contrôle', desc: 'Ralentir et geler sous les tirs : Givre, Glu, Gel, Nuage… puis Kraken passe.', deck: { 10: 8, 20: 2, 30: 27, 40: 28, 50: 38, 60: 40, 70: 17 } },
    { name: 'Fourberie', wr: 49, rr: 32, style: 'furtif', desc: 'Ce qu’on ne voit pas fait mal : Taupe, Boum, Fantôme, Lutin qui vole la mana, Sirène qui retourne les ennemis.', deck: { 10: 21, 20: 25, 30: 11, 40: 14, 50: 15, 60: 16, 70: 7 } },
    { name: 'Gros bras', wr: 76, rr: 82, style: 'brutes', desc: 'Des brutes qui encaissent : Pik, Givre, Vampire, Golem, Titan, et un Phare pour les presser.', deck: { 10: 8, 20: 2, 30: 28, 40: 33, 50: 37, 60: 41, 70: 45 } },
    { name: 'Feu d’artifice', wr: 68, rr: 52, style: 'explosions', desc: 'Tout explose : Étincelle, Pétard, Boum, Tiktak, Dynamite, Phénix, Essaim.', deck: { 10: 20, 20: 24, 30: 11, 40: 13, 50: 39, 60: 42, 70: 46 } },
    { name: 'Économie', wr: 48, rr: 27, style: 'tempo', desc: 'Plus de mana que l’adversaire : Lutin, Mojo, Source, puis les gros coups (Léviathan).', deck: { 10: 1, 20: 25, 30: 30, 40: 34, 50: 35, 60: 6, 70: 44 } },
    { name: 'Nuée', wr: 44, rr: 29, style: 'essaim', desc: 'Beaucoup de petites cibles d’un coup : Puce, Nid, Rafale, Hydre, Totem, Essaim.', deck: { 10: 18, 20: 23, 30: 12, 40: 31, 50: 36, 60: 43, 70: 46 } },
    { name: 'Tireurs', wr: 60, rr: 57, style: 'tourelles', desc: 'Un mur de feu : Canonnier, Krak, Ballon, Mortier, Oracle, et Zéphir qui tire en volant.', deck: { 10: 1, 20: 22, 30: 3, 40: 32, 50: 35, 60: 40, 70: 7 } },
  ];
  const DECK_COSTS = [10, 20, 30, 40, 50, 60, 70];
  const DEFAULT_DECK = Object.fromEntries(DECK_COSTS.map(cost => [cost, CREATURES.find(c => c.base && c.cost === cost).id]));
  const BASE_COLLECTION = Object.fromEntries(CREATURES.filter(c => c.base).map(c => [c.id, 1]));
  // Étoiles d'une carte selon ses exemplaires (cosmétique) : 1 étoile à l'obtention, puis +1 tous les copiesPerStar×n.
  function cardStars(creature, copies) { const per = RARITIES[creature.rarity].copiesPerStar; let s = 1, need = per; let c = (copies || 0) - 1; while (c >= need && s < 5) { c -= need; need += per; s += 1; } return s; }
  function nextStarCopies(creature, copies) { const per = RARITIES[creature.rarity].copiesPerStar; let s = 1, need = per; let c = (copies || 0) - 1; while (c >= need && s < 5) { c -= need; need += per; s += 1; } return s >= 5 ? null : { have: c, need }; }

  // ----- Capsules (butin de victoire, tirage par rareté avec garanties) -----
  const CAPSULE = { max: 5, pityEpic: 12, pityLegendary: 40, skinChance: 0.3 };
  function rollRarity(rng, pity) {
    if (pity.legendary >= CAPSULE.pityLegendary) return 'legendaire';
    if (pity.epic >= CAPSULE.pityEpic) return 'epique';
    const total = Object.values(RARITIES).reduce((n, r) => n + r.weight, 0);
    let x = rng() * total;
    for (const [key, r] of Object.entries(RARITIES)) { x -= r.weight; if (x < 0) return key; }
    return 'commune';
  }
  // rng : fonction () => [0,1). Retourne { cards: [{ id, rarity, copies }], coins, skin?: id }
  function openCapsule(rng, collection, ownedSkins, pity) {
    const cards = [];
    const n = 2 + (rng() < 0.3 ? 1 : 0);
    const p = Object.assign({ epic: 0, legendary: 0 }, pity || {});
    for (let i = 0; i < n; i += 1) {
      const rarity = rollRarity(rng, p);
      const pool = CREATURES.filter(c => c.rarity === rarity && !c.base) ;
      const fallback = CREATURES.filter(c => c.rarity === rarity);
      const pick = (pool.length ? pool : fallback)[Math.floor(rng() * (pool.length ? pool : fallback).length)];
      const copies = rarity === 'commune' ? 1 + Math.floor(rng() * 3) : rarity === 'rare' ? 1 + Math.floor(rng() * 2) : 1;
      cards.push({ id: pick.id, rarity, copies, isNew: !collection[pick.id] });
      if (rarity === 'epique' || rarity === 'legendaire') p.epic = 0; else p.epic += 1;
      if (rarity === 'legendaire') p.legendary = 0; else p.legendary += 1;
    }
    const coins = 20 + Math.floor(rng() * 41);
    let skin = null;
    if (rng() < CAPSULE.skinChance) {
      const candidates = SKINS.filter(s => !s.hidden && s.unlock.type !== 'default' && !ownedSkins.includes(s.id));
      if (candidates.length) skin = candidates[Math.floor(rng() * candidates.length)].id;
    }
    return { cards, coins, skin, pity: p };
  }

  // ----- Route des trophées (paliers de meilleurs trophées, récompenses à réclamer) -----
  const TROPHY_ROAD = [];
  (function buildRoad() {
    const creatureAt = { 50: 8, 100: 18, 150: 10, 200: 20, 300: 15, 350: 24, 450: 11, 500: 26, 600: 9, 700: 27, 800: 12, 900: 21, 1000: 13, 1100: 19, 1250: 14, 1350: 30, 1500: 16, 1600: 22, 1750: 31, 1900: 25, 2050: 34, 2200: 17, 2350: 37, 2500: 33 };
    for (let t = 50; t <= 2500; t += 50) {
      let reward;
      if (creatureAt[t]) reward = { type: 'creature', id: creatureAt[t] };
      else if (t % 250 === 0) reward = { type: 'capsule', count: t >= 1000 ? 2 : 1 };
      else if (t % 200 === 0) reward = { type: 'skin', pick: 'random' };
      else reward = { type: 'coins', count: 40 + Math.floor(t / 50) * 10 };
      TROPHY_ROAD.push({ trophies: t, reward });
    }
  })();
  function roadLabel(r) {
    if (r.type === 'creature') return `Créature : ${CREATURE_BY_ID[r.id].name}`;
    if (r.type === 'capsule') return r.count > 1 ? `${r.count} capsules` : '1 capsule';
    if (r.type === 'skin') return 'Skin surprise';
    return `${r.count} pièces`;
  }

  // Thèmes de skins : nom affiché par créature + déblocage.
  const HALLOWEEN_NAMES = { 1: 'Zip Citrouille', 2: 'Gromp Vampire', 3: 'Krak Sorcière', 4: 'Riko Momie', 5: 'Blok Frankenstein', 6: 'Mojo Zombie', 7: 'Zéphir Chauve-souris' };
  const THEMES = [
    { theme: 'default', suffix: 'default', name: (n) => `${n} classique`, rarity: 'commun', unlock: { type: 'default' } },
    { theme: 'halloween', suffix: 'halloween', name: (n, og) => HALLOWEEN_NAMES[og], rarity: 'epique', unlock: { type: 'coins', value: 200 } },
    { theme: 'ghost', suffix: 'ghost', name: (n) => `${n} Fantôme`, rarity: 'rare', unlock: (og) => ({ type: 'level', value: 2 + og }) },
    { theme: 'neon', suffix: 'neon', name: (n) => `${n} Néon`, rarity: 'rare', unlock: { type: 'coins', value: 150 } },
    { theme: 'robot', suffix: 'robot', name: (n) => `Robo-${n}`, rarity: 'epique', unlock: (og) => ({ type: 'trophies', value: 150 + og * 50 }) },
    { theme: 'ice', suffix: 'ice', name: (n) => `${n} Givré`, rarity: 'epique', unlock: (og) => ({ type: 'wins', value: 5 + og * 5 }) },
    { theme: 'gold', suffix: 'gold', name: (n) => `${n} Doré`, rarity: 'legendaire', unlock: (og) => ({ type: 'level', value: 8 + og * 2 }) },
    { theme: 'pirate', suffix: 'pirate', name: (n) => `Capitaine ${n}`, rarity: 'rare', unlock: { type: 'coins', value: 180 } },
    { theme: 'astro', suffix: 'astro', name: (n) => `${n} Astronaute`, rarity: 'epique', unlock: { type: 'coins', value: 260 } },
    { theme: 'candy', suffix: 'candy', name: (n) => `${n} Bonbon`, rarity: 'rare', unlock: { type: 'coins', value: 160 } },
    { theme: 'lava', suffix: 'lava', name: (n) => `${n} Magma`, rarity: 'epique', unlock: (og) => ({ type: 'trophies', value: 400 + og * 60 }) },
    { theme: 'ninja', suffix: 'ninja', name: (n) => `${n} Ninja`, rarity: 'rare', unlock: { type: 'coins', value: 170 } },
    { theme: 'royal', suffix: 'royal', name: (n) => `Roi ${n}`, rarity: 'legendaire', unlock: (og) => ({ type: 'wins', value: 30 + og * 10 }) },
    { theme: 'summer', suffix: 'summer', name: (n) => `${n} Plage`, rarity: 'commun', unlock: { type: 'coins', value: 90 } },
    { theme: 'xmas', suffix: 'xmas', name: (n) => `${n} Noël`, rarity: 'epique', unlock: { type: 'coins', value: 220 } },
    { theme: 'toxic', suffix: 'toxic', name: (n) => `${n} Toxique`, rarity: 'rare', unlock: (og) => ({ type: 'level', value: 5 + og }) },
    { theme: 'cyber', suffix: 'cyber', name: (n) => `Cyber-${n}`, rarity: 'legendaire', unlock: (og) => ({ type: 'trophies', value: 700 + og * 80 }) },
  ];
  // Arènes (décors) : dessinées par public/js/maps.js ; 'random' = tirage au sort par le serveur.
  const MAPS = [{ id: 'lagoon', name: 'Lagon' }, { id: 'space', name: 'Espace' }, { id: 'lava', name: 'Mer de lave' }, { id: 'halloween', name: 'Cimetière' }, { id: 'farm', name: 'Ferme' }, { id: 'ice', name: 'Banquise' }, { id: 'candy', name: 'Pays des bonbons' }];
  // 15 avatars de profil proposés (dessinés par creatures.js) ; sinon photo importée (data URL).
  const AVATAR_PRESETS = ['og1_default', 'og2_default', 'og3_default', 'og4_default', 'og5_default', 'og6_default', 'og7_default', 'og1_pirate', 'og2_royal', 'og4_candy', 'og7_cyber', 'og6_astro', 'og3_ninja', 'og5_lava', 'og1_halloween'];
  const SKINS = [];
  for (let og = 1; og <= 47; og += 1) {
    for (const th of THEMES) {
      SKINS.push({ id: `og${og}_${th.suffix}`, ogId: og, theme: th.theme, name: th.name(OG_NAMES[og], og), rarity: th.rarity, unlock: typeof th.unlock === 'function' ? th.unlock(og) : th.unlock });
    }
  }
  // Compatibilité avec les anciens identifiants (comptes créés avant la refonte).
  const LEGACY = { or: 'gold', ombre: 'neon', prisme: 'gold' };
  for (const [old, theme] of Object.entries(LEGACY)) for (let og = 1; og <= 7; og += 1) SKINS.push({ id: `og${og}_${old}`, ogId: og, theme, name: `${OG_NAMES[og]} (ancien)`, rarity: 'commun', unlock: { type: 'hidden' }, hidden: true });

  const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const DEFAULT_EQUIP = Object.fromEntries(Array.from({ length: 47 }, (_, i) => i + 1).map(og => [og, `og${og}_default`]));

  const RANKS = [
    { name: 'Bronze', min: 0, color: '#b45309' },
    { name: 'Argent', min: 200, color: '#94a3b8' },
    { name: 'Or', min: 500, color: '#f59e0b' },
    { name: 'Diamant', min: 900, color: '#38bdf8' },
    { name: 'Mythique', min: 1400, color: '#a855f7' },
    { name: 'Légendaire', min: 2000, color: '#f43f5e' },
  ];
  function rankFor(trophies) {
    let r = RANKS[0];
    for (const rank of RANKS) if (trophies >= rank.min) r = rank;
    return r;
  }
  function nextRank(trophies) { return RANKS.find(r => r.min > trophies) || null; }

  function xpForLevel(level) { return 100 + (level - 1) * 60; } // XP pour passer du niveau `level` au suivant
  function levelFromXp(xp) {
    let level = 1, rest = xp;
    while (rest >= xpForLevel(level) && level < 200) { rest -= xpForLevel(level); level += 1; }
    return { level, into: rest, need: xpForLevel(level) };
  }

  // Récompenses de fin de partie (style Brawl Stars : gains/pertes selon l'écart de trophées).
  function matchRewards(me, opp, result, mode) {
    const ranked = mode === 'ranked';
    const diff = (opp.trophies || 0) - (me.trophies || 0);
    let trophies = 0;
    if (ranked) {
      if (result === 'win') trophies = Math.round(Math.max(4, Math.min(16, 8 + diff / 50)));
      else if (result === 'loss') {
        const base = Math.round(Math.max(2, Math.min(12, 8 - diff / 50)));
        const protect = me.trophies < 100 ? 0.5 : 1;
        trophies = -Math.round(base * protect);
        if (me.trophies + trophies < 0) trophies = -me.trophies;
      }
    }
    let xp = result === 'win' ? 40 : result === 'draw' ? 20 : 15;
    let coins = result === 'win' ? 20 : result === 'draw' ? 10 : 6;
    if (mode === 'bot') { xp = Math.round(xp * 0.6); coins = Math.round(coins * 0.5); }
    if (mode === 'friendly') { xp = Math.round(xp * 0.5); coins = 0; }
    const streakBonus = result === 'win' && (me.streak || 0) >= 2 ? Math.min(10, (me.streak || 0) * 2) : 0;
    return { trophies, xp: xp + streakBonus, coins: coins + (streakBonus ? 4 : 0), streakBonus };
  }

  function canUnlock(skin, profile) {
    const u = skin.unlock;
    if (u.type === 'default') return { ok: true };
    if (u.type === 'level') return { ok: profile.level >= u.value, label: `Niveau ${u.value}` };
    if (u.type === 'trophies') return { ok: profile.bestTrophies >= u.value, label: `${u.value} trophées` };
    if (u.type === 'wins') return { ok: profile.wins >= u.value, label: `${u.value} victoires` };
    if (u.type === 'coins') return { ok: profile.coins >= u.value, label: `${u.value} pièces`, price: u.value };
    return { ok: false };
  }

  // ----- Quêtes du jour -----
  // kind : 'wins' | 'games' | 'kills' | 'orbs' | 'placed' (ogId) | 'abilities' | 'evolutions' | 'waves' (survie)
  const QUEST_TEMPLATES = [
    { id: 'win2', kind: 'wins', goal: 2, label: 'Gagne 2 parties', coins: 40 },
    { id: 'play3', kind: 'games', goal: 3, label: 'Joue 3 parties', coins: 30 },
    { id: 'kills20', kind: 'kills', goal: 20, label: 'Élimine 20 unités adverses', coins: 35 },
    { id: 'orbs10', kind: 'orbs', goal: 10, label: 'Ramasse 10 orbes de mana', coins: 25 },
    { id: 'zip15', kind: 'placed', ogId: 1, goal: 15, label: 'Pose 15 Zip', coins: 30 },
    { id: 'gromp8', kind: 'placed', ogId: 2, goal: 8, label: 'Pose 8 Gromp', coins: 30 },
    { id: 'krak6', kind: 'placed', ogId: 3, goal: 6, label: 'Pose 6 Krak', coins: 30 },
    { id: 'riko5', kind: 'placed', ogId: 4, goal: 5, label: 'Pose 5 Riko', coins: 30 },
    { id: 'blok4', kind: 'placed', ogId: 5, goal: 4, label: 'Pose 4 Blok', coins: 30 },
    { id: 'mojo4', kind: 'placed', ogId: 6, goal: 4, label: 'Pose 4 Mojo', coins: 30 },
    { id: 'zephir3', kind: 'placed', ogId: 7, goal: 3, label: 'Pose 3 Zéphir', coins: 35 },
    { id: 'abil5', kind: 'abilities', goal: 5, label: 'Utilise 5 capacités actives', coins: 30 },
    { id: 'evo3', kind: 'evolutions', goal: 3, label: 'Fais évoluer 3 unités', coins: 35 },
    { id: 'waves5', kind: 'waves', goal: 5, label: 'Survis à 5 vagues en Survie', coins: 40 },
  ];
  function dayKey(d) { return (d || new Date()).toISOString().slice(0, 10); }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 3 quêtes du jour, déterministes par (jour, joueur).
  function dailyQuests(userId, day) {
    const key = day || dayKey();
    let h = hashStr(`${key}:${userId}`);
    const pool = [...QUEST_TEMPLATES];
    const picked = [];
    while (picked.length < 3 && pool.length) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; picked.push(pool.splice(h % pool.length, 1)[0]); }
    return { date: key, items: picked.map(q => ({ id: q.id, progress: 0, claimed: false })) };
  }
  function questTemplate(id) { return QUEST_TEMPLATES.find(q => q.id === id); }
  // Fait avancer les quêtes à partir des stats d'une partie.
  function advanceQuests(quests, { result, stats, mode, waves }) {
    for (const item of quests.items) {
      const q = questTemplate(item.id);
      if (!q || item.claimed) continue;
      let add = 0;
      switch (q.kind) {
        case 'wins': add = result === 'win' ? 1 : 0; break;
        case 'games': add = 1; break;
        case 'kills': add = stats.kills || 0; break;
        case 'orbs': add = stats.orbs || 0; break;
        case 'placed': add = (stats.placedBy && stats.placedBy[q.ogId]) || 0; break;
        case 'abilities': add = stats.abilities || 0; break;
        case 'evolutions': add = stats.evolutions || 0; break;
        case 'waves': add = mode === 'survival' ? Math.max(0, (waves || 0) - item.progress) : 0; break;
        default: break;
      }
      item.progress = Math.min(q.goal, item.progress + add);
    }
    return quests;
  }

  // ----- Offre de la semaine : un skin payant à -50 % -----
  function weekKey(d) { const date = d || new Date(); const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); return `${date.getUTCFullYear()}-${Math.floor((date - start) / 604800000)}`; }
  function weeklyDeal(d) {
    const paid = SKINS.filter(s => !s.hidden && s.unlock.type === 'coins');
    if (!paid.length) return null;
    const skin = paid[hashStr(weekKey(d)) % paid.length];
    return { skinId: skin.id, price: Math.ceil(skin.unlock.value / 2), week: weekKey(d) };
  }

  return { OG_NAMES, OG_ROLES, OG_LORE, THEMES, MAPS, AVATAR_PRESETS, SKINS, SKIN_BY_ID, DEFAULT_EQUIP, RANKS,
    RARITIES, CREATURES, CREATURE_BY_ID, RECOMMENDED_DECKS, DECK_COSTS, DEFAULT_DECK, BASE_COLLECTION, cardStars, nextStarCopies, CAPSULE, openCapsule, TROPHY_ROAD, roadLabel, rankFor, nextRank, xpForLevel, levelFromXp, matchRewards, canUnlock, QUEST_TEMPLATES, dailyQuests, questTemplate, advanceQuests, dayKey, weeklyDeal };
});
