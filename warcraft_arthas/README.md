# WARCRAFT — Arthas Menethil, Frostmourne & the Enslavement of Souls
Minecraft Bedrock add-on (behavior pack + resource pack). Target: `min_engine_version 1.26.10`, `@minecraft/server 2.0.0`.

> **Honesty note.** Everything below marked ✅ was verified by tools in this repository (JSON/reference validator,
> TypeScript type-check against the real `@minecraft/server@2.0.0` typings, unit tests, and import/render in a real
> Blockbench build). **Nothing has been run inside Minecraft yet.** Items marked ⏳ are not implemented; items marked
> ⚠️ are implemented but need in-game tuning/confirmation.

## Status by stage
| Stage | Scope | State |
|---|---|---|
| 1 | Architecture, manifests, validation tooling | ✅ done (static validation only) |
| 2 | Arthas model + UV + textures, Frostmourne | ✅ done (370-cube model, 3 phase texture sets, standalone sword) |
| 2b | Revision: slimmer/smaller sword, cleaner textures, smooth-mesh Frostmourne experiment | ✅ done (mesh variant is experimental) |
| 3 | Entity registration, rendering, animations | 🟡 entity + 4-layer render controllers + `idle`/`walk` done; action animations ⏳ |
| 4–10 | AI, abilities, souls, servants, phases, cinematic, audio, final QA | ⏳ not started |

## Layout
```
behavior_pack/   manifest, entities/arthas.json, items/frostmourne.json, loot_tables, spawn_rules, scripts/ (main.js, core/*)
resource_pack/   manifest, entity/, models/entity/{arthas,frostmourne}.geo.json, textures/, animations/, animation_controllers/,
                 render_controllers/, attachables/, particles/, texts/
blockbench/      arthas.bbmodel, frostmourne.bbmodel (open in Blockbench; composite preview texture)
previews/        renders made with a real Blockbench build (multiple angles, 3 boss phases, head, sword, legs)
tools/gen/       Python generator: model specs (arthas_spec.py, frostmourne_spec.py) -> geo.json, bbmodel, textures, render controllers
tools/validate/  validate_addon.mjs      tools/preview/  Blockbench screenshot + geo round-trip scripts
tests/           node:test unit tests
```
Models and textures are **generated** from `tools/gen/*_spec.py`: edit the spec, run `python3 tools/gen/build_all.py`.

## The model (Stage 2)
* 50 bones / 360 cubes; hierarchy `root → body → torso, chest_armor, waist(_armor), tabard, cape → cape_mid → cape_low → cape_tail,
  shoulder_*, arm_* → forearm_* → gauntlet_* → frostmourne, head → helmet → helmet_crown, eyes, hair…; leg_* → shin_* → boot_*`.
* Rendered as **four texture layers** by four render controllers (`part_visibility` is generated from each bone's layer):
  `body.png` (skin/cloth/hair/cape/tabard), `armor.png` (Saronite plate), `frost_effect.png` (ice crystals), `frostmourne.png` (sword).
  All layers share one 256×256 UV atlas; textures are 512 px (sword 1024 px) = 2×/4× density.
* **Three phase texture sets** (`*_phase2.png`, `*_phase3.png`) selected with `q.property('warcraft:phase')`; extra frost bones
  (`frost_p2_aura`, `frost_p3_wings`) appear in phases 2/3.
* Glow uses `entity_emissive_alpha`: texture alpha 1–254 = emissive (lower = brighter), 255 = normal
  ([Bedrock Wiki — Glowing Entity Texture](https://wiki.bedrock.dev/visuals/glowing-texture)). Eyes, runes, gems, skull sockets use it. ⚠️ confirm look in game.
* Frostmourne exists twice: embedded in `geometry.warcraft_arthas` (bone `frostmourne`, held in the right fist) and as the standalone
  `geometry.warcraft_frostmourne` + `attachable` for the player-held item. ⚠️ attachable hold offsets (`animations/frostmourne.animation.json`) are estimates.
* Rest pose is baked into the geometry (right arm raised, blade up-forward); animations are additive on top.

## Beyond cubes: smooth mesh Frostmourne (experimental)
`python3 tools/gen/mesh_frostmourne.py` builds Frostmourne as a real mesh (lenticular blade with raised rune ridge and glowing fuller,
swept horn-like guard prongs, skull, wrapped grip, ice crystals; 3456 verts / 5728 tris) and exports:
* `models_mesh/frostmourne_hero.glb` / `.obj` + `.mtl` + base & emissive PNGs — open in Blender, any glTF viewer, or Blockbench (Generic model).
* `resource_pack/models/entity/frostmourne_mesh.geo.json` — Bedrock **`poly_mesh`** geometry (`geometry.warcraft_frostmourne_mesh`) +
  `textures/entity/frostmourne/frostmourne_mesh.png`. `poly_mesh` is documented in the official geometry schema (all versions up to 1.26.x),
  but it is **not wired to any entity/attachable** and is unverified in game: Blockbench cannot edit/round-trip it, and UV-v/handedness
  conventions are assumptions. To try it, point `attachables/frostmourne.attachable.json` `geometry.default` at the mesh geometry and its texture
  at `frostmourne_mesh`. The cube sword remains the safe default.
* Hero renders (three.js + bloom) are in `previews/08_*`, `09_*`; render your own with `tools/preview/render_glb.cjs` (serve the project root on `:8766`).

## Commands (⚠️ syntactically checked only, not run in game)
```
/give @s warcraft:frostmourne
/summon warcraft:arthas            (or /summon warcraft:arthas ~ ~ ~)
/tag @s add warcraft_dev           (enables developer commands for yourself)
/scriptevent warcraft:help         list developer commands
/scriptevent warcraft:spawn        spawn Arthas 8 blocks ahead
/scriptevent warcraft:give         give Frostmourne
/scriptevent warcraft:phase 2      force the *visual* phase (1-3) of the nearest Arthas
/scriptevent warcraft:action raise set the `warcraft:action` property of the nearest Arthas (no animation bound yet)
/scriptevent warcraft:persist_test dynamic-property round trip (20 kB, chunked)
```

## Verify / build
```
npm install                      # typings (@minecraft/server 2.0.0) + three + typescript
python3 tools/gen/build_all.py   # regenerate models, textures, render controllers, bbmodels
node tools/validate/validate_addon.mjs   # 2134 static checks: manifests, UUIDs, IDs, UV overlap, bone/animation/controller refs, textures, imports
npx tsc -p tools/tsconfig.json   # type-checks all scripts against the real API typings
node --test tests/*.test.mjs     # unit tests (config, phases, utilities, persistence)
python3 tools/build_mcaddon.py   # dist/warcraft_arthas.mcaddon
```
Previews: build Blockbench (`npm install --ignore-scripts && node build.js --target=web`), serve it on `:8765`, then
`NODE_PATH=$(npm root -g) node tools/preview/bb_shots.cjs blockbench/arthas.bbmodel <outdir> <prefix> arthas <phase>`.

## Known limitations / design decisions
* `minecraft:health` has no minimum, so the future death sequence will intercept lethal damage in scripts (heal back to a floor, then run the sequence) — it cannot be made hit-proof by data alone.
* `@minecraft/server` 2.0.0 exposes no operator check; developer commands are gated by the `warcraft_dev` tag.
* Natural spawning is deliberately extremely rare (frozen biomes, ≥96 blocks from players, density 1); remove `spawn_rules/arthas.json` to disable.
* No audio is shipped yet (Stage 9); no file references a missing sound.
