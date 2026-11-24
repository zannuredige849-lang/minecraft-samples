"""Tiny mesh toolkit: smooth grids, sweeps, spheres, cylinders + OBJ / GLB / Bedrock poly_mesh exporters.

Conventions: Y up, positions in Bedrock model units (1/16 block).  UV origin is TOP-LEFT (v down) -
the same as Bedrock poly_mesh (normalized_uvs) and glTF; the OBJ exporter flips v.
"""
from __future__ import annotations
import json, struct, io
import numpy as np


class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.uv, self.tri = [], [], [], []

    # ------------------------------------------------------------------ builders
    def grid(self, P, UV, flip=False, wrap=False):
        """P: (rows, cols, 3) points, UV: (rows, cols, 2). Smooth normals from the grid."""
        P = np.asarray(P, float); UV = np.asarray(UV, float)
        R, Cc = P.shape[:2]
        N = np.zeros_like(P)
        r1 = np.roll(P, -1, 0) if False else None
        # central differences
        dr = np.zeros_like(P); dc = np.zeros_like(P)
        dr[1:-1] = P[2:] - P[:-2]; dr[0] = P[1] - P[0]; dr[-1] = P[-1] - P[-2]
        if wrap:
            dc = np.roll(P, -1, 1) - np.roll(P, 1, 1)
        else:
            dc[:, 1:-1] = P[:, 2:] - P[:, :-2]; dc[:, 0] = P[:, 1] - P[:, 0]; dc[:, -1] = P[:, -1] - P[:, -2]
        N = np.cross(dc, dr)
        L = np.linalg.norm(N, axis=2, keepdims=True)
        N = np.where(L > 1e-9, N / np.maximum(L, 1e-9), np.array([0, 0, 1.0]))
        if flip:
            N = -N
        base = len(self.pos)
        for i in range(R):
            for j in range(Cc):
                self.pos.append(P[i, j].tolist()); self.nrm.append(N[i, j].tolist()); self.uv.append(UV[i, j].tolist())
        cols = Cc
        for i in range(R - 1):
            for j in range(Cc - 1 + (1 if wrap else 0)):
                j2 = (j + 1) % Cc if wrap else j + 1
                a, b, c, d = base + i * cols + j, base + i * cols + j2, base + (i + 1) * cols + j2, base + (i + 1) * cols + j
                if flip:
                    self.tri += [(a, c, b), (a, d, c)]
                else:
                    self.tri += [(a, b, c), (a, c, d)]
        return self

    def merge(self, other: "Mesh"):
        o = len(self.pos)
        self.pos += other.pos; self.nrm += other.nrm; self.uv += other.uv
        self.tri += [(a + o, b + o, c + o) for a, b, c in other.tri]

    def transform(self, M):
        M = np.asarray(M, float)
        p = np.c_[np.asarray(self.pos), np.ones(len(self.pos))] @ M.T
        n = np.asarray(self.nrm) @ M[:3, :3].T
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        self.pos, self.nrm = p[:, :3].tolist(), n.tolist()


def sweep(path, cross, uv_rect, rows_uv=(0, 1), flip=False):
    """Sweep a closed cross-section along `path` (list of (pt, tangent, normal, binormal, scale_n, scale_b))."""
    rows = []
    for (pt, T, N, B, sn, sb) in path:
        rows.append([np.asarray(pt) + N * cx * sn + B * cy * sb for cx, cy in cross])
    P = np.asarray(rows)
    R, Cc = P.shape[:2]
    P = np.concatenate([P, P[:, :1]], axis=1)  # close ring
    u0, v0, u1, v1 = uv_rect
    U = np.linspace(u0, u1, Cc + 1)[None, :].repeat(R, 0)
    V = np.linspace(v0 + (v1 - v0) * rows_uv[0], v0 + (v1 - v0) * rows_uv[1], R)[:, None].repeat(Cc + 1, 1)
    m = Mesh().grid(P, np.stack([U, V], -1), flip=flip)
    return m


def sphere(c, r, uv_rect, nu=18, nv=12, planar=True):
    cx, cy, cz = c; rx, ry, rz = r
    th = np.linspace(0, 2 * np.pi, nu + 1)
    ph = np.linspace(0, np.pi, nv + 1)
    P = np.zeros((nv + 1, nu + 1, 3)); UV = np.zeros((nv + 1, nu + 1, 2))
    u0, v0, u1, v1 = uv_rect
    for i, p in enumerate(ph):
        for j, t in enumerate(th):
            x, y, z = rx * np.sin(p) * np.sin(t), ry * np.cos(p), -rz * np.sin(p) * np.cos(t)  # -z = front
            P[i, j] = (cx + x, cy + y, cz + z)
            uu, vv = (0.5 + x / (2 * rx)), (0.5 - y / (2 * ry))
            UV[i, j] = (u0 + (u1 - u0) * uu, v0 + (v1 - v0) * vv)
    return Mesh().grid(P, UV, wrap=False, flip=True)


