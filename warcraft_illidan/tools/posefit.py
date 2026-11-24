"""Random-search pose solver: find arm/forearm rotations that put a hand at a target point."""
import numpy as np


def hand_world(m, pose, forearm, local):
    R, t = m._bone_matrix(forearm, pose)
    return R @ np.array(local, float) + t


def elbow_world(m, pose, forearm, local):
    R, t = m._bone_matrix(forearm, pose)
    return R @ np.array(local, float) + t


def solve(m, arm, forearm, hand_local, elbow_local, target, ranges, horizontal=True, seed=1, n=40000, extra=None):
    rng = np.random.default_rng(seed)
    lo = np.array([r[0] for r in ranges], float)
    hi = np.array([r[1] for r in ranges], float)
    best, bs = None, 1e9
    for _ in range(n):
        v = rng.uniform(lo, hi)
        pose = {arm: {"rot": [v[0], 0, v[1]]}, forearm: {"rot": [v[2], 0, v[3]]}}
        h = hand_world(m, pose, forearm, hand_local)
        e = elbow_world(m, pose, forearm, elbow_local)
        cost = np.linalg.norm(h - np.array(target))
        if horizontal:
            cost += 0.8 * abs(h[1] - e[1])
        if extra:
            cost += extra(h, e)
        if cost < bs:
            bs, best = cost, v
    return best, bs
