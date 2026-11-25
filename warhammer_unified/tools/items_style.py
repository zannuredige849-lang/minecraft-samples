"""Step 4: spawn eggs (one egg silhouette, body = the mob's dominant colour, emblem = faction) + icon restyle."""
import sys, os, glob, json, colorsys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json
from forge.core import make_ramp, hex2rgb
from forge.factions import FACTION_OF, FACTIONS
from forge.common import ENT
from restyle import restyle_icon
import json

GLYPH = {
    "cross": ["..#..", "..#..", "#####", "..#..", "..#.."],
    "axe": ["..##.", "..###", ".###.", ".#...", ".#..."],
    "star": ["#.#.#", ".###.", "#####", ".###.", "#.#.#"],
    "drop": ["..#..", ".###.", ".###.", "#####", ".###."],
    "eye": [".....", ".###.", "#.#.#", ".###.", "....."],
    "skull": [".###.", "#####", "#.#.#", ".###.", ".#.#."],
    "gear": ["#.#.#", ".###.", "##.##", ".###.", "#.#.#"],
    "leaf": ["..###", ".####", "####.", "###..", "#...."],
    "flame": ["..#..", ".##..", ".###.", "#####", ".###."],
    "tusk": ["#...#", "#...#", "##.##", ".###.", "..#.."],
    "bolt": ["..##.", ".##..", ".###.", "..##.", ".##.."],
    "fist": [".####", "#####", "#####", ".###.", "..##."],
    "wave": [".....", ".#.#.", "#.#.#", ".#.#.", "....."],
    "wing": ["#...#", "##.##", "#####", ".###.", "..#.."],
    "fang": ["#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    "gem": ["..#..", ".###.", "#####", ".###.", "..#.."],
    "house": ["..#..", ".###.", "#####", "#.#.#", "#.#.#"],
    "coin": [".###.", "##.##", "##.##", "##.##", ".###."],
    "horn": ["....#", "...##", "..##.", ".##..", "##..."],
    "snow": ["..#..", "#.#.#", ".###.", "#.#.#", "..#.."],
    "crown": ["#.#.#", "#####", "#####", ".....", "....."],
    "hammer": ["#####", "#####", "..#..", "..#..", "..#.."],
    "sword": ["..#..", "..#..", "..#..", ".###.", "..#.."],
    "tree": ["..#..", ".###.", "#####", "..#..", "..#.."],
    "bear": ["#...#", "#####", "#.#.#", "#####", ".#.#."],
    "chariot": [".....", "####.", "#####", ".#.#.", "#.#.#"],
}
OVERRIDE = {
    "warcraft:frost_golem": "snow", "warcraft:lightning_golem": "bolt", "warcraft:inferno_golem": "flame", "warcraft:ember_colossus": "flame",
    "cb:inferno_golem": "flame", "cb:hephaestus_golem": "gear", "warcraft:ice_demon": "snow",
    "warcraft:royal_queen": "crown", "warcraft:royal_captain": "sword", "warcraft:garithos_paladin": "hammer", "warcraft:paladin_swordsman": "sword",
    "warcraft:grizzly_bear": "bear", "warcraft:skeleton_bear": "skull", "warcraft:big_ent": "tree", "warcraft:burning_chariot": "chariot",
    "warcraft:chaos_knight": "horn", "warcraft:void_knight": "gem", "warcraft:hornet_demon": "wing", "warcraft:blood_angel": "wing",
    "warcraft:pink_horror": "flame", "warcraft:norse_shaman": "eye", "warcraft:sabertooth_rider": "fang", "warcraft:bandit_dog": "fang",
    "cb:zeus": "bolt", "cb:ares": "sword", "cb:athena": "crown", "cb:hades": "skull", "cb:poseidon": "wave", "cb:hephaestus": "hammer",
    "cb:lich_king": "skull", "cb:dreadlord": "horn", "cb:fel_lord": "flame", "cb:guldan": "eye",
}
SHAPE_W = [4, 6, 8, 8, 10, 10, 10, 10, 10, 10, 8, 8, 6, 4]


def dominant(img):
    a = np.asarray(img.convert("RGBA"))
    op = a[..., 3] > 200
    px = a[..., :3][op].astype(float) / 255
    if len(px) == 0: return (128, 128, 128)
    q = (px * 7).astype(int)
    keys = q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]
    best, bs = None, -1
    for k in np.unique(keys):
        sel = px[keys == k]; c = sel.mean(axis=0)
        h, l, s = colorsys.rgb_to_hls(*c)
        score = len(sel) * (0.15 + s) * (1 - abs(l - 0.5))
        if l < 0.12 or l > 0.94: score *= 0.2
        if score > bs: bs, best = score, c
    return tuple(int(v * 255) for v in best)


def egg(body_rgb, emblem_rgb, glyph):
    r = make_ramp(body_rgb)
    e = make_ramp(emblem_rgb)
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    ecol = e[4]
    if abs(lum(ecol) - lum(r[3])) < 75:
        ecol = (248, 244, 232, 255) if lum(r[3]) < 140 else (28, 24, 34, 255)
    img = np.zeros((16, 16, 4), np.uint8)
    mask = np.zeros((16, 16), bool)
    for i, w in enumerate(SHAPE_W):
        y = i + 1
        x0 = 8 - w // 2
        mask[y, x0:x0 + w] = True
    pad = np.pad(mask, 1)
    edge = mask & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    for y in range(16):
        for x in range(16):
            if not mask[y, x]: continue
            if edge[y, x]:
                img[y, x] = r[0]; continue
            t = 3.2 - (x - 6) * 0.14 + (y - 7) * 0.16 * 0.9
            t = min(max(round(t), 1), 5)
            img[y, x] = r[t]
    # highlight
    img[3, 6] = r[5]; img[4, 5] = r[5]; img[4, 6] = r[4]
    # emblem 5x5 at centre
    g = GLYPH[glyph]
    for gy in range(5):
        for gx in range(5):
            if g[gy][gx] == "#":
                x, y = 5 + gx, 5 + gy
                if mask[y, x] and not edge[y, x]:
                    img[y, x] = ecol
    # emblem shadow (1px down-right, darker)
    for gy in range(5):
        for gx in range(5):
            if g[gy][gx] == "#":
                x, y = 6 + gx, 6 + gy
                if x < 16 and y < 16 and mask[y, x] and not edge[y, x] and img[y, x].tolist() == list(r[2]) or (x < 16 and y < 16 and mask[y, x] and not edge[y, x] and img[y, x, 3] and tuple(img[y, x]) in (r[1], r[2], r[3], r[4], r[5])):
                    img[y, x] = r[1]
    return Image.fromarray(img)


