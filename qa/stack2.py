import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
import sys
from PIL import Image
REF=os.environ.get("BOSS_REF_DIR","./design")+"/Screens/"
names=sys.argv[1].split(","); box=[int(v) for v in sys.argv[2:6]]; scale=float(sys.argv[6])
parts=[]
for n in names:
    a=Image.open(REF+n+".png").convert("RGB"); m=Image.open(f"/tmp/boss-qa/mine/{n}.png").convert("RGB")
    c=lambda im: im.crop((box[0]*2,box[1]*2,box[2]*2,box[3]*2))
    a,m=c(a),c(m); w,h=a.size
    p=Image.new("RGB",(w,h*2+6),(255,0,255)); p.paste(a,(0,0)); p.paste(m,(0,h+6)); parts.append(p)
H=sum(p.height for p in parts)+10*(len(parts)-1)
s=Image.new("RGB",(parts[0].width,H),(0,255,0)); y=0
for p in parts: s.paste(p,(0,y)); y+=p.height+10
s=s.resize((int(s.width*scale/2),int(s.height*scale/2)),Image.LANCZOS); s.save("/tmp/boss-qa/stack.png"); print(s.size)
