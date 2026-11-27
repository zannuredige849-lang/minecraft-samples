"""Step 3: faction/alliance layer in the behavior pack (entity JSON + script)."""
import sys, os, json, glob, re, copy
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json
from forge.factions import FACTION_OF, KIN_OF, FACTIONS, allies_of

TARGET_KEYS = ("nearest_attackable_target", "nearest_prioritized_attackable_target", "hurt_by_target", "defend_trusted_target")


def excl(tags):
    return {"all_of": [{"test": "is_family", "subject": "other", "operator": "!=", "value": t} for t in tags]}


def wrap(f, tags):
    ex = excl(tags)
    if not f: return ex
    if isinstance(f, list): return {"all_of": ex["all_of"] + f}
    if isinstance(f, dict) and list(f.keys()) == ["all_of"]:
        g = copy.deepcopy(f); g["all_of"] = ex["all_of"] + g["all_of"]; return g
    return {"all_of": ex["all_of"] + [f]}


def patch_comp(comp, tags, stats):
    for k, v in list(comp.items()):
        if not any(t in k for t in TARGET_KEYS) or not isinstance(v, dict):
            continue
        et = v.get("entity_types")
        if et is None:
            if "hurt_by_target" in k:
                v["entity_types"] = [{"filters": excl(tags), "max_dist": 64}]
                stats["hurt_added"] += 1
            continue
        if isinstance(et, dict):
            et["filters"] = wrap(et.get("filters"), tags); stats["patched"] += 1
        else:
            for e in et:
                e["filters"] = wrap(e.get("filters"), tags); stats["patched"] += 1


def uniqueness(out):
    """Abilities engine + data, trophies, item effects, bestiary item/recipe/lang/icon."""
    import shutil
    from forge.uniq import E, ITEMS
    sc = f"{out}/behavior_pack/scripts"
    names = {k: v["ru"] for k, v in E.items()}
    abil = {k: v["ab"] for k, v in E.items() if v["ab"]}
    drops = {k: v["drops"] for k, v in E.items() if v["drops"]}
    notes = {k: v["note"] for k, v in E.items() if v["note"]}
    titles = {k: v["title"] for k, v in FACTIONS.items()}
    j = lambda o: json.dumps(o, ensure_ascii=False, indent=1)
    open(f"{sc}/abilities_data.js", "w", encoding="utf-8").write(
        "// Создаётся tools/patch_bp.py из tools/forge/uniq.py\n"
        f"export const ABILITIES = {j(abil)};\nexport const DROPS = {j(drops)};\nexport const NAMES = {j(names)};\n"
        f"export const NOTES = {j(notes)};\nexport const FACTION_TITLES = {j(titles)};\nexport const ITEM_INFO = {j(ITEMS)};\n")
    for f in ("abilities.js", "item_abilities.js", "bestiary.js"):
        shutil.copy(os.path.join(os.path.dirname(__file__), "js", f), f"{sc}/{f}")
    mp = f"{sc}/main.js"
    m = open(mp, encoding="utf-8").read()
    if "abilities.js" not in m:
        m = m.replace('import "./factions.js";', 'import "./factions.js";\nimport "./abilities.js";\nimport "./item_abilities.js";\nimport "./bestiary.js";', 1)
        open(mp, "w", encoding="utf-8").write(m)
    # bestiary item + recipe + icon (vanilla enchanted-book icon) + names
    json.dump({"format_version": "1.21.0", "minecraft:item": {"description": {"identifier": "cb:bestiary", "menu_category": {"category": "items"}},
               "components": {"minecraft:icon": {"textures": {"default": "cb_bestiary"}}, "minecraft:display_name": {"value": "item.cb:bestiary.name"},
                              "minecraft:max_stack_size": 1}}}, open(f"{out}/behavior_pack/items/bestiary.json", "w", encoding="utf-8"), indent=2)
    json.dump({"format_version": "1.20.10", "minecraft:recipe_shapeless": {"description": {"identifier": "cb:bestiary_recipe"}, "tags": ["crafting_table"],
               "ingredients": [{"item": "minecraft:book"}, {"item": "minecraft:emerald"}], "result": {"item": "cb:bestiary"}}},
              open(f"{out}/behavior_pack/recipes/bestiary.json", "w", encoding="utf-8"), indent=2)
    rp = f"{out}/resource_pack"
    shutil.copy(os.path.join(os.path.dirname(__file__), "data", "vanilla", "items", "book_enchanted.png"), f"{rp}/textures/items/cb_bestiary.png")
    itp = f"{rp}/textures/item_texture.json"
    doc = load_json(itp); doc["texture_data"]["cb_bestiary"] = {"textures": "textures/items/cb_bestiary"}
    json.dump(doc, open(itp, "w", encoding="utf-8"), indent=2)
    for part in ("behavior_pack", "resource_pack"):
        for lang, name in (("en_US", "Bestiary of Uniqueness"), ("ru_RU", "Бестиарий уникальностей")):
            p = f"{out}/{part}/texts/{lang}.lang"
            if os.path.exists(p):
                t = open(p, encoding="utf-8").read()
                if "item.cb:bestiary.name" not in t:
                    open(p, "a", encoding="utf-8").write(("" if t.endswith("\n") else "\n") + f"item.cb:bestiary.name={name}\n")
    return dict(abilities=sum(len(v) for v in abil.values()), mobs_with_abilities=len(abil), trophies=sum(len(v) for v in drops.values()), described=len(names))


