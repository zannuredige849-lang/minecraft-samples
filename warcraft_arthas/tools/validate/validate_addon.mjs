#!/usr/bin/env node
// Static validator for the Arthas add-on: manifests, identifiers, geometry/UVs, references, scripts.
// Exit code 0 = all checks passed.  This is NOT an in-game test.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BP = path.join(ROOT, "behavior_pack"), RP = path.join(ROOT, "resource_pack");
const errors = [], notes = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) errors.push(msg); return cond; };
const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = (p) => path.relative(ROOT, p);

// ---------- 1. every JSON parses
const json = {};
for (const f of [...walk(BP), ...walk(RP)].filter((f) => f.endsWith(".json"))) {
  try { json[rel(f)] = JSON.parse(read(f)); ok(true); } catch (e) { ok(false, `JSON syntax error in ${rel(f)}: ${e.message}`); }
}
const J = (p) => json[p] ?? (errors.push(`missing/invalid JSON ${p}`), {});

// ---------- 2. manifests
const bpM = J("behavior_pack/manifest.json"), rpM = J("resource_pack/manifest.json");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuids = [bpM.header?.uuid, rpM.header?.uuid, ...(bpM.modules ?? []).map((m) => m.uuid), ...(rpM.modules ?? []).map((m) => m.uuid)];
uuids.forEach((u) => ok(UUID.test(u ?? ""), `bad UUID: ${u}`));
ok(new Set(uuids).size === uuids.length, "manifest UUIDs must all be unique");
ok(bpM.format_version === 2 && rpM.format_version === 2, "manifests must use format_version 2");
ok((bpM.dependencies ?? []).some((d) => d.uuid === rpM.header?.uuid), "BP must depend on RP header uuid");
ok((rpM.dependencies ?? []).some((d) => d.uuid === bpM.header?.uuid), "RP must depend on BP header uuid");
ok(JSON.stringify(bpM.header?.version) === JSON.stringify(rpM.header?.version), "BP/RP versions should match");
const scriptMod = (bpM.modules ?? []).find((m) => m.type === "script");
ok(scriptMod && exists(path.join(BP, scriptMod.entry)), "script entry file missing");
ok((bpM.dependencies ?? []).some((d) => d.module_name === "@minecraft/server"), "BP must depend on @minecraft/server");

// ---------- 3. identifiers across files
const ent = J("behavior_pack/entities/arthas.json")["minecraft:entity"]?.description ?? {};
const cli = J("resource_pack/entity/arthas.entity.json")["minecraft:client_entity"]?.description ?? {};
const item = J("behavior_pack/items/frostmourne.json")["minecraft:item"] ?? {};
const att = J("resource_pack/attachables/frostmourne.attachable.json")["minecraft:attachable"]?.description ?? {};
const spawn = J("behavior_pack/spawn_rules/arthas.json")["minecraft:spawn_rules"]?.description ?? {};
ok(ent.identifier === "warcraft:arthas", "BP entity identifier");
ok(cli.identifier === ent.identifier, "client entity identifier must equal BP entity identifier");
ok(spawn.identifier === ent.identifier, "spawn rule identifier must equal entity identifier");
ok(item.description?.identifier === "warcraft:frostmourne", "item identifier");
ok(Object.keys(att.item ?? {})[0] === item.description?.identifier, "attachable item must equal item identifier");
const lang = read(path.join(RP, "texts/en_US.lang"));
ok(lang.includes(`entity.${ent.identifier}.name=`), "lang: entity name");
ok(lang.includes(`item.spawn_egg.entity.${ent.identifier}.name=`), "lang: spawn egg name");
ok(lang.includes(`item.${item.description?.identifier}.name=`), "lang: item name");
const lootPath = ent && J("behavior_pack/entities/arthas.json")["minecraft:entity"]?.components?.["minecraft:loot"]?.table;
ok(lootPath && exists(path.join(BP, lootPath)), `loot table missing: ${lootPath}`);
const icon = item.components?.["minecraft:icon"];
const itex = J("resource_pack/textures/item_texture.json").texture_data?.[icon];
ok(!!itex, `item_texture.json has no entry for icon ${icon}`);
ok(itex && exists(path.join(RP, itex.textures + ".png")), "item icon png missing");
for (const pool of J("behavior_pack/loot_tables/entities/arthas.json").pools ?? [])
  for (const e of pool.entries) ok(/^[a-z0-9_]+:[a-z0-9_]+$/.test(e.name), `loot entry name ${e.name}`);

