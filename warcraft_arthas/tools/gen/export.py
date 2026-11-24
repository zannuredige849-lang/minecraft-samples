"""Exporters: Bedrock geometry JSON and Blockbench .bbmodel (project) files."""
from __future__ import annotations
import base64, io, json, uuid as _uuid
from spec_lib import Model, face_rects

NS = _uuid.UUID("a3b1c0de-0000-4000-8000-0a47ba5e0001")


def _u(key):  # deterministic uuids so regenerated files diff cleanly
    return str(_uuid.uuid5(NS, key))


def _r(v):
    return [round(float(x), 4) if abs(x - round(x)) > 1e-6 else int(round(x)) for x in v]


def geo_json(model: Model, tex_w, tex_h, visible=(4, 4.4, (0, 2.0, 0))):
    bones = []
    for name in model.order:
        b = model.bones[name]
        d = {"name": b.name}
        if b.parent:
            d["parent"] = b.parent
        d["pivot"] = _r(b.pivot)
        if any(abs(x) > 1e-6 for x in b.rotation):
            d["rotation"] = _r(b.rotation)
        if b.cubes:
            cubes = []
            for c in b.cubes:
                cd = {"origin": _r(c.origin), "size": list(c.size)}
                if c.pivot is not None and c.rot is not None:
                    cd["pivot"] = _r(c.pivot)
                    cd["rotation"] = _r(c.rot)
                if abs(c.inflate) > 1e-9:
                    cd["inflate"] = round(c.inflate, 3)
                cd["uv"] = list(c.uv)
                cubes.append(cd)
            d["cubes"] = cubes
        if b.locators:
            d["locators"] = {k: _r(v) for k, v in b.locators.items()}
        bones.append(d)
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": model.identifier,
                "texture_width": tex_w, "texture_height": tex_h,
                "visible_bounds_width": visible[0], "visible_bounds_height": visible[1],
                "visible_bounds_offset": list(visible[2]),
            },
            "bones": bones,
        }],
    }


def bbmodel(model: Model, tex_w, tex_h, texture, name: str, visible=(4, 4.4, 2.0), hidden=()):
    """texture: one PIL image (Blockbench bedrock entity projects use a single texture)."""
    buf = io.BytesIO()
    texture.save(buf, "PNG")
    tex_list = [{
        "path": "", "name": f"{name}.png", "folder": "", "namespace": "", "id": "0",
        "width": texture.size[0], "height": texture.size[1], "uv_width": tex_w, "uv_height": tex_h,
        "particle": False, "use_as_default": True, "layers_enabled": False, "sync_to_project": "",
        "render_mode": "default", "render_sides": "auto", "frame_time": 1, "frame_order_type": "loop",
        "frame_order": "", "frame_interpolate": False, "visible": True, "internal": True, "saved": False,
        "uuid": _u(f"tex-{name}"),
        "source": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
    }]
    elements = []
    groups_children = {n: [] for n in model.order}

    for n in model.order:
        b = model.bones[n]
        for ci, c in enumerate(b.cubes):
            ox, oy, oz = c.origin
            sx, sy, sz = c.size
            frm = [-(ox + sx), oy, oz]
            to = [frm[0] + sx, oy + sy, oz + sz]
            el = {
                "name": c.name, "box_uv": True, "rescale": False, "locked": False, "light_emission": 0,
                "render_order": "default", "allow_mirror_modeling": False, "visibility": n not in hidden,
                "from": _r(frm), "to": _r(to), "autouv": 0, "color": 0, "inflate": round(c.inflate, 3),
                "origin": _r([-c.pivot[0], c.pivot[1], c.pivot[2]]) if c.pivot else _r([-b.pivot[0], b.pivot[1], b.pivot[2]]),
                "uv_offset": list(c.uv), "mirror_uv": False,
                "faces": {f: {"uv": [0, 0, 0, 0], "texture": 0} for f in ("north", "east", "south", "west", "up", "down")},
                "type": "cube", "uuid": _u(f"cube-{n}-{ci}-{c.name}"),
            }
            if c.rot is not None:
                el["rotation"] = _r([-c.rot[0], -c.rot[1], c.rot[2]])
            elements.append(el)
            groups_children[n].append(el["uuid"])
        for lname, lp in b.locators.items():
            el = {"name": lname, "from": _r([-lp[0], lp[1], lp[2]]), "color": 0, "locked": False,
                  "type": "locator", "uuid": _u(f"loc-{n}-{lname}")}
            elements.append(el)
            groups_children[n].append(el["uuid"])

    def node(n):
        b = model.bones[n]
        g = {"name": n, "origin": _r([-b.pivot[0], b.pivot[1], b.pivot[2]]), "color": 0, "uuid": _u(f"grp-{n}"),
             "export": True, "mirror_uv": False, "isOpen": False, "locked": False, "visibility": n not in hidden, "autouv": 0}
        if any(abs(x) > 1e-6 for x in b.rotation):
            g["rotation"] = _r([-b.rotation[0], -b.rotation[1], b.rotation[2]])
        kids = [node(k) for k in model.order if model.bones[k].parent == n]
        g["children"] = groups_children[n] + kids
        return g

    roots = [node(n) for n in model.order if model.bones[n].parent is None]
    return {
        "meta": {"format_version": "5.0", "model_format": "bedrock", "box_uv": True},
        "name": name,
        "model_identifier": model.identifier.replace("geometry.", ""),
        "visible_box": [visible[0], visible[1], visible[2]],
        "variable_placeholders": "", "bedrock_animation_mode": "entity", "timeline_setups": [],
        "unhandled_root_fields": {},
        "resolution": {"width": tex_w, "height": tex_h},
        "elements": elements,
        "outliner": roots,
        "textures": tex_list,
    }
