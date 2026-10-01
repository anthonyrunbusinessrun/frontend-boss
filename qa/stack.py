import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
import sys
from PIL import Image
REF=os.environ.get("BOSS_REF_DIR","./design")+"/Screens/"
name=sys.argv[1]; scale=float(sys.argv[2]) if len(sys.argv)>2 else 0.7
box=[int(v) for v in sys.argv[3:7]] if len(sys.argv)>6 else [0,0,1440,900]
a=Image.open(REF+name+".png").convert("RGB"); m=Image.open(f"/tmp/boss-qa/mine/{name}.png").convert("RGB")
c=lambda im: im.crop((box[0]*2,box[1]*2,box[2]*2,box[3]*2))
a,m=c(a),c(m)
w,h=a.size
s=Image.new("RGB",(w,h*2+8),(255,0,255)); s.paste(a,(0,0)); s.paste(m,(0,h+8))
s=s.resize((int(s.width*scale/2),int(s.height*scale/2)),Image.LANCZOS); s.save("/tmp/boss-qa/stack.png"); print(s.size)
