/* Test de bout en bout des équipes : amical 2v2 (2 humains + 2 bots) puis file 3v3 complétée par des bots. */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3210';
const OUT = process.env.OUT || '/tmp';
async function login(page) { await page.goto(BASE); await page.click('#btnGuest'); await page.waitForSelector('#screen-lobby:not(.hidden)', { timeout: 10000 }); }
(async () => {
  const browser = await chromium.launch();
  const A = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const B = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errors = [];
  for (const p of [A, B]) p.on('dialog', d => { console.log('dialog:', d.message()); d.accept(); });
  for (const [p, n] of [[A, 'A'], [B, 'B']]) { p.on('pageerror', e => errors.push(`${n}: ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/404|ERR_|409|401/.test(m.text())) errors.push(`${n} console: ${m.text()}`); }); }
  await login(A); await login(B);
  // Amical 2v2 : A crée (format 2v2), B rejoint, A lance (2 bots complètent).
  await A.click('#modeCard'); await A.click('.mode-tile[data-mode="friendly"]'); await A.selectOption('#teamSelect', '2'); await A.click('#btnModeOk'); await A.click('#btnPlay');
  await A.waitForSelector('#queueCode:not(.hidden)', { timeout: 5000 });
  const code = await A.$eval('#queueCode', e => e.textContent.trim());
  await B.click('#modeCard'); await B.click('.mode-tile[data-mode="friendly"]'); await B.fill('#friendlyCode', code); await B.click('#btnFriendlyJoin');
  await A.waitForSelector('#btnFriendlyStart:not(.hidden)', { timeout: 5000 });
  console.log('salle :', await A.$eval('#queueSub', e => e.textContent));
  await A.click('#btnFriendlyStart');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 }); await B.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 });
  await A.waitForTimeout(4500);
  // Pose avec le clavier sur l'arène large (colonne 12 existe en 2v2)
  await A.keyboard.press('a'); for (let i = 0; i < 8; i++) await A.keyboard.press('ArrowRight'); await A.keyboard.press('Enter');
  await A.waitForTimeout(6000);
  await A.screenshot({ path: path.join(OUT, 'team_2v2.png') });
  console.log('HUD A :', await A.$eval('#hudMeName', e => e.textContent), '|', await A.$eval('#hudOppName', e => e.textContent));
  const colsA = await A.evaluate(() => document.getElementById('gameCanvas').width / document.getElementById('gameCanvas').height);
  console.log('ratio canvas (2v2, attendu ~1.08) :', colsA.toFixed(2));
  // Abandon : A puis B -> fin de partie pour l'équipe
  console.log('surrender visible:', await A.isVisible('#btnSurrender'), 'phase:', await A.evaluate(() => document.querySelector('#screen-game').className));
  await A.click('#btnSurrender'); await A.waitForTimeout(1500); console.log('après abandon A, toasts:', await A.$$eval('.toast', t => t.map(x => x.textContent)));
  await B.click('#btnSurrender');
  try { await A.waitForSelector('#screen-result:not(.hidden)', { timeout: 10000 }); } catch (e) { console.log('ERREURS:', errors.join(' | ')); throw e; }
  console.log('résultat A :', await A.$eval('#resultTitle', e => e.textContent), '|', await A.$eval('#resultSub', e => e.textContent));
  await A.click('#btnResultMenu'); await A.waitForTimeout(500);
  // Trio 3v3 classé : A seul en file, bots après le délai
  await A.click('#modeCard'); await A.click('.mode-tile[data-mode="trio"]'); await A.click('#btnModeOk'); await A.click('#btnPlay');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 30000 });
  await A.waitForTimeout(5000);
  await A.screenshot({ path: path.join(OUT, 'team_3v3.png') });
  console.log('3v3 HUD :', await A.$eval('#hudMeName', e => e.textContent), '|', await A.$eval('#hudOppName', e => e.textContent));
  console.log('erreurs JS :', errors.length ? errors.join('\n') : 'aucune');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
