// Opens each *.geo.json in a locally built Blockbench and checks cube/bone counts survive the import.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let bad = 0;
  for (const f of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
    await p.goto('http://localhost:8765/index.html');
    await p.waitForFunction(() => window.Codecs && window.Formats && window.Preview, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const text = fs.readFileSync(f, 'utf8');
    const res = await p.evaluate((t) => {
      const data = JSON.parse(t);
      newProject(Formats.bedrock);
      Codecs.bedrock.parse(data, '');
      const g = data['minecraft:geometry'][0];
      return { cubes: Cube.all.length, groups: Group.all.length,
        expectCubes: g.bones.reduce((s, x) => s + (x.cubes || []).length, 0), expectBones: g.bones.length,
        id: Project.geometry_name, tw: Project.texture_width, th: Project.texture_height };
    }, text);
    const pass = res.cubes === res.expectCubes && res.groups >= res.expectBones;
    if (!pass) bad++;
    console.log(pass ? 'OK  ' : 'FAIL', f.split('/').pop(), JSON.stringify(res));
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