def run(out):
    stats = dict(patched=0, hurt_added=0, entities=0, families=0)
    for p in glob.glob(f"{out}/behavior_pack/entities/*.json"):
        d = load_json(p)
        e = d["minecraft:entity"]
        ident = e["description"]["identifier"]
        tags = allies_of(ident)
        if not tags:
            continue
        comps = e.get("components", {})
        groups = e.get("component_groups", {})
        # families
        def addfam(c):
            tf = c.get("minecraft:type_family")
            if tf is None: return False
            fam = tf.setdefault("family", [])
            for t in tags + ["summon_safe"]:
                if t not in fam: fam.append(t)
            stats["families"] += 1
            return True
        if not addfam(comps):
            comps["minecraft:type_family"] = {"family": list(tags) + ["summon_safe"]}
        for g in groups.values():
            addfam(g)
        patch_comp(comps, tags, stats)
        for g in groups.values():
            patch_comp(g, tags, stats)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
        stats["entities"] += 1
    # ---- script
    sc = f"{out}/behavior_pack/scripts"
    fo = json.dumps(FACTION_OF, indent=1, ensure_ascii=False)
    kin = json.dumps(KIN_OF, indent=1, ensure_ascii=False)
    js = f'''// Единая таблица фракций (создаётся tools/patch_bp.py из tools/forge/factions.py).
// Правило: существа одной фракции (и одного «родства», например все големы) НЕ воюют друг с другом;
// призванные существа принадлежат той же фракции, что и их тип, поэтому не воюют со своими.
import {{ world, EntityDamageCause }} from "@minecraft/server";

export const FACTION_OF = {fo};
export const KIN_OF = {kin};

export function factionOf(e) {{
  try {{ return FACTION_OF[e.typeId] ?? null; }} catch {{ return null; }}
}}

export function areAllies(a, b) {{
  if (!a || !b) return false;
  let ta, tb;
  try {{ ta = a.typeId; tb = b.typeId; }} catch {{ return false; }}
  if (ta === tb && FACTION_OF[ta]) return true;
  const fa = FACTION_OF[ta], fb = FACTION_OF[tb];
  if (fa && fa === fb) return true;
  const ka = KIN_OF[ta], kb = KIN_OF[tb];
  if (ka && kb && ka.some((k) => kb.includes(k))) return true;
  return false;
}}

// Страховка: если урон всё же прошёл между союзниками (область, снаряд, скриптовый удар) — возвращаем здоровье.
world.afterEvents.entityHurt.subscribe((ev) => {{
  try {{
    const victim = ev.hurtEntity;
    const attacker = ev.damageSource?.damagingEntity;
    if (!victim || !attacker || victim.id === attacker.id) return;
    if (!areAllies(attacker, victim)) return;
    const hp = victim.getComponent("minecraft:health");
    if (!hp) return;
    hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + ev.damage));
  }} catch {{}}
}});
'''
    open(f"{sc}/factions.js", "w", encoding="utf-8").write(js)
    # main.js import (first, so the guard is registered before other handlers)
    mp = f"{sc}/main.js"
    m = open(mp, encoding="utf-8").read()
    if 'factions.js' not in m:
        m = m.replace('import "./cyclops.js";', 'import "./factions.js";\nimport "./cyclops.js";', 1)
        open(mp, "w", encoding="utf-8").write(m)
    # patch script hostility helpers
    def edit(fn, old, new, imp=True):
        path = f"{sc}/{fn}"
        s = open(path, encoding="utf-8").read()
        if "areAllies" in s and imp: return
        assert old in s, (fn, old[:50])
        s = s.replace(old, new, 1)
        if imp:
            # add import after the first import line block
            s = 'import { areAllies } from "./factions.js";\n' + s
        open(path, "w", encoding="utf-8").write(s)
    edit("orcs.js", "if (!other || other.id === orc.id || !alive(other) || sameSide(orc, other)) return false;",
         "if (!other || other.id === orc.id || !alive(other) || sameSide(orc, other) || areAllies(orc, other)) return false;")
    edit("warhammer_main.js", "  if (!ent || ent.id === selfEnt.id) return false;\n  if (CB_NEVER_TARGET.has(ent.typeId)) return false;",
         "  if (!ent || ent.id === selfEnt.id) return false;\n  if (areAllies(selfEnt, ent)) return false;\n  if (CB_NEVER_TARGET.has(ent.typeId)) return false;")
    edit("guldan.js", "if (!m || m.id === owner.id || m.id === g.id || !alive(m) || sameSummonCipher(g, m)) continue;",
         "if (!m || m.id === owner.id || m.id === g.id || !alive(m) || sameSummonCipher(g, m) || areAllies(g, m)) continue;")
    stats["unique"] = uniqueness(out)
    return stats


if __name__ == "__main__":
    print(run(sys.argv[1]))
