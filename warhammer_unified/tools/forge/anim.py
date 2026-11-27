"""Procedural animations for the unified rigs. Keeps the old animation ids / lengths / loop flags."""
import re


def S(L, amp, phase=0.0, off=0.0, n=1):
    s = f"Math.sin(query.anim_time*{360.0 * n / L:.4f}+{phase})*{amp}"
    return s if not off else f"{off}+{s}"


def AB(L, amp, phase=0.0, off=0.0):
    return f"{off}+Math.abs(Math.sin(query.anim_time*{180.0 / L:.4f}+{phase}))*{amp}"


def kf(d):
    """d: {time: [x,y,z]} -> keyframe dict (string times)."""
    return {("%g" % t): v for t, v in sorted(d.items())}


def classify(short):
    s = short.lower()
    if s in ("controller", "move_ctrl", "ctrl", "attack_ctrl") or s.endswith("_ctrl") or s.startswith("controller") or s == "pillager_root_controller":
        return None
    if s.startswith("idle_b") or s == "idle_ready" or s == "inspect": return "fidget"
    if s.startswith("idle") or s == "rooted_idle" or s == "sleep" or s == "sleep_lie" or s == "stack": return "idle"
    if s in ("walk", "move", "swim", "fly", "ground", "crawl", "blind_walk", "limp", "stalk", "charge", "ride"): return "walk"
    if s == "death" or s.startswith("dead"): return "death"
    if s.startswith("hurt"): return "hurt"
    if s == "dance" or s == "celebrating": return "dance"
    if s in ("spawn_rise", "morph_uproot", "grow0"): return "rise"
    if s in ("morph_root",): return "root"
    if s in ("green_fire", "flies", "spin", "armor", "bob", "holding", "humanoid_base_pose") or s.startswith("look_at"): return "loop_fx"
    if s.startswith("attack_b") or s in ("slam", "ground_slam", "attack_smash", "attack_pound", "attack_stomp", "attack_clap", "special_attack", "attack_combo", "rage", "roar"): return "slam"
    if s.startswith("attack") or s in ("bite", "strike", "swipe", "chop", "spear_thrust", "punch", "mine", "attack.rotations") or s.startswith("strike"): return "attack"
    if s in ("ability", "spell", "ability2", "cast", "channel", "special1", "special2", "special3", "sing", "drain", "totem_cast", "throw_spear", "cast_orb", "cast_curse", "fel_nova", "chain_fel", "cast_meteor", "rain_prep", "warcry", "breath", "angry", "work", "stun", "eat", "command_horn") or s.startswith("special"): return "cast"
    return "idle"


# --------------------------------------------------------------------------- roles
def roles_humanoid(m, pre=""):
    g = lambda n: (pre + n) if (pre + n) in m.bones else None
    return dict(body=g("body"), head=g("head"), arm_l=g("arm_l"), arm_r=g("arm_r"), farm_l=g("farm_l"), farm_r=g("farm_r"), leg_l=g("leg_l"), leg_r=g("leg_r"),
                cape=g("cape"), skirt=g("skirt"), wing_l=g("wing_l"), wing_r=g("wing_r"), tail=g("tail"), halo=g("halo"),
                orbit=g("orbit"), root=g("root"))


def roles_quad(m):
    g = lambda n: n if n in m.bones else None
    return dict(body=g("body"), head=g("head"), leg_fl=g("leg_fl"), leg_fr=g("leg_fr"), leg_bl=g("leg_bl"), leg_br=g("leg_br"), tail=g("tail"), root=g("root"))


def _add(out, bone, chan, val):
    if bone is None: return
    out.setdefault(bone, {})[chan] = val


