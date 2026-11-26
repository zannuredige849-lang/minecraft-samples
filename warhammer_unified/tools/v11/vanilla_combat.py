"""v10.8.5: vanilla weapons, bows that keep their distance, real shields - for humans and every mob that can hold items.

Humans (cb:human_villager)
  * They already get only vanilla items from settlements.js (swords, axes, tridents, spears, bows, crossbows, maces,
    shields, vanilla armour). The modelled shield (`shieldBone`) is hidden: the vanilla shield in the off hand is drawn
    instead (leftItem bone, attachables are on), so a shield is only seen when one is really held.
  * Archers / crossbowmen lose the native melee AI (it pulled them into close combat against the script that shoots)
    and get `avoid_mob_type`: an enemy within 6 blocks makes them step back, then they shoot again (kiting).
    The script backs off too when an enemy is closer than 7 blocks instead of a tiny push at 4.5.
  * Shield blocking needs a real shield in the off hand and works only against hits from the front (like a player's).
Orcs (cb:orc, cb:green_orc, cb:hell_orc)
  * Ranged orcs: vanilla bow or crossbow (50/50) and the same step-back behaviour.
  * scripts/shields.js: 40 % of melee orcs carry a vanilla shield; goblins and the item-holding trolls use one when
    given. Blocking for all of them: front only, 100 % of arrows, 75 % of melee, an axe disables it for 5 s.

python3 vanilla_combat.py <built add-on folder>
"""
import sys, os, json, glob, re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fix_held import L, W

HERE = os.path.dirname(os.path.abspath(__file__))
ORCS = ["orc", "green_orc", "hell_orc"]
MELEE_ROLES = ["cb:role_villager", "cb:role_militia", "cb:role_swordsman", "cb:role_spearman", "cb:role_captain"]
RANGED_ROLES = ["cb:role_archer", "cb:role_crossbowman"]


def _avoid(filters_from, extra_families):
    fam = [{"test": "is_family", "subject": "other", "value": f} for f in extra_families]
    try:
        anyof = filters_from["entity_types"][0]["filters"]["any_of"]
    except Exception:
        anyof = []
    return {"priority": 1, "remove_target": False, "ignore_visibility": False,
            "entity_types": [{"filters": {"any_of": anyof + fam}, "max_dist": 6, "walk_speed_multiplier": 1.0,
                              "sprint_speed_multiplier": 1.25, "sprint_distance": 4}]}


def humans(out):
    bp = f"{out}/behavior_pack/entities/human_villager.json"; d = L(bp); e = d["minecraft:entity"]
    c = e["components"]; g = e["component_groups"]
    melee = c.pop("minecraft:behavior.melee_attack", None)
    if melee:
        for r in MELEE_ROLES: g[r]["minecraft:behavior.melee_attack"] = dict(melee)
    av = _avoid(c.get("minecraft:behavior.nearest_attackable_target", {}), [])
    for r in RANGED_ROLES: g[r]["minecraft:behavior.avoid_mob_type"] = av
    W(bp, d)
    rc = f"{out}/resource_pack/render_controllers/human.render_controllers.json"; d = L(rc)
    for v in d["render_controllers"].values():
        for pv in v.get("part_visibility", []):
            if "shieldBone" in pv: pv["shieldBone"] = False
    W(rc, d)
    js = f"{out}/behavior_pack/scripts/settlements.js"; s = open(js, encoding="utf-8").read(); n0 = s
    # a shield is a real vanilla shield in the off hand, nothing else
    s = re.sub(r'(export function hasShieldEquipped\(entity\) \{\n  const off = getEntitySlotId\(entity, EquipmentSlot\.Offhand\);\n'
               r'  if \(off === "minecraft:shield"\) return true;\n)  const role = .*?\n  return role === .*?;\n\}',
               r'\1  return false;\n}\n\n// v10.8.5: like a player, a raised shield only stops what comes from the front\n'
               r'export function attackFromFront(entity, attacker) {\n  try {\n    const v = entity.getViewDirection();\n'
               r'    const dx = attacker.location.x - entity.location.x, dz = attacker.location.z - entity.location.z;\n'
               r'    const l = Math.hypot(dx, dz) || 1, lv = Math.hypot(v.x, v.z) || 1;\n'
               r'    return (dx * v.x + dz * v.z) / (l * lv) > 0.2;\n  } catch (e) { return true; }\n}', s, count=1, flags=re.S)
    s = s.replace("const canBlock = hasShieldEquipped(hurt) && now >= st.shieldDisabledUntil;",
                  "const canBlock = hasShieldEquipped(hurt) && now >= st.shieldDisabledUntil && attacker && valid(attacker) && attackFromFront(hurt, attacker);", 1)
    old = re.search(r"    if \(d < 4\.5 && allowAdvance\) \{\n      // Kiting back slightly when enemy is too close\n.*?\n    \} else if \(d > 22\.0 && allowAdvance\) \{\n      walkToward\(h, foe\.location, 0\.24\);\n    \}\n", s, re.S)
    if old:
        s = s.replace(old.group(0), '''    if (d < 7.0 && allowAdvance) {
      // v10.8.5 kiting: step back to bow range, then turn and shoot again
      const dx = h.location.x - foe.location.x;
      const dz = h.location.z - foe.location.z;
      const l = Math.max(0.1, Math.hypot(dx, dz));
      walkToward(h, { x: h.location.x + (dx / l) * 4, y: h.location.y, z: h.location.z + (dz / l) * 4 }, 0.27);
      faceTarget(h, foe.location);
    } else if (d > 18.0 && allowAdvance) {
      walkToward(h, foe.location, 0.24);
    }
''', 1)
    open(js, "w", encoding="utf-8").write(s)
    return {"melee_moved": bool(melee), "settlements_patched": s != n0, "kiting": bool(old)}


def orcs(out):
    for m in ORCS:
        p = f"{out}/behavior_pack/entities/{m}.json"; d = L(p); e = d["minecraft:entity"]
        nat = e["components"].get("minecraft:behavior.nearest_attackable_target", {})
        e["component_groups"]["cb:ranged"]["minecraft:behavior.avoid_mob_type"] = _avoid(nat, ["player", "human", "human_faction"])
        W(p, d)
        lt = f"{out}/behavior_pack/loot_tables/entities/{m}_gear_ranged.json"
        if os.path.exists(lt):
            t = L(lt)
            for pool in t["pools"]:
                if any(en.get("name") == "minecraft:crossbow" for en in pool["entries"]):
                    pool["entries"] = [{"type": "item", "name": "minecraft:bow", "weight": 1},
                                       {"type": "item", "name": "minecraft:crossbow", "weight": 1}]
            W(lt, t)
    sd = f"{out}/behavior_pack/scripts"
    open(f"{sd}/shields.js", "w", encoding="utf-8").write(open(os.path.join(HERE, "..", "js", "shields.js"), encoding="utf-8").read())
    mp = f"{sd}/main.js"; m = open(mp, encoding="utf-8").read()
    if './shields.js' not in m:
        m = m.replace('import "./settlements.js";', 'import "./settlements.js";\nimport "./shields.js";', 1)
        open(mp, "w", encoding="utf-8").write(m)
    return "./shields.js" in m


if __name__ == "__main__":
    out = sys.argv[1]
    print("humans:", humans(out))
    print("orcs + shields.js:", orcs(out))
