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


def run(out, generated=()):
    rp = os.path.join(out, "resource_pack")
    itd = load_json(f"{rp}/textures/item_texture.json")["texture_data"]
    stats = dict(eggs=0, icons=0)
    egg_names = set()
    for ent, info in ENT.items():
        se = info.get("spawn_egg")
        if not se: continue
        name = se["texture"]
        egg_names.add(name)
        td = itd.get(name)
        if not td: continue
        path = td["textures"] if isinstance(td["textures"], str) else td["textures"][0]
        tex_path = list(info["textures"].values())[0]
        tex = Image.open(f"{rp}/{tex_path}.png")
        fac = FACTION_OF.get(ent)
        c2 = FACTIONS[fac]["c2"] if fac else "#dddddd"
        glyph = OVERRIDE.get(ent) or (FACTIONS[fac]["emblem"] if fac else "gem")
        img = egg(dominant(tex), hex2rgb(c2), glyph)
        os.makedirs(os.path.dirname(f"{rp}/{path}.png"), exist_ok=True)
        img.save(f"{rp}/{path}.png")
        for suf in ("_mer", "_height", "_normal"):
            f = f"{rp}/{path}{suf}.png"
            if os.path.exists(f): os.remove(f)
        ts = f"{rp}/{path}.texture_set.json"
        if os.path.exists(ts): os.remove(ts)
        stats["eggs"] += 1
    # remaining icons (items, maps, weapons): restyle within their silhouette
    for name, td in itd.items():
        if name in egg_names: continue
        path = td["textures"] if isinstance(td["textures"], str) else td["textures"][0]
        p = f"{rp}/{path}.png"
        if not os.path.exists(p): continue
        im = Image.open(p)
        restyle_icon(im).save(p); stats["icons"] += 1
    return stats


if __name__ == "__main__":
    print(run(sys.argv[1]))
