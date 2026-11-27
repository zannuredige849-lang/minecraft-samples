import sys, os, glob, math, time
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import *
from PIL import Image, ImageDraw
SRC = sys.argv[1]; OUT = sys.argv[2]
geos = {}
for p in glob.glob(f"{SRC}/resource_pack/models/entity/*.json"):
    try: geos.update(collect_geometries(p))
    except Exception as e: print("ERR", p, e)
items = []
seen = set()
for p in sorted(glob.glob(f"{SRC}/resource_pack/entity/*.json")):
    c = load_json(p)["minecraft:client_entity"]["description"]
    g = list(c.get("geometry", {}).values())[0]
    t = c.get("textures", {})
    tp = list(t.values())[0] if t else None
    key = (g, tp)
    if key in seen or g not in geos or not tp: continue
    seen.add(key)
    items.append((c["identifier"], g, tp))
print(len(items))
cell = 280
per = 15
for si in range(0, len(items), per):
    chunk = items[si:si + per]
    sheet = Image.new("RGBA", (cell * 5, cell * 3), (58, 62, 74, 255))
    d = ImageDraw.Draw(sheet)
    for i, (ident, g, tp) in enumerate(chunk):
        tpath = f"{SRC}/resource_pack/{tp}.png"
        if not os.path.exists(tpath):
            tpath = f"{SRC}/resource_pack/{tp}.tga"
        try:
            tex = Image.open(tpath).convert("RGBA")
        except Exception as e:
            d.text(((i % 5) * cell + 4, (i // 5) * cell + 4), f"{ident}: no tex", fill=(255, 200, 200)); continue
        bb = bbox_units(geos[g])
        if bb is None: continue
        h = bb[1][1] - bb[0][1]; w = max(bb[1][0] - bb[0][0], bb[1][2] - bb[0][2])
        sc = min((cell - 40) / max(h, 1), (cell - 20) / max(w, 1)) 
        t0 = time.time()
        im = render(geos[g], tex, yaw=-35, pitch=14, scale=sc, size=(cell, cell), bg=(58, 62, 74, 255))
        sheet.paste(im, ((i % 5) * cell, (i // 5) * cell))
        d.text(((i % 5) * cell + 4, (i // 5) * cell + 4), f"{ident} h={h:.0f}", fill=(255, 255, 255))
        print(ident, f"{h:.0f}x{w:.0f}", f"{time.time()-t0:.1f}s", flush=True)
    sheet.convert("RGB").save(f"{OUT}/old_{si//per:02d}.png")
