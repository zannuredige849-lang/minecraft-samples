"""Frostmourne: separate runeblade geometry.

`add_frostmourne(model, parent, g)` emits the sword in the coordinate frame of
the model it is added to, with the *grip centre* at `g=(x,y,z)` and the blade
pointing +Y.  The same function builds the standalone `geometry.frostmourne`.
"""
from spec_lib import Model, chain_xy, chain_yz

BONE = "frostmourne"
# (y0 above grip centre, height, width, thickness) -- shared with the world-space blade painter
BLADE_SEGS = [(7, 2, 6, 3), (9, 2, 7, 3), (11, 5, 8, 3), (16, 5, 7, 3), (21, 5, 6, 3),
              (25, 4, 5, 3), (29, 3, 4, 2), (32, 3, 3, 2), (35, 2, 2, 2)]
TEETH_Y = (12, 17, 22, 26)


def add_frostmourne(m: Model, parent, g, pivot=None, rotation=(0, 0, 0)):
    gx, gy, gz = g
    P = pivot or g
    m.bone(BONE, parent, P, "sword", rotation=rotation, locators={
        "grip": (gx, gy, gz), "pommel": (gx, gy - 12, gz),
        "guard": (gx, gy + 5, gz), "blade_mid": (gx, gy + 20, gz), "sword_tip": (gx, gy + 37, gz)})
    m.bone("frostmourne_blade", BONE, P, "sword")
    m.bone("frostmourne_guard", BONE, P, "sword")
    m.bone("frostmourne_grip", BONE, P, "sword")
    m.bone("frostmourne_frost", "frostmourne_blade", P, "sword")

    def C(bone, ox, oy, oz, sx, sy, sz, mat, **kw):
        c = m.cube(bone, (gx + ox, gy + oy, gz + oz), (sx, sy, sz), mat, **kw)
        c.ref = (gx, gy, gz)
        return c

    # ---- grip & pommel -------------------------------------------------------
    C("frostmourne_grip", -1, -7, -1, 2, 10, 2, "grip")
    for yy in (-6, -3, 0):
        C("frostmourne_grip", -1.5, yy, -1.5, 3, 1, 3, "guard_dark")
    C("frostmourne_grip", -2, -10, -2, 4, 3, 4, "guard_dark")
    C("frostmourne_grip", -1.5, -9.5, -2.5, 3, 2, 1, "gem", detail="gem_blue")        # pommel gem (front)
    C("frostmourne_grip", -1, -13, -1, 2, 3, 2, "guard_dark", inflate=-0.2)           # pommel spike
    C("frostmourne_grip", -2.5, -9, -2.5, 5, 1, 5, "guard_trim")

    # ---- crossguard: skull core + two sweeping bat-wing prongs ------------------
    C("frostmourne_guard", -3, 3, -2, 6, 4, 4, "guard_dark", detail="guard_skull")
    C("frostmourne_guard", -2, 7, -1.5, 4, 1, 3, "guard_trim")
    C("frostmourne_guard", -1.5, 4, -2.5, 3, 2, 1, "gem", detail="gem_blue")         # soul gem in the skull brow
    for s in (-1, 1):
        # bat-wing prongs sweeping outward and curling up toward the blade tip
        pts = [(s * 3, 4.5), (s * 6, 5.5), (s * 9, 7.5), (s * 11, 10.5), (s * 11.5, 14.5)]
        chain_xy(m, "frostmourne_guard", [(gx + x, gy + y) for x, y in pts], [3, 3, 2, 2], 3, "guard_dark", z=gz)
        # barbed spur under each wing, attached to the wing underside
        C("frostmourne_guard", s * 7 - (0 if s > 0 else 1), 2.5, -1, 1, 3, 2, "guard_trim", inflate=-0.15)
    # ---- blade silhouette (stacked, gradually tapering segments) -----------------
    for y0, h, w, t in BLADE_SEGS:
        C("frostmourne_blade", -w / 2, y0, -t / 2, w, h, t, "blade")
    C("frostmourne_blade", -0.5, 37, -0.5, 1, 2, 1, "blade_edge", inflate=-0.15)          # needle tip
    # raised central spine (the rune channel)
    C("frostmourne_blade", -1, 8, -2, 2, 28, 4, "blade_spine")
    # serrated teeth on both edges, placed from the real half-width at that height
    hw = lambda y: next(w / 2 for y0, h, w, t in BLADE_SEGS if y0 <= y < y0 + h)
    for y0 in TEETH_Y:
        e = hw(y0)
        C("frostmourne_blade", e - 0.2, y0, -1, 1, 3, 2, "blade_edge", inflate=-0.1)
        C("frostmourne_blade", -e - 0.8, y0, -1, 1, 3, 2, "blade_edge", inflate=-0.1)
    # jagged hooks flaring from the lower blade (Frostmourne's claw-like barbs)
    for s in (-1, 1):
        chain_xy(m, "frostmourne_blade", [(gx + s * 3.5, gy + 11), (gx + s * 6.5, gy + 13.5), (gx + s * 8, gy + 17.5)],
                 [3, 2], 2, "blade_edge", z=gz)
    # ---- frost crystals clinging to the blade edges --------------------------------
    for y0, side in ((13, 1), (19, -1), (24, 1), (28, -1)):
        e = hw(y0)
        m.spike("frostmourne_frost", (gx + side * (e + 0.2), gy + y0, gz), 1, 2, 4, 2, 32 * side, plane="z", mat="ice")
    C("frostmourne_frost", -4, 5.5, -1.5, 3, 1, 3, "ice")
    C("frostmourne_frost", 1, 5.5, -1.5, 3, 1, 3, "ice")
    for c in m.all_cubes():
        if c.layer == "sword" and c.ref is None:
            c.ref = (gx, gy, gz)