DYES = {"white": "#f9fffe", "orange": "#f9801d", "magenta": "#c74ebd", "light_blue": "#3ab3da", "yellow": "#fed83d", "lime": "#80c71f",
        "pink": "#f38baa", "gray": "#474f52", "light_gray": "#9d9d97", "cyan": "#169c9c", "purple": "#8932b8", "blue": "#3c44aa",
        "brown": "#835432", "green": "#5e7c16", "red": "#b02e26", "black": "#1d1d21"}
# item icon -> (vanilla item icon, tint colour or None)
ICON_SRC = {
    "cb_bronze_ingot": ("copper_ingot", "#b98a38"), "cb_dragon_scale": ("turtle_shell_piece", "#e0782a"),
    "cb_island_compass": ("compass_item", None), "cb_sargeras_shard": ("amethyst_shard", "#7aff30"),
    "cb_ting_tang_disc": ("record_cat", "#e060c0"), "frost_orb": ("heartofthesea_closed", "#7fd8ff"),
    "inferno_orb": ("fireball", None), "storm_orb": ("ender_pearl", "#ffe35a"),
    "cb_map_circe": ("map_filled", "#8a4ac0"), "cb_map_cyclops": ("map_filled", "#c0703a"), "cb_map_hydra": ("map_filled", "#2a9a8a"),
    "cb_map_laestry": ("map_filled", "#c0402a"), "cb_map_list": ("map_filled", "#d8c070"),
}
WEAPONS = ("cb_hell_scimitar", "cb_laestrygonian_sword", "cb_orc_cleaver", "cb_orc_war_axe")


def _drop_siblings(rp, path):
    for suf in ("_mer.png", "_height.png", "_normal.png", ".texture_set.json"):
        f = f"{rp}/{path}{suf}"
        if os.path.exists(f): os.remove(f)


def run(out, generated=()):
    from forge import vanilla as V
    rp = os.path.join(out, "resource_pack")
    itd_path = f"{rp}/textures/item_texture.json"
    doc = load_json(itd_path); itd = doc["texture_data"]
    stats = dict(eggs=0, icons=0, armor=0, weapons=0)
    # ---- spawn eggs: the VANILLA egg with the mob's dominant colour and the faction colour as overlay
    for ent, info in ENT.items():
        se = info.get("spawn_egg")
        if not se: continue
        cp = f"{rp}/entity/{info['client']}"
        cdoc = load_json(cp)
        fac = FACTION_OF.get(ent)
        tex = Image.open(f"{rp}/{list(info['textures'].values())[0]}.png")
        base = dominant(tex)
        over = hex2rgb(FACTIONS[fac]["c2"]) if fac else (221, 221, 221)
        cdoc["minecraft:client_entity"]["description"]["spawn_egg"] = {"base_color": "#%02x%02x%02x" % base, "overlay_color": "#%02x%02x%02x" % over}
        json.dump(cdoc, open(cp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        name = se.get("texture")
        td = itd.pop(name, None)
        if td:
            path = td["textures"] if isinstance(td["textures"], str) else td["textures"][0]
            for f in (f"{rp}/{path}.png",):
                if os.path.exists(f): os.remove(f)
            _drop_siblings(rp, path)
        stats["eggs"] += 1
    # ---- icons from vanilla textures
    def path_of(name):
        td = itd[name]; return td["textures"] if isinstance(td["textures"], str) else td["textures"][0]
    for name, (van, col) in ICON_SRC.items():
        if name not in itd: continue
        img = V.icon(van)
        if col: img = V.tint(img, hex2rgb(col))
        p = f"{rp}/{path_of(name)}.png"; img.save(p); _drop_siblings(rp, path_of(name)); stats["icons"] += 1
    for name in list(itd):
        if name.startswith("cb_sheepskin"):
            color = name[len("cb_sheepskin_"):] if name != "cb_sheepskin" else "white"
            dye = hex2rgb(DYES.get(color, "#f9fffe"))
            p = f"{rp}/{path_of(name)}.png"
            V.tint(V.icon("leather"), dye).save(p); _drop_siblings(rp, path_of(name)); stats["icons"] += 1
            ap = f"{rp}/textures/models/armor/{name}.png"
            if os.path.exists(ap):
                V.wool_fabric(64, dye).save(ap); _drop_siblings(rp, f"textures/models/armor/{name}"); stats["armor"] += 1
    refs = [V.icon(n) for n in ("iron_sword", "gold_sword", "stick", "iron_axe", "copper_ingot")]
    for name in WEAPONS:
        if name not in itd: continue
        p = f"{rp}/{path_of(name)}.png"
        V.palette_map(Image.open(p), refs).save(p); stats["weapons"] += 1
    json.dump(doc, open(itd_path, "w", encoding="utf-8"), indent=2)
    return stats


if __name__ == "__main__":
    print(run(sys.argv[1]))
