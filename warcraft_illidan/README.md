# Illidan Stormrage – Bedrock add-on (three forms)

Three custom entities modelled after the supplied Blockbench/Minecraft reference renders of Illidan:

| Entity id | Form | Signature features |
|---|---|---|
| `warcraft:illidan_elf` | Night elf | black blindfold with glowing green eyes, olive horns (one long swept arm, one with a spiral plate), mauve skin with green tattoos, tan bracers over crossed arms, gold-trimmed green tassets with a red gem, gold-banded greaves, green Azzinoth glaives |
| `warcraft:illidan_demon` | Demon (purple) | lilac skin with black swirl tattoos, striped black/cream horn pillars, blindfold, long navy hair with red beads, tall ears, grey belt and red/cream wraps, large feathered wings with a hooked claw, skull warglaives |
| `warcraft:illidan_demon_dark` | Dark demon | obsidian skin with glowing green runes, horn arc + spiral plate, spiky hair, wings that crumble into pixels |

`/summon warcraft:illidan_elf` (or `_demon`, `_demon_dark`), or use the spawn eggs.
They are hostile melee bosses (boss bar, 200–450 HP) that target players.

## Contents

```
resource_pack/   geometry (models/entity), 128–256px textures, animations, client entities, render controller
behavior_pack/   server entities (stats, melee AI, boss bar)
previews/        renders from several angles + texture sheets (x3)
tools/           the generator that produces everything above
```

Install: copy `resource_pack` and `behavior_pack` into your `development_resource_packs` /
`development_behavior_packs` folders (or zip each as `.mcpack`) and enable both on a world.

## Rebuilding

Everything is generated from Python specs, so models and textures can be tweaked and rebuilt:

```
pip install pillow numpy
python3 tools/build.py      # geometry, textures, animations, entities, previews
python3 tools/validate.py   # structural checks (bone parents, UV bounds, texture sizes, manifests)
```

* `tools/mcgeo.py` – box-UV packer, Bedrock geo exporter and a small software renderer used for the previews
* `tools/paint.py` – pixel painters (banded gradients, rim light, ASCII-art motifs)
* `tools/models/{elf,demon,dark}.py` – one file per form (cubes, textures, poses)

## Animations

* Demons: `idle` (breathing, head sway, wing flap) + `walk` (limb swing).
* Elf: `crossed` (arms crossed, glaives hidden) while idle, `armed` (glaives drawn) when the entity has a target, plus `walk`.

## Status / known limitations

* **Not tested in-game.** There is no Minecraft client in the build environment. The previews come from the
  bundled software renderer, which follows the Bedrock UV and rotation conventions but is not the game's renderer.
  The JSON passes `tools/validate.py` only.
* The elf's armed/crossed switch uses `query.has_target`; if that query is not available client-side in your game
  version the elf simply stays in the crossed pose.
* Glow (runes, eyes) is painted as bright colours with the `entity_alphatest` material, so it does not emit light.
* The models imitate the reference renders; they are not extracted from them, so proportions are matched by eye.
