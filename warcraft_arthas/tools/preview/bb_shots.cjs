// Render a .bbmodel from several camera angles using a locally built Blockbench (web).
// usage: NODE_PATH=$(npm root -g) node bb_shots.cjs <bbmodel> <outdir> <prefix> <preset> [bbUrl]
//   preset: arthas | sword | head
const { chromium } = require('playwright');
const fs = require('fs');
const [,, model, outdir, prefix, preset, phase = '1', bbUrl = 'http://localhost:8765/index.html'] = process.argv;

const PRESETS = {
  // views: [azimuth deg (0=front, 90=model's left side), elevation deg]; Blockbench space, front faces -z
  arthas: { target: [0, 27, 0], dist: 84, views: {
    front: [0, 6], front34r: [-38, 8], side_r: [-90, 6], back34: [-145, 10], back: [180, 6], side_l: [90, 6], front34l: [38, 8], top: [0, 78] } },
  head: { target: [0, 42, 0], dist: 30, views: {
    front: [0, 4], front34r: [-35, 8], side_r: [-90, 4], back34: [-145, 12], top: [0, 70] } },
  sword: { target: [0, 22, 0], dist: 75, views: {
    front: [0, 3], side_r: [-90, 3], front34r: [-35, 10], back34: [-145, 10] } },
  shoulder: { target: [-12, 34, 0], dist: 38, views: {
    front34r: [-35, 15], side_r: [-90, 8], back34: [-145, 15] } },
  upper: { target: [0, 32, 0], dist: 62, views: {
    front: [0, 3], front34r: [-35, 10], back34: [-145, 10] } },
  legs: { target: [0, 12, 0], dist: 62, views: {
    front: [0, 3], front34r: [-35, 8], side_r: [-90, 3] } },
};
(async () => {
  const cfg = PRESETS[preset];
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('pageerror:', String(e).slice(0, 300)));
  await page.goto(bbUrl);
  await page.waitForFunction(() => window.Codecs && window.Codecs.project && window.Preview, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const txt = fs.readFileSync(model, 'utf8');
  const info = await page.evaluate((t) => {
    Codecs.project.load(JSON.parse(t), { path: '' });
    try { if (window.three_grid) three_grid.visible = false; } catch (e) {}
    try { Canvas.updateAll(); } catch (e) {}
    return { cubes: Cube.all.length, groups: Group.all.length };
  }, txt);
  if (phase !== '1') {
    const texFile = model.replace(/\.bbmodel$/, '') + `_preview_texture_phase${phase}.png`;
    const url = 'data:image/png;base64,' + fs.readFileSync(require('path').join(require('path').dirname(model), `arthas_preview_texture_phase${phase}.png`)).toString('base64');
    await page.evaluate(async ({ url, phase }) => {
      Texture.all[0].fromDataURL(url);
      const show = phase === '2' ? ['frost_p2_aura'] : ['frost_p2_aura', 'frost_p3_wings'];
      for (const n of show) { const g = Group.all.find(x => x.name === n); if (g) { g.visibility = true; g.children.forEach(c => c.visibility = true); } }
      Canvas.updateAll();
    }, { url, phase });
    await page.waitForTimeout(800);
  }
  console.log(prefix, 'phase', phase, JSON.stringify(info));
  await page.waitForTimeout(1200);
  fs.mkdirSync(outdir, { recursive: true });
  for (const [name, dir] of Object.entries(cfg.views)) {
    const url = await page.evaluate(async ({ dir, cfg }) => {
      const p = Preview.selected;
      const az = dir[0] * Math.PI / 180, el = dir[1] * Math.PI / 180;
      const v = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
      const pos = v.map((d, i) => cfg.target[i] + d * cfg.dist);
      p.loadAnglePreset({ position: pos, target: cfg.target, projection: 'perspective' });
      p.render();
      return await new Promise(res => p.screenshot({ crop: false, width: 900, height: 900 }, res));
    }, { dir, cfg });
    fs.writeFileSync(`${outdir}/${prefix}_${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
