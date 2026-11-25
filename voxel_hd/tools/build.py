#!/usr/bin/env python3
"""Voxel HD pack generator (Minecraft Bedrock).

Reads the vanilla Bedrock resource pack (Mojang/bedrock-samples `resource_pack/`)
and writes `VoxelHD_RP/`:

  1. HD "voxel relief" textures (K x upscale) for blocks, items, mobs and armor.
     Every source texel stays a hard-edged square; a height field derived from
     the texel brightness is lit from the top-left, so brighter texels read as
     raised voxels and darker ones as recessed ones.
  2. Vibrant Visuals texture sets (height map + uniform MER) for opaque blocks,
     so the same relief is real parallax relief in game.
  3. 3D voxel held items: one shared texture-mesh geometry + one attachable per
     item (vanilla bow hold pose), fed by a 2x edge-smoothed (Scale2x) sprite.

Usage: build.py <vanilla resource_pack dir> <output pack dir>
"""
import json
import re
import shutil
import sys
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

K = 4  # texture upscale factor (16px -> 64px)
LEVELS = 6  # brightness steps of the height field (voxel layers)
RELIEF = 2.6  # shading strength
SHADE_MIN, SHADE_MAX = 0.80, 1.22
ITEM_THICKNESS = 1.5  # held voxel item thickness in model units (vanilla = 1)

# ---------------------------------------------------------------- helpers


def load_jsonc(path):
    s = Path(path).read_text(encoding="utf-8-sig")
    s = re.sub(r"(?m)^\s*//.*$", "", s)
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    return json.loads(s)


def write_json(path, data, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, separators=(",", ":")) if compact else json.dumps(data, indent=2),
        encoding="utf-8",
    )


def luminance(rgb):
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0


def box3(a, wrap_x, wrap_y):
    """3x3 box blur with per-axis wrap/edge padding."""
    h, w = a.shape
    p = np.pad(a, ((1, 1), (0, 0)), mode="wrap" if wrap_y else "edge")
    p = np.pad(p, ((0, 0), (1, 1)), mode="wrap" if wrap_x else "edge")
    out = np.zeros_like(a)
    for dy in range(3):
        for dx in range(3):
            out += p[dy : dy + h, dx : dx + w]
    return out / 9.0


