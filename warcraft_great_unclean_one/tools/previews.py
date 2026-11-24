"""Render preview sheets and the pack icons from the exported files."""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import preview  # noqa: E402

ROOT = os.path.dirname(HERE)
PV = os.path.join(ROOT, "previews")
os.makedirs(PV, exist_ok=True)
mdl = preview.Model()
_, fr = mdl.render(None, 0, 0, 8, size=200, ss=1)
FR = (fr[0] + 6, fr[1], fr[2] * 1.55)


def views():
    sheet = Image.new("RGB", (1600, 800), "white")
    for i, (yaw, pit) in enumerate([(0, 8), (38, 14), (90, 6), (180, 8)]):
        im, _ = mdl.render(None, 0, yaw, pit, size=400, ss=2, frame=FR)
        sheet.paste(im, (i * 400, 0))
    for i, (yaw, pit, fm) in enumerate([(0, 6, (fr[0] + 8, fr[1] + 22, fr[2] * 0.5)), (0, 6, (fr[0] + 8, fr[1] - 2, fr[2] * 0.62)),
                                         (-35, 10, (fr[0] + 14, fr[1] + 24, fr[2] * 0.62)), (60, 10, (fr[0] + 22, fr[1] - 6, fr[2] * 0.75))]):
        im, _ = mdl.render(None, 0, yaw, pit, size=400, ss=2, frame=fm)
        sheet.paste(im, (i * 400, 400))
    sheet.save(os.path.join(PV, "01_views_and_closeups.png"))


def animations():
    names = ["walk", "idle_a", "idle_b", "channel", "attack_a", "attack_b", "slam", "death"]
    n = 6
    cw = 250
    sheet = Image.new("RGB", (cw * n, 22 + cw * len(names)), "white")
    dr = ImageDraw.Draw(sheet)
    frame = (fr[0] + 12, fr[1] + 2, fr[2] * 1.7)
    for r, name in enumerate(names):
        L = mdl.anims["animation.great_unclean_one." + name]["animation_length"]
        for c in range(n):
            t = L * c / (n - 1) * (0.999 if c == n - 1 else 1)
            im, _ = mdl.render(name, t, 28, 10, size=cw, ss=1, frame=frame)
            sheet.paste(im, (c * cw, 22 + r * cw))
            dr.text((c * cw + 4, 22 + r * cw + 3), "%s  t=%.2fs" % (name, t), fill=(110, 0, 0))
    dr.text((6, 6), "animation frames (converted from the Warcraft III sequences: Walk, Stand 1/2, Stand Channel, Attack 1/2, Spell Slam, Death)", fill=(0, 0, 0))
    sheet.save(os.path.join(PV, "02_animations.png"))


def icons():
    im, _ = mdl.render(None, 0, 22, 10, size=256, ss=2, frame=(fr[0] + 6, fr[1] + 4, fr[2] * 1.15), bg=(40, 52, 34))
    for d in ("resource_pack", "behavior_pack"):
        im.save(os.path.join(ROOT, d, "pack_icon.png"))


if __name__ == "__main__":
    what = sys.argv[1:] or ["views", "animations", "icons"]
    for w in what:
        globals()[w]()
        print("done", w)