# --------------------------------------------------------------------------- humanoid motions
def hum_motion(R, kind, L, loop, heavy=1.0, armed=True, floaty=False):
    o = {}
    A = lambda r, ch, v: _add(o, R.get(r), ch, v)
    amp = 1.0 * heavy
    if kind == "walk":
        sw = 30 * (0.8 if heavy > 1.2 else 1.0)
        A("leg_l", "rotation", [S(L, sw), 0, 0]); A("leg_r", "rotation", [S(L, -sw), 0, 0])
        A("arm_l", "rotation", [S(L, -sw * 0.9), 0, 2]); A("arm_r", "rotation", [S(L, sw * (0.35 if armed else 0.9)), 0, -2])
        A("farm_l", "rotation", [S(L, -8, 20), 0, 0]); A("farm_r", "rotation", [S(L, 8, 20), 0, 0])
        A("body", "position", [0, AB(L, 0.9 * amp), 0]); A("body", "rotation", [3 * amp, S(L, 3), S(L, 2, 90)])
        A("head", "rotation", [-3, S(L, -3), 0])
        A("cape", "rotation", [S(L, 6, 0, 10), 0, 0]); A("skirt", "rotation", [S(L, 5, 0, 3), 0, 0])
        A("tail", "rotation", [0, S(L, 14), 0]); A("wing_l", "rotation", [0, 0, S(L, 7, 0, -4)]); A("wing_r", "rotation", [0, 0, S(L, -7, 0, 4)])
        A("orbit", "rotation", [0, f"query.anim_time*{360.0 / L / 1.5:.2f}", 0]); A("halo", "rotation", [0, f"query.anim_time*{360.0 / L:.2f}", 0])
        if floaty:
            A("root", "position", [0, S(L, 1.2, 0, 0), 0])
    elif kind == "idle":
        A("farm_l", "rotation", [S(L, 2.5, 60), 0, 0]); A("farm_r", "rotation", [S(L, 2.5, 120), 0, 0])
        A("body", "position", [0, S(L, 0.4 * amp), 0]); A("body", "rotation", [S(L, 1.2), 0, 0])
        A("arm_l", "rotation", [S(L, 2, 40), 0, S(L, 2, 0, 3)]); A("arm_r", "rotation", [S(L, 2, 80), 0, S(L, -2, 0, -3)])
        A("head", "rotation", [S(L, 2, 20), S(L, 4, 0, 0, 1), 0])
        A("cape", "rotation", [S(L, 3, 0, 4), 0, 0]); A("skirt", "rotation", [S(L, 2, 30, 1), 0, 0])
        A("tail", "rotation", [0, S(L, 10), 0]); A("wing_l", "rotation", [0, 0, S(L, 4, 0, -3)]); A("wing_r", "rotation", [0, 0, S(L, -4, 0, 3)])
        A("orbit", "rotation", [0, f"query.anim_time*{360.0 / L * 2:.2f}", 0]); A("halo", "rotation", [0, f"query.anim_time*{360.0 / L * 3:.2f}", 0])
        if floaty: A("root", "position", [0, S(L, 1.5), 0])
    elif kind == "fidget":
        A("head", "rotation", {"rotation": 0} if False else kf({0: [0, 0, 0], L * .25: [-4, 28, 0], L * .6: [2, -24, 0], L: [0, 0, 0]}))
        A("arm_r", "rotation", kf({0: [0, 0, 0], L * .3: [-18, 0, 4], L * .6: [-18, 0, 4], L: [0, 0, 0]}))
        A("body", "rotation", kf({0: [0, 0, 0], L * .3: [0, 8, 0], L * .6: [0, -6, 0], L: [0, 0, 0]}))
        A("cape", "rotation", kf({0: [0, 0, 0], L * .4: [8, 0, 0], L: [0, 0, 0]}))
    elif kind == "attack":
        A("arm_r", "rotation", kf({0: [0, 0, 0], L * .22: [-105, 0, 14], L * .42: [-20, 0, -6], L * .7: [-8, 0, 0], L: [0, 0, 0]}))
        A("arm_l", "rotation", kf({0: [0, 0, 0], L * .22: [-30, 0, -10], L * .42: [-10, 0, 0], L: [0, 0, 0]}))
        A("farm_r", "rotation", kf({0: [0, 0, 0], L * .22: [-25, 0, 0], L * .42: [30, 0, 0], L * .7: [8, 0, 0], L: [0, 0, 0]}))
        A("body", "rotation", kf({0: [0, 0, 0], L * .22: [-8 * amp, -12, 0], L * .42: [14 * amp, 14, 0], L * .75: [4, 3, 0], L: [0, 0, 0]}))
        A("body", "position", kf({0: [0, 0, 0], L * .22: [0, 0, 1], L * .42: [0, -1, -2.5 * amp], L: [0, 0, 0]}))
        A("head", "rotation", kf({0: [0, 0, 0], L * .22: [-8, 6, 0], L * .42: [8, -8, 0], L: [0, 0, 0]}))
        A("leg_l", "rotation", kf({0: [0, 0, 0], L * .42: [-22, 0, 0], L: [0, 0, 0]})); A("leg_r", "rotation", kf({0: [0, 0, 0], L * .42: [18, 0, 0], L: [0, 0, 0]}))
        A("cape", "rotation", kf({0: [0, 0, 0], L * .42: [26, 0, 0], L: [0, 0, 0]}))
        A("tail", "rotation", kf({0: [0, 0, 0], L * .42: [0, 40, 0], L: [0, 0, 0]}))
    elif kind == "slam":
        A("arm_r", "rotation", kf({0: [0, 0, 0], L * .3: [-150, 0, 12], L * .5: [-18, 0, 0], L * .8: [-10, 0, 0], L: [0, 0, 0]}))
        A("arm_l", "rotation", kf({0: [0, 0, 0], L * .3: [-150, 0, -12], L * .5: [-18, 0, 0], L * .8: [-10, 0, 0], L: [0, 0, 0]}))
        A("farm_l", "rotation", kf({0: [0, 0, 0], L * .3: [-20, 0, 0], L * .5: [30, 0, 0], L: [0, 0, 0]})); A("farm_r", "rotation", kf({0: [0, 0, 0], L * .3: [-20, 0, 0], L * .5: [30, 0, 0], L: [0, 0, 0]}))
        A("body", "rotation", kf({0: [0, 0, 0], L * .3: [-16 * amp, 0, 0], L * .5: [26 * amp, 0, 0], L * .85: [8, 0, 0], L: [0, 0, 0]}))
        A("body", "position", kf({0: [0, 0, 0], L * .3: [0, 1, 2], L * .5: [0, -2, -4 * amp], L: [0, 0, 0]}))
        A("head", "rotation", kf({0: [0, 0, 0], L * .3: [-14, 0, 0], L * .5: [14, 0, 0], L: [0, 0, 0]}))
        A("leg_l", "rotation", kf({0: [0, 0, 0], L * .5: [-14, 0, 0], L: [0, 0, 0]})); A("leg_r", "rotation", kf({0: [0, 0, 0], L * .5: [10, 0, 0], L: [0, 0, 0]}))
        A("wing_l", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, -30], L * .5: [0, 0, 14], L: [0, 0, 0]})); A("wing_r", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, 30], L * .5: [0, 0, -14], L: [0, 0, 0]}))
    elif kind == "cast":
        A("arm_r", "rotation", kf({0: [0, 0, 0], L * .25: [-125, 0, 24], L * .7: [-125, 0, 24], L: [0, 0, 0]}))
        A("arm_l", "rotation", kf({0: [0, 0, 0], L * .25: [-125, 0, -24], L * .7: [-125, 0, -24], L: [0, 0, 0]}))
        A("farm_l", "rotation", kf({0: [0, 0, 0], L * .25: [20, 0, 0], L * .7: [20, 0, 0], L: [0, 0, 0]})); A("farm_r", "rotation", kf({0: [0, 0, 0], L * .25: [20, 0, 0], L * .7: [20, 0, 0], L: [0, 0, 0]}))
        A("head", "rotation", kf({0: [0, 0, 0], L * .25: [-22, 0, 0], L * .7: [-22, 0, 0], L: [0, 0, 0]}))
        A("body", "rotation", kf({0: [0, 0, 0], L * .25: [-8, 0, 0], L * .7: [-8, 0, 0], L: [0, 0, 0]}))
        A("body", "position", kf({0: [0, 0, 0], L * .3: [0, 1.5, 0], L * .7: [0, 1.5, 0], L: [0, 0, 0]}))
        A("cape", "rotation", kf({0: [0, 0, 0], L * .3: [-10, 0, 0], L: [0, 0, 0]}))
        A("wing_l", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, -32], L * .7: [0, 0, -32], L: [0, 0, 0]})); A("wing_r", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, 32], L * .7: [0, 0, 32], L: [0, 0, 0]}))
        A("orbit", "rotation", [0, f"query.anim_time*{720.0 / max(L, .1):.2f}", 0]); A("halo", "rotation", [0, f"query.anim_time*{720.0 / max(L, .1):.2f}", 0])
    elif kind == "hurt":
        A("body", "rotation", kf({0: [0, 0, 0], L * .3: [-10, 0, 4], L: [0, 0, 0]})); A("head", "rotation", kf({0: [0, 0, 0], L * .3: [-14, 0, 0], L: [0, 0, 0]}))
        A("arm_l", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, -18], L: [0, 0, 0]})); A("arm_r", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, 18], L: [0, 0, 0]}))
    elif kind == "dance":
        A("body", "position", [0, AB(L, 2.0), 0]); A("body", "rotation", [0, S(L, 12), S(L, 6, 90)])
        A("arm_l", "rotation", [S(L, 40, 0, -100), 0, -20]); A("arm_r", "rotation", [S(L, -40, 0, -100), 0, 20])
        A("leg_l", "rotation", [S(L, 22), 0, 0]); A("leg_r", "rotation", [S(L, -22), 0, 0]); A("head", "rotation", [S(L, 6), S(L, 15), 0])
        A("cape", "rotation", [S(L, 8, 0, 10), 0, 0]); A("tail", "rotation", [0, S(L, 25), 0])
    elif kind == "death":
        A("root", "rotation", kf({0: [0, 0, 0], L * .3: [-8, 0, 3], L * .75: [78, 0, 0], L * .88: [90, 0, 0], L: [90, 0, 0]}))
        A("root", "position", kf({0: [0, 0, 0], L * .75: [0, 0, 0], L * .88: [0, 2, 0], L: [0, 2, 0]}))
        A("arm_l", "rotation", kf({0: [0, 0, 0], L * .3: [-30, 0, -30], L * .8: [-60, 0, -40], L: [-60, 0, -40]})); A("arm_r", "rotation", kf({0: [0, 0, 0], L * .3: [-30, 0, 30], L * .8: [-60, 0, 40], L: [-60, 0, 40]}))
        A("head", "rotation", kf({0: [0, 0, 0], L * .3: [-20, 0, 0], L: [-14, 8, 0]}))
        A("orbit", "rotation", kf({0: [0, 0, 0], L: [0, 360, 0]}))
    elif kind == "rise":
        A("root", "position", kf({0: [0, -22, 0], L * .7: [0, -4, 0], L: [0, 0, 0]}))
        A("arm_l", "rotation", kf({0: [-40, 0, -20], L: [0, 0, 0]})); A("arm_r", "rotation", kf({0: [-40, 0, 20], L: [0, 0, 0]}))
        A("head", "rotation", kf({0: [30, 0, 0], L * .8: [-6, 0, 0], L: [0, 0, 0]}))
    elif kind == "root":
        A("body", "position", kf({0: [0, 0, 0], L: [0, -4, 0]})); A("leg_l", "rotation", kf({0: [0, 0, 0], L: [0, 0, 8]})); A("leg_r", "rotation", kf({0: [0, 0, 0], L: [0, 0, -8]}))
    elif kind == "loop_fx":
        A("orbit", "rotation", [0, f"query.anim_time*{360.0 / max(L, .2):.2f}", 0]); A("halo", "rotation", [0, f"query.anim_time*{360.0 / max(L, .2):.2f}", 0])
        A("cape", "rotation", [S(max(L, .5), 4, 0, 4), 0, 0])
    return o


