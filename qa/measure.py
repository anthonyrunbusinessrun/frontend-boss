import os
import sys
from PIL import Image
import numpy as np
REF=os.environ.get("BOSS_REF_DIR","./design")+"/Screens/"
def load(name,which):
    return np.array(Image.open((REF+name+".png") if which=="ref" else f"/tmp/boss-qa/mine/{name}.png").convert("RGB")).astype(int)
def runs(mask):
    out=[];s=None
    for i,v in enumerate(mask):
        if v and s is None: s=i
        if not v and s is not None: out.append((s,i-1)); s=None
    if s is not None: out.append((s,len(mask)-1))
    return out
def vruns(name,x,y0,y1,bg,which,tol=6):
    im=load(name,which); col=im[2*y0:2*y1,2*x]
    m=np.abs(col-np.array(bg)).max(axis=1)>tol
    return [(round(a/2+y0,1),round(b/2+y0,1)) for a,b in runs(m)]
def hruns(name,y,x0,x1,bg,which,tol=6,gap=0):
    im=load(name,which); row=im[2*y,2*x0:2*x1]
    m=np.abs(row-np.array(bg)).max(axis=1)>tol
    r=runs(m)
    # merge runs separated by <= gap px(2x)
    mg=[]
    for a,b in r:
        if mg and a-mg[-1][1]<=gap*2: mg[-1]=(mg[-1][0],b)
        else: mg.append((a,b))
    return [(round(a/2+x0,1),round(b/2+x0,1)) for a,b in mg]
if __name__=="__main__":
    pass
