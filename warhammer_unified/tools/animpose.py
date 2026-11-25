import math
def _val(v):
    return v
def eval_channel(ch, t=0.0):
    """ch: [x,y,z] | {time: [x,y,z] | {"post":..,"pre":..}}; returns [x,y,z] floats (expressions -> 0)."""
    def num(a):
        out = []
        for x in a:
            out.append(float(x) if isinstance(x, (int, float)) else 0.0)
        return out
    if isinstance(ch, list):
        return num(ch)
    if isinstance(ch, (int, float)):
        return [float(ch)] * 3
    if isinstance(ch, dict):
        if "vector" in ch:
            return num(ch["vector"])
        keys = sorted(ch.keys(), key=lambda k: float(k)) if all(re.match(r"^-?[0-9.]+$", str(k)) for k in ch) else []
        if not keys:
            return [0, 0, 0]
        prev = keys[0]
        for k in keys:
            if float(k) <= t: prev = k
        v = ch[prev]
        if isinstance(v, dict):
            v = v.get("post", v.get("pre", [0, 0, 0]))
        return num(v) if isinstance(v, list) else [0, 0, 0]
    return [0, 0, 0]
import re
def pose_from_anim(anim, t=0.0):
    pose = {}
    for bone, ch in (anim.get("bones") or {}).items():
        e = {}
        if "rotation" in ch: e["rot"] = eval_channel(ch["rotation"], t)
        if "position" in ch: e["pos"] = eval_channel(ch["position"], t)
        pose[bone] = e
    return pose
