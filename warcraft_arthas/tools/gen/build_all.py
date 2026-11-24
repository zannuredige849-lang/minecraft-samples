#!/usr/bin/env python3
"""Regenerate every model/texture asset of the Arthas add-on from the specs.

Outputs (relative to the add-on root):
  resource_pack/models/entity/arthas.geo.json, frostmourne.geo.json
  resource_pack/textures/entity/arthas/{body,armor,frost_effect,frostmourne}[_phaseN].png
  resource_pack/textures/entity/frostmourne/frostmourne.png (+phases) -- standalone sword
  blockbench/arthas.bbmodel, blockbench/frostmourne.bbmodel
"""
import json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from arthas_spec import build_arthas
from frostmourne_spec import add_frostmourne
from spec_lib import Model, pack_layer
from paint import paint_layer
from export import geo_json, bbmodel
import gen_resources

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RP = os.path.join(ROOT, "resource_pack")
LAYOUT = 256
SCALE = {"cloth": 2, "metal": 2, "frost": 2, "sword": 4}
TEX_NAME = {"cloth": "body", "metal": "armor", "frost": "frost_effect", "sword": "frostmourne"}


def w(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def build_sword_model():
    m = Model("geometry.warcraft_frostmourne")
    m.bone("root", None, (0, 0, 0), "sword")
    add_frostmourne(m, "root", (0, 14, 0))
    return m


def main():
    arthas = build_arthas()
    # One shared atlas layout: Blockbench (and Bedrock) work with ONE uv layout per geometry. Each layer
    # texture file only contains the regions of its own bones; render controllers show only those bones.
    used = pack_layer(list(arthas.all_cubes()), LAYOUT)
    print(f"atlas rows used: {used}/{LAYOUT}")
    w(os.path.join(RP, "models/entity/arthas.geo.json"), geo_json(arthas, LAYOUT, LAYOUT, (4, 4.4, (0, 2.0, 0))))

    sword = build_sword_model()
    pack_layer(sword.layer_cubes("sword"), 128)
    w(os.path.join(RP, "models/entity/frostmourne.geo.json"), geo_json(sword, 128, 128, (2, 3.4, (0, 1.4, 0))))

    # ---- textures: three boss phases for every layer
    phase1 = {}
    phase_imgs = {}
    for phase in (1, 2, 3):
        suffix = "" if phase == 1 else f"_phase{phase}"
        for layer in ("cloth", "metal", "frost", "sword"):
            im = paint_layer(arthas.layer_cubes(layer), LAYOUT, SCALE[layer], phase)
            im.save(os.path.join(RP, f"textures/entity/arthas/{TEX_NAME[layer]}{suffix}.png"), optimize=True)
            phase_imgs.setdefault(phase, {})[layer] = im
            if phase == 1:
                phase1[layer] = im
        im = paint_layer(sword.layer_cubes("sword"), 128, 4, phase)
        im.save(os.path.join(RP, f"textures/entity/frostmourne/frostmourne{suffix}.png"), optimize=True)
        if phase == 1:
            sword_tex = im

    os.makedirs(os.path.join(ROOT, "blockbench"), exist_ok=True)
    # Blockbench shows a single texture per entity model -> composite of all layers (phase 1)
    def composite(imgs):
        c = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        for layer in ("cloth", "metal", "frost", "sword"):
            c.alpha_composite(imgs[layer].resize((512, 512), Image.LANCZOS if layer == "sword" else Image.NEAREST))
        return c
    comp = composite(phase1)
    comp.save(os.path.join(ROOT, "blockbench/arthas_preview_texture.png"), optimize=True)
    for ph in (2, 3):
        composite(phase_imgs[ph]).save(os.path.join(ROOT, f"blockbench/arthas_preview_texture_phase{ph}.png"), optimize=True)
    w(os.path.join(ROOT, "blockbench/arthas.bbmodel"), bbmodel(arthas, LAYOUT, LAYOUT, comp, "arthas", (4, 4.4, 2.0), hidden=("frost_p2_aura", "frost_p3_wings")))
    w(os.path.join(ROOT, "blockbench/frostmourne.bbmodel"), bbmodel(sword, 128, 128, sword_tex, "frostmourne", (2, 3.4, 1.4)))
    gen_resources.write_all(ROOT, arthas)
    n = sum(1 for _ in arthas.all_cubes())
    print(f"arthas: {n} cubes / {len(arthas.bones)} bones; frostmourne standalone: {sum(1 for _ in sword.all_cubes())} cubes")


if __name__ == "__main__":
    main()
