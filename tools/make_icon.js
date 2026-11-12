// Renders the home-screen icons from tools/icon-src/icon.html (Kenney Letter Tiles Redux, CC0) into assets/icons/.
// Needs Playwright (not a repo dependency): node tools/make_icon.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const src = 'file://' + path.resolve(__dirname, 'icon-src/icon.html');
  const out = path.resolve(__dirname, '../assets/icons');
  for (const [name, px] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['favicon-32.png', 32]]) {
    const p = await b.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: px / 180 });
    await p.goto(src);
    await p.locator('#icon').screenshot({ path: path.join(out, name) });
    await p.close();
  }
  await b.close();
})();