// ---------- 4. geometry
const pngSize = (p) => { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const geos = {};
for (const f of fs.readdirSync(path.join(RP, "models/entity")).filter((f) => f.endsWith(".geo.json"))) {
  const g = J(`resource_pack/models/entity/${f}`)["minecraft:geometry"]?.[0];
  if (g) geos[g.description.identifier] = g;
}
const arthasGeo = geos[cli.geometry?.default];
ok(!!arthasGeo, `client entity geometry ${cli.geometry?.default} not found in models/entity`);
const sword = geos[att.geometry?.default];
ok(!!sword, `attachable geometry ${att.geometry?.default} not found`);
for (const [id, g] of Object.entries(geos)) {
  const names = new Set();
  const { texture_width: TW, texture_height: TH } = g.description;
  const rects = [];
  g.bones.forEach((b, i) => {
    ok(!names.has(b.name), `${id}: duplicate bone ${b.name}`); names.add(b.name);
    ok(!b.parent || names.has(b.parent), `${id}: bone ${b.name} parent ${b.parent} must be defined earlier`);
    ok(b.pivot?.length === 3, `${id}: bone ${b.name} pivot`);
    for (const c of b.cubes ?? []) {
      ok(c.size.every((s) => Number.isInteger(s) && s >= 1), `${id}: ${b.name} non-integer cube size ${c.size}`);
      ok(!c.rotation || (c.pivot?.length === 3 && c.rotation.filter((r) => Math.abs(r) > 1e-6).length <= 1), `${id}: ${b.name} cube rotation needs pivot & single axis`);
      const [w, h, d] = c.size, [u, v] = c.uv;
      for (const r of [[u + d, v, 2 * w, d], [u, v + d, 2 * d + 2 * w, h]]) {
        ok(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= TW && r[1] + r[3] <= TH, `${id}: ${b.name} uv out of atlas ${JSON.stringify(r)}`);
        rects.push({ r, b: b.name });
      }
    }
  });
  // UV overlap (box nets of different cubes must not overlap)
  let overlap = 0;
  const pxMap = new Uint8Array(TW * TH);
  for (const { r } of rects) for (let y = r[1]; y < r[1] + r[3]; y++) for (let x = r[0]; x < r[0] + r[2]; x++) { if (pxMap[y * TW + x]) overlap++; pxMap[y * TW + x] = 1; }
  ok(overlap === 0, `${id}: ${overlap} overlapping UV pixels`);
  const cubes = g.bones.reduce((s, b) => s + (b.cubes?.length ?? 0), 0);
  notes.push(`${id}: ${g.bones.length} bones, ${cubes} cubes, atlas ${TW}x${TH}, ${((pxMap.reduce((a, b) => a + b, 0) / (TW * TH)) * 100).toFixed(0)}% used`);
}
const boneSet = new Set(arthasGeo?.bones.map((b) => b.name));

// ---------- 5. render controllers, textures
const rc = J("resource_pack/render_controllers/arthas.render.json").render_controllers ?? {};
ok(JSON.stringify([...(cli.render_controllers ?? [])].sort()) === JSON.stringify(Object.keys(rc).sort()), "client entity render_controllers must equal the controllers defined");
const shown = new Map();
const propIds = new Set(Object.keys(ent.properties ?? {}));
for (const [name, c] of Object.entries(rc)) {
  for (const pv of c.part_visibility ?? []) for (const [bone, v] of Object.entries(pv)) {
    if (bone === "*") continue;
    ok(boneSet.has(bone), `${name}: part_visibility bone '${bone}' not in geometry`);
    shown.set(bone, (shown.get(bone) ?? 0) + 1);
    if (typeof v === "string") for (const m of v.matchAll(/property\('([^']+)'\)/g)) ok(propIds.has(m[1]), `${name}: unknown entity property ${m[1]}`);
  }
  for (const t of c.textures ?? []) for (const m of t.matchAll(/property\('([^']+)'\)/g)) ok(propIds.has(m[1]), `${name}: unknown entity property ${m[1]}`);
  for (const [arr, list] of Object.entries(c.arrays?.textures ?? {})) for (const t of list) ok(cli.textures?.[t.replace("Texture.", "")], `${name}: ${t} not defined in client entity textures`);
  ok(cli.materials?.[c.materials?.[0]?.["*"]?.replace("Material.", "")], `${name}: material not defined`);
}
for (const b of boneSet) ok((shown.get(b) ?? 0) === 1, `bone '${b}' is shown by ${shown.get(b) ?? 0} render controllers (expected exactly 1)`);
const [aw, ah] = [arthasGeo.description.texture_width, arthasGeo.description.texture_height];
for (const [k, t] of Object.entries(cli.textures ?? {})) {
  const p = path.join(RP, t + ".png");
  if (!ok(exists(p), `texture file missing: ${t}.png`)) continue;
  const [w, h] = pngSize(p);
  ok(w % aw === 0 && h % ah === 0 && w / aw === h / ah, `${t}.png is ${w}x${h}: must be an integer multiple of the ${aw}x${ah} UV atlas`);
}
{
  const t = att.textures?.default; const p = path.join(RP, t + ".png");
  if (ok(exists(p), `attachable texture missing ${t}`)) { const [w, h] = pngSize(p); const g = sword.description; ok(w % g.texture_width === 0 && w / g.texture_width === h / g.texture_height, `${t}.png size ${w}x${h} vs atlas`); }
}
const phaseTexKeys = Object.keys(cli.textures ?? {});
ok(phaseTexKeys.length === 12, "expected 4 layers x 3 phase textures");

// ---------- 6. animations & controllers
const animFiles = ["arthas.animation.json", "frostmourne.animation.json"].map((f) => J(`resource_pack/animations/${f}`).animations ?? {});
const allAnims = Object.assign({}, ...animFiles);
const ctrls = J("resource_pack/animation_controllers/arthas.controller.json").animation_controllers ?? {};
for (const [short, id] of Object.entries(cli.animations ?? {})) ok(allAnims[id] || ctrls[id], `client entity animation '${short}' -> ${id} not defined`);
const swordBones = new Set(sword?.bones.map((b) => b.name));
for (const [id, a] of Object.entries(allAnims)) {
  const target = id.startsWith("animation.warcraft_frostmourne") ? swordBones : boneSet;
  for (const b of Object.keys(a.bones ?? {})) ok(target.has(b), `${id}: animates unknown bone '${b}'`);
}
for (const [cid, c] of Object.entries(ctrls)) {
  ok(c.states?.[c.initial_state ?? "default"], `${cid}: initial state missing`);
  for (const [sn, s] of Object.entries(c.states ?? {})) {
    for (const a of s.animations ?? []) ok(cli.animations?.[typeof a === "string" ? a : Object.keys(a)[0]], `${cid}/${sn}: animation ${JSON.stringify(a)} not in client entity`);
    for (const t of s.transitions ?? []) ok(c.states[Object.keys(t)[0]], `${cid}/${sn}: transition to unknown state`);
  }
}
for (const a of cli.scripts?.animate ?? []) ok(cli.animations?.[typeof a === "string" ? a : Object.keys(a)[0]], `scripts.animate '${a}' undefined`);
for (const [k, v] of Object.entries(att.animations ?? {})) ok(allAnims[v], `attachable animation ${k} -> ${v} undefined`);
for (const [k, v] of Object.entries(cli.particle_effects ?? {})) {
  const f = `resource_pack/particles/${v.split(":")[1]}.json`;
  ok(json[f]?.particle_effect?.description?.identifier === v, `particle ${v} must be defined in ${f}`);
}

// ---------- 7. entity definition sanity
const props = ent.properties ?? {};
for (const [id, p] of Object.entries(props)) {
  ok(id.startsWith("warcraft:"), `property ${id} namespace`);
  if (p.type === "enum") { ok(p.values.length <= 16 && p.values.includes(p.default), `${id}: enum <=16 values and default must be listed`); ok(new Set(p.values).size === p.values.length, `${id}: duplicate enum values`); }
  if (p.type === "int") ok(p.default >= p.range[0] && p.default <= p.range[1], `${id}: default outside range`);
}
const comps = J("behavior_pack/entities/arthas.json")["minecraft:entity"]?.components ?? {};
ok(comps["minecraft:health"]?.max >= comps["minecraft:health"]?.value, "health max >= value");
for (const [ev, e] of Object.entries(J("behavior_pack/entities/arthas.json")["minecraft:entity"]?.events ?? {}))
  for (const g of e.add?.component_groups ?? []) ok(J("behavior_pack/entities/arthas.json")["minecraft:entity"].component_groups?.[g], `event ${ev}: unknown component group ${g}`);

// ---------- 8. scripts: import graph + property usage
const scriptsDir = path.join(BP, "scripts");
for (const f of walk(scriptsDir).filter((f) => f.endsWith(".js"))) {
  const src = read(f);
  for (const m of src.matchAll(/(?:^|\n)\s*import[^'"]*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith(".")) ok(exists(path.resolve(path.dirname(f), spec)), `${rel(f)}: unresolved import ${spec}`);
    else ok(["@minecraft/server", "@minecraft/server-ui"].includes(spec), `${rel(f)}: unsupported module import ${spec}`);
  }
  for (const m of src.matchAll(/(?:set|get)Property\(\s*["'](warcraft:[a-z_]+)["']/g)) ok(propIds.has(m[1]), `${rel(f)}: uses undefined entity property ${m[1]}`);
}
for (const m of lang.matchAll(/^([^#=\n]+)=/gm)) ok(m[1].length > 0);

// ---------- report
console.log(notes.map((n) => "  • " + n).join("\n"));
console.log(`\n${checks} checks run.`);
if (errors.length) { console.error(`\n${errors.length} PROBLEM(S):\n` + errors.map((e) => "  ✗ " + e).join("\n")); process.exit(1); }
console.log("✓ add-on validation passed (static checks only; in-game testing is still required).");
