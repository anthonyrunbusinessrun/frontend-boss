import os
os.makedirs("/tmp/boss-qa/mine",exist_ok=True); os.makedirs("/tmp/boss-qa/cmp",exist_ok=True)
from playwright.sync_api import sync_playwright, expect
B=os.environ.get("BOSS_URL","http://localhost:3100")
results=[]; console=[]
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ")+name+(f"  [{detail}]" if detail and not cond else ""))
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1440,"height":900}); pg=ctx.new_page()
    pg.on("console",lambda m: console.append((m.type,m.text)) if m.type in("error","warning") else None)
    pg.on("pageerror",lambda e: console.append(("pageerror",str(e))))
    # ---- auth
    pg.goto(B+"/"); check("root redirects to /sign-in", pg.url.endswith("/sign-in"), pg.url)
    pw=pg.locator('input[name="password"]'); check("password hidden by default", pw.get_attribute("type")=="password")
    pg.get_by_label("Show password").click(); check("eye toggle reveals password", pw.get_attribute("type")=="text")
    pg.get_by_label("Hide password").click(); check("eye toggle hides again", pw.get_attribute("type")=="password")
    pg.get_by_role("link",name="Sign Up").click(); pg.wait_for_url("**/sign-up"); check("sign-in -> sign-up link", True)
    pg.get_by_role("link",name="Sign In").click(); pg.wait_for_url("**/sign-in"); check("sign-up -> sign-in link", True)
    pg.get_by_role("button",name="Sign In").click(); pg.wait_for_url("**/profiles"); check("sign-in submit lands on /profiles", True)
    # ---- header / tabs
    check("Profiles tab active", pg.get_by_role("link",name="Profiles",exact=True).get_attribute("aria-current")=="page")
    pg.get_by_role("link",name="Categories").click(); pg.wait_for_url("**/categories")
    check("tab navigation to Categories", pg.get_by_role("link",name="Categories").get_attribute("aria-current")=="page")
    check("previous tab no longer active", pg.get_by_role("link",name="Profiles",exact=True).get_attribute("aria-current") is None)
    pg.get_by_role("link",name="BOSS",exact=True).click(); pg.wait_for_url("**/boss"); check("BOSS placeholder renders", pg.get_by_text("No design was supplied").is_visible())
    pg.goto(B+"/nope"); check("unknown section is 404", pg.get_by_text("404").first.is_visible() or "could not be found" in pg.content().lower())
    # ---- profile menu
    pg.goto(B+"/profiles")
    pg.get_by_label("Account menu").first.click(); check("profile menu opens", pg.get_by_role("dialog",name="Account menu").is_visible())
    pg.keyboard.press("Escape"); check("profile menu closes on Esc", pg.get_by_role("dialog",name="Account menu").count()==0)
    pg.get_by_label("Account menu").first.click(); pg.get_by_role("link",name="Log out").click(); pg.wait_for_url("**/sign-in"); check("Log out -> /sign-in", True)
    # ---- sidebar
    pg.goto(B+"/profiles")
    sb=pg.get_by_label("Views")
    check("sidebar item visible", sb.get_by_text("Active Profiles").is_visible())
    sb.get_by_role("button",name="My Favorites").click(); check("section collapses", sb.get_by_text("Bookmarks").count()==0)
    sb.get_by_role("button",name="My Favorites").click(); check("section expands", sb.get_by_text("Bookmarks").is_visible())
    sb.get_by_label("Find a view").fill("team"); check("find-a-view filters", sb.get_by_text("Team Profiles").is_visible() and sb.get_by_text("Archive").count()==0)
    sb.get_by_label("Find a view").fill("")
    # ---- pagination (profiles footer)
    pager=pg.get_by_label("Pagination")
    pager.get_by_role("button",name="2",exact=True).click(); check("pagination page 2 becomes current", pager.get_by_role("button",name="2",exact=True).get_attribute("aria-current")=="page")
    pager.get_by_label("Previous page").click(); check("previous page works", pager.get_by_role("button",name="1",exact=True).get_attribute("aria-current")=="page")
    # ---- popovers on profiles
    chips=[("57 hidden fields","Hide fields"),("Filtered by Team, Inactive","Filter"),("Grouped by 1 field","Group by"),("Sort","Sort"),("Color","Color"),("Share and sync","Share and sync")]
    for chip,label in chips:
        pg.get_by_role("toolbar").get_by_role("button",name=chip,exact=True).click()
        check(f"popover opens: {label}", pg.get_by_role("dialog",name=label,exact=True).is_visible())
        pg.keyboard.press("Escape"); check(f"popover closes on Esc: {label}", pg.get_by_role("dialog",name=label,exact=True).count()==0)
    tb=pg.get_by_role("toolbar")
    tb.get_by_role("button",name="Sort",exact=True).click(); tb.get_by_role("button",name="Color",exact=True).click()
    check("opening one popover closes the other", pg.get_by_role("dialog").count()==1 and pg.get_by_role("dialog",name="Color").is_visible())
    pg.mouse.click(700,500); check("outside click closes popover", pg.get_by_role("dialog").count()==0)
    # hidden fields behaviour
    tb.get_by_role("button",name="57 hidden fields").click(); d=pg.get_by_role("dialog",name="Hide fields")
    d.get_by_role("button",name="Hide all").click(); sw=d.get_by_role("switch")
    check("Hide all turns every toggle off", all(sw.nth(i).get_attribute("aria-checked")=="false" for i in range(sw.count())), f"{sw.count()} toggles")
    d.get_by_role("button",name="Show all").click(); check("Show all turns every toggle on", all(sw.nth(i).get_attribute("aria-checked")=="true" for i in range(sw.count())))
    sw.first.click(); check("single toggle flips", sw.first.get_attribute("aria-checked")=="false")
    d.get_by_label("Find a field").fill("phone"); check("field search filters list", d.get_by_role("switch").count()==3, str(d.get_by_role("switch").count()))
    pg.keyboard.press("Escape")
    # filter card
    tb.get_by_role("button",name="Filtered by Team, Inactive").click(); d=pg.get_by_role("dialog",name="Filter")
    n0=d.get_by_label("Delete condition").count(); d.get_by_role("button",name="Add condition",exact=True).click()
    check("Add condition adds a row", d.get_by_label("Delete condition").count()==n0+1)
    d.get_by_label("Delete condition").last.click(); check("Delete condition removes a row", d.get_by_label("Delete condition").count()==n0)
    d.get_by_role("checkbox").nth(1).click(); check("condition value toggles", d.get_by_role("checkbox").nth(1).get_attribute("aria-checked")=="true")
    pg.keyboard.press("Escape")
    # share + sync
    tb.get_by_role("button",name="Share and sync").click(); d=pg.get_by_role("dialog",name="Share and sync")
    d.get_by_role("button",name="Dismiss").click(); check("Dismiss hides the notice", d.get_by_text("Interface pages can now be shared").count()==0)
    d.get_by_label("Close").click(); check("close button closes card", pg.get_by_role("dialog").count()==0)
    # color card
    tb.get_by_role("button",name="Color",exact=True).click(); d=pg.get_by_role("dialog",name="Color")
    d.get_by_role("button",name="Conditions").click(); check("color option selects", d.get_by_role("button",name="Conditions").get_attribute("aria-pressed")=="true")
    pg.keyboard.press("Escape")
    # keyboard activation
    tb.get_by_role("button",name="Sort",exact=True).focus(); pg.keyboard.press("Enter"); check("chip opens via keyboard Enter", pg.get_by_role("dialog",name="Sort").is_visible()); pg.keyboard.press("Escape")
    # ---- groups: categories
    pg.goto(B+"/categories")
    rows=lambda: pg.locator("tbody tr").count()
    r0=rows(); pg.get_by_role("button",name="GROUP 2.0 INTERNAL").click(); r1=rows()
    check("group header collapses its rows", r1<r0, f"{r0}->{r1}")
    pg.get_by_role("button",name="GROUP 2.0 INTERNAL").click(); check("group header expands again", rows()==r0)
    pg.get_by_role("toolbar").get_by_role("button",name="Grouped by 1 field").click(); d=pg.get_by_role("dialog",name="Group by")
    d.get_by_role("button",name="Collapse all").click(); pg.keyboard.press("Escape")
    check("Collapse all hides every group's rows", pg.locator("tbody tr").count()==3, str(pg.locator("tbody tr").count()))
    pg.get_by_role("toolbar").get_by_role("button",name="Grouped by 1 field").click(); pg.get_by_role("dialog",name="Group by").get_by_role("button",name="Expand all").click(); pg.keyboard.press("Escape")
    check("Expand all restores rows", rows()==r0)
    # ---- selection: packet
    pg.goto(B+"/packet")
    cb=pg.get_by_role("checkbox",name="Select RFI & SOW Drafts"); cb.click(); check("row checkbox selects", cb.get_attribute("aria-checked")=="true")
    pg.get_by_role("checkbox",name="Select all rows").click(); allc=pg.get_by_role("checkbox"); 
    check("select-all checks every row", all(allc.nth(i).get_attribute("aria-checked")=="true" for i in range(allc.count())))
    pg.get_by_role("checkbox",name="Select all rows").click(); check("select-all again clears", cb.get_attribute("aria-checked")=="false")
    # ---- vouchers legend
    pg.goto(B+"/vouchers")
    lg=pg.get_by_role("button",name="VOUCHERS LEGEND & SYSTEM NOTES"); check("legend open by default", pg.get_by_text("Debit / Credit Rules:").is_visible())
    lg.click(); check("legend collapses", pg.get_by_text("Debit / Credit Rules:").count()==0)
    # ---- all routes console clean + no horizontal page overflow
    for r in ["profiles","categories","folios","actions","packet","vouchers","transactions","items","accounts","forms","concepts","capabilities","leads","registries","sign-in","sign-up"]:
        pg.goto(B+"/"+r); ov=pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
        check(f"no page-level horizontal overflow: /{r}", not ov)
    b.close()
bad=[c for c in console if not ("favicon" in c[1])]
print("\nconsole errors/warnings:",len(bad)); [print("  ",c[0],c[1][:160]) for c in bad[:10]]
fails=[r for r in results if not r[1]]; print(f"\n{len(results)-len(fails)}/{len(results)} checks passed")
for f in fails: print("FAILED:",f[0],f[2])
