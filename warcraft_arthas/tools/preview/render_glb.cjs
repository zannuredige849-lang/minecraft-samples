// usage: NODE_PATH=$(npm root -g) node render_glb.cjs <outdir> <prefix> <modelUrlPath> <viewName:az,el,dist,tx,ty,bloom>...
const { chromium } = require('playwright');
const [,, outdir, prefix, model, ...views] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 900 } });
  p.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
  for (const v of views) {
    const [name, args] = v.split(':'); const [az, el, dist, tx, ty, bloom] = args.split(',');
    await p.goto(`http://localhost:8766/tools/preview/glb_viewer.html?model=${model}&az=${az}&el=${el}&dist=${dist}&tx=${tx || 0}&ty=${ty || 1.35}&bloom=${bloom || 0.7}`);
    await p.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 });
    const err = await p.evaluate(() => window.__error); if (err) { console.log('ERR', err); continue; }
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${outdir}/${prefix}_${name}.png` });
  }
  await b.close();
})();
