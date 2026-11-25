"""Step 1: replace geometry, textures and animations of every generated mob inside an add-on tree."""
import sys, os, json, glob
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json
from forge.registry import REG
from forge.common import ENT
from forge.mobs_beasts import big_ent, ENT_VARIANTS, vanillaize_ent
from forge.anim import anims_for
from forge.signature import SIG


def write_json(path, d):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=1, ensure_ascii=False)


def run(out, only=None, report=None):
    rp = os.path.join(out, "resource_pack")
    anim_files = {}

    def anim_doc(fname):
        if fname not in anim_files:
            anim_files[fname] = load_json(os.path.join(rp, "animations", fname))
        return anim_files[fname]

    stats = []
    for ent, fn in REG.items():
        if only and ent not in only:
            continue
        info = ENT[ent]
        spec = fn()
        m = spec.model
        key = ent.split(":")[1] if ent.startswith("warcraft:") else ent.replace(":", "_")
        if key == "inferno_golem" and ent.startswith("warcraft:"): key = "inferno_golem"
        if key in SIG: SIG[key](m)
        if ent == "warcraft:big_ent": vanillaize_ent(m, "oak")
        geo_id = info["geometry"]["default"]
        assert m.ident == geo_id, f"{ent}: model ident {m.ident} != client geometry {geo_id}"
        m.finalize()
        gfile = info["geo_file"]["default"]
        old = load_json(os.path.join(rp, "models", "entity", gfile))
        old_ids = [g["description"]["identifier"] for g in old.get("minecraft:geometry", [])] + [k.split(":")[0] for k in old if k.startswith("geometry.")]
        assert old_ids == [geo_id], f"{ent}: {gfile} holds {old_ids}, refusing to overwrite shared file"
        gdoc = {"format_version": "1.12.0", "minecraft:geometry": [m.geometry()]}
        write_json(os.path.join(rp, "models", "entity", gfile), gdoc)
        # textures (variants for the ent)
        tex_map = info["textures"]
        if ent == "warcraft:big_ent":
            for key in ENT_VARIANTS:                        # every vanilla tree, written as textures/entity/big_ent_<tree>
                path = f"textures/entity/big_ent_{key}"
                mv = big_ent(key).model
                SIG["big_ent"](mv)
                vanillaize_ent(mv, key)
                mv.finalize()
                assert mv.tw == m.tw, "ent variants must share one atlas size"
                p = os.path.join(rp, path + ".png")
                os.makedirs(os.path.dirname(p), exist_ok=True)
                mv.texture.save(p)
        else:
            for key, path in tex_map.items():
                p = os.path.join(rp, path + ".png")
                os.makedirs(os.path.dirname(p), exist_ok=True)
                m.texture.save(p)
        for path in tex_map.values():   # PBR siblings no longer match the new texture
            for suf in ("_mer.png", "_height.png", "_normal.png", ".texture_set.json"):
                f = os.path.join(rp, path + suf)
                if os.path.exists(f): os.remove(f)
        # animations: keep ids / lengths / loops
        names = info["animations"]
        new = anims_for(m, spec.rig, names, heavy=spec.heavy, armed=spec.armed, floaty=spec.floaty, extra=spec.extra)
        for short, ai in names.items():
            if ai["id"] not in new: continue
            f = ai.get("file")
            if not f:
                continue
            doc = anim_doc(f)
            doc.setdefault("animations", {})[ai["id"]] = new[ai["id"]]
        stats.append((ent, m.cube_count(), m.tw, len(new)))
    for f, doc in anim_files.items():
        write_json(os.path.join(rp, "animations", f), doc)
    return stats


if __name__ == "__main__":
    out = sys.argv[1]
    for s in run(out): print(s)
