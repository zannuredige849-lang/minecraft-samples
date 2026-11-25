"""Full pipeline: python3 build_all.py <original-extracted-dir> <out-dir> [--zip path.mcaddon]"""
import sys, os, shutil, argparse
sys.path.insert(0, os.path.dirname(__file__))
import build_models, ent_variants, restyle, items_style, patch_bp, package, strip_strays, remove_orc_gear, banners
from forge.registry import REG
from forge.common import ENT


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out"); ap.add_argument("--zip")
    a = ap.parse_args()
    if os.path.exists(a.out): shutil.rmtree(a.out)
    for part in ("behavior_pack", "resource_pack"):
        shutil.copytree(os.path.join(a.src, part), os.path.join(a.out, part))
    st = build_models.run(a.out)
    print("models regenerated:", len(st), "cubes total", sum(s[1] for s in st))
    print("big ent tree variants:", ent_variants.run(a.out))
    skip = set(t for e in REG for t in ENT[e]["textures"].values())
    skip |= {f"textures/entity/big_ent_{k}" for k in ent_variants.ENT_VARIANTS}      # generated vanilla-wood ents
    print("floating cubes removed:", strip_strays.run(a.out))
    print("vanilla banners on orc leaders (textures):", banners.run(a.out))
    print("orc gear files removed:", remove_orc_gear.run(a.out))
    print("textures restyled:", restyle.run(a.out, skip))
    print("items/eggs:", items_style.run(a.out))
    print("factions:", patch_bp.run(a.out))
    package.manifests(a.out)
    errs, warns, info = package.validate(a.out)
    print("validate:", info, "errors", len(errs), "warnings", len(warns))
    for e in errs[:40]: print("  ERR", e)
    for w in warns[:20]: print("  warn", w)
    if a.zip and not errs:
        package.zip_addon(a.out, a.zip)
        print("zip:", a.zip, os.path.getsize(a.zip) // 1024, "KB")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
