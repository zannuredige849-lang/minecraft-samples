import math

import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from mcgeo import Model  # noqa: E402,F401
from paint import *  # noqa: E402,F401,F403


def mx(origin, size):
    """mirror an (origin, size) box across x=0"""
    return [-(origin[0] + size[0]), origin[1], origin[2]]


def mirror_painter(fn):
    """painter for the left-hand twin: swap east/west so the pattern mirrors"""

    def f(face, w, h):
        flip = {"east": "west", "west": "east"}
        im = fn(flip.get(face, face), w, h)
        if face in ("north", "south", "up", "down"):
            from PIL import ImageOps

            return ImageOps.mirror(im)
        return im

    return f


def chain_xy(m, bone, start, segs, side=1, paint=None, factory=None, tag=""):
    """planar chain of boxes in the XY plane (curls up/down). start=(x,y,z0) where z0 is the z of the box's
    front face; segs = [(length, height, thickness, d_angle_deg)] with the first d_angle being the absolute
    start angle (degrees above +x axis). side=-1 runs towards -x. Returns end point and final angle."""
    x, y, z = start
    ang = 0.0
    for i, (ln, hh, th, da) in enumerate(segs):
        ang += da
        a = math.radians(ang)
        if side > 0:
            origin = [x, y - hh / 2, z]
            rot = [0, 0, ang]
        else:
            origin = [x - ln, y - hh / 2, z]
            rot = [0, 0, -ang]
        p = factory(i) if factory else paint
        m.cube(bone, origin, [ln, hh, th], p, pivot=[x, y, z], rot=rot, tag=tag)
        x += side * ln * math.cos(a)
        y += ln * math.sin(a)
    return (x, y, z), ang


def chain_yz(m, bone, start, segs, paint=None, factory=None, tag=""):
    """planar chain in the YZ plane (curls forward/back). start=(x0,y,z) with x0 the box's min x.
    angle measured from +Y (up) tilting towards +Z (backwards) for positive values."""
    x, y, z = start
    ang = 0.0
    for i, (ln, ww, th, da) in enumerate(segs):
        ang += da
        a = math.radians(ang)
        origin = [x, y, z - th / 2]
        # negative file rx tilts an up-pointing box towards +z (backwards)
        rot = [-ang, 0, 0]
        p = factory(i) if factory else paint
        m.cube(bone, origin, [ww, ln, th], p, pivot=[x, y, z], rot=rot, tag=tag)
        y += ln * math.cos(a)
        z += ln * math.sin(a)
    return (x, y, z), ang
