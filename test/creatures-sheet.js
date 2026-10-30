// Génère une planche de toutes les créatures x thèmes (contrôle visuel).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 2650 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const cat = fs.readFileSync('shared/catalog.js', 'utf8'), cre = fs.readFileSync('public/js/creatures.js', 'utf8');
  await page.setContent(`<body style="margin:0;background:#1d4ed8"><canvas id="c" width="1200" height="2650"></canvas><script>${cat}</script><script>${cre}</script></body>`);
  await page.evaluate((t) => {
    const ctx = document.getElementById('c').getContext('2d');
    const themes = OGSCatalog.THEMES.map(x => x.theme);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    themes.forEach((th, j) => ctx.fillText(th, 20, 40 + j * 150));
    for (let og = 1; og <= 7; og += 1) {
      ctx.fillStyle = '#fff'; ctx.fillText(OGSCatalog.OG_NAMES[og], 140 + (og - 1) * 150, 20);
      themes.forEach((th, j) => {
        Creatures.draw(ctx, og, `og${og}_${th === 'default' ? 'default' : th}`, 180 + (og - 1) * 150, 90 + j * 150, 120, t, { moving: true, vx: 1, phase: og, rot: og === 3 ? -1.2 : og === 4 ? 0.6 : 0, hpRatio: og === 5 ? 0.4 : 1, shoot: og === 7 ? 0.8 : 0 });
      });
    }
  }, 1.3);
  await page.screenshot({ path: process.env.OUT || '/tmp/creatures.png' });
  console.log('erreurs:', errors);
  await browser.close();
})();
