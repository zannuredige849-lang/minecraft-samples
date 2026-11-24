"""Build the Illidan add-on: geometry, textures, animations, entities, packs and preview renders.

    python3 tools/build.py            # from warcraft_illidan/
"""
import json
import os
import shutil
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "models"))

from PIL import Image  # noqa: E402

import dark  # noqa: E402
import demon  # noqa: E402
import elf  # noqa: E402
from mcgeo import write_json  # noqa: E402

NS = "warcraft"
RP = os.path.join(ROOT, "resource_pack")
BP = os.path.join(ROOT, "behavior_pack")
PV = os.path.join(ROOT, "previews")

FORMS = [
    dict(
        mod=elf, ident="illidan_elf", title="Illidan Stormrage - Night Elf",
        egg=("#2a2614", "#4d7d1c"), health=200, damage=10, speed=0.32, box=(0.8, 2.2), kb=0.4,
        pose="crossed", wings=False,
    ),
    dict(
        mod=demon, ident="illidan_demon", title="Illidan Stormrage - Demon Form",
        egg=("#7568a1", "#720d0d"), health=400, damage=16, speed=0.30, box=(1.1, 2.8), kb=0.7,
        pose="stand", wings=True,
    ),
    dict(
        mod=dark, ident="illidan_demon_dark", title="Illidan Stormrage - Dark Demon",
        egg=("#3a2548", "#20d62a"), health=450, damage=18, speed=0.30, box=(1.1, 2.8), kb=0.8,
        pose="stand", wings=True,
    ),
]


def ensure(path):
    os.makedirs(path, exist_ok=True)
    return path


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "warcraft_illidan/" + name))


# ------------------------------------------------------------------------------------ animations
def pose_bones(pose):
    return {b: {"rotation": [round(v, 3) for v in p["rot"]]} for b, p in pose.items() if "rot" in p}


def idle_animation(form, pose_name, extra_bones=None):
    mod = form["mod"]
    bones = pose_bones(mod.POSES[pose_name])
    bones.setdefault("body", {})["position"] = {
        "0.0": [0, 0, 0], "1.5": [0, -0.35, 0], "3.0": [0, 0, 0],
    }
    bones.setdefault("head", {})["rotation"] = {
        "0.0": [0, 0, 0], "1.5": [1.5, 1.2, 0], "3.0": [0, 0, 0],
    }
    if form["wings"]:
        for s, sx in (("r", 1), ("l", -1)):
            bones[f"wing_{s}"] = {
                "rotation": {
                    "0.0": [0, 0, 0],
                    "1.2": [-3, -sx * 9, -sx * 4],
                    "2.4": [0, 0, 0],
                    "3.0": [0, 0, 0],
                }
            }
    for k, v in (extra_bones or {}).items():
        bones.setdefault(k, {}).update(v)
    return {"loop": True, "animation_length": 3.0, "bones": bones}


def walk_animation(form, swing_arms=True):
    t = "query.limb_swing * 38.17"
    a = "query.limb_swing_amount"
    bones = {
        "leg_r": {"rotation": [f"Math.cos({t}) * 42 * {a}", 0, 0]},
        "leg_l": {"rotation": [f"Math.cos({t} + 180) * 42 * {a}", 0, 0]},
        "shin_r": {"rotation": [f"Math.max(0, Math.cos({t} + 70)) * 38 * {a}", 0, 0]},
        "shin_l": {"rotation": [f"Math.max(0, Math.cos({t} + 250)) * 38 * {a}", 0, 0]},
        "body": {"rotation": [0, f"Math.cos({t}) * 3 * {a}", 0]},
    }
    if swing_arms:
        bones["arm_r"] = {"rotation": [f"Math.cos({t} + 180) * 22 * {a}", 0, 0]}
        bones["arm_l"] = {"rotation": [f"Math.cos({t}) * 22 * {a}", 0, 0]}
    return {"loop": True, "bones": bones}


