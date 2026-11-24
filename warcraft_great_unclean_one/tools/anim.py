"""Skeleton + animation conversion from MDX nodes to Bedrock bones / animation keyframes.

Verified against Blockbench (see tools/README notes):
  bone transform  M = T(position) T(pivot) R S T(-pivot), parent transforms multiply on the left,
  which is exactly the Warcraft III node model, so tracks convert 1:1 after the axis change.
  File rotation (rx, ry, rz) in degrees acts as Rz(rz) Ry(-ry) Rx(-rx) in the visual (INT) frame,
  file x is mirrored: x_file = -x_int  (pivot, position).
"""
import math
import re

import numpy as np

import mdx
import voxel

# WC3 -> INT axis change as a pure rotation matrix: x_int = -y, y_int = z, z_int = -x
MROT = np.array([[0, -1, 0], [0, 0, 1], [-1, 0, 0]], float)

SEQ = {  # animation name -> MDX sequence index
    "walk": 0, "idle_a": 1, "idle_b": 2, "attack_a": 3, "attack_b": 4, "slam": 5, "channel": 6, "death": 7,
}
LOOPING = {"walk"}  # idle_a / idle_b / channel are chained by the animation controller instead


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def skeleton(m, used):
    """kept node ids (parents first), bone names, parent map"""
    keep = set()
    for b in used:
        n = b
        while n != mdx.NONE and n in m.nodes:
            keep.add(n)
            n = m.nodes[n].parent

    def depth(n):
        d = 0
        while m.nodes[n].parent in m.nodes:
            n = m.nodes[n].parent
            d += 1
        return d

    ids = sorted(keep, key=lambda n: (depth(n), n))
    names, seen = {}, set()
    for n in ids:
        s = slug(m.nodes[n].name) or "bone"
        if s in seen:
            s = "%s_%d" % (s, n)
        seen.add(s)
        names[n] = s
    parent = {n: (m.nodes[n].parent if m.nodes[n].parent in keep else None) for n in ids}
    return ids, names, parent


def pivot_int(m, nid):
    return voxel.to_int(np.array(m.pivots[nid], float))


