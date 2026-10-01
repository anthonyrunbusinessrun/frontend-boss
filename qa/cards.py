import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
D=os.environ.get("BOSS_REF_DIR","./design")+"/Cards:Modals/"
MAP={"sort":"action-sort-card","hidden":"fields-hidden-manager-card","filter":"filter-inactive-card","color":"action-color-card","share":"action-share-card","dialog":"share-dialog-card","group":"grouping-chip-filtering-card","profile":"profile-dropdown-container-shadow"}
def card_bounds(im):
    # card body: the surface colour #0B1F3A (or #FFFFFF for dialog) region; use border colour search fallback
    arr=np.array(im.convert("RGB")).astype(int)
    for col in ([0x0B,0x1F,0x3A],[0x0F,0x17,0x2A]):
        m=(np.abs(arr-np.array(col)).max(axis=2)<=2)
        cx=np.where(m.sum(axis=0)>150)[0]; cy=np.where(m.sum(axis=1)>150)[0]
        if len(cx) and len(cy): return cx[0],cy[0],cx[-1],cy[-1]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1500,"height":1800},device_scale_factor=2)
    pg.goto(os.environ.get("BOSS_URL","http://localhost:3100")+"/dev/cards",wait_until="networkidle"); pg.wait_for_timeout(400)
    errs=[]
    pg.on("pageerror",lambda e: errs.append(str(e)))
    for k,f in MAP.items():
        el=pg.locator(f'[data-card="{k}"]'); el.screenshot(path=f"/tmp/boss-qa/mine/card-{k}.png")
        mine=Image.open(f"/tmp/boss-qa/mine/card-{k}.png").convert("RGB"); ref=Image.open(D+f+".png").convert("RGB")
        bx=card_bounds(ref)
        rw=(bx[2]-bx[0]+1,bx[3]-bx[1]+1)
        print(f"{k:8s} ref card px {rw} => css {rw[0]/2:.0f}x{rw[1]/2:.0f} | mine css {mine.width/2:.0f}x{mine.height/2:.0f}")
        r=ref.crop((bx[0],bx[1],bx[2]+1,bx[3]+1))
        W=max(r.width,mine.width); H=max(r.height,mine.height)
        s=Image.new("RGB",(W*2+10,H),(255,0,255)); s.paste(r,(0,0)); s.paste(mine,(W+10,0)); s.save(f"/tmp/boss-qa/cmp/card-{k}.png")
    print("page errors",errs)
    b.close()
