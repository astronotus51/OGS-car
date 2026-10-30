#!/usr/bin/env node
/*
 * Réinitialise le mot de passe d'un compte (à lancer sur le serveur, dans le dossier du jeu) :
 *   node scripts/reset-password.js Aluego            -> demande le nouveau mot de passe sans l'afficher
 *   node scripts/reset-password.js Aluego 'nouveau'  -> le passe directement (attention : reste dans l'historique du shell)
 * Déconnecte toutes les sessions existantes du compte.
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { createStore } = require('../server/db.js');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout;
    rl.question(question, (answer) => { stdout.write('\n'); rl.close(); resolve(answer); });
    rl._writeToOutput = () => {}; // n'affiche pas la saisie
  });
}

(async () => {
  const username = process.argv[2];
  if (!username) { console.error('Usage : node scripts/reset-password.js <pseudo> [nouveau-mot-de-passe]'); process.exit(1); }
  let password = process.argv[3];
  if (!password) {
    password = await ask(`Nouveau mot de passe pour ${username} : `);
    const again = await ask('Confirme : ');
    if (password !== again) { console.error('Les deux saisies sont différentes.'); process.exit(1); }
  }
  if (password.length < 8) { console.error('8 caractères minimum.'); process.exit(1); }
  const db = createStore();
  await db.init();
  const user = await db.getUserByUsername(username);
  if (!user) { console.error(`Compte "${username}" introuvable.`); process.exit(1); }
  await db.updateUser(user.id, { password_hash: await bcrypt.hash(password, 12), session_version: (user.session_version || 0) + 1 });
  console.log(`Mot de passe de ${user.username} mis à jour, toutes ses sessions sont déconnectées.`);
  process.exit(0);
})().catch((err) => { console.error(err.message); process.exit(1); });
