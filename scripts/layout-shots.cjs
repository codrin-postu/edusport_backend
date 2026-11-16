// Screenshot gate for admin layout work.
// Usage: node scripts/layout-shots.cjs --out <dir> --label <label> [--state <storageState.json>] [--base <url>]
// Shoots Inscrieri, one Sportivi record (first row) and Setari site at 1440, 820 and 390 wide, full page.
const fs = require('fs');
const path = require('path');
const pw = require(process.env.PLAYWRIGHT_PATH || '/Users/codrin/Documents/Programming/edusport_frontend/node_modules/playwright');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const out = opt('out', positional[0]);
const label = opt('label', positional[1] || 'shot');
const base = opt('base', 'http://localhost:1340');
const state = opt('state', process.env.SHOTS_STATE);
const record = opt('record', 'exetpqgruaze4nvp9f6lqvo6');
if (!out || !state) {
  console.error('usage: layout-shots.cjs --out <dir> --label <label> --state <storageState.json> [--base <url>]');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const SIZES = [[1440, 900, 'd'], [820, 1180, 't'], [390, 844, 'm']];

(async () => {
  const browser = await pw.chromium.launch();
  const done = [];
  for (const [w, h, tag] of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      storageState: state,
      isMobile: w < 500,
      hasTouch: w < 1000,
    });
    const page = await ctx.newPage();
    const shoot = async (name) => {
      const file = path.join(out, `${label}-${name}-${tag}.png`);
      await page.screenshot({ path: file, fullPage: true });
      done.push(file);
    };
    await page.goto(base + '/admin/plugins/edusport-inscrieri');
    await page.waitForTimeout(4000);
    await shoot('inscrieri');

    // The phone list shows cards, not a table: open the record by its address.
    await page.goto(base + '/admin/plugins/edusport-sportivi/' + record);
    await page.waitForTimeout(4000);
    await shoot('sportiv');

    await page.goto(base + '/admin/plugins/edusport-setari');
    await page.waitForTimeout(4000);
    await shoot('setari');
    await ctx.close();
  }
  await browser.close();
  console.log(done.length + ' shots in ' + out);
})().catch((e) => { console.error(e); process.exit(1); });
