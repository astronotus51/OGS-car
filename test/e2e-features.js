/* Test de bout en bout des options de gameplay : draft, capacités, évolution, roi du centre, survie, quêtes. */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3210';
const OUT = process.env.OUT || '/tmp';

async function login(page, name) {
  await page.goto(BASE);
  await page.fill('#authUser', name); await page.fill('#authPass', 'test1234');
  await page.click('[data-action="register"]');
  await page.waitForSelector('#screen-lobby:not(.hidden)', { timeout: 10000 });
}
async function setOptions(page, opts) {
  await page.evaluate((o) => { document.querySelectorAll('#featureList input[data-feature]').forEach(i => { if (o[i.dataset.feature] !== undefined) { i.checked = o[i.dataset.feature]; i.dispatchEvent(new Event('change')); } }); }, opts);
}

(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errors = [];
  for (const [p, n] of [[A, 'A'], [B, 'B']]) { p.on('pageerror', e => errors.push(`${n}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_|409|401/.test(m.text())) errors.push(`${n} console: ${m.text()}`); }); }
  const suf = String(Date.now()).slice(-5);
  await login(A, 'Feat' + suf); await login(B, 'Ure' + suf);
  await A.waitForTimeout(500);
  const quests = await A.$$eval('#questList li', l => l.length);
  console.log('quêtes affichées :', quests);
  await A.screenshot({ path: path.join(OUT, 'f_lobby.png') });

  // Partie amicale avec draft + roi du centre + capacités + évolution
  await setOptions(A, { draft: true, kingOfCenter: true, abilities: true, evolution: true, powerPatches: true, fog: false });
  await A.click('#btnFriendlyCreate');
  await A.waitForSelector('#queueCode:not(.hidden)', { timeout: 5000 });
  const code = await A.$eval('#queueCode', e => e.textContent.trim());
  await B.fill('#friendlyCode', code); await B.click('#btnFriendlyJoin');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 });
  await B.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 });
  await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(OUT, 'f_draft.png') });
  await A.keyboard.press('u'); // A bannit Zéphir chez B
  await B.keyboard.press('r'); // B bannit Riko chez A
  await A.waitForTimeout(4500); // fin du draft + compte à rebours
  // A pose un Krak deux fois au même endroit (évolution), puis un Zip et utilise Sprint.
  await A.keyboard.press('e'); await A.keyboard.press('ArrowDown'); await A.keyboard.press('Enter');
  await A.waitForTimeout(6000);
  await A.keyboard.press('e'); await A.keyboard.press('Enter');
  await A.waitForTimeout(1500);
  await A.keyboard.press('a'); await A.keyboard.press('ArrowUp'); await A.keyboard.press('ArrowUp'); await A.keyboard.press('Enter');
  await A.waitForTimeout(800);
  await A.keyboard.press('Shift+A');
  await A.waitForTimeout(600);
  await A.keyboard.press('r'); // banni pour A
  await A.waitForTimeout(400);
  await A.screenshot({ path: path.join(OUT, 'f_game.png') });
  const toast = await A.$eval('#gameToast', e => e.textContent);
  console.log('dernier toast A :', toast);
  await B.evaluate(() => Net.send({ t: 'surrender' }));
  await A.waitForSelector('#screen-result:not(.hidden)', { timeout: 15000 });
  await A.waitForTimeout(500);
  console.log('résultat :', await A.$eval('#resultTitle', e => e.textContent), '|', await A.$eval('#resExtra', e => e.textContent));
  await A.click('#btnResultMenu'); await A.waitForTimeout(400);

  // Survie
  await A.click('#btnSurvival');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 });
  await A.waitForTimeout(16000);
  await A.keyboard.press('t'); await A.keyboard.press('Enter');
  await A.waitForTimeout(3000);
  await A.screenshot({ path: path.join(OUT, 'f_survival.png') });
  await A.evaluate(() => Net.send({ t: 'surrender' }));
  await A.waitForSelector('#screen-result:not(.hidden)', { timeout: 15000 });
  await A.waitForTimeout(500);
  console.log('survie :', await A.$eval('#resultTitle', e => e.textContent), '|', await A.$eval('#resultSub', e => e.textContent));
  await A.screenshot({ path: path.join(OUT, 'f_survival_result.png') });
  await A.click('#btnResultMenu'); await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(OUT, 'f_lobby2.png') });
  await A.click('#screen-lobby [data-screen="skins"]'); await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(OUT, 'f_skins.png') });
  console.log('erreurs JS :', errors.length ? errors : 'aucune');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
