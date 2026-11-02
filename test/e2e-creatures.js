/* Bout en bout : un admin met Kraken, Sirène et Fantôme dans son équipe et les pose en entraînement ; l'adversaire ne voit pas le Fantôme. */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3210';
const OUT = process.env.OUT || '/tmp';
(async () => {
  const browser = await chromium.launch();
  const A = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
  const errors = []; A.on('pageerror', e => errors.push(e.message)); A.on('dialog', d => d.accept());
  await A.goto(BASE); await A.click('#btnGuest'); await A.waitForSelector('#screen-lobby:not(.hidden)');
  await A.click('#btnSettings'); await A.fill('#adminKey', process.env.ADMIN_KEY || 'TestCle123'); await A.click('#adminKeyForm button'); await A.waitForTimeout(600);
  await A.click('[data-screen="collection"]'); await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(OUT, 'c_collection_admin.png'), fullPage: true });
  // Kraken dans la case 70, Sirène en 60, Fantôme en 40, Pik en 10
  for (const id of [17, 16, 14, 8]) { await A.click(`.ccard[data-id="${id}"]`); await A.waitForSelector('#btnPutInDeck', { timeout: 3000 }); await A.click('#btnPutInDeck'); await A.waitForTimeout(500); }
  const deckNames = await A.$$eval('#deckStrip .deck-slot b', els => els.map(e => e.textContent));
  console.log('équipe :', deckNames.join(' · '));
  await A.screenshot({ path: path.join(OUT, 'c_deck.png') });
  await A.click('#screen-collection [data-screen="lobby"]'); await A.waitForTimeout(400);
  await A.click('#modeCard'); await A.click('.mode-tile[data-mode="bot"]'); await A.click('#btnModeOk'); await A.click('#btnPlay');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 }); await A.waitForTimeout(4500);
  // pose : U (Kraken 70 mana) — attend la mana ; A (Pik) tout de suite
  await A.keyboard.press('a'); await A.keyboard.press('Enter'); await A.waitForTimeout(500);
  await A.keyboard.press('r'); await A.keyboard.press('Enter'); await A.waitForTimeout(16000);
  await A.keyboard.press('u'); await A.keyboard.press('Enter'); await A.waitForTimeout(4000);
  await A.screenshot({ path: path.join(OUT, 'c_game.png') });
  await A.click('#btnSurrender'); await A.waitForSelector('#screen-result:not(.hidden)', { timeout: 10000 });
  console.log('erreurs JS :', errors.length ? errors.join('\n') : 'aucune');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
