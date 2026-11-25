"""Big Ent: one variant per vanilla tree (oak ... poplar, crimson/warped stems). Adds the new variants 6+ to the
client entity, the render controller, the behaviour (component groups + spawn roll) and the Big Ent script, whose old
code treated every variant >= 4 as a Nether ent."""
import os, json, glob
from forge.mobs_beasts import ENT_VARIANTS

# stats of the new trees: (health, damage, speed, knockback resistance, spawn weight)
STATS = {"jungle": (150, 8, 0.29, 0.7, 14), "acacia": (140, 8, 0.31, 0.6, 12), "dark_oak": (200, 10, 0.21, 0.95, 12),
         "mangrove": (170, 8, 0.25, 0.85, 12), "pale_oak": (165, 9, 0.24, 0.8, 10), "azalea": (130, 6, 0.28, 0.6, 12),
         "poplar": (145, 7, 0.28, 0.7, 12)}

# per-tree slam effects for the new variants (vanilla effect ids), appended to the script's if/else chain
EFFECTS = {
    "jungle": '        v.addEffect("poison", 100, { amplifier: 1, showParticles: true });\n        v.addEffect("slowness", 50, { amplifier: 1, showParticles: true });',
    "acacia": '        v.addEffect("hunger", 120, { amplifier: 1, showParticles: true });\n        v.addEffect("slowness", 50, { amplifier: 1, showParticles: true });',
    "dark_oak": '        v.addEffect("blindness", 60, { amplifier: 0, showParticles: true });\n        v.addEffect("slowness", 90, { amplifier: 3, showParticles: true });',
    "mangrove": '        v.addEffect("slowness", 100, { amplifier: 4, showParticles: true });',
    "pale_oak": '        v.addEffect("darkness", 80, { amplifier: 0, showParticles: true });\n        v.addEffect("weakness", 80, { amplifier: 1, showParticles: true });',
    "azalea": '        v.addEffect("nausea", 80, { amplifier: 0, showParticles: true });\n        v.addEffect("slowness", 40, { amplifier: 1, showParticles: true });',
    "poplar": '        v.addEffect("levitation", 20, { amplifier: 0, showParticles: true });\n        v.addEffect("slowness", 60, { amplifier: 2, showParticles: true });',
}


def _dump(p, d):
    with open(p, "w", encoding="utf-8") as f: json.dump(d, f, indent=2, ensure_ascii=False)


def run(out):
    rp, bp = f"{out}/resource_pack", f"{out}/behavior_pack"
    keys = list(ENT_VARIANTS)
    # client entity
    p = f"{rp}/entity/big_ent.entity.json"
    d = json.load(open(p, encoding="utf-8"))
    d["minecraft:client_entity"]["description"]["textures"] = {k: f"textures/entity/big_ent_{k}" for k in keys}
    _dump(p, d)
    # render controller
    p = f"{rp}/render_controllers/big_ent.render_controllers.json"
    d = json.load(open(p, encoding="utf-8"))
    d["render_controllers"]["controller.render.big_ent"]["arrays"]["textures"]["Array.skins"] = [f"Texture.{k}" for k in keys]
    _dump(p, d)
    # behaviour
    p = f"{bp}/entities/big_ent.json"
    d = json.load(open(p, encoding="utf-8"))
    e = d["minecraft:entity"]
    cg, roll = e["component_groups"], e["events"]["minecraft:entity_spawned"]["randomize"]
    have = {r["add"]["component_groups"][0] for r in roll}
    for i, k in enumerate(keys):
        if k not in STATS: continue
        hp, dmg, spd, kb, wt = STATS[k]
        cg[f"ent_{k}"] = {"minecraft:variant": {"value": i}, "minecraft:health": {"value": hp, "max": hp},
                          "minecraft:attack": {"damage": dmg}, "minecraft:movement": {"value": spd},
                          "minecraft:knockback_resistance": {"value": kb}}
        if f"ent_{k}" not in have:
            roll.append({"weight": wt, "add": {"component_groups": [f"ent_{k}"]}})
    _dump(p, d)
    # script
    p = f"{bp}/scripts/warhammer_main.js"
    s = open(p, encoding="utf-8").read()
    s = s.replace("vId >= 4 ?", "(vId === 4 || vId === 5) ?")
    s = s.replace("// 0=Oak, 1=Birch, 2=Spruce, 3=Cherry, 4=Crimson(Nether), 5=Warped(Nether)",
                  "// " + ", ".join(f"{i}={k}" for i, k in enumerate(keys)) + " (4, 5 = Nether stems)")
    s = s.replace("6 vanilla tree variants", f"{len(keys)} vanilla tree variants")
    anchor = '''      } else if (vId === 5) {
        v.addEffect("levitation", 40, { amplifier: 0, showParticles: true });
        v.addEffect("wither", 70, { amplifier: 0, showParticles: true });
      }'''
    if anchor in s:
        extra = "".join(f'\n      }} else if (vId === {keys.index(k)}) {{  // {k}\n{code}' for k, code in EFFECTS.items())
        s = s.replace(anchor, anchor[:-8] + extra + "\n      }", 1)
    open(p, "w", encoding="utf-8").write(s)
    return len(keys)
