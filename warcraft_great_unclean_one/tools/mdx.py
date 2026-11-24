"""Minimal Warcraft III MDX (version 800) reader: sequences, materials, textures, geosets, bones, pivots.

Only what the Bedrock converter needs. All numbers are little endian. Coordinates stay in
Warcraft III space (X forward, Y left, Z up); the converter does the axis change.
"""
import struct

NONE = 0xFFFFFFFF


class R:
    def __init__(self, data, pos=0):
        self.d, self.p = data, pos

    def u32(self):
        v = struct.unpack_from("<I", self.d, self.p)[0]
        self.p += 4
        return v

    def i32(self):
        v = struct.unpack_from("<i", self.d, self.p)[0]
        self.p += 4
        return v

    def f32(self):
        v = struct.unpack_from("<f", self.d, self.p)[0]
        self.p += 4
        return v

    def vec(self, n):
        v = struct.unpack_from("<%df" % n, self.d, self.p)
        self.p += 4 * n
        return v

    def arr(self, fmt, n):
        sz = struct.calcsize("<" + fmt)
        v = struct.unpack_from("<%d%s" % (n, fmt), self.d, self.p)
        self.p += sz * n
        return v

    def tag(self):
        t = self.d[self.p : self.p + 4].decode("latin1")
        self.p += 4
        return t

    def cstr(self, n):
        s = self.d[self.p : self.p + n].split(b"\0")[0].decode("latin1")
        self.p += n
        return s


def read_track(r, nvals):
    """KGTR/KGRT/KGSC body after the tag: returns dict(interp, gseq, keys=[(t, value, in, out)])"""
    n = r.u32()
    interp = r.u32()
    gseq = r.i32()
    keys = []
    for _ in range(n):
        t = r.i32()
        v = r.vec(nvals)
        tin = tout = None
        if interp > 1:
            tin = r.vec(nvals)
            tout = r.vec(nvals)
        keys.append((t, v, tin, tout))
    return {"interp": interp, "gseq": gseq, "keys": keys}


class Node:
    pass


def read_node(r):
    start = r.p
    size = r.u32()
    end = start + size
    n = Node()
    n.name = r.cstr(80)
    n.id = r.u32()
    n.parent = r.u32()
    n.flags = r.u32()
    n.tr = n.rot = n.sc = None
    while r.p < end:
        t = r.tag()
        if t == "KGTR":
            n.tr = read_track(r, 3)
        elif t == "KGRT":
            n.rot = read_track(r, 4)
        elif t == "KGSC":
            n.sc = read_track(r, 3)
        else:
            raise ValueError("unknown node track " + t)
    r.p = end
    return n