def animations_for(form):
    ident = form["ident"]
    anims = {}
    if form["mod"] is elf:
        anims[f"animation.{ident}.crossed"] = idle_animation(
            form, "crossed", {"glaive_r": {"scale": 0}, "glaive_l": {"scale": 0}}
        )
        anims[f"animation.{ident}.armed"] = idle_animation(form, "armed")
        anims[f"animation.{ident}.walk"] = walk_animation(form, swing_arms=False)
    else:
        anims[f"animation.{ident}.idle"] = idle_animation(form, form["pose"])
        anims[f"animation.{ident}.walk"] = walk_animation(form, swing_arms=True)
    return anims


# ------------------------------------------------------------------------------------ entities
def client_entity(form):
    ident = form["ident"]
    if form["mod"] is elf:
        animations = {
            "crossed": f"animation.{ident}.crossed",
            "armed": f"animation.{ident}.armed",
            "walk": f"animation.{ident}.walk",
        }
        animate = [
            {"crossed": "!query.has_target"},
            {"armed": "query.has_target"},
            {"walk": "query.limb_swing_amount > 0.05"},
        ]
    else:
        animations = {"idle": f"animation.{ident}.idle", "walk": f"animation.{ident}.walk"}
        animate = ["idle", {"walk": "query.limb_swing_amount > 0.05"}]
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"{NS}:{ident}",
                "min_engine_version": "1.16.0",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": f"textures/entity/{ident}"},
                "geometry": {"default": f"geometry.{ident}"},
                "animations": animations,
                "scripts": {"animate": animate},
                "render_controllers": ["controller.render.illidan"],
                "spawn_egg": {"base_color": form["egg"][0], "overlay_color": form["egg"][1]},
            }
        },
    }


