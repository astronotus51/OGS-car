#!/usr/bin/env node
/* Supprime TOUS les joueurs et toutes les parties (irréversible) : node scripts/wipe-all.js --oui */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createStore } = require('../server/db.js');
(async () => {
  if (!process.argv.includes('--oui')) { console.error('Ajoute --oui pour confirmer : tous les joueurs et parties seront supprimés.'); process.exit(1); }
  const db = createStore(); await db.init();
  const n = await db.countUsers();
  await db.wipe(); await db.close();
  console.log(`${n} joueur(s) et toutes les parties supprimés. Redémarre le serveur : pm2 restart ogs`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
