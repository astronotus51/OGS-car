/*
 * Interrupteurs de fonctionnalités (expérimentations de gameplay).
 *  - enabled: false  => la fonctionnalité disparaît partout (lobby, serveur, règles). Pour la retirer, mets false ou supprime la ligne.
 *  - scope 'match'   => case à cocher dans le lobby (entraînement & amical) ; `ranked` dit si elle est active en classée.
 *  - scope 'server'  => réglage global, pas de case à cocher.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OGSFeatures = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FEATURES = {
    // --- Règles de partie (cases à cocher) ---
    tightSpacing: { enabled: true, scope: 'match', default: true, ranked: true, group: 'Règles', label: 'Pose rapprochée', desc: 'On peut reposer une créature sur une case dès que la précédente s’en est un peu écartée (sinon il faut attendre qu’elle ait quitté la case).' },
    abilities: { enabled: true, scope: 'match', default: true, ranked: true, group: 'Règles', label: 'Capacités actives', desc: 'Maj + touche (ou clic sur ⚡) : chaque créature a un pouvoir (10 mana, 20 s de recharge).' },
    evolution: { enabled: true, scope: 'match', default: true, ranked: true, group: 'Règles', label: 'Évolution des unités', desc: 'Repose Krak, Blok ou Mojo sur lui-même : niveau 2 puis 3 (plus de PV, plus fort).' },
    overtime: { enabled: true, scope: 'match', default: true, ranked: true, group: 'Règles', label: 'Mort subite', desc: 'Égalité au temps écoulé : mana ×3, le premier qui prend un dégât perd.' },
    powerPatches: { enabled: true, scope: 'match', default: true, ranked: true, group: 'Règles', label: 'Patchs de pouvoir', desc: 'Gromp renvoie Riko au lieu de mourir avec, Mojo soigne ses voisins, Zéphir bombarde les Blok qu’il survole.' },
    draft: { enabled: true, scope: 'match', default: false, ranked: false, group: 'Règles', label: 'Draft (bannissement)', desc: 'Avant la partie, chacun bannit une créature que l’adversaire ne pourra pas poser.' },
    // --- Modes ---
    kingOfCenter: { enabled: true, scope: 'match', default: false, ranked: false, group: 'Modes', label: 'Roi du centre', desc: 'Tes unités dans les deux lignes centrales marquent des points ; 60 points = victoire.' },
    survival: { enabled: true, scope: 'server', label: 'Mode Survie (solo)', desc: 'Des vagues de plus en plus fortes ; score, record et pièces.' },
    // --- Mutateurs ---
    manaX2: { enabled: true, scope: 'match', default: false, ranked: false, group: 'Mutateurs', label: 'Mana ×2', desc: 'Régénération doublée, 30 mana au départ.' },
    fastUnits: { enabled: true, scope: 'match', default: false, ranked: false, group: 'Mutateurs', label: 'Unités rapides', desc: 'Toutes les unités vont 1,5× plus vite.' },
    fog: { enabled: true, scope: 'match', default: false, ranked: false, group: 'Mutateurs', label: 'Brouillard de guerre', desc: 'Tu ne vois la moitié adverse que lorsqu’une unité entre dans la tienne.' },
    zigzag: { enabled: true, scope: 'match', default: false, ranked: false, group: 'Mutateurs', label: 'Zip zigzague', desc: 'Les Zip courent en zigzag au lieu de tout droit.' },
    // --- Méta ---
    quests: { enabled: true, scope: 'server', label: 'Quêtes du jour', desc: '3 quêtes quotidiennes qui rapportent des pièces.' },
    shopDeals: { enabled: true, scope: 'server', label: 'Offre de la semaine', desc: 'Un skin à −50 % chaque semaine.' },
  };

  function enabled(key) { const f = FEATURES[key]; return !!(f && f.enabled); }
  function matchFeatures() { return Object.entries(FEATURES).filter(([, f]) => f.enabled && f.scope === 'match').map(([key, f]) => Object.assign({ key }, f)); }
  // Options d'une partie à partir d'un choix utilisateur (entraînement / amical) ; en classée, les valeurs `ranked`.
  function resolveOptions(input, ranked) {
    const out = {};
    for (const [key, f] of Object.entries(FEATURES)) {
      if (!f.enabled || f.scope !== 'match') { out[key] = false; continue; }
      out[key] = ranked ? !!f.ranked : (input && typeof input[key] === 'boolean' ? input[key] : !!f.default);
    }
    return out;
  }

  return { FEATURES, enabled, matchFeatures, resolveOptions };
});
