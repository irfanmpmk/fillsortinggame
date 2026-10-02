// Automated play test: node tools/playtest.js [outdir]
// Checks every level 1..80 generates a solvable puzzle, then auto-solves a few
// levels through the real tap handler and saves screenshots.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 820 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html'));
  await page.screenshot({ path: path.join(out, 'home.png') });

  const gen = await page.evaluate(() => {
    const P = window.__potion;
    const res = [];
    for (let l = 1; l <= 80; l++) {
      const t0 = performance.now();
      const pz = P.generateLevel(l);
      res.push({ l, ms: Math.round(performance.now() - t0), par: pz.par, colors: pz.cfg.colors, cap: pz.cfg.capacity });
    }
    return res;
  });
  const unsolved = gen.filter((g) => !g.par);
  console.log('max gen ms', Math.max(...gen.map((g) => g.ms)), 'unsolved', JSON.stringify(unsolved));
  console.log(gen.filter((g) => g.l % 10 === 1).map((g) => `L${g.l}: ${g.colors}c cap${g.cap} par${g.par} ${g.ms}ms`).join('\n'));

  for (const level of [1, 14, 40]) {
    await page.evaluate(() => window.handleBack && window.handleBack());
    await page.evaluate((l) => {
      document.getElementById('btnPlay').click();
    });
    await page.evaluate((l) => window.__potion.state && null, level);
    // Jump straight to the level through the level grid API.
    await page.evaluate((l) => { window.__startForTest(l); }, level);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `level${level}-start.png`) });
    const sol = await page.evaluate(() => {
      const P = window.__potion;
      return P.solve(P.state.tubes, P.state.cap, 200000);
    });
    let mid = Math.floor(sol.length / 2);
    for (let k = 0; k < sol.length; k++) {
      const [a, b] = sol[k];
      await page.evaluate(([a, b]) => { window.__potion.onTubeTap(a); window.__potion.onTubeTap(b); }, [a, b]);
      if (k === mid) {
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(out, `level${level}-pouring.png`) });
      }
      await page.waitForFunction(() => !window.__potion.view.anim);
    }
    await page.waitForTimeout(1300);
    const won = await page.evaluate(() => window.__potion.state.won);
    const modal = await page.evaluate(() => !document.getElementById('modal').classList.contains('hidden'));
    console.log(`level ${level}: ${sol.length} moves, won=${won}, modal=${modal}`);
    await page.screenshot({ path: path.join(out, `level${level}-won.png`) });
    if (!won || !modal) process.exitCode = 1;
  }
  const unlocked = await page.evaluate(() => localStorage.getItem('potionsort.unlocked'));
  console.log('unlocked saved:', unlocked);
  if (errors.length) { console.log('PAGE ERRORS', errors); process.exitCode = 1; }
  if (unsolved.length) process.exitCode = 1;
  await browser.close();
})();
