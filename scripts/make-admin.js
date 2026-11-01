#!/usr/bin/env node
/* Passe un joueur administrateur (ou lui retire le rôle), directement sur le serveur, sans clé :
 *   node scripts/make-admin.js Aluego            -> Aluego devient admin (tous les skins, panneau admin)
 *   node scripts/make-admin.js Aluego --retirer  -> Aluego redevient joueur normal
 * Puis : pm2 restart ogs (pour que le serveur recharge le profil).
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createStore } = require('../server/db.js');
(async () => {
  const args = process.argv.slice(2);
  const retirer = args.includes('--retirer');
  const username = args.find(a => !a.startsWith('--'));
  if (!username) { console.error('Usage : node scripts/make-admin.js <pseudo> [--retirer]'); process.exit(1); }
  const db = createStore(); await db.init();
  const user = await db.getUserByUsername(username);
  if (!user) {
    const all = await db.searchUsers('', 50);
    console.error(`Joueur « ${username} » introuvable. Joueurs existants : ${all.map(u => u.username).join(', ') || 'aucun'}`);
    await db.close(); process.exit(1);
  }
  await db.updateUser(user.id, { is_admin: !retirer });
  await db.close();
  console.log(`${user.username} est maintenant ${retirer ? 'un joueur normal' : 'ADMIN'}. Redémarre le serveur : pm2 restart ogs, puis recharge la page du jeu.`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