def parse(path):
    data = open(path, "rb").read()
    assert data[:4] == b"MDLX"
    m = Node()
    m.sequences, m.materials, m.textures, m.geosets = [], [], [], []
    m.bones, m.helpers, m.attachments = [], [], []
    m.pivots = []
    p = 4
    while p < len(data):
        tag = data[p : p + 4].decode("latin1")
        size = struct.unpack_from("<I", data, p + 4)[0]
        body = p + 8
        end = body + size
        r = R(data, body)
        if tag == "VERS":
            m.version = r.u32()
        elif tag == "MODL":
            m.name = r.cstr(80)
            r.p += 260
            m.bounds_radius = r.f32()
            m.bmin, m.bmax = r.vec(3), r.vec(3)
        elif tag == "SEQS":
            for _ in range(size // 132):
                s = Node()
                s.name = r.cstr(80)
                s.start, s.end = r.u32(), r.u32()
                s.speed = r.f32()
                s.flags = r.u32()  # 1 = non looping
                s.rarity = r.f32()
                r.u32()
                s.radius = r.f32()
                s.bmin, s.bmax = r.vec(3), r.vec(3)
                m.sequences.append(s)
        elif tag == "TEXS":
            for _ in range(size // 268):
                t = Node()
                t.replaceable = r.u32()
                t.path = r.cstr(260)
                t.flags = r.u32()
                m.textures.append(t)
        elif tag == "MTLS":
            while r.p < end:
                ms = r.u32()
                mend = r.p - 4 + ms
                mat = Node()
                mat.priority = r.u32()
                mat.flags = r.u32()
                assert r.tag() == "LAYS"
                nl = r.u32()
                mat.layers = []
                for _ in range(nl):
                    ls = r.u32()
                    lend = r.p - 4 + ls
                    L = Node()
                    L.filter = r.u32()
                    L.shading = r.u32()
                    L.tex = r.u32()
                    L.texanim = r.i32()
                    L.coord = r.u32()
                    L.alpha = r.f32()
                    r.p = lend
                    mat.layers.append(L)
                r.p = mend
                m.materials.append(mat)
        elif tag == "GEOS":
            while r.p < end:
                gs = r.u32()
                gend = r.p - 4 + gs
                g = Node()
                while True:
                    t = r.tag()
                    if t == "VRTX":
                        n = r.u32()
                        g.verts = r.arr("f", n * 3)
                    elif t == "NRMS":
                        n = r.u32()
                        g.norms = r.arr("f", n * 3)
                    elif t == "PTYP":
                        n = r.u32()
                        g.ptyp = r.arr("I", n)
                    elif t == "PCNT":
                        n = r.u32()
                        g.pcnt = r.arr("I", n)
                    elif t == "PVTX":
                        n = r.u32()
                        g.pvtx = r.arr("H", n)
                    elif t == "GNDX":
                        n = r.u32()
                        g.gndx = r.arr("B", n)
                    elif t == "MTGC":
                        n = r.u32()
                        g.mtgc = r.arr("I", n)
                    elif t == "MATS":
                        n = r.u32()
                        g.mats = r.arr("I", n)
                        break
                    else:
                        raise ValueError("geoset tag " + t)
                g.material = r.u32()
                g.selgroup = r.u32()
                g.selflags = r.u32()
                g.radius = r.f32()
                g.bmin, g.bmax = r.vec(3), r.vec(3)
                ne = r.u32()
                r.p += 28 * ne
                assert r.tag() == "UVAS"
                nuv = r.u32()
                g.uvs = []
                for _ in range(nuv):
                    assert r.tag() == "UVBS"
                    n = r.u32()
                    g.uvs.append(r.arr("f", n * 2))
                r.p = gend
                m.geosets.append(g)
        elif tag == "BONE":
            while r.p < end:
                nd = read_node(r)
                nd.geoset = r.u32()
                nd.geoanim = r.u32()
                m.bones.append(nd)
        elif tag == "HELP":
            while r.p < end:
                m.helpers.append(read_node(r))
        elif tag == "ATCH":
            while r.p < end:
                s = r.p
                size2 = r.u32()
                nd = read_node(r)
                r.p = s + size2
                m.attachments.append(nd)
        elif tag == "GEOA":
            m.geoanims = []
            while r.p < end:
                st = r.p
                sz = r.u32()
                ga = Node()
                ga.alpha = r.f32()
                ga.flags = r.u32()
                ga.color = r.vec(3)
                ga.geoset = r.u32()
                ga.kgao = None
                while r.p < st + sz:
                    t = r.tag()
                    if t == "KGAO":
                        ga.kgao = read_track(r, 1)
                    elif t == "KGAC":
                        read_track(r, 3)
                    else:
                        raise ValueError("geoanim tag " + t)
                r.p = st + sz
                m.geoanims.append(ga)
        elif tag == "PIVT":
            m.pivots = [r.vec(3) for _ in range(size // 12)]
        p = end
    # triangle lists
    for g in m.geosets:
        tris, k = [], 0
        for t, c in zip(g.ptyp, g.pcnt):
            if t == 4:
                for i in range(0, c, 3):
                    tris.append(tuple(g.pvtx[k + i : k + i + 3]))
            k += c
        g.tris = tris
        # per-vertex matrix group -> bone object ids
        groups, k = [], 0
        for c in g.mtgc:
            groups.append(list(g.mats[k : k + c]))
            k += c
        g.groups = groups
    m.nodes = {}
    for nd in m.bones + m.helpers:
        m.nodes[nd.id] = nd
    return m