def cylinder(c, r, h, uv_rect, seg=12, rows=2, taper=(1.0, 1.0), cap=True):
    cx, cy, cz = c
    P = np.zeros((rows, seg + 1, 3)); UV = np.zeros((rows, seg + 1, 2))
    u0, v0, u1, v1 = uv_rect
    for i in range(rows):
        t = i / (rows - 1)
        rr = r * (taper[0] + (taper[1] - taper[0]) * t)
        for j in range(seg + 1):
            a = 2 * np.pi * j / seg
            P[i, j] = (cx + rr * np.cos(a), cy + h * t, cz + rr * np.sin(a))
            UV[i, j] = (u0 + (u1 - u0) * j / seg, v1 - (v1 - v0) * t)
    return Mesh().grid(P, UV, flip=True)


# ------------------------------------------------------------------ exporters
def export_obj(mesh: Mesh, path, mtl_name, tex_name, emissive_name=None, scale=1.0):
    with open(path, "w") as f:
        f.write(f"mtllib {mtl_name}\no frostmourne\nusemtl frostmourne\n")
        for p in mesh.pos: f.write("v %.5f %.5f %.5f\n" % tuple(x * scale for x in p))
        for u in mesh.uv: f.write("vt %.5f %.5f\n" % (u[0], 1 - u[1]))
        for n in mesh.nrm: f.write("vn %.5f %.5f %.5f\n" % tuple(n))
        for a, b, c in mesh.tri:
            f.write(f"f {a+1}/{a+1}/{a+1} {b+1}/{b+1}/{b+1} {c+1}/{c+1}/{c+1}\n")
    with open(path.rsplit("/", 1)[0] + "/" + mtl_name, "w") as f:
        f.write(f"newmtl frostmourne\nKa 1 1 1\nKd 1 1 1\nKs 0.6 0.6 0.7\nNs 60\nmap_Kd {tex_name}\n")
        if emissive_name:
            f.write(f"Ke 1 1 1\nmap_Ke {emissive_name}\n")


def export_glb(mesh: Mesh, path, base_png: bytes, emissive_png: bytes, scale=1 / 16):
    pos = (np.asarray(mesh.pos, np.float32) * scale)
    nrm = np.asarray(mesh.nrm, np.float32)
    uv = np.asarray(mesh.uv, np.float32)
    idx = np.asarray(mesh.tri, np.uint32).reshape(-1)
    blobs, views = [], []

    def add(data, target=None):
        pad = (-sum(len(b) for b in blobs)) % 4
        if pad: blobs.append(b"\0" * pad)
        off = sum(len(b) for b in blobs)
        blobs.append(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: v["target"] = target
        views.append(v)
        return len(views) - 1

    vp, vn, vu, vi = add(pos.tobytes(), 34962), add(nrm.tobytes(), 34962), add(uv.tobytes(), 34962), add(idx.tobytes(), 34963)
    vimg0, vimg1 = add(base_png), add(emissive_png)
    acc = [
        {"bufferView": vp, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
        {"bufferView": vn, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
        {"bufferView": vu, "componentType": 5126, "count": len(uv), "type": "VEC2"},
        {"bufferView": vi, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
    ]
    gltf = {
        "asset": {"version": "2.0", "generator": "warcraft_arthas/meshlib"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "Frostmourne"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0}]}],
        "materials": [{"name": "frostmourne", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.85, "roughnessFactor": 0.38},
                       "emissiveTexture": {"index": 1}, "emissiveFactor": [1, 1, 1], "doubleSided": True}],
        "textures": [{"source": 0, "sampler": 0}, {"source": 1, "sampler": 0}],
        "images": [{"bufferView": vimg0, "mimeType": "image/png"}, {"bufferView": vimg1, "mimeType": "image/png"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "bufferViews": views, "accessors": acc,
    }
    binb = b"".join(blobs); binb += b"\0" * ((-len(binb)) % 4)
    gltf["buffers"] = [{"byteLength": len(binb)}]
    js = json.dumps(gltf, separators=(",", ":")).encode(); js += b" " * ((-len(js)) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binb), 0x004E4942) + binb)


def poly_mesh_json(mesh: Mesh, decimals=3):
    """Bedrock `poly_mesh` block (normalized UVs, explicit [pos, normal, uv] index triples per triangle)."""
    q = lambda arr: [[round(float(x), decimals) for x in v] for v in arr]
    return {
        "normalized_uvs": True,
        "positions": q(mesh.pos), "normals": q(mesh.nrm), "uvs": q(mesh.uv),
        "polys": [[[a, a, a], [b, b, b], [c, c, c]] for a, b, c in mesh.tri],
    }
