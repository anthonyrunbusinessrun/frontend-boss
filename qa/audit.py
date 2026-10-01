import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
"""Column audit: compare ink colour and x/y extents per column for the first data rows, ref vs mine."""
import sys
from collections import Counter
import numpy as np
from playwright.sync_api import sync_playwright
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from measure import load, runs
ROUTES={"03":"profiles","04":"categories","05":"folios","06":"actions","07":"packet","08":"vouchers","09":"transactions","10":"items","11":"accounts","12":"forms","13":"concepts","14":"capabilities","15":"leads","16":"registries"}
import glob,os
def refname(pre): return os.path.basename(glob.glob(os.environ.get("BOSS_REF_DIR","./design")+f"/Screens/{pre}-*.png")[0])[:-4]
def ink(im,x0,x1,y0,y1):
    reg=im[int(2*y0):int(2*y1),int(2*x0):int(2*x1)]
    if reg.size==0: return None
    flat=reg.reshape(-1,3)
    bgc=Counter(map(tuple,flat)).most_common(1)[0][0]
    d=np.abs(reg-np.array(bgc)).max(axis=2)
    m=d>60
    if m.sum()<3: return None
    cols=Counter(map(tuple,reg[m]))
    top=cols.most_common(1)[0][0]
    ys,xs=np.where(m)
    return ('#%02X%02X%02X'%top, round(xs.min()/2+x0,1), round(xs.max()/2+x0,1), round(ys.min()/2+y0,1), round(ys.max()/2+y0,1))
pre=sys.argv[1]; nrow=int(sys.argv[2]) if len(sys.argv)>2 else 1
name=refname(pre); route=ROUTES[pre]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900},device_scale_factor=2)
    pg.goto(os.environ.get("BOSS_URL","http://localhost:3100")+"/"+route,wait_until="networkidle"); pg.wait_for_timeout(300)
    pg.screenshot(path=f"/tmp/boss-qa/mine/{name}.png")
    info=pg.evaluate("""(n)=>{
      const ths=[...document.querySelectorAll('thead th')].map(t=>{const b=t.getBoundingClientRect();return {t:t.textContent.trim(),l:b.left,r:b.right,top:b.top,bot:b.bottom}});
      const rows=[...document.querySelectorAll('tbody tr')].filter(r=>r.querySelector('td:not([colspan])')&&!r.querySelector('td.groupTd')).slice(0,n).map(r=>{const b=r.getBoundingClientRect();return {top:b.top,bot:b.bottom}});
      return {ths,rows};
    }""",nrow)
    b.close()
ref=load(name,"ref"); mine=load(name,"mine")
print(name)
print("header:",[(t['t'][:10],round(t['l']),round(t['r'])) for t in info['ths']][:3],"...  header y",round(info['ths'][0]['top'],1),round(info['ths'][0]['bot'],1))
for ri,r in enumerate(info['rows']):
    print(f"row {ri+1}: mine y {r['top']:.1f}-{r['bot']:.1f}")
    for t in info['ths']:
        a=ink(ref,t['l']+1,t['r']-1,r['top']+1,r['bot']-1); m=ink(mine,t['l']+1,t['r']-1,r['top']+1,r['bot']-1)
        def f(v): return "none" if v is None else f"{v[0]} x{v[1]}-{v[2]} y{v[3]}-{v[4]}"
        flag=""
        if a and m:
            if a[0]!=m[0]: flag+=" COLOR"
            if abs(a[1]-m[1])>1.5: flag+=" X-START(%+.1f)"%(m[1]-a[1])
            if abs(a[2]-m[2])>3: flag+=" X-END(%+.1f)"%(m[2]-a[2])
            if abs((a[3]+a[4])/2-(m[3]+m[4])/2)>1.5: flag+=" Y(%+.1f)"%((m[3]+m[4])/2-(a[3]+a[4])/2)
        print(f"  {t['t'][:12]:12s} ref {f(a):38s} mine {f(m):38s}{flag}")
