"""Write the non-generated add-on files: manifests, entities, animation controller, render controller, lang, loot."""
import json
import os
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "resource_pack"), os.path.join(ROOT, "behavior_pack")
ID = "warcraft:great_unclean_one"
NAME = "great_unclean_one"


def u(tag):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "warcraft_great_unclean_one/" + tag))


def put(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def text(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(s)


def main():
    ver = [1, 0, 0]
    engine = [1, 21, 0]
    put(os.path.join(RP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "Great Unclean One - Resources", "description": "Great Unclean One boss model, texture and animations (converted from a Warcraft III model).",
                   "uuid": u("rp-header"), "version": ver, "min_engine_version": engine},
        "modules": [{"type": "resources", "uuid": u("rp-module"), "version": ver}],
    })
    put(os.path.join(BP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "Great Unclean One - Behavior", "description": "Great Unclean One boss entity.",
                   "uuid": u("bp-header"), "version": ver, "min_engine_version": engine},
        "modules": [{"type": "data", "uuid": u("bp-module"), "version": ver}],
        "dependencies": [{"uuid": u("rp-header"), "version": ver}],
    })

    # ---------------------------------------------------------------- behaviour entity
    put(os.path.join(BP, "entities", NAME + ".json"), {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": ID, "is_spawnable": True, "is_summonable": True, "is_experimental": False},
            "components": {
                "minecraft:type_family": {"family": ["great_unclean_one", "monster"]},
                "minecraft:health": {"value": 500, "max": 500},
                "minecraft:attack": {"damage": 14, "effect_name": "poison", "effect_duration": 6},
                "minecraft:movement": {"value": 0.22},
                "minecraft:follow_range": {"value": 40},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:collision_box": {"width": 2.2, "height": 4.0},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
                "minecraft:nameable": {},
                "minecraft:persistent": {},
                "minecraft:experience_reward": {"on_death": "60"},
                "minecraft:loot": {"table": "loot_tables/entities/great_unclean_one.json"},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:navigation.walk": {"can_path_over_water": False, "avoid_water": True, "can_break_doors": True},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.hurt_by_target": {"priority": 1},
                "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.0, "track_target": True, "reach_multiplier": 1.6},
                "minecraft:behavior.nearest_attackable_target": {
                    "priority": 2, "must_see": True, "reselect_targets": True,
                    "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 40}],
                },
                "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.7},
                "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 10},
                "minecraft:behavior.random_look_around": {"priority": 8},
                "minecraft:boss": {"hud_range": 48, "name": "Great Unclean One", "should_darken_sky": False},
            },
        },
    })
    put(os.path.join(BP, "loot_tables/entities", NAME + ".json"), {"pools": [
        {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:rotten_flesh", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 4, "max": 9}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:bone", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 2, "max": 5}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:poisonous_potato", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 1, "max": 3}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:iron_ingot", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 2, "max": 6}}]}]},
    ]})

    # ---------------------------------------------------------------- client entity
    pre = "animation.%s." % NAME
    names = ["walk", "idle_a", "idle_b", "channel", "attack_a", "attack_b", "slam", "death", "flies"]
    put(os.path.join(RP, "entity", NAME + ".entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": ID,
            "min_engine_version": "1.16.0",
            "materials": {"default": "entity_alphatest"},
            "textures": {"default": "textures/entity/" + NAME},
            "geometry": {"default": "geometry." + NAME},
            "animations": {**{n: pre + n for n in names}, "controller": "controller.animation." + NAME},
            "scripts": {"animate": ["flies", "controller"]},
            "render_controllers": ["controller.render." + NAME],
            "spawn_egg": {"base_color": "#566b3a", "overlay_color": "#c9b87a"},
        }},
    })
    put(os.path.join(RP, "render_controllers", NAME + ".render_controllers.json"), {
        "format_version": "1.8.0",
        "render_controllers": {"controller.render." + NAME: {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"]}},
    })

    dead = {"death": "!query.is_alive"}
    atk = [{"attack_a": "variable.attack_time > 0 && math.random(0, 1) < 0.34"},
           {"attack_b": "variable.attack_time > 0 && math.random(0, 1) < 0.5"},
           {"slam": "variable.attack_time > 0"}]
    walk = {"walk": "query.ground_speed > 0.1"}

    states = {
        "idle_a": {"animations": ["idle_a"], "blend_transition": 0.3,
                   "transitions": [dead, *atk, walk, {"idle_b": "query.all_animations_finished && math.random(0, 1) < 0.6"},
                                   {"channel": "query.all_animations_finished"}]},
        "idle_b": {"animations": ["idle_b"], "blend_transition": 0.3,
                   "transitions": [dead, *atk, walk, {"idle_a": "query.all_animations_finished"}]},
        "channel": {"animations": ["channel"], "blend_transition": 0.3,
                    "transitions": [dead, *atk, walk, {"idle_a": "query.all_animations_finished"}]},
        "walk": {"animations": ["walk"], "blend_transition": 0.25,
                 "transitions": [dead, *atk, {"idle_a": "query.ground_speed <= 0.1"}]},
        "attack_a": {"animations": ["attack_a"], "blend_transition": 0.15,
                     "transitions": [dead, {"idle_a": "query.all_animations_finished"}]},
        "attack_b": {"animations": ["attack_b"], "blend_transition": 0.15,
                     "transitions": [dead, {"idle_a": "query.all_animations_finished"}]},
        "slam": {"animations": ["slam"], "blend_transition": 0.15,
                 "transitions": [dead, {"idle_a": "query.all_animations_finished"}]},
        "death": {"animations": ["death"], "blend_transition": 0.2},
    }
    put(os.path.join(RP, "animation_controllers", NAME + ".animation_controllers.json"), {
        "format_version": "1.10.0",
        "animation_controllers": {"controller.animation." + NAME: {"initial_state": "idle_a", "states": states}},
    })

    text(os.path.join(RP, "texts/en_US.lang"),
         "entity.%s.name=Great Unclean One\nitem.spawn_egg.entity.%s.name=Great Unclean One Spawn Egg\n" % (ID, ID))
    text(os.path.join(RP, "texts/ru_RU.lang"),
         "entity.%s.name=Великий Нечистый\nitem.spawn_egg.entity.%s.name=Яйцо призыва: Великий Нечистый\n" % (ID, ID))
    put(os.path.join(RP, "texts/languages.json"), ["en_US", "ru_RU"])
    print("pack files written")


if __name__ == "__main__":
    main()