def voxel_relief(img, wrap_x=False, wrap_y=False):
    """Return (color RGBA uint8 K x larger, height uint8 K x larger)."""
    a = np.asarray(img.convert("RGBA"), dtype=np.uint8)
    alpha = a[..., 3]
    lum = luminance(a[..., :3].astype(np.float32))
    # transparent texels sit at the bottom so cut-out edges get a visible lip
    hq = np.round(lum * (LEVELS - 1)) / (LEVELS - 1)
    hq = np.where(alpha > 0, 0.25 + 0.75 * hq, 0.0).astype(np.float32)

    up = lambda m: np.repeat(np.repeat(m, K, axis=0), K, axis=1)
    h_up = box3(up(hq), wrap_x, wrap_y)  # plateaus with 1px chamfers
    col_up = up(a)
    gy, gx = np.gradient(h_up)
    # light from top-left: slopes facing it brighten, slopes facing away darken
    shade = 1.0 + RELIEF * (gx + gy)
    shade = np.clip(shade, SHADE_MIN, SHADE_MAX)
    out = col_up.astype(np.float32)
    out[..., :3] *= shade[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    height = np.clip(h_up * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA"), Image.fromarray(height, "L"), alpha


def save_lossless_small(img, path):
    """Save as palette PNG when <=256 distinct colors (lossless), else plain optimized PNG."""
    a = np.asarray(img)
    flat = a.reshape(-1, a.shape[-1])
    colors, idx = np.unique(flat, axis=0, return_inverse=True)
    if len(colors) > 256:
        img.save(path, optimize=True)
        return
    pal = Image.fromarray(idx.reshape(a.shape[:2]).astype(np.uint8), "P")
    pal.putpalette(colors.astype(np.uint8).flatten().tolist(), rawmode="RGBA" if a.shape[-1] == 4 else "RGB")
    pal.save(path, optimize=True)


def scale2x(img):
    """Scale2x/EPX pixel-art upscale (keeps hard edges, smooths staircases)."""
    p = np.asarray(img.convert("RGBA"), dtype=np.uint8)
    h, w, _ = p.shape
    pad = np.pad(p, ((1, 1), (1, 1), (0, 0)), mode="edge")
    P = p
    A = pad[0:h, 1 : w + 1]  # up
    B = pad[1 : h + 1, 2 : w + 2]  # right
    C = pad[1 : h + 1, 0:w]  # left
    D = pad[2 : h + 2, 1 : w + 1]  # down
    eq = lambda x, y: np.all(x == y, axis=-1)
    e0 = eq(C, A) & ~eq(C, D) & ~eq(A, B)
    e1 = eq(A, B) & ~eq(A, C) & ~eq(B, D)
    e2 = eq(D, C) & ~eq(D, B) & ~eq(C, A)
    e3 = eq(B, D) & ~eq(B, A) & ~eq(D, C)
    out = np.zeros((h * 2, w * 2, 4), dtype=np.uint8)
    out[0::2, 0::2] = np.where(e0[..., None], A, P)
    out[0::2, 1::2] = np.where(e1[..., None], B, P)
    out[1::2, 0::2] = np.where(e2[..., None], C, P)
    out[1::2, 1::2] = np.where(e3[..., None], D, P)
    return Image.fromarray(out, "RGBA")


# ---------------------------------------------------------------- textures


def build_textures(src, dst):
    stats = {"blocks": 0, "items": 0, "entity": 0, "armor": 0, "texture_sets": 0}

    def process(rel_dir, kind, wrap_tiles, make_sets):
        root = src / "textures" / rel_dir
        if not root.exists():
            return
        for png in sorted(root.rglob("*.png")):
            rel = png.relative_to(src)
            img = Image.open(png)
            w, h = img.size
            strip = h > w  # flipbook strip: wrap sideways only
            color, height, alpha = voxel_relief(
                img, wrap_x=wrap_tiles, wrap_y=wrap_tiles and not strip
            )
            out = dst / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            color.save(out, optimize=True)
            stats[kind] += 1
            # --- texture set: keep vanilla MERS/normal (emissive ores, lava...) upscaled
            vset = png.with_name(png.stem + ".texture_set.json")
            ts = {"color": out.stem}
            if vset.exists():
                vts = load_jsonc(vset)["minecraft:texture_set"]
                for key in ("metalness_emissive_roughness_subsurface", "metalness_emissive_roughness", "normal"):
                    v = vts.get(key)
                    if isinstance(v, str):
                        mp = next((png.with_name(v + e) for e in (".tga", ".png") if png.with_name(v + e).exists()), None)
                        if mp is not None:
                            m = Image.open(mp)
                            m = m.convert("RGBA" if m.mode == "RGBA" else "RGB")
                            arr = np.asarray(m).reshape(-1, len(m.getbands()))
                            if (arr == arr[0]).all():
                                ts[key] = [int(c) for c in arr[0]]  # uniform map -> inline value
                            else:
                                m = m.resize(color.size, Image.NEAREST)  # match color map size
                                save_lossless_small(m, out.with_name(v + ".png"))
                                ts[key] = v
                    elif v is not None:
                        ts[key] = v
            want_height = False
            if make_sets and not strip and "normal" not in ts:
                partial = ((alpha > 0) & (alpha < 255)).mean()
                want_height = partial < 0.02 and int(height.getextrema()[0]) != int(height.getextrema()[1])  # skip flat maps
            if want_height:
                height.save(out.with_name(out.stem + "_height.png"), optimize=True)
                ts["heightmap"] = out.stem + "_height"
            if len(ts) > 1:
                if not any(k.startswith("metalness") for k in ts):
                    ts["metalness_emissive_roughness"] = [0, 0, 190]
                write_json(out.with_name(out.stem + ".texture_set.json"),
                           {"format_version": "1.21.30", "minecraft:texture_set": ts}, compact=True)
                stats["texture_sets"] += 1

    process("blocks", "blocks", True, True)
    process("items", "items", False, False)
    process("entity", "entity", False, False)
    process("models/armor", "armor", False, False)
    return stats


# ---------------------------------------------------------------- 3D items

SKIP_SUFFIX = ("_helmet", "_chestplate", "_leggings", "_boots", "_horse_armor")
SKIP_IDS = {
    "bow", "crossbow", "trident", "shield", "elytra", "fishing_rod", "carrot_on_a_stick",
    "warped_fungus_on_a_stick", "compass", "recovery_compass", "clock", "filled_map", "map",
    "potion", "splash_potion", "lingering_potion", "spawn_egg", "firework_star", "lead",
    "turtle_helmet", "mace", "spyglass", "banner_pattern", "enchanted_book", "tipped_arrow",
    "writable_book", "written_book", "brush", "goat_horn", "bundle", "totem_of_undying",
}
RENAME = {
    "cooked_beef": "beef_cooked", "cooked_porkchop": "porkchop_cooked",
    "cooked_chicken": "chicken_cooked", "cooked_mutton": "mutton_cooked",
    "cooked_rabbit": "rabbit_cooked", "cooked_cod": "fish_cooked",
    "cooked_salmon": "salmon_cooked", "golden_apple": "apple_golden",
    "golden_carrot": "carrot_golden", "enchanted_golden_apple": "apple_golden",
    "porkchop": "porkchop_raw", "beef": "beef_raw", "chicken": "chicken_raw",
    "mutton": "mutton_raw", "rabbit": "rabbit_raw", "cod": "fish_raw",
    "salmon": "salmon_raw", "melon_slice": "melon", "glow_berries": "glow_berries",
    "ender_eye": "ender_eye", "slime_ball": "slimeball", "iron_ingot": "iron_ingot",
    "netherite_ingot": "netherite_ingot", "gold_ingot": "gold_ingot",
    "copper_ingot": "copper_ingot", "snowball": "snowball",
}
TOOLS = ("sword", "pickaxe", "axe", "shovel", "hoe", "spear")
MATS = {"wooden": "wood", "golden": "gold"}


def resolve_icon(item_id, src, item_tex):
    cands = [item_id]
    if item_id in RENAME:
        cands.insert(0, RENAME[item_id])
    for mat, vm in MATS.items():
        for t in TOOLS:
            if item_id == f"{mat}_{t}":
                cands.insert(0, f"{vm}_{t}")
    for c in cands:
        p = src / "textures" / "items" / f"{c}.png"
        if p.exists():
            return p
    ent = item_tex.get(item_id)
    if ent:
        tex = ent["textures"]
        if isinstance(tex, str):
            p = src / (tex + ".png")
            if p.exists():
                return p
    return None


def build_items(src, dst, pack_ns):
    lang = (src / "texts" / "en_US.lang").read_text(encoding="utf-8")
    ids = sorted({m.group(1) for m in re.finditer(r"(?m)^item\.([a-z0-9_]+)\.name=", lang)})
    item_tex = load_jsonc(src / "textures" / "item_texture.json")["texture_data"]

    made, skipped = [], []
    for item_id in ids:
        if item_id in SKIP_IDS or item_id.endswith(SKIP_SUFFIX) or item_id.startswith("record_"):
            skipped.append((item_id, "special"))
            continue
        icon = resolve_icon(item_id, src, item_tex)
        if icon is None:
            skipped.append((item_id, "no icon"))
            continue
        img = Image.open(icon).convert("RGBA")
        if img.size not in ((16, 16), (32, 32)):
            skipped.append((item_id, f"size {img.size}"))
            continue
        if img.size == (16, 16):
            img = scale2x(img)
        tex_path = dst / "textures" / pack_ns / "items" / f"{item_id}.png"
        tex_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(tex_path, optimize=True)
        write_json(
            dst / "attachables" / f"{item_id}.attachable.json",
            {
                "format_version": "1.10.0",
                "minecraft:attachable": {
                    "description": {
                        "identifier": f"minecraft:{item_id}",
                        "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
                        "textures": {
                            "default": f"textures/{pack_ns}/items/{item_id}",
                            "enchanted": "textures/misc/enchanted_item_glint",
                        },
                        "geometry": {"default": "geometry.voxel_item"},
                        "animations": {"wield": "animation.voxel_item.wield"},
                        "scripts": {"animate": ["wield"]},
                        "render_controllers": ["controller.render.item_default"],
                    }
                },
            },
            compact=True,
        )
        made.append(item_id)

    # shared geometry: sprite as 0.5-unit voxels (texture is 32px, geometry grid is 16)
    write_json(
        dst / "models" / "entity" / "voxel_item.geo.json",
        {
            "format_version": "1.16.0",
            "minecraft:geometry": [
                {
                    "description": {
                        "identifier": "geometry.voxel_item",
                        "texture_width": 16,
                        "texture_height": 16,
                    },
                    "bones": [
                        {
                            "name": "rightitem",
                            "texture_meshes": [
                                {
                                    # same hold transform as the vanilla bow sprite
                                    "local_pivot": [6.0, 0.0, 6.0],
                                    "position": [2.0, 1.0, -2.0],
                                    "rotation": [0.0, -135.0, 90.0],
                                    "scale": [1.0, ITEM_THICKNESS, 1.0],
                                    "use_pixel_depth": False,
                                    "texture": "default",
                                }
                            ],
                        }
                    ],
                }
            ],
        },
    )
    # same wield animation as the vanilla bow (first / third person hold pose)
    write_json(
        dst / "animations" / "voxel_item.animation.json",
        {
            "format_version": "1.10.0",
            "animations": {
                "animation.voxel_item.wield": {
                    "loop": True,
                    "bones": {
                        "rightitem": {
                            "position": [
                                "c.is_first_person ? -5.5 : 0.5",
                                "c.is_first_person ? -3.0 : -2.5",
                                "c.is_first_person ? -3.0 : 1.0",
                            ],
                            "rotation": [
                                "c.is_first_person ? 38.0 : 0.0",
                                "c.is_first_person ? -120.0 : 0.0",
                                "c.is_first_person ? -63.0 : 0.0",
                            ],
                        }
                    },
                }
            },
        },
    )
    return made, skipped


# ---------------------------------------------------------------- main


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True)

    stats = build_textures(src, dst)
    made, skipped = build_items(src, dst, "voxel")

    write_json(
        dst / "manifest.json",
        {
            "format_version": 2,
            "header": {
                "name": "Voxel HD",
                "description": "Voxel-style HD textures with relief (Vibrant Visuals height maps) and 3D voxel held items.",
                "uuid": "6d0c5f0e-8b1e-4f4a-9a77-4c1f3b0a7e21",
                "version": [1, 0, 0],
                "min_engine_version": [1, 21, 30],
            },
            "modules": [
                {
                    "type": "resources",
                    "uuid": "a2a1f6c8-3d7c-4c8e-b0f4-5e9d2d1c8b34",
                    "version": [1, 0, 0],
                    "description": "Voxel HD resources",
                }
            ],
            "capabilities": ["pbr"],
        },
    )
    icon = Image.open(dst / "textures" / "items" / "diamond_sword.png").convert("RGBA")
    canvas = Image.new("RGBA", (256, 256), (52, 52, 58, 255))
    canvas.alpha_composite(icon.resize((256, 256), Image.NEAREST))
    canvas.save(dst / "pack_icon.png")
    print(json.dumps({"textures": stats, "held_items_3d": len(made), "skipped_items": len(skipped)}, indent=2))
    write_json(dst.parent / "build_report.json", {"held_items": made, "skipped": skipped, "stats": stats})


if __name__ == "__main__":
    main()
