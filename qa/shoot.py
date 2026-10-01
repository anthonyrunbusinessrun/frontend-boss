import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
import sys, json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
import numpy as np

REF=os.environ.get("BOSS_REF_DIR","./design")+"/Screens/"
ROUTES={
 "01-sign-up":"/sign-up","02-sign-in":"/sign-in","03-boss-profile-management":"/profiles",
 "04-boss-categories":"/categories","05-boss-folios":"/folios","06-actions-section":"/actions",
 "07-boss-packet-sections":"/packet","08-boss-vouchers":"/vouchers","09-boss-transactions":"/transactions",
 "10-boss-items":"/items","11-boss-accounts":"/accounts","12-boss-forms":"/forms","13-boss-concepts":"/concepts",
 "14-boss-capabilities":"/capabilities","15-boss-leads":"/leads","16-boss-registries":"/registries"}
only=sys.argv[1:] 
errors={}
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={"width":1440,"height":900},device_scale_factor=2)
    page=ctx.new_page()
    log=[]
    page.on("console",lambda m: log.append((m.type,m.text)) if m.type in("error","warning") else None)
    page.on("pageerror",lambda e: log.append(("pageerror",str(e))))
    for ref,route in ROUTES.items():
        if only and not any(o in ref for o in only): continue
        log.clear()
        page.goto(os.environ.get("BOSS_URL","http://localhost:3100")+route,wait_until="networkidle")
        page.wait_for_timeout(300)
        out=f"/tmp/boss-qa/mine/{ref}.png"
        page.screenshot(path=out)
        errors[ref]=list(log)
        a=Image.open(REF+ref+".png").convert("RGB"); m=Image.open(out).convert("RGB")
        if a.size!=m.size: m=m.resize(a.size)
        d=np.abs(np.array(a).astype(int)-np.array(m).astype(int)).sum(axis=2)
        score=(d>60).mean()*100
        # compare image: ref | mine | diff (downscaled to 1x)
        diff=Image.fromarray(np.clip(d,0,255).astype('uint8')).convert("RGB")
        W,H=a.size
        sheet=Image.new("RGB",(W*3+20,H),(80,80,80))
        sheet.paste(a,(0,0)); sheet.paste(m,(W+10,0)); sheet.paste(diff,(2*W+20,0))
        sheet=sheet.resize((sheet.width//2,sheet.height//2)); sheet.save(f"/tmp/boss-qa/cmp/{ref}.png")
        print(f"{ref:32s} diff-pixels {score:5.2f}%   console:{len(errors[ref])}")
    b.close()
for k,v in errors.items():
    for t,x in v: print("  ",k,t,x[:200])
