"""v10.8.6: balanced stats for every creature + cannibal troll without his weapon.

Ranks (player: 20 HP; diamond sword ~12 damage/s, netherite + Sharpness V ~19/s):
  regular  20-46 HP, 2-7 melee      - orcs, humans, goblins, small trolls, faceless rank and file, beasts
  elite    50-180 HP, 5-9 melee     - chaos demons, golems, ents, ice troll, faceless general, laestrygonian
  boss     140-400 HP, 7-12 melee   - boss bar on; scripted boss HP follows the same numbers
Every value is written explicitly below (no hidden multipliers); difficulty scaling of the add-on's scripts stays
(easy 0.75x / hard 1.35x HP). scripts/fairness.js (tools/js) caps scripted damage to players, scripted instant
kills, harmful effect lengths and boss self-heals, so every scripted ability stays survivable.
Also: invalid particle / sound ids -> vanilla ids, the Cyclops grab can be broken by 2 hits, Circe's hex ends after
60 s, the cannibal troll's club is removed (it fights with its fists), and rounding cubes written as per-face UV
(the cannibal troll's) are removed like the others.

python3 balance.py <built add-on folder> [BALANCE.md path]
"""
import sys, os, re, json, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fix_held import L, W
import mechanics

# ident -> {"rank", group-name -> (hp, melee damage)}, "base" = components; "speed"/"kb" optional caps
STATS = {
    # humans and orcs: equal footing, leaders a little stronger
    "cb:human_villager": {"rank": "regular", "base": (20, 2), "cb:role_villager": (20, 2), "cb:role_militia": (22, 4),
                          "cb:role_swordsman": (26, 5), "cb:role_archer": (22, 3), "cb:role_crossbowman": (24, 3),
                          "cb:role_spearman": (26, 5), "cb:role_captain": (32, 6)},
    "cb:orc": {"rank": "regular", "base": (24, 4), "cb:leader": (40, 6), "cb:enslaved": (26, 4)},
    "cb:green_orc": {"rank": "regular", "base": (24, 4), "cb:leader": (40, 6)},
    "cb:hell_orc": {"rank": "regular", "base": (28, 5), "cb:leader": (44, 7)},
    "cb:goblin": {"rank": "regular", "base": (14, 2), "cb:Tamed": (22, None)},
    # trolls: from the small ones up to the cannibal boss
    "cb:smart_troll": {"rank": "regular", "base": (40, 5)},
    "cb:tribal_troll": {"rank": "regular", "base": (45, 6)},
    "cb:wild_troll": {"rank": "elite", "base": (60, 7)},
    "cb:ice_troll": {"rank": "elite", "base": (100, 8)},
    "cb:cannibal_troll": {"rank": "boss", "base": (240, 11)},
    # faceless
    "warcraft:faceless_warrior": {"rank": "regular", "base": (40, 5)},
    "warcraft:faceless_cultist": {"rank": "regular", "base": (32, 4)},
    "warcraft:faceless_sorcerer": {"rank": "regular", "base": (36, 4)},
    "warcraft:faceless_berserker": {"rank": "regular", "base": (46, 7)},
    "warcraft:faceless_general": {"rank": "elite", "base": (90, 8)},
    # chaos
    "warcraft:pink_horror": {"rank": "elite", "base": (50, 5)},
    "warcraft:hornet_demon": {"rank": "elite", "base": (60, 6)},
    "warcraft:ice_demon": {"rank": "elite", "base": (80, 7)},
    "warcraft:abomination_lord": {"rank": "boss", "base": (280, 10)},
    "warcraft:great_unclean_one": {"rank": "boss", "base": (320, 10)},
    # golems: one family, the same numbers
    "warcraft:frost_golem": {"rank": "elite", "base": (120, 8)},
    "warcraft:lightning_golem": {"rank": "elite", "base": (120, 8)},
    "warcraft:inferno_golem": {"rank": "elite", "base": (120, 8)},
    "cb:inferno_golem": {"rank": "elite", "base": (120, 8)},
    "warcraft:ember_colossus": {"rank": "boss", "base": (260, 11)},
    # ents: each tree a little different, all inside 140-180 / 7-9
    "warcraft:big_ent": {"rank": "elite", "base": (160, 8), "ent_oak": (160, 8), "ent_birch": (140, 7), "ent_spruce": (180, 9),
                         "ent_cherry": (145, 7), "ent_crimson": (175, 9), "ent_warped": (170, 9)},
    # mythic bosses
    "cb:cyclops": {"rank": "boss", "base": (400, None)},
    "cb:fel_lord": {"rank": "boss", "base": (400, 12)},
    "cb:dreadlord": {"rank": "boss", "base": (280, 10)},
    "cb:minotaur": {"rank": "boss", "base": (300, 11)},
    "cb:hydra": {"rank": "boss", "base": (200, 7)},
    "cb:guldan": {"rank": "boss", "base": (240, 7)},
    "cb:circe": {"rank": "boss", "base": (140, None)},
    # others
    "cb:laestrygonian": {"rank": "elite", "base": (60, 7)},
    "cb:thunder_lizard": {"rank": "regular", "base": (40, 5), "cb:ridden": (None, 7)},
    "cb:warg": {"rank": "regular", "base": (24, 4)},
    "cb:siren": {"rank": "regular", "base": (30, 4)},
    "cb:fel_minion": {"rank": "regular", "base": (16, 3)},
}
HYDRA_HEAD_HP = 30
SPEED_CAP = {"regular": 0.33, "elite": 0.32, "boss": 0.30}
KB_MIN_BOSS = 0.8
BOSSES = sorted(k for k, v in STATS.items() if v["rank"] == "boss")