# --------------------------------------------------------------------------- quad motions
def quad_motion(R, kind, L, loop, heavy=1.0):
    o = {}
    A = lambda r, ch, v: _add(o, R.get(r), ch, v)
    if kind == "walk":
        sw = 32 / max(heavy, 1) ** 0.3
        A("leg_fl", "rotation", [S(L, sw), 0, 0]); A("leg_br", "rotation", [S(L, sw), 0, 0])
        A("leg_fr", "rotation", [S(L, -sw), 0, 0]); A("leg_bl", "rotation", [S(L, -sw), 0, 0])
        A("body", "position", [0, AB(L, 0.8), 0]); A("body", "rotation", [S(L, 2, 90), S(L, 2), 0])
        A("head", "rotation", [S(L, 4, 90, 2), S(L, 3), 0]); A("tail", "rotation", [S(L, 6, 0, 8), S(L, 16), 0])
    elif kind in ("idle", "loop_fx"):
        A("body", "position", [0, S(L, 0.4), 0]); A("head", "rotation", [S(L, 3, 20), S(L, 8, 0, 0), 0]); A("tail", "rotation", [S(L, 4, 0, 8), S(L, 14), 0])
    elif kind == "fidget":
        A("head", "rotation", kf({0: [0, 0, 0], L * .3: [12, 30, 0], L * .65: [-4, -26, 0], L: [0, 0, 0]}))
        A("leg_fl", "rotation", kf({0: [0, 0, 0], L * .4: [-30, 0, 0], L * .55: [-30, 0, 0], L: [0, 0, 0]}))
    elif kind in ("attack", "slam"):
        A("head", "rotation", kf({0: [0, 0, 0], L * .25: [-26, 0, 0], L * .45: [28, 0, 0], L * .8: [4, 0, 0], L: [0, 0, 0]}))
        A("body", "rotation", kf({0: [0, 0, 0], L * .25: [-14, 0, 0], L * .45: [8, 0, 0], L: [0, 0, 0]}))
        A("body", "position", kf({0: [0, 0, 0], L * .45: [0, -1, -4], L: [0, 0, 0]}))
        A("leg_fl", "rotation", kf({0: [0, 0, 0], L * .25: [-70, 0, 0], L * .45: [-20, 0, 0], L: [0, 0, 0]})); A("leg_fr", "rotation", kf({0: [0, 0, 0], L * .3: [-70, 0, 0], L * .5: [-20, 0, 0], L: [0, 0, 0]}))
        A("tail", "rotation", kf({0: [0, 0, 0], L * .45: [-16, 0, 0], L: [0, 0, 0]}))
    elif kind == "cast":
        A("head", "rotation", kf({0: [0, 0, 0], L * .3: [-34, 0, 0], L * .75: [-34, 0, 0], L: [0, 0, 0]}))
        A("body", "rotation", kf({0: [0, 0, 0], L * .3: [-22, 0, 0], L * .75: [-22, 0, 0], L: [0, 0, 0]}))
        A("leg_fl", "rotation", kf({0: [0, 0, 0], L * .3: [-60, 0, 0], L * .75: [-60, 0, 0], L: [0, 0, 0]})); A("leg_fr", "rotation", kf({0: [0, 0, 0], L * .3: [-60, 0, 0], L * .75: [-60, 0, 0], L: [0, 0, 0]}))
    elif kind == "hurt":
        A("body", "rotation", kf({0: [0, 0, 0], L * .3: [-8, 0, 6], L: [0, 0, 0]})); A("head", "rotation", kf({0: [0, 0, 0], L * .3: [-16, 0, 0], L: [0, 0, 0]}))
    elif kind == "dance":
        A("body", "position", [0, AB(L, 2.5), 0]); A("head", "rotation", [S(L, 10), S(L, 20), 0]); A("tail", "rotation", [0, S(L, 30), 0])
        A("leg_fl", "rotation", [S(L, 20), 0, 0]); A("leg_fr", "rotation", [S(L, -20), 0, 0]); A("leg_bl", "rotation", [S(L, -20), 0, 0]); A("leg_br", "rotation", [S(L, 20), 0, 0])
    elif kind == "death":
        A("root", "rotation", kf({0: [0, 0, 0], L * .3: [0, 0, 6], L * .8: [0, 0, 84], L: [0, 0, 90]}))
        A("root", "position", kf({0: [0, 0, 0], L * .8: [0, 0, 0], L: [4, 0, 0]}))
        A("head", "rotation", kf({0: [0, 0, 0], L * .5: [-18, 0, 0], L: [-10, 0, 0]}))
        for r in ("leg_fl", "leg_fr", "leg_bl", "leg_br"): A(r, "rotation", kf({0: [0, 0, 0], L * .5: [-24, 0, 0], L: [-18, 0, 0]}))
    elif kind == "rise":
        A("root", "position", kf({0: [0, -18, 0], L: [0, 0, 0]}))
    return o