def server_entity(form):
    ident = form["ident"]
    w, h = form["box"]
    return {
        "format_version": "1.20.0",
        "minecraft:entity": {
            "description": {
                "identifier": f"{NS}:{ident}",
                "is_spawnable": True,
                "is_summonable": True,
                "is_experimental": False,
            },
            "components": {
                "minecraft:type_family": {"family": ["illidan", "monster"]},
                "minecraft:health": {"value": form["health"], "max": form["health"]},
                "minecraft:attack": {"damage": form["damage"]},
                "minecraft:movement": {"value": form["speed"]},
                "minecraft:follow_range": {"value": 32},
                "minecraft:knockback_resistance": {"value": form["kb"]},
                "minecraft:collision_box": {"width": w, "height": h},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
                "minecraft:nameable": {},
                "minecraft:persistent": {},
                "minecraft:experience_reward": {"on_death": "50"},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:navigation.walk": {"can_path_over_water": False, "avoid_water": True, "can_break_doors": True},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.hurt_by_target": {"priority": 1},
                "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True},
                "minecraft:behavior.nearest_attackable_target": {
                    "priority": 2,
                    "must_see": True,
                    "reselect_targets": True,
                    "entity_types": [
                        {"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 32}
                    ],
                },
                "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
                "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
                "minecraft:behavior.random_look_around": {"priority": 8},
                "minecraft:boss": {"hud_range": 48, "name": form["title"], "should_darken_sky": False},
            },
        },
    }


def manifest(kind, name, desc, deps=None):
    mod_type = "resources" if kind == "rp" else "data"
    m = {
        "format_version": 2,
        "header": {
            "name": name,
            "description": desc,
            "uuid": uid(f"{kind}-header"),
            "version": [1, 0, 0],
            "min_engine_version": [1, 20, 0],
        },
        "modules": [{"type": mod_type, "uuid": uid(f"{kind}-module"), "version": [1, 0, 0]}],
    }
    if deps:
        m["dependencies"] = [{"uuid": deps, "version": [1, 0, 0]}]
    return m


# ------------------------------------------------------------------------------------ previews
def render_views(form, tex, model, poses, name, size=420):
    views = [(0, 10), (38, 10), (90, 10), (180, 10)]
    sheet = Image.new("RGB", (size * len(views), size * len(poses)), (255, 255, 255))
    for r, (pose, hide, *tilt) in enumerate(poses):
        views = [(0, 10 + (tilt[0] if tilt else 0)), (38, 10 + (tilt[0] if tilt else 0)), (90, 10), (180, 10 + (tilt[0] if tilt else 0))]
        # one shared frame per row so the four angles keep the same scale
        import numpy as np

        lo, hi = model.bounds_xyz(pose)
        c = (lo + hi) / 2
        span = max(hi[1] - lo[1], hi[0] - lo[0], hi[2] - lo[2]) * 1.12
        for i, (yaw, pitch) in enumerate(views):
            im = model.render(tex, pose, yaw, pitch, size=size, hide=hide, frame=(0, c[1], span))
            sheet.paste(im.convert("RGB"), (size * i, size * r))
    sheet.save(os.path.join(PV, f"{name}_views.png"))


def main():
    for d in (RP, BP, PV):
        shutil.rmtree(d, ignore_errors=True)
    for sub in ("models/entity", "textures/entity", "entity", "animations", "render_controllers", "texts"):
        ensure(os.path.join(RP, sub))
    for sub in ("entities", "texts"):
        ensure(os.path.join(BP, sub))
    ensure(PV)

    lang_rp, lang_bp = [], []
    icon_src = None
    for form in FORMS:
        mod, ident = form["mod"], form["ident"]
        model = mod.build()
        tex = model.texture()
        write_json(os.path.join(RP, "models/entity", f"{ident}.geo.json"), model.geo())
        tex.save(os.path.join(RP, "textures/entity", f"{ident}.png"))
        write_json(os.path.join(RP, "entity", f"{ident}.entity.json"), client_entity(form))
        write_json(
            os.path.join(RP, "animations", f"{ident}.animation.json"),
            {"format_version": "1.8.0", "animations": animations_for(form)},
        )
        write_json(os.path.join(BP, "entities", f"{ident}.json"), server_entity(form))
        lang_rp.append(f"entity.{NS}:{ident}.name={form['title']}")
        lang_rp.append(f"item.spawn_egg.entity.{NS}:{ident}.name=Spawn {form['title']}")

        # previews
        tex.resize((tex.width * 3, tex.height * 3), Image.NEAREST).save(os.path.join(PV, f"{ident}_texture_x3.png"))
        if mod is elf:
            poses = [(mod.POSES["crossed"], ("glaive",)), (mod.POSES["armed"], (), 30)]
        else:
            poses = [(mod.POSES["stand"], ())]
        render_views(form, tex, model, poses, ident)
        if mod is demon:
            icon_src = model.render(tex, mod.POSES["stand"], 15, 12, size=256, hide=("wing_r", "wing_l"),
                                    frame=(0, 36, 64))

    write_json(
        os.path.join(RP, "render_controllers", "illidan.render_controllers.json"),
        {
            "format_version": "1.8.0",
            "render_controllers": {
                "controller.render.illidan": {
                    "geometry": "Geometry.default",
                    "materials": [{"*": "Material.default"}],
                    "textures": ["Texture.default"],
                }
            },
        },
    )
    write_json(os.path.join(RP, "manifest.json"), manifest("rp", "Illidan Stormrage - Resources", "Illidan models: night elf, demon and dark demon forms.", None))
    write_json(os.path.join(BP, "manifest.json"), manifest("bp", "Illidan Stormrage - Behavior", "Illidan boss entities.", uid("rp-header")))
    # the resource pack must also depend on the behavior pack's resource pack link (rp declares nothing)
    with open(os.path.join(RP, "texts", "en_US.lang"), "w") as fh:
        fh.write("\n".join(lang_rp) + "\n")
    with open(os.path.join(RP, "texts", "languages.json"), "w") as fh:
        fh.write('["en_US"]\n')
    with open(os.path.join(BP, "texts", "en_US.lang"), "w") as fh:
        fh.write("\n".join(lang_rp) + "\n")
    with open(os.path.join(BP, "texts", "languages.json"), "w") as fh:
        fh.write('["en_US"]\n')
    if icon_src is not None:
        icon = icon_src.resize((256, 256), Image.NEAREST)
        icon.save(os.path.join(RP, "pack_icon.png"))
        icon.save(os.path.join(BP, "pack_icon.png"))
    print("built", [f["ident"] for f in FORMS])


if __name__ == "__main__":
    main()