def _set_hp(c, hp):
    h = c.get("minecraft:health")
    if not h or hp is None: return
    for k in ("value", "max"):
        if k in h: h[k] = hp


def _set_dmg(c, dmg):
    a = c.get("minecraft:attack")
    if not a or dmg is None: return
    if isinstance(a.get("damage"), list): a["damage"] = [max(1, dmg - 1), dmg]
    else: a["damage"] = dmg


def stats(out):
    rows = []
    for p in sorted(glob.glob(f"{out}/behavior_pack/entities/*.json")):
        d = L(p); e = d["minecraft:entity"]; ident = e["description"]["identifier"]
        s = STATS.get(ident)
        if not s: continue
        before = []
        comps = [("base", e.setdefault("components", {}))] + list(e.get("component_groups", {}).items())
        for name, c in comps:
            if "minecraft:health" in c or "minecraft:attack" in c:
                before.append((name, (c.get("minecraft:health") or {}).get("max", (c.get("minecraft:health") or {}).get("value")),
                               (c.get("minecraft:attack") or {}).get("damage")))
            if name in s:
                hp, dmg = s[name]; _set_hp(c, hp); _set_dmg(c, dmg)
            mv = c.get("minecraft:movement")
            if mv and isinstance(mv.get("value"), (int, float)) and mv["value"] > SPEED_CAP[s["rank"]]: mv["value"] = SPEED_CAP[s["rank"]]
            kb = c.get("minecraft:knockback_resistance")
            if kb and s["rank"] == "boss" and isinstance(kb.get("value"), (int, float)) and kb["value"] < KB_MIN_BOSS: kb["value"] = KB_MIN_BOSS
        if s["rank"] == "boss" and not any("minecraft:boss" in c for _, c in comps):
            e["components"]["minecraft:boss"] = {"should_darken_sky": False, "hud_range": 40}
        W(p, d)
        rows.append((ident, s["rank"], before, {k: v for k, v in s.items() if k != "rank"}))
    return rows


