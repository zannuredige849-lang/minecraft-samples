import sys
sys.path.insert(0, 'models')
from PIL import Image
U = "/root/.claude/uploads/b9c58f6b-aa8f-5b83-87e0-a515efaf52df/"
def ref(name, box=None, size=520):
    im = Image.open(U + name).convert("RGBA")
    if box: im = im.crop(box)
    b = Image.new("RGBA", im.size, (255, 255, 255, 255)); b.alpha_composite(im)
    s = size / max(b.size)
    return b.resize((int(b.width * s), int(b.height * s)), Image.NEAREST).convert("RGB")
def row(imgs, h=520):
    W = sum(i.width for i in imgs)
    out = Image.new("RGB", (W, h), (255, 255, 255)); x = 0
    for i in imgs:
        out.paste(i, (x, (h - i.height) // 2)); x += i.width
    return out
