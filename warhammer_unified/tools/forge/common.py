import json, os
from .core import Palette, make_ramp
from .humanoid import Humanoid, M, dec, R
from .quad import Quad, attach

ENT = json.load(open(os.path.join(os.path.dirname(__file__), "..", "data", "entities.json")))


class Spec:
    def __init__(self, model, rig="humanoid", heavy=1.0, armed=True, floaty=False, extra=None, variants=None):
        self.model, self.rig, self.heavy, self.armed, self.floaty = model, rig, heavy, armed, floaty
        self.extra = extra
        self.variants = variants  # {texture_key: Palette}


def target_h(ent):
    e = ENT[ent]
    return e["height"] * 16.0 / (e.get("scale") or 1.0)


def target_w(ent):
    e = ENT[ent]
    return e["width"] * 16.0 / (e.get("scale") or 1.0)


BASE = dict(skin="#d9a27a", dark="#14141c", bone="#e6dcc0", glow="#7fd8ff", leather="#6b4a2e", fur="#6a5238",
            metal="#aeb7c4", cloth="#556070", armor="#7d8795", trim="#d6a935",
            horse="#e8e4dc", mane="#cdb98c", hair="#8a6a3a", plume="#a8283a", cloth2="#4a6a4a", paint="#b02a2a", accent="#e08a30", ember="#ff8a30")


def pal(**kw):
    d = dict(BASE); d.update(kw)
    return Palette(**d)