def merge_bones(*dicts):
    out = {}
    for d in dicts:
        for b, ch in d.items():
            out.setdefault(b, {}).update(ch)
    return out


# --------------------------------------------------------------------------- driver
def make_anim(model, rig, kind, L, loop, heavy=1.0, armed=True, floaty=False, extra_loop_bones=None):
    """rig: 'humanoid' | 'quad' | 'rider' | 'generic'. Returns a Bedrock animation dict."""
    if rig == "humanoid":
        R = roles_humanoid(model, getattr(model, "pre", ""))
        bones = hum_motion(R, kind, L, loop, heavy, armed, floaty)
    elif rig == "quad":
        R = roles_quad(model)
        bones = quad_motion(R, kind, L, loop, heavy)
    elif rig == "rider":
        Rq = roles_quad(model)
        Rh = roles_humanoid(model, "r_")
        # rider rides the mount: only upper body animates + mount legs
        hk = kind
        hq = quad_motion(Rq, kind if kind != "cast" else "idle", L, loop, heavy)
        hh = hum_motion({k: v for k, v in Rh.items() if k not in ("root", "leg_l", "leg_r")}, hk, L, loop, heavy, armed)
        if kind in ("attack", "slam"):
            hq = quad_motion(Rq, "idle", L, loop, heavy)
            hq.setdefault(Rq["body"], {})["rotation"] = kf({0: [0, 0, 0], L * .25: [-12, 0, 0], L * .45: [4, 0, 0], L: [0, 0, 0]})
            hq.setdefault(Rq["leg_fl"], {})["rotation"] = kf({0: [0, 0, 0], L * .25: [-60, 0, 0], L * .5: [0, 0, 0], L: [0, 0, 0]})
            hq.setdefault(Rq["leg_fr"], {})["rotation"] = kf({0: [0, 0, 0], L * .3: [-60, 0, 0], L * .55: [0, 0, 0], L: [0, 0, 0]})
        if kind == "death":
            hq = quad_motion(Rq, "death", L, loop, heavy); hh = {}
        bones = merge_bones(hq, hh)
    else:
        bones = {}
    anim = {"animation_length": L}
    if loop is True: anim["loop"] = True
    elif loop == "hold_on_last_frame": anim["loop"] = "hold_on_last_frame"
    if kind == "death" and "loop" not in anim: anim["loop"] = "hold_on_last_frame"
    anim["bones"] = {}
    for b, ch in bones.items():
        c2 = {}
        for k, v in ch.items(): c2[k] = v
        anim["bones"][b] = c2
    if extra_loop_bones:
        for b, spec in extra_loop_bones.items():
            if b in model.bones:
                anim["bones"].setdefault(b, {}).update(spec)
    if not anim["bones"]:
        anim["bones"] = {}
    return anim


def anims_for(model, rig, names, heavy=1.0, armed=True, floaty=False, extra=None):
    """names: {short: {id,length,loop}} (from the inventory). Returns {id: anim}."""
    out = {}
    for short, info in names.items():
        if short.lower().startswith("look_at"):
            hb = roles_humanoid(model, getattr(model, "pre", "")).get("head") or roles_quad(model).get("head")
            if hb:
                out[info["id"]] = {"loop": True, "bones": {hb: {"rotation": ["Math.clamp(query.target_x_rotation,-30,30)", "Math.clamp(query.target_y_rotation,-45,45)", 0]}}}
            continue
        kind = classify(short)
        if kind is None: continue
        L = info.get("length") or 1.0
        loop = info.get("loop")
        if kind in ("walk", "idle", "loop_fx", "dance") and loop is None and kind != "dance": loop = True
        if kind == "walk": loop = True if loop in (None, True) else loop
        L = float(L)
        if kind == "walk" and L > 1.6: L = 0.8
        ex = extra.get(kind) if extra else None
        out[info["id"]] = make_anim(model, rig, kind, L, loop if loop is not None else False, heavy, armed, floaty, ex)
    return out
