// Renders launcher icons: node tools/make-icons.js (needs playwright)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RES = path.resolve(__dirname, '../app/src/main/res');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

function iconScript(size, mode) {
  // mode: 'legacy' (full square icon with background) or 'foreground' (adaptive layer)
  return `(() => {
    const S = ${size}, mode = '${mode}';
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const u = S / 108; // work in 108dp adaptive-icon units
    if (mode === 'legacy') {
      const r = 22 * u;
      g.beginPath(); g.moveTo(r, 0); g.arcTo(S, 0, S, S, r); g.arcTo(S, S, 0, S, r); g.arcTo(0, S, 0, 0, r); g.arcTo(0, 0, S, 0, r);
      const bg = g.createRadialGradient(S/2, 0, 0, S/2, S/2, S*0.8); bg.addColorStop(0, '#3b2a8a'); bg.addColorStop(1, '#140d33');
      g.fillStyle = bg; g.fill();
    }
    const scale = mode === 'legacy' ? 1.35 : 1;
    const cols = [['#e6194b','#ffe119','#4363d8'], ['#4363d8','#4363d8','#4363d8'], ['#ffe119','#e6194b','#f032e6']];
    const tw = 13 * u * scale, unit = 11 * u * scale, th = 3 * unit + tw * 0.5;
    const top = S / 2 - th / 2 + 1 * u;
    cols.forEach((layers, i) => {
      const x = S / 2 + (i - 1) * 19 * u * scale, y = top - (i === 1 ? 5 * u : 0);
      const path = () => { g.beginPath(); g.moveTo(x - tw/2, y); g.lineTo(x - tw/2, y + th - tw/2); g.arc(x, y + th - tw/2, tw/2, Math.PI, 0, true); g.lineTo(x + tw/2, y); };
      g.save(); path(); g.clip();
      layers.forEach((col, k) => { g.fillStyle = col; g.fillRect(x - tw, y + th - (k + 1) * unit, tw * 2, k === 0 ? unit + tw : unit); });
      g.restore();
      path(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.6 * u * scale; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - tw * 0.3, y + 3 * u, 1.6 * u * scale, th - 9 * u);
      g.fillStyle = '#ffffff'; g.fillRect(x - tw/2 - 1.5*u, y - 1.2*u, tw + 3*u, 2.4*u);
      if (i === 1) { g.fillStyle = '#c98b4e'; g.fillRect(x - tw*0.38, y - 5.5*u, tw*0.76, 4.5*u); }
    });
    return c.toDataURL('image/png').split(',')[1];
  })()`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, d] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, 'mipmap-' + name);
    fs.mkdirSync(dir, { recursive: true });
    const legacy = await page.evaluate(iconScript(Math.round(48 * d) * 1, 'legacy'));
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), Buffer.from(legacy, 'base64'));
    const fg = await page.evaluate(iconScript(Math.round(108 * d), 'foreground'));
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), Buffer.from(fg, 'base64'));
  }
  const big = await page.evaluate(iconScript(512, 'legacy'));
  fs.writeFileSync(path.resolve(__dirname, '../icon-512.png'), Buffer.from(big, 'base64'));
  await browser.close();
})();
