import sys
from PIL import Image
# usage: sheet.py out.png crop(l,t,r,b) names...
out=sys.argv[1]; crop=tuple(int(x) for x in sys.argv[2].split(',')); names=sys.argv[3:]
ims=[]
for n in names:
    im=Image.open(n).convert('RGBA').crop(crop)
    bg=Image.new('RGBA',im.size,(46,56,78,255))
    # vertical gradient background
    px=bg.load()
    for y in range(im.height):
        k=y/im.height; c=(int(40+30*(1-k)),int(52+40*(1-k)),int(78+50*(1-k)),255)
        for x in range(im.width): px[x,y]=c
    bg.alpha_composite(im); ims.append(bg.convert('RGB'))
W=sum(i.width for i in ims); sheet=Image.new('RGB',(W,ims[0].height))
x=0
for i in ims: sheet.paste(i,(x,0)); x+=i.width
sheet.save(out); print(out,sheet.size)