def scripts(out):
    sd = f"{out}/behavior_pack/scripts"; changed = []
    def edit(name, fn):
        p = f"{sd}/{name}"
        if not os.path.exists(p): return
        s0 = open(p, encoding="utf-8").read(); s = fn(s0)
        for a, b in {**mechanics.PARTICLES, **mechanics.SOUNDS}.items(): s = s.replace(a, b)
        if s != s0: open(p, "w", encoding="utf-8").write(s); changed.append(name)
    hp = lambda k: STATS[k]["base"][0]
    edit("cyclops.js", lambda s: (s.replace("applyBossDifficultyHp(c, 560)", f"applyBossDifficultyHp(c, {hp('cb:cyclops')})")
                                  + ("" if "v10.12 fairness" in s else mechanics.CYCLOPS_ESCAPE)).replace(
        'subtitle: T("cyc.grabbed_you")', 'subtitle: T("cyc.grabbed_you") + " §e(бейте Циклопа, чтобы вырваться)"'))
    def gul(s):
        mx = hp("cb:guldan")
        s = re.sub(r"const START_HP = \d+;", f"const START_HP = {round(mx * 100 / 180)};", s, count=1)
        s = re.sub(r"const MAX_HP = \d+;", f"const MAX_HP = {mx};", s, count=1)
        return s.replace("applyBossDifficultyHp(e, 180)", f"applyBossDifficultyHp(e, {mx})")
    edit("guldan.js", gul)
    def myth(s):
        for k in ("cb:minotaur", "cb:fel_lord", "cb:dreadlord"):
            s = re.sub(rf'"{k}": \d+', f'"{k}": {hp(k)}', s, count=1)
        return re.sub(r"if \(isPlayer\(target\)\)\s*\n(\s*)return;",
                      r'if (isPlayer(target)) actionBar(target, "§cМинотавр поднял вас на рога! Через секунду бросит — готовьтесь к падению");\n\1return;', s)
    edit("mythic_bosses.js", myth)
    def trolls(s):
        for k in ("cb:smart_troll", "cb:tribal_troll", "cb:wild_troll", "cb:cannibal_troll", "cb:ice_troll"):
            s = re.sub(rf'"{k}": \d+', f'"{k}": {hp(k)}', s, count=1)
        return s
    edit("trolls.js", trolls)
    edit("hydra_layout.js", lambda s: re.sub(r"export const HEAD_HP = \d+;", f"export const HEAD_HP = {HYDRA_HEAD_HP};", s))
    def circe(s):
        if "v10.12 fairness" in s: return s
        return s.replace("return { formId, form, by, refresh:", "return { t0: now, formId, form, by, refresh:", 1) + mechanics.CIRCE_TIMEOUT
    edit("circe.js", circe)
    for n in ("mob_ai.js", "settlements.js", "warhammer_main.js"): edit(n, lambda s: s)
    hh = f"{out}/behavior_pack/entities/hydra_head.json"
    if os.path.exists(hh):
        d = L(hh); _set_hp(d["minecraft:entity"].get("components", {}), HYDRA_HEAD_HP); W(hh, d)
    # fairness guard, loaded first
    src = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "js", "fairness.js")
    t = open(src, encoding="utf-8").read().replace("/*BOSSES*/[]", json.dumps(BOSSES))
    open(f"{sd}/fairness.js", "w", encoding="utf-8").write(t)
    mp = f"{sd}/main.js"; m = open(mp, encoding="utf-8").read()
    if './fairness.js' not in m:
        m = '// v10.8.6 fairness guard first\nimport "./fairness.js";\n' + m
        open(mp, "w", encoding="utf-8").write(m)
    return changed


def cannibal_unarmed(out):
    """The club in the right fist: four cubes (shaft, head, butt, spike) reaching in front of the forearm."""
    p = f"{out}/resource_pack/models/entity/cannibal_troll.geo.json"; d = L(p); n = 0
    for g in d["minecraft:geometry"]:
        for b in g["bones"]:
            if b["name"] != "rightForearm": continue
            keep = []
            for c in b.get("cubes") or []:
                if c["origin"][2] < -8:   # starts in front of the fist (the forearm itself begins at z = -6.8)
                    n += 1; continue
                keep.append(c)
            b["cubes"] = keep
    W(p, d)
    return n


def report(rows, md):
    L_ = ["# Баланс (v10.8.6)", "",
          "Игрок: 20 HP. Урон игрока: алмазный меч ≈12 в секунду, незеритовый с Остротой V ≈19. Урон по игроку в броне: железо ×0,4, алмаз ×0,2.",
          "Ранги: обычные 20–46 HP / 2–7 урона, элита 50–180 / 5–9, боссы 140–400 / 7–12 (с полосой здоровья).",
          "Скриптовые способности ограничены `scripts/fairness.js`: не больше 40 % здоровья игрока за удар босса (25 % — обычного моба), "
          "не больше 60 % за 3 секунды, без мгновенных смертей, вредные эффекты не дольше 5 с и не сильнее II, босс в бою лечится не больше 8 % за 10 с.",
          "Сложность мира: лёгкая ×0,75 HP, тяжёлая ×1,35 HP (скрипты аддона).", "",
          "| Существо | Ранг | Было (HP / урон) | Стало (HP / урон) | Убить алмазным мечом | Незеритовым V |", "|---|---|---|---|---|---|"]
    order = {"boss": 0, "elite": 1, "regular": 2}
    for ident, rank, before, after in sorted(rows, key=lambda r: (order[r[1]], -(r[3]["base"][0] or 0))):
        b = "; ".join(f"{n}: {h}/{a}" if n != "base" else f"{h}/{a}" for n, h, a in before)
        a = "; ".join(f"{n}: {h}/{dd}" if n != "base" else f"{h}/{dd}" for n, (h, dd) in after.items())
        hp = after["base"][0] or 0
        L_.append(f"| `{ident}` | {rank} | {b} | {a.replace('None', '—')} | {hp / 12:.0f} с | {hp / 19:.0f} с |")
    open(md, "w", encoding="utf-8").write("\n".join(L_) + "\n")


if __name__ == "__main__":
    out = sys.argv[1]
    print("cannibal club cubes removed:", cannibal_unarmed(out))
    rows = stats(out); print("entities balanced:", len(rows))
    print("scripts:", scripts(out))
    if len(sys.argv) > 2: report(rows, sys.argv[2])
