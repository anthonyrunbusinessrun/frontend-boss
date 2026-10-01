import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
D=os.environ.get("BOSS_REF_DIR","./design")+"/Cards:Modals/"
MAP={"sort":"action-sort-card","hidden":"fields-hidden-manager-card","filter":"filter-inactive-card","color":"action-color-card","share":"action-share-card","dialog":"share-dialog-card","group":"grouping-chip-filtering-card","profile":"profile-dropdown-container-shadow"}
def bounds(arr):
    m=np.zeros(arr.shape[:2],bool)
    for col in ([0x0B,0x1F,0x3A],[0x0F,0x17,0x2A],[0x1E,0x3A,0x5F]):
        m|=(np.abs(arr-np.array(col)).max(axis=2)<=2)
    cx=np.where(m.sum(axis=0)>60)[0]; cy=np.where(m.sum(axis=1)>60)[0]
    return cx[0],cy[0],cx[-1],cy[-1]
JS="""(id)=>{
 const root=document.querySelector(`[data-card="${id}"]`); const rb=root.getBoundingClientRect(); const out=[];
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(w.nextNode()){const n=w.currentNode; const t=n.textContent.trim(); if(!t||t.length<3) continue;
   const r=document.createRange(); r.selectNodeContents(n); const b=r.getBoundingClientRect(); if(b.width<4||b.height<4) continue;
   const fs=parseFloat(getComputedStyle(n.parentElement).fontSize);
   out.push({t:t.slice(0,28),l:b.left-rb.left,top:b.top-rb.top,w:b.width,h:b.height,fs});}
 return out;}"""
only=sys.argv[1:]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1500,"height":1800},device_scale_factor=2)
    pg.goto(os.environ.get("BOSS_URL","http://localhost:3100")+"/dev/cards",wait_until="networkidle"); pg.wait_for_timeout(300)
    for k,f in MAP.items():
        if only and k not in only: continue
        ref=np.array(Image.open(D+f+".png").convert("RGB")).astype(int)
        bx=bounds(ref); 
        mine=pg.locator(f'[data-card="{k}"]'); mine.screenshot(path=f"/tmp/boss-qa/mine/card-{k}.png")
        mim=np.array(Image.open(f"/tmp/boss-qa/mine/card-{k}.png").convert("RGB")).astype(int)
        items=pg.evaluate(JS,k)
        print(f"== {k}: ref card origin css ({bx[0]/2:.0f},{bx[1]/2:.0f}) size {(bx[2]-bx[0]+1)/2:.0f}x{(bx[3]-bx[1]+1)/2:.0f}; mine {mim.shape[1]/2:.0f}x{mim.shape[0]/2:.0f}")
        def ink(arr,x0,y0,x1,y1):
            reg=arr[int(2*y0):int(2*y1),int(2*x0):int(2*x1)]
            if reg.size==0: return None
            flat=reg.reshape(-1,3); vals,cnt=np.unique(flat,axis=0,return_counts=True); bg=vals[cnt.argmax()]
            m=np.abs(reg-bg).max(axis=2)>90
            ys,xs=np.where(m)
            if len(xs)<3: return None
            return xs.min()/2+x0, xs.max()/2+x0, ys.min()/2+y0, ys.max()/2+y0
        for it in items:
            # same row band in ref (assume same y); text starts near same x
            y0=it["top"]-3; y1=it["top"]+it["h"]+3
            m_ink=ink(mim,it["l"]-2,y0,it["l"]+it["w"]+2,y1)
            r_ink=ink(ref,bx[0]/2+it["l"]-30,bx[1]/2+y0,bx[0]/2+it["l"]+it["w"]+40,bx[1]/2+y1)
            if not m_ink or not r_ink: continue
            mw=m_ink[1]-m_ink[0]; rw=r_ink[1]-r_ink[0]
            print(f"  {it['t']:28s} fs={it['fs']:4.1f}  mine w={mw:6.1f} ref w={rw:6.1f}  ratio={rw/mw:4.2f} -> ~{it['fs']*rw/mw:4.1f}px   dy={((r_ink[2]+r_ink[3])/2-(bx[1]/2))-((m_ink[2]+m_ink[3])/2):+.1f}")
    b.close()
