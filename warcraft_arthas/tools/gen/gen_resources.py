"""Generates resource-pack JSON that must stay in sync with the geometry: render controllers
(part_visibility lists are derived from each bone's layer) and the client entity definition."""
import json, os

PHASE_TEXTURE_SUFFIX = {1: "", 2: "_phase2", 3: "_phase3"}
LAYERS = [  # (render-controller suffix, layer, texture base name, texture array key)
    ("body", "cloth", "body", "body"),
    ("armor", "metal", "armor", "armor"),
    ("frost", "frost", "frost_effect", "frost"),
    ("sword", "sword", "frostmourne", "sword"),
]
PHASE_BONES = {"frost_p2_aura": "q.property('warcraft:phase') >= 2", "frost_p3_wings": "q.property('warcraft:phase') >= 3"}


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def render_controllers(model):
    ctrls = {}
    for suffix, layer, _tex, key in LAYERS:
        vis = [{"*": False}]
        for b in model.layer_bones(layer):
            vis.append({b: PHASE_BONES.get(b, True)})
        ctrls[f"controller.render.warcraft_arthas_{suffix}"] = {
            "arrays": {"textures": {f"Array.{key}": [f"Texture.{key}_{i}" for i in (1, 2, 3)]}},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": [f"Array.{key}[q.property('warcraft:phase') - 1]"],
            "part_visibility": vis,
        }
    return {"format_version": "1.8.0", "render_controllers": ctrls}


def client_entity():
    textures = {}
    for _s, _l, base, key in LAYERS:
        for p, suf in PHASE_TEXTURE_SUFFIX.items():
            textures[f"{key}_{p}"] = f"textures/entity/arthas/{base}{suf}"
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "warcraft:arthas",
            "materials": {"default": "entity_emissive_alpha"},
            "textures": textures,
            "geometry": {"default": "geometry.warcraft_arthas"},
            "animations": {
                "idle": "animation.warcraft_arthas.idle",
                "walk": "animation.warcraft_arthas.walk",
                "locomotion": "controller.animation.warcraft_arthas.locomotion",
            },
            "scripts": {"animate": ["locomotion"]},
            "particle_effects": {
                "frost_aura": "warcraft:frost_aura",
                "soul_absorption": "warcraft:soul_absorption",
                "frost_impact": "warcraft:frost_impact",
            },
            "render_controllers": [f"controller.render.warcraft_arthas_{s}" for s, *_ in LAYERS],
            "spawn_egg": {"base_color": "#0a1530", "overlay_color": "#7fe3ff"},
        }},
    }


def write_all(root, model):
    rp = os.path.join(root, "resource_pack")
    dump(os.path.join(rp, "render_controllers/arthas.render.json"), render_controllers(model))
    dump(os.path.join(rp, "entity/arthas.entity.json"), client_entity())
