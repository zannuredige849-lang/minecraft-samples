import sys, os, glob, time
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import *
from animpose import pose_from_anim
from PIL import Image, ImageDraw
SRC, OUT = sys.argv[1], sys.argv[2]
only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
geos = {}
for p in glob.glob(f"{SRC}/resource_pack/models/entity/*.json"):
    geos.update(collect_geometries(p))
anims = {}
for p in glob.glob(f"{SRC}/resource_pack/animations/*.json"):
    try: anims.update(load_json(p).get("animations", {}))
    except Exception as e: print("ERR", p)
items = []
for p in sorted(glob.glob(f"{SRC}/resource_pack/entity/*.json")):
    c = load_json(p)["minecraft:client_entity"]["description"]
    if not c["identifier"].startswith("warcraft:"): continue
    if only and c["identifier"].split(":")[1] not in only: continue
    g = list(c["geometry"].values())[0]
    tp = list(c["textures"].values())[0]
    a = c.get("animations", {})
    idle = a.get("idle_a")
    items.append((c["identifier"], g, tp, idle))
cell, per, cols = 300, 12, 4
for si in range(0, len(items), per):
    chunk = items[si:si + per]
    sheet = Image.new("RGBA", (cell * cols, cell * 3), (58, 62, 74, 255))
    d = ImageDraw.Draw(sheet)
    for i, (ident, g, tp, idle) in enumerate(chunk):
        tex = Image.open(f"{SRC}/resource_pack/{tp}.png").convert("RGBA")
        pose = pose_from_anim(anims[idle], 0.0) if idle in anims else None
        geo = geos[g]
        bb = bbox_units(geo, pose)
        if bb is None: continue
        h = bb[1][1] - bb[0][1]; w = max(bb[1][0] - bb[0][0], bb[1][2] - bb[0][2])
        ctr = (bb[0] + bb[1]) / 2
        sc = min((cell - 30) / max(h, 1), (cell - 20) / max(w, 1))
        im = render(geo, tex, yaw=-30, pitch=12, scale=sc, size=(cell, cell), bg=(58, 62, 74, 255), pose=pose, center=ctr)
        sheet.paste(im, ((i % cols) * cell, (i // cols) * cell))
        d.text(((i % cols) * cell + 4, (i // cols) * cell + 4), f"{ident} h={h:.0f}", fill=(255, 255, 255))
    sheet.convert("RGB").save(f"{OUT}/oldpose_{si//per:02d}.png")
print(len(items))
