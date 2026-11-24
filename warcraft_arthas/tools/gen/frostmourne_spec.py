"""Frostmourne: separate runeblade geometry.

`add_frostmourne(model, parent, g)` emits the sword in the coordinate frame of
the model it is added to, with the *grip centre* at `g=(x,y,z)` and the blade
pointing +Y.  The same function builds the standalone `geometry.frostmourne`.
"""
from spec_lib import Model, chain_xy, chain_yz

BONE = "frostmourne"
# (y0 above grip centre, height, width, thickness) -- slim, thin runeblade; shared with the blade painter
BLADE_SEGS = [(6, 2, 4, 1), (8, 3, 5, 1), (11, 4, 5, 1), (15, 4, 4, 1), (19, 4, 4, 1),
              (23, 3, 3, 1), (26, 2, 2, 1), (28, 2, 1, 1)]
TEETH_Y = (12, 17, 21)
BLADE_TOP = 30


def add_frostmourne(m: Model, parent, g, pivot=None, rotation=(0, 0, 0)):
    gx, gy, gz = g
    P = pivot or g
    m.bone(BONE, parent, P, "sword", rotation=rotation, locators={
        "grip": (gx, gy, gz), "pommel": (gx, gy - 9, gz),
        "guard": (gx, gy + 4.5, gz), "blade_mid": (gx, gy + 17, gz), "sword_tip": (gx, gy + BLADE_TOP, gz)})
    m.bone("frostmourne_blade", BONE, P, "sword")
    m.bone("frostmourne_guard", BONE, P, "sword")
    m.bone("frostmourne_grip", BONE, P, "sword")
    m.bone("frostmourne_frost", "frostmourne_blade", P, "sword")

    def C(bone, ox, oy, oz, sx, sy, sz, mat, **kw):
        c = m.cube(bone, (gx + ox, gy + oy, gz + oz), (sx, sy, sz), mat, **kw)
        c.ref = (gx, gy, gz)
        return c

    # ---- grip & pommel (slim) ------------------------------------------------
    C("frostmourne_grip", -1, -5, -1, 2, 8, 2, "grip")
    C("frostmourne_grip", -1.5, -3, -1.5, 3, 1, 3, "guard_dark")
    C("frostmourne_grip", -1.5, 0, -1.5, 3, 1, 3, "guard_dark")
    C("frostmourne_grip", -1.5, -7, -1.5, 3, 2, 3, "guard_dark")                       # pommel
    C("frostmourne_grip", -1, -6.5, -2, 2, 1, 1, "gem", detail="gem_blue")             # pommel gem
    C("frostmourne_grip", -0.5, -10, -0.5, 1, 3, 1, "guard_dark", inflate=-0.1)        # pommel point

    # ---- crossguard: small skull + slender swept wings --------------------------
    C("frostmourne_guard", -2, 3, -1.5, 4, 3, 3, "guard_dark", detail="guard_skull")
    C("frostmourne_guard", -1, 3.5, -2, 2, 1, 1, "gem", detail="gem_blue")
    for s in (-1, 1):
        pts = [(s * 2, 4.5), (s * 4.5, 5), (s * 7, 6.5), (s * 8.5, 9.5)]
        chain_xy(m, "frostmourne_guard", [(gx + x, gy + y) for x, y in pts], [2, 2, 1], 2, "guard_dark", z=gz, tip_inflate=-0.15)

    # ---- blade: thin, gradually tapering, with a raised rune spine ------------------
    for y0, h, w, t in BLADE_SEGS:
        C("frostmourne_blade", -w / 2, y0, -t / 2, w, h, t, "blade")
    C("frostmourne_blade", -0.5, 30, -0.5, 1, 2, 1, "blade_edge", inflate=-0.2)       # needle tip
    C("frostmourne_blade", -0.5, 7, -1, 1, 22, 2, "blade_spine")                        # ridge (the rune channel)
    hw = lambda y: next(w / 2 for y0, h, w, t in BLADE_SEGS if y0 <= y < y0 + h)
    for y0 in TEETH_Y:                                                                  # serrations
        e = hw(y0)
        C("frostmourne_blade", e - 0.1, y0, -0.5, 1, 2, 1, "blade_edge", inflate=-0.1)
        C("frostmourne_blade", -e - 0.9, y0, -0.5, 1, 2, 1, "blade_edge", inflate=-0.1)
    for s in (-1, 1):                                                                   # short barbs above the guard
        chain_xy(m, "frostmourne_blade", [(gx + s * 2.5, gy + 7.5), (gx + s * 4.5, gy + 9.5)], [2], 1, "blade_edge", z=gz, tip_inflate=-0.15)
    # a few thin frost crystals on the edges
    for y0, side in ((13, 1), (20, -1), (24, 1)):
        e = hw(y0)
        m.spike("frostmourne_frost", (gx + side * (e + 0.1), gy + y0, gz), 1, 1, 3, 2, 30 * side, plane="z", mat="ice")

    for c in m.all_cubes():
        if c.layer == "sword" and c.ref is None:
            c.ref = (gx, gy, gz)
