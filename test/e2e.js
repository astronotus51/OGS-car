/* Test de bout en bout : deux navigateurs se connectent, se matchent, jouent au clavier. */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3210';
const OUT = process.env.OUT || '/tmp';

async function login(page, name) {
  await page.goto(BASE);
  await page.fill('#authUser', name);
  await page.click('#authForm button[type=submit]');
  await page.waitForSelector('#screen-lobby:not(.hidden)', { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errors = [];
  for (const [p, n] of [[A, 'A'], [B, 'B']]) {
    p.on('pageerror', e => errors.push(`${n}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/401|404|409|ERR_/.test(m.text())) errors.push(`${n} console: ${m.text()}`); });
  }
  const suf = String(Date.now()).slice(-5); await login(A, 'Oscar' + suf); await login(B, 'Rival' + suf);
  await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(OUT, 'shot_lobby.png') });
  await A.click('#btnPlay'); await B.click('#btnPlay');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 15000 });
  await B.waitForSelector('#screen-game:not(.hidden)', { timeout: 15000 });
  console.log('match trouvé');
  await A.waitForTimeout(3600); // compte à rebours
  await A.screenshot({ path: path.join(OUT, 'shot_countdown_end.png') });
  // Joue au clavier : A pose des runners, B des murs/défenseurs.
  for (let i = 0; i < 14; i += 1) {
    await A.keyboard.press('a'); await A.keyboard.press('ArrowLeft'); await A.keyboard.press('Enter');
    await B.keyboard.press('z'); await B.keyboard.press('ArrowRight'); await B.keyboard.press('Enter');
    await A.waitForTimeout(1500);
    if (i === 4) { await A.keyboard.press('e'); await A.keyboard.press('ArrowDown'); await A.keyboard.press('Enter'); }
    if (i === 6) { await B.keyboard.press('r'); await B.keyboard.press('Enter'); }
    if (i === 8) { await B.keyboard.press('t'); await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter'); }
    if (i === 9) { await A.keyboard.press('y'); await A.keyboard.press('ArrowDown'); await A.keyboard.press('Enter'); }
    if (i === 3) await A.screenshot({ path: path.join(OUT, 'shot_game_A.png') });
    if (i === 10) { await A.screenshot({ path: path.join(OUT, 'shot_game_A2.png') }); await B.screenshot({ path: path.join(OUT, 'shot_game_B.png') }); }
  }
  // Clic souris : A sélectionne le slot 1 et clique une case.
  const box = await A.$eval('#gameCanvas', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await A.mouse.click(box.x + box.w * 0.07, box.y + box.h * 0.93);
  await A.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.56);
  await A.waitForTimeout(800);
  await A.screenshot({ path: path.join(OUT, 'shot_game_click.png') });
  // Abandon de B pour terminer.
  await B.evaluate(() => Net.send({ t: 'surrender' }));
  await A.waitForSelector('#screen-result:not(.hidden)', { timeout: 15000 });
  await B.waitForSelector('#screen-result:not(.hidden)', { timeout: 15000 });
  await A.waitForTimeout(700);
  await A.screenshot({ path: path.join(OUT, 'shot_result_A.png') });
  const resA = await A.$eval('#resultTitle', e => e.textContent), resB = await B.$eval('#resultTitle', e => e.textContent);
  console.log('résultats :', resA, '/', resB, 'trophées A', await A.$eval('#resTrophies', e => e.textContent));
  await A.click('#btnResultMenu');
  await A.waitForTimeout(500);
  await A.click('#screen-lobby [data-screen="skins"]'); await A.waitForTimeout(1200); await A.screenshot({ path: path.join(OUT, 'shot_skins.png') });
  await A.click('#screen-skins [data-screen="lobby"]'); await A.click('#screen-lobby [data-screen="profile"]'); await A.waitForTimeout(800); await A.screenshot({ path: path.join(OUT, 'shot_profile.png') });
  // Entraînement vs IA
  await A.click('#screen-profile [data-screen="lobby"]'); await A.waitForTimeout(300);
  await A.selectOption('#botLevel', 'difficile'); await A.click('#btnBot');
  await A.waitForSelector('#screen-game:not(.hidden)', { timeout: 10000 });
  await A.waitForTimeout(9000);
  await A.screenshot({ path: path.join(OUT, 'shot_bot.png') });
  console.log('erreurs JS :', errors.length ? errors : 'aucune');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