# --------------------------------------------------------------------------- rotation helpers
def rot_x(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rot_y(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rot_z(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def file_rot_matrix(rot):
    """file euler degrees -> rotation matrix in the INT frame"""
    rx, ry, rz = (math.radians(v) for v in rot)
    return rot_z(rz) @ rot_y(-ry) @ rot_x(-rx)


def quat_matrix(q):
    x, y, z, w = q
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def matrix_file_rot(R, prev=None):
    """INT-frame rotation matrix -> file euler degrees, kept continuous with `prev`"""
    b = -math.asin(max(-1.0, min(1.0, R[2, 0])))
    if abs(math.cos(b)) > 1e-6:
        a = math.atan2(R[2, 1], R[2, 2])
        c = math.atan2(R[1, 0], R[0, 0])
    else:  # gimbal lock
        c = 0.0
        a = math.atan2(-R[1, 2], R[1, 1])
    cands = [(a, b, c), (a + math.pi, math.pi - b, c + math.pi)]
    out = []
    for cand in cands:
        e = [-math.degrees(cand[0]), -math.degrees(cand[1]), math.degrees(cand[2])]
        if prev is not None:
            for i in range(3):
                while e[i] - prev[i] > 180:
                    e[i] -= 360
                while e[i] - prev[i] < -180:
                    e[i] += 360
        out.append(e)
    if prev is None:
        return out[0]
    return min(out, key=lambda e: sum(abs(e[i] - prev[i]) for i in range(3)))


def slerp(q0, q1, t):
    q0, q1 = np.array(q0, float), np.array(q1, float)
    q0 /= np.linalg.norm(q0) or 1
    q1 /= np.linalg.norm(q1) or 1
    d = float(np.dot(q0, q1))
    if d < 0:
        q1, d = -q1, -d
    if d > 0.9995:
        r = q0 + t * (q1 - q0)
        return r / np.linalg.norm(r)
    th = math.acos(d)
    return (math.sin((1 - t) * th) * q0 + math.sin(t * th) * q1) / math.sin(th)


# --------------------------------------------------------------------------- track evaluation
def keys_in(track, start, end, glb=None):
    if track is None:
        return []
    if track["gseq"] >= 0 and glb:
        dur = glb[track["gseq"]]
        return [k for k in track["keys"] if 0 <= k[0] <= dur]
    return [k for k in track["keys"] if start <= k[0] <= end]


def evaluate(track, t, start, end, kind, glb=None):
    """value of an MDX track at time t of the sequence [start, end]; None if the track is idle there"""
    ks = keys_in(track, start, end, glb)
    if not ks:
        return None
    if track["gseq"] >= 0 and glb:
        dur = glb[track["gseq"]] or 1
        t = (t - start) % dur
    if t <= ks[0][0]:
        return ks[0][1]
    if t >= ks[-1][0]:
        return ks[-1][1]
    for a, b in zip(ks, ks[1:]):
        if a[0] <= t <= b[0]:
            f = (t - a[0]) / float(b[0] - a[0] or 1)
            if track["interp"] == 0:
                return a[1]
            if kind == "rot":
                return tuple(slerp(a[1], b[1], f))
            return tuple(x + (y - x) * f for x, y in zip(a[1], b[1]))
    return ks[-1][1]


def sample_times(node, start, end, glb):
    ts = set()
    for tr in (node.tr, node.rot, node.sc):
        for k in keys_in(tr, start, end, glb):
            ts.add(k[0] if tr["gseq"] < 0 else start + k[0])
    if not ts:
        return []
    ts |= {start, end}
    return sorted(t for t in ts if start <= t <= end)


def convert_sequence(m, ids, names, seq, glb):
    """-> {bone_name: {"rotation": {time: [..]}, "position": ..., "scale": ...}} with times in seconds"""
    start, end = seq.start, seq.end
    bones = {}
    for nid in ids:
        node = m.nodes[nid]
        if any(tr is not None and tr["gseq"] >= 0 for tr in (node.tr, node.rot, node.sc)):
            continue  # driven by a global sequence -> see build_global_animation
        has = [tr is not None and keys_in(tr, start, end, glb) for tr in (node.tr, node.rot, node.sc)]
        if not any(has):
            continue
        ts = sample_times(node, start, end, glb)
        out = {}
        prev = None
        if has[1]:  # rotation: subdivide long arcs so linear euler interpolation stays faithful
            fine = []
            lastq = None
            for a, b in zip(ts, ts[1:]):
                qa = evaluate(node.rot, a, start, end, "rot", glb)
                qb = evaluate(node.rot, b, start, end, "rot", glb)
                ang = 2 * math.degrees(math.acos(min(1.0, abs(float(np.dot(qa / np.linalg.norm(qa), qb / np.linalg.norm(qb)))))))
                n = max(1, int(math.ceil(ang / 18.0)))
                fine += [a + (b - a) * i / n for i in range(n)]
            fine.append(ts[-1])
            rts = fine
            rot = {}
            for t in rts:
                q = evaluate(node.rot, t, start, end, "rot", glb)
                R = MROT @ quat_matrix(q) @ MROT.T
                e = matrix_file_rot(R, prev)
                prev = e
                rot[t] = [round(v, 3) for v in e]
            out["rotation"] = rot
        if has[0]:
            pos = {}
            for t in ts:
                v = evaluate(node.tr, t, start, end, "tr", glb)
                ti = voxel.SCALE * (MROT @ np.array(v, float))
                pos[t] = [round(-ti[0], 3), round(ti[1], 3), round(ti[2], 3)]
            out["position"] = pos
        if has[2]:
            sc = {}
            for t in ts:
                v = evaluate(node.sc, t, start, end, "sc", glb)
                sc[t] = [round(v[1], 4), round(v[2], 4), round(v[0], 4)]
            out["scale"] = sc
        bones[names[nid]] = {
            ch: {("%.4f" % ((t - start) / 1000.0)).rstrip("0").rstrip("."): val for t, val in d.items()}
            for ch, d in out.items()
        }
    return bones


def build_global_animation(m, ids, names, gseq=0):
    """looping animation for the nodes driven by global sequence `gseq` (the orbiting fly swarm)"""
    glb = _global_durations(m)
    dur = glb[gseq]
    bones = {}
    for nid in ids:
        node = m.nodes[nid]
        if node.tr is None or node.tr["gseq"] != gseq:
            continue
        pos = {}
        for k in node.tr["keys"]:
            ti = voxel.SCALE * (MROT @ np.array(k[1], float))
            pos["%.4f" % (k[0] / 1000.0)] = [round(-ti[0], 3), round(ti[1], 3), round(ti[2], 3)]
        bones[names[nid]] = {"position": {t: pos[t] for t in sorted(pos, key=float)}}
    return {"animation_length": round(dur / 1000.0, 4), "loop": True, "bones": bones}


def build_animations(m, ids, names, prefix):
    glb = _global_durations(m)
    anims = {}
    for key, si in SEQ.items():
        seq = m.sequences[si]
        a = {"animation_length": round((seq.end - seq.start) / 1000.0, 4), "bones": convert_sequence(m, ids, names, seq, glb)}
        if key in LOOPING:
            a["loop"] = True
        elif key == "death":
            a["loop"] = "hold_on_last_frame"
            # a dying mob is removed after ~1 s: play the 2.17 s animation about twice as fast
            a["anim_time_update"] = "query.anim_time + query.delta_time * 2.17"
        if key == "walk":
            # the stride of the original walk cycle is ~4.6 blocks: tie the cycle to the distance walked
            a["anim_time_update"] = "query.modified_distance_moved * 0.22"
        anims["animation.%s.%s" % (prefix, key)] = a
    anims["animation.%s.flies" % prefix] = build_global_animation(m, ids, names, 0)
    return anims


def _global_durations(m):
    import struct
    raw = open(m.path, "rb").read()
    p = 4
    while p < len(raw):
        tag = raw[p:p + 4]
        size = struct.unpack_from("<I", raw, p + 4)[0]
        if tag == b"GLBS":
            return list(struct.unpack_from("<%dI" % (size // 4), raw, p + 8))
        p += 8 + size
    return []


if __name__ == "__main__":
    import sys

    m = mdx.parse(sys.argv[1])
    m.path = sys.argv[1]
    # self-test of the euler round trip
    rng = np.random.RandomState(1)
    for _ in range(2000):
        e = list(rng.uniform(-170, 170, 3))
        e[1] = rng.uniform(-80, 80)
        R = file_rot_matrix(e)
        e2 = matrix_file_rot(R, e)
        assert np.allclose(file_rot_matrix(e2), R, atol=1e-9), (e, e2)
    print("euler round trip ok")
    ids = [n for n in m.nodes]
    ids, names, parent = skeleton(m, [n for n in m.nodes if n in (20, 44, 14)])
    print([(names[i]) for i in ids])
    glb = _global_durations(m)
    print("global sequences", glb)
    anims = build_animations(m, ids, names, "great_unclean_one")
    for k, a in anims.items():
        print(k, a["animation_length"], len(a["bones"]))
