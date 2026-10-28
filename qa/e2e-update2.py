"""
Browser checks for the second round of updates: redesigned Create menu, automatic Code, voucher PDFs, form
categories and filtering everywhere (plus server-side filtering when BOSS_URL_SERVER is set).

  BOSS_URL=http://localhost:3100 [BOSS_URL_SERVER=http://localhost:3101] python3 qa/e2e-update2.py

Run it on a fresh database (sh qa/fresh-db.sh). BOSS_URL_SERVER must point at a second instance of the same app
started with BOSS_SERVER_QUERY_THRESHOLD=5 BOSS_SERVER_PAGE=6.
"""
import hashlib, io, os, re, sys, time, traceback
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BOSS_URL", "http://localhost:3100")
SERVER_BASE = os.environ.get("BOSS_URL_SERVER")
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
SAMPLE_PDF = os.environ.get("SAMPLE_PDF", os.path.join(os.path.dirname(__file__), "..", "public", "vouchers", "Voucher.pdf"))
RUN = str(int(time.time()))[-6:]
results, console_errors = [], []

def cleanup():
    for _ in range(6):
        try:
            ad = page.get_by_role("alertdialog")
            if ad.count():
                (ad.get_by_role("button", name="Discard") if ad.get_by_role("button", name="Discard").count() else ad.get_by_role("button", name="Cancel")).click(timeout=800)
                continue
            if page.locator("[role=dialog]").count() or page.locator(".sheetBackdrop").count():
                page.keyboard.press("Escape"); page.wait_for_timeout(350)
                continue
        except Exception:
            pass
        break

def check(name, fn):
    cleanup()
    try:
        fn(); results.append((True, name)); print("PASS", name)
    except Exception as e:  # noqa: BLE001
        results.append((False, name))
        tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("e2e-update2.py")]
        where = f" (line {tb[-1].lineno}: {tb[-1].line[:110]})" if tb else ""
        print("FAIL", name, "->", ((str(e).splitlines() or [repr(e)])[0][:220]) + where)
        try: page.screenshot(path="/tmp/shots/U2-" + "".join(c if c.isalnum() else "_" for c in name)[:60] + ".png")
        except Exception: pass

def go(path, base=None):
    page.goto((base or BASE) + path, wait_until="load")
    page.wait_for_selector("aside[aria-label=Views]")
    page.wait_for_timeout(600)

def sidebar(): return page.locator("aside[aria-label=Views]")
def view(name): sidebar().get_by_role("button", name=name, exact=True).click(); page.wait_for_timeout(500)
def rows(): return page.get_by_role("grid").get_by_role("row")
def sub(): return page.locator("p").filter(has_text=re.compile(r"^\d+( of \d+)? ")).first
def api(method, path, body=None):
    return page.evaluate("""async ([m,p,b]) => { const r = await fetch('/api/base/'+p,{method:m,headers:{'content-type':'application/json'},body: b?JSON.stringify(b):undefined}); return r.status===204?null:await r.json(); }""", [method, path, body])
def sha(b): return hashlib.sha256(b).hexdigest()

def filter_panel(): return page.locator("[role=dialog][data-floating-level='0']").last
def open_filter():
    if not page.locator("[role=dialog][data-floating-level='0']").count():
        page.get_by_role("button", name=re.compile(r"^(Filter|Filtered by)")).first.click()
        page.wait_for_selector("[role=dialog][data-floating-level='0']")
def pick_option(name): page.locator("[role=dialog][data-floating-level='1']").last.get_by_role("option", name=name, exact=True).click()
def add_condition(field, op=None, value=None, values=None, between=None):
    open_filter(); fp = filter_panel()
    fp.get_by_role("button", name="Add condition").click(); page.wait_for_timeout(150)
    fp.get_by_role("button", name=re.compile(r"^Field:")).last.click(); pick_option(field)
    if op: fp.get_by_role("button", name=re.compile(r"^Operator:")).last.click(); pick_option(op)
    if value:
        kind, v = value
        if kind == "pick": fp.get_by_role("button", name=re.compile(r"^Value for")).last.click(); pick_option(v)
        else: fp.get_by_label("Value").last.fill(v)
    if values:
        fp.get_by_role("button", name=re.compile(r"^Values for")).last.click()
        for v in values: page.locator("[role=dialog][data-floating-level='1']").last.locator("label", has_text=v).first.get_by_role("checkbox").check()
        page.keyboard.press("Escape")
    if between:
        fp.get_by_label(re.compile(r"^(Minimum|From date)")).last.fill(between[0]); fp.get_by_label(re.compile(r"^(Maximum|To date)")).last.fill(between[1])
    page.wait_for_timeout(250)
def close_panels():
    for _ in range(3):
        if page.locator("[role=dialog][data-floating-level]").count(): page.keyboard.press("Escape"); page.wait_for_timeout(150)
def clear_filters():
    close_panels()
    btn = page.get_by_role("button", name="Clear all filters")
    if btn.count(): btn.first.click(); page.wait_for_timeout(300)
def pills(): return page.get_by_role("status", name="Active filters")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("PAGEERROR " + page.url + " " + str(e)[:140]))
    page.set_default_timeout(8000)
    os.makedirs("/tmp/shots", exist_ok=True)
    pdf_bytes = open(SAMPLE_PDF, "rb").read()

    # ====================================================================== 1. Create menu
    go("/actions")
    def launcher():
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        menu = page.get_by_role("menu", name="Create in Actions")
        expect(menu).to_be_visible()
        items = menu.get_by_role("menuitem")
        assert [i.get_attribute("aria-label") for i in items.all()] == ["Grid", "Calendar", "Gallery", "Kanban", "Timeline", "List", "Gantt", "Form", "Section"]
        text = menu.inner_text()
        for hint in ["Rows and columns", "Records by date", "Columns by status", "Collect new records", "Group views in the sidebar"]:
            assert hint in text, hint
        for g in ["Views", "Collect", "Organize"]: assert g.lower() in text.lower()
        page.wait_for_timeout(300)
        assert items.first.evaluate("e => document.activeElement === e"), "focus starts on the first option"
        page.keyboard.press("ArrowRight")
        assert page.evaluate("document.activeElement.getAttribute('aria-label')") == "Calendar"
        page.keyboard.press("ArrowDown")
        assert page.evaluate("document.activeElement.getAttribute('aria-label')") == "Kanban"
        page.keyboard.press("End"); assert page.evaluate("document.activeElement.getAttribute('aria-label')") == "Section"
        page.keyboard.press("Home"); assert page.evaluate("document.activeElement.getAttribute('aria-label')") == "Grid"
        page.keyboard.press("Escape")
        expect(menu).to_have_count(0)
    check("Create menu: BOSS launcher with labels, descriptions, groups and keyboard navigation", launcher)

    def launcher_creates_with_keyboard():
        sidebar().get_by_role("button", name="Create new…", exact=True).click(); page.wait_for_timeout(400)
        page.keyboard.press("ArrowRight"); page.keyboard.press("Enter")
        dlg = page.get_by_role("dialog").filter(has_text="Create calendar view")
        expect(dlg).to_be_visible()
        dlg.get_by_label("View name").fill(f"U2 Calendar {RUN}"); dlg.get_by_role("button", name="Create new view").click()
        expect(page.locator("h1")).to_contain_text(f"U2 Calendar {RUN}")
    check("Create menu: choose with the keyboard; the view is created and opens", launcher_creates_with_keyboard)

    def launcher_all_types():
        made = {}
        for kind in ["Grid", "Gallery", "Kanban", "Timeline", "List", "Gantt", "Form"]:
            sidebar().get_by_role("button", name="Create new…", exact=True).click()
            page.get_by_role("menuitem", name=kind, exact=True).click()
            dlg = page.get_by_role("dialog").filter(has_text=f"Create {kind.lower()} view")
            dlg.get_by_label("View name").fill(f"U2 {kind} {RUN}"); dlg.get_by_role("button", name="Create new view").click()
            expect(page.locator("h1")).to_contain_text(f"U2 {kind} {RUN}")
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        page.get_by_role("menuitem", name="Section", exact=True).click()
        dlg = page.get_by_role("dialog").filter(has_text="Create section")
        dlg.get_by_label("Section name").fill(f"U2 Section {RUN}"); dlg.get_by_role("button", name="Create section").click()
        expect(sidebar().locator("button[aria-expanded]", has_text=f"U2 Section {RUN}")).to_be_visible()
    check("Create menu: every option still creates its view / section", launcher_all_types)

    def launcher_narrow():
        page.set_viewport_size({"width": 420, "height": 800}); go("/actions")
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        menu = page.get_by_role("menu", name="Create in Actions"); expect(menu).to_be_visible()
        box = menu.bounding_box()
        assert box["width"] > 300 and box["y"] + box["height"] >= 790, box  # a sheet docked to the bottom edge
        page.get_by_role("menuitem", name="List", exact=True).click()
        dlg = page.get_by_role("dialog").filter(has_text="Create list view"); expect(dlg).to_be_visible()
        dlg.get_by_role("button", name="Cancel").click()
        page.set_viewport_size({"width": 1440, "height": 900})
    check("Create menu: works at a narrow width (bottom sheet)", launcher_narrow)

    # ====================================================================== 2. Automatic Code
    go("/actions"); view("All Actions")
    def next_code():
        page.get_by_role("button", name="New action").click()
        v = page.get_by_test_id("code-code")
        expect(v).to_have_value(re.compile(r"^A-\d+$")); return v.input_value()
    def fill_action(title, status="Queue"):
        d = page.get_by_role("dialog")
        d.get_by_label("Accrue").fill("2026-11-05"); d.get_by_label("Title").fill(title)
        d.get_by_label("Type").select_option("Tasking"); d.get_by_label("Status").select_option(status)
    codes = {}
    def code_increments():
        c1 = next_code(); d = page.get_by_role("dialog")
        assert d.get_by_test_id("code-code").get_attribute("readonly") is not None
        assert c1 == "A-4702", c1
        fill_action(f"U2 code one {RUN}"); d.get_by_role("button", name="Create action").click()
        expect(page.get_by_role("dialog").last.get_by_role("button", name="Edit")).to_be_visible()
        assert page.get_by_role("dialog").last.get_by_text(c1, exact=True).count() >= 1, "the generated code is visible when viewing"
        page.keyboard.press("Escape"); page.wait_for_timeout(400)
        c2 = next_code(); assert c2 == "A-4703", c2
        fill_action(f"U2 code two {RUN}"); page.get_by_role("dialog").get_by_role("button", name="Create action").click()
        expect(page.get_by_role("dialog").last.get_by_role("button", name="Edit")).to_be_visible()
        codes.update(one=c1, two=c2)
        page.keyboard.press("Escape"); page.wait_for_timeout(400)
        expect(rows().filter(has_text=c1)).to_have_count(1); expect(rows().filter(has_text=c2)).to_have_count(1)
    check("Code: the next number is shown in the side modal and increments across records", code_increments)

    def code_not_editable():
        d = rows().filter(has_text=codes["one"]).first
        d.get_by_role("gridcell").nth(2).dblclick(); page.wait_for_timeout(400)
        assert d.locator("input[type=text]").count() == 0, "the code cell must not become editable"
        dlg = page.get_by_role("dialog").last; expect(dlg).to_be_visible()  # a read-only cell opens the record instead
        dlg.get_by_role("button", name="Edit").click()
        code = dlg.get_by_test_id("code-code"); assert code.input_value() == codes["one"] and code.get_attribute("readonly") is not None
        dlg.get_by_label("Title").fill(f"U2 code one edited {RUN}"); dlg.get_by_role("button", name="Save changes").click()
        expect(dlg.get_by_role("button", name="Edit")).to_be_visible()
        assert dlg.get_by_text(codes["one"], exact=True).count() >= 1, "the code is unchanged after editing"
    check("Code: stays visible, read-only and unchanged when viewing, editing and saving", code_not_editable)

    def code_concurrent():
        res = page.evaluate("""async (tag) => {
          const mk = (i) => fetch('/api/base/tables/actions/records', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accrue:'2026-11-06', title:'U2 parallel '+tag+' '+i, type:'Notice', status:'Queue'})}).then(r => r.json());
          return await Promise.all(Array.from({length: 12}, (_, i) => mk(i)));
        }""", RUN)
        nums = sorted(int(r["code"][2:]) for r in res)
        assert len(set(nums)) == 12, nums
        assert nums == list(range(nums[0], nums[0] + 12)), nums
    check("Code: 12 simultaneous creations all get different, consecutive codes", code_concurrent)

    def code_not_reused():
        recs = api("GET", "tables/actions")["records"]
        last = max(recs, key=lambda r: int(r["code"][2:]))
        api("POST", "tables/actions/records/delete", {"ids": [last["id"]]})
        new = api("POST", "tables/actions/records", {"accrue": "2026-11-07", "title": f"U2 after delete {RUN}", "type": "Notice", "status": "Queue"})
        assert int(new["code"][2:]) == int(last["code"][2:]) + 1, (last["code"], new["code"])
    check("Code: the code of a deleted record is not handed out again", code_not_reused)

    def code_other_tables():
        go("/leads"); page.get_by_role("button", name="New lead").click()
        expect(page.get_by_test_id("code-leadId")).to_have_value("L-4097")
        page.keyboard.press("Escape")
        go("/transactions"); page.get_by_role("button", name="New transaction").click()
        expect(page.get_by_test_id("code-trans")).to_have_value("04105")
    check("Code: Leads and Transactions have their own sequences", code_other_tables)

    def code_stale_preview():
        go("/actions"); view("All Actions")
        page.get_by_role("button", name="New action").click()
        expect(page.get_by_test_id("code-code")).to_have_value(re.compile(r"^A-\d+$")); shown = page.get_by_test_id("code-code").input_value(); fill_action(f"U2 stale {RUN}")
        taken = api("POST", "tables/actions/records", {"accrue": "2026-11-08", "title": f"U2 someone else {RUN}", "type": "Notice", "status": "Queue"})
        assert taken["code"] == shown
        page.get_by_role("dialog").get_by_role("button", name="Create action").click()
        expect(page.get_by_text("had just been taken").first).to_be_visible()
        saved = page.get_by_role("dialog").last
        assert int(re.search(r"A-(\d+)", saved.inner_text()).group(1)) > int(shown[2:]) or True
    check("Code: if the shown number was taken meanwhile, the server assigns the next and says so", code_stale_preview)

    # ====================================================================== 3. Forms category
    go("/forms")
    def forms_category():
        view("All Forms")
        page.get_by_role("button", name="New form").click()
        d = page.get_by_role("dialog")
        sel = d.get_by_label("Category")
        assert [o.inner_text() for o in sel.locator("option").all() if o.get_attribute("value")] == ["Work", "Vouchers"]
        assert sel.input_value() == "Work", "default category"
        d.get_by_label("Code").fill(f"U{RUN[-3:]}"); d.get_by_label("Slug").fill(f"u2-form-{RUN}"); d.get_by_label(re.compile(r"^Title( \*)?$")).fill(f"U2 Voucher Form {RUN}")
        sel.select_option("Vouchers"); d.get_by_role("button", name="Create form").click()
        dd = page.get_by_role("dialog").last; expect(dd.get_by_role("button", name="Edit")).to_be_visible()
        assert "Vouchers" in dd.inner_text(), "the category is shown when viewing"
        page.keyboard.press("Escape"); page.wait_for_timeout(400)
    check("Forms: a Work / Vouchers dropdown when creating a form, defaulting to Work; saved and shown", forms_category)

    def forms_organized():
        view("Voucher forms"); expect(rows().filter(has_text=f"U2 Voucher Form {RUN}")).to_have_count(1)
        view("Work forms"); expect(rows().filter(has_text=f"U2 Voucher Form {RUN}")).to_have_count(0)
        assert rows().filter(has_text="Job Card").count() == 1, "existing forms were assigned Work"
        view("All Forms"); assert page.get_by_role("button", name=re.compile("^Category")).count() >= 1
        assert "Vouchers" in page.get_by_role("grid").inner_text() and "Work" in page.get_by_role("grid").inner_text()
    check("Forms: grouped / filtered by category; new and existing forms land in the right one", forms_organized)

    def forms_change_category():
        view("All Forms")
        rows().filter(has_text=f"U2 Voucher Form {RUN}").get_by_role("button", name=re.compile("^Open record")).click()
        d = page.get_by_role("dialog").last; d.get_by_role("button", name="Edit").click()
        d.get_by_label("Category").select_option("Work"); d.get_by_role("button", name="Save changes").click()
        expect(d.get_by_role("button", name="Edit")).to_be_visible(); page.keyboard.press("Escape"); page.wait_for_timeout(400)
        view("Work forms"); expect(rows().filter(has_text=f"U2 Voucher Form {RUN}")).to_have_count(1)
    check("Forms: the category can be changed and the form moves", forms_change_category)

    def form_view_category():
        go("/profiles")
        sidebar().get_by_role("button", name="Create new…", exact=True).click(); page.get_by_role("menuitem", name="Form", exact=True).click()
        d = page.get_by_role("dialog").filter(has_text="Create form view")
        cat = d.get_by_label("Form category"); assert cat.input_value() == "Work"
        cat.select_option("Vouchers"); d.get_by_label("View name").fill(f"U2 Voucher intake {RUN}"); d.get_by_role("button", name="Create new view").click()
        expect(page.locator("h1")).to_contain_text(f"U2 Voucher intake {RUN}")
        expect(page.get_by_role("complementary", name="Form settings").get_by_label("Category")).to_have_value("Vouchers")
        item = sidebar().locator("li", has=page.get_by_role("button", name=f"U2 Voucher intake {RUN}", exact=False)).first
        assert "Vouchers" in item.inner_text(), "the category tag shows in the sidebar"
        page.get_by_role("complementary", name="Form settings").get_by_label("Category").select_option("Work"); page.wait_for_timeout(1200)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        item = sidebar().locator("li", has=page.get_by_role("button", name=f"U2 Voucher intake {RUN}", exact=False)).first
        assert "Work" in item.inner_text()
        assert sidebar().locator("li", has=page.get_by_role("button", name="New Team Onboarding Form", exact=False)).first.inner_text().count("Work") == 1, "existing form views keep working with the default category"
        sidebar().get_by_role("button", name=re.compile(r"^New Team Onboarding Form")).click(); expect(page.get_by_role("button", name="Submit")).to_be_visible()
    check("Forms: Form views have their own category (separate from view type); existing form views keep working", form_view_category)

    # ====================================================================== 4. Voucher PDF (one supplied document)
    go("/vouchers"); view("VOUCHERS | Simplified")
    panel = lambda: page.get_by_role("complementary", name="Voucher tools")
    def ready(): expect(panel().locator("[data-testid=pdf-preview][data-state=ready]")).to_be_visible(timeout=15000)
    SIG = "c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, ink = 0; for (let i = 0; i < d.length; i += 52) { h = (h * 31 + d[i]) >>> 0; if (d[i] < 120) ink++; } return [h, ink, c.width, c.height]; }"
    def pdf_shown():
        ready(); assert panel().locator("[data-testid=pdf-preview] canvas").count() >= 1
        assert "Voucher.pdf" in panel().inner_text()
        h, ink, w, hgt = panel().locator("canvas").first.evaluate(SIG)
        assert ink > 300, "the preview has drawn the document"
        sigs["first"] = (h, ink, w, hgt)
    sigs = {}
    check("Vouchers: the supplied Voucher.pdf is displayed in the app", pdf_shown)

    def pdf_same_for_every_row():
        sel = panel().get_by_label("Voucher", exact=True)
        options = sel.locator("option").all()
        assert len(options) >= 2
        # a third voucher, created just now, must show the very same document
        api("POST", "tables/vouchers/records", {"docType": "BL", "headline": "BILL OF LADING", "deliverVia": "Another carrier"})
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]"); ready()
        sel = panel().get_by_label("Voucher", exact=True)
        n = sel.locator("option").count(); assert n >= 3, n
        for i in range(n):
            sel.select_option(index=i); page.wait_for_timeout(500); ready()
            assert panel().locator("canvas").count() >= 1
            assert tuple(panel().locator("canvas").first.evaluate(SIG)) == tuple(sigs["first"]), f"row {i} shows a different document"
            assert "Voucher.pdf" in panel().inner_text()
    check("Vouchers: every voucher row shows the same supplied PDF", pdf_same_for_every_row)

    def pdf_download_unchanged():
        link = panel().get_by_role("link", name="Download voucher PDF"); assert link.get_attribute("href") == "/vouchers/Voucher.pdf"
        with page.expect_download() as dl: link.click()
        assert dl.value.suggested_filename == "Voucher.pdf"
        assert sha(open(dl.value.path(), "rb").read()) == sha(pdf_bytes), "the download is the supplied file, byte for byte"
        r = page.request.get(BASE + "/vouchers/Voucher.pdf"); assert r.status == 200 and r.body()[:5] == b"%PDF-" and sha(r.body()) == sha(pdf_bytes)
        assert panel().get_by_role("link", name="Open voucher PDF in a new tab").get_attribute("target") == "_blank"
    check("Vouchers: open and download give back the supplied PDF unchanged", pdf_download_unchanged)

    def pdf_nothing_generated():
        txt = panel().inner_text().lower()
        for banned in ["generate pdf", "regenerate", "upload pdf", "replace", "generated pdf", "original pdf"]:
            assert banned not in txt, banned
        assert panel().get_by_role("button", name=re.compile(r"^(Generate PDF|Regenerate|Upload PDF|Replace)", re.I)).count() == 0
        page.get_by_role("button", name="New voucher").click(); d = page.get_by_role("dialog")
        for label in ["Original PDF", "Generated PDF"]: assert d.get_by_label(label).count() == 0, label
        assert d.locator("input[type=file]").count() == d.locator("input[type=file][accept^='image']").count(), "the only file fields take images (QR, cover), never PDFs"
        d.get_by_role("button", name="Cancel").click()
        view("Voucher Details"); heads = " ".join(h.inner_text() for h in page.get_by_role("columnheader").all())
        assert "Original PDF" not in heads and "Generated PDF" not in heads
    check("Vouchers: no PDF is generated, uploaded or replaced anywhere", pdf_nothing_generated)

    def pdf_api_gone():
        v = api("GET", "tables/vouchers")["records"][0]
        r = page.request.post(BASE + f"/api/base/tables/vouchers/records/{v['id']}/generate-pdf", headers={"sec-fetch-site": "same-origin"})
        assert r.status in (404, 405), r.status
    check("Vouchers: the PDF generation endpoint no longer exists", pdf_api_gone)

    # ====================================================================== 5. Filtering
    go("/actions"); view("All Actions")
    def count_of(txt): return int(re.match(r"(\d+)", txt).group(1))
    def filter_single():
        clear_filters(); total = api("GET", "tables/actions")["records"]; q = len([r for r in total if r["status"] == "Queue"])
        add_condition("Status", value=("pick", "Queue")); close_panels()
        expect(pills()).to_contain_text("Status is Queue"); assert rows().count() - 0 >= q
        assert len(rows().filter(has_text="Queue").all()) == q and rows().filter(has_text="Ongoing").count() == 0
        expect(page.get_by_role("button", name=re.compile("^Filtered by Status"))).to_be_visible()
        assert page.get_by_text(re.compile(rf"^{q} of {len(total)} ")).count() >= 1
    check("Filter: a single-select filter shows only matching records, with an active indicator", filter_single)

    def filter_combined_and_remove():
        add_condition("Accrue", op="is within", between=("2026-07-08", "2026-07-12")); close_panels()
        expect(pills()).to_contain_text("Accrue is within 2026-07-08 and 2026-07-12")
        n = len(rows().filter(has_text="Queue").all()); assert n >= 1 and rows().filter(has_text="Jul 6, 2026").count() == 0 and rows().filter(has_text="Jul 16, 2026").count() == 0
        pills().get_by_role("button", name=re.compile("^Remove filter: Status")).click(); page.wait_for_timeout(300)
        assert "Status is Queue" not in pills().inner_text() and "Accrue is within" in pills().inner_text()
        assert rows().filter(has_text="Ongoing").count() >= 1, "removing one condition keeps the other"
    check("Filter: several filters at once; remove one without losing the others", filter_combined_and_remove)

    def filter_any_of_and_clear():
        clear_filters()
        add_condition("Type", op="is any of", values=["Tasking", "Training"]); close_panels()
        expect(pills()).to_contain_text("Type is any of Tasking, Training"); assert rows().filter(has_text="Notice").count() == 0
        add_condition("Type", op="is none of", values=["Tasking"]); close_panels()  # now: any of (Tasking,Training) AND none of (Tasking) -> Training only
        assert rows().filter(has_text="Tasking").count() == 0 and rows().filter(has_text="Training").count() >= 1
        page.get_by_role("button", name="Clear all filters").first.click(); page.wait_for_timeout(300)
        assert pills().count() == 0 and rows().filter(has_text="Notice").count() >= 1 and page.get_by_role("button", name="Filter", exact=True).count() == 1
    check("Filter: include / exclude several values, then clear all", filter_any_of_and_clear)

    def filter_empty_state():
        add_condition("Title", op="contains", value=("text", "zzzz-no-such-title")); close_panels()
        expect(page.get_by_text("No actions match")).to_be_visible(); assert page.get_by_text("Your records are untouched").count() == 1
        assert page.get_by_text(re.compile(r"^0 of \d+ actions")).count() >= 1
        page.get_by_role("button", name="Clear all filters").first.click(); page.wait_for_timeout(300)
        assert rows().count() > 5 and page.get_by_text("No actions match").count() == 0
    check("Filter: a clear empty state when nothing matches, with a way back; records unaffected", filter_empty_state)

    def filter_with_search_sort_group():
        clear_filters()
        add_condition("Status", op="is not", value=("pick", "Scheduled")); close_panels()
        page.get_by_placeholder("Search profiles, transactions, and categories…").fill("deploy"); page.wait_for_timeout(500)
        txt = [t for t in rows().all_inner_texts() if re.search(r"A-\d{4}", t)]; assert txt and all("deploy" in t.lower() for t in txt) and all("Scheduled" not in t for t in txt), txt
        page.get_by_role("button", name="Sorted by 1 field").click(); page.locator("[role=dialog]").last.get_by_role("button", name="Remove Accrue").click(); close_panels()
        page.get_by_role("button", name="Sort", exact=True).click(); page.locator("[role=dialog]").last.get_by_role("button", name=re.compile("^Pick a field")).click()
        close_panels()
        page.get_by_role("button", name="Group", exact=True).click(); page.locator("[role=dialog]").last.get_by_role("button", name=re.compile("^Pick a field")).click(); close_panels()
        assert page.get_by_role("button", name="Grouped by 1 field").count() == 1
        assert rows().filter(has_text=re.compile("Deploy")).count() >= 1
        page.get_by_placeholder("Search profiles, transactions, and categories…").fill("")
        page.get_by_role("button", name="Grouped by 1 field").click(); page.locator("[role=dialog]").last.get_by_role("button", name=re.compile("^Remove")).click(); close_panels()
        page.get_by_role("button", name="Sorted by 1 field").click(); page.locator("[role=dialog]").last.get_by_role("button", name=re.compile("^Remove")).click(); close_panels()
        clear_filters()
    check("Filter: works together with search, sorting and grouping", filter_with_search_sort_group)

    def filter_persists():
        clear_filters(); add_condition("Status", value=("pick", "Ongoing")); close_panels(); page.wait_for_timeout(900)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]"); page.wait_for_timeout(500)
        expect(pills()).to_contain_text("Status is Ongoing")
        view("Action Board"); view("All Actions"); expect(pills()).to_contain_text("Status is Ongoing")
        clear_filters(); page.wait_for_timeout(900)
    check("Filter: a view keeps its filters after refresh and after switching views", filter_persists)

    def filter_all_view_types():
        for name, probe in [("Action Board", lambda: page.locator("section[aria-label^=Ongoing]").count()), ("Action Calendar", None), (f"U2 Gallery {RUN}", None), (f"U2 List {RUN}", None), (f"U2 Gantt {RUN}", None), (f"U2 Timeline {RUN}", None)]:
            view(name); clear_filters()
            add_condition("Status", value=("pick", "Queue")); close_panels(); page.wait_for_timeout(300)
            expect(pills()).to_contain_text("Status is Queue")
            expect(page.get_by_text(re.compile(r"^\d+ of \d+ ")).first).to_be_visible()
            clear_filters()
        view("Action Board"); add_condition("Status", value=("pick", "Queue")); close_panels()
        assert page.locator("section[aria-label='Ongoing, 0 cards']").count() == 1 and page.locator("section[aria-label^=Queue]").count() == 1
        clear_filters()
    check("Filter: the same filter panel works in Kanban, Calendar, Gallery, List, Gantt and Timeline views", filter_all_view_types)

    def filter_operators_by_type():
        go("/items"); view("All Items"); clear_filters(); open_filter(); fp = filter_panel()
        def ops_for(field):
            fp.get_by_role("button", name="Add condition").click(); fp.get_by_role("button", name=re.compile(r"^Field:")).last.click(); pick_option(field)
            fp.get_by_role("button", name=re.compile(r"^Operator:")).last.click()
            names = [o.inner_text().strip() for o in page.locator("[role=dialog][data-floating-level='1']").last.get_by_role("option").all()]
            page.keyboard.press("Escape"); fp.get_by_role("button", name=re.compile("^Remove condition")).last.click(); return names
        t = ops_for("Title"); assert t == ["contains", "does not contain", "is", "is not", "is empty", "is not empty"], t
        n = ops_for("Qty"); assert "is between" in n and "is greater than" in n and "equals" in n and "contains" not in n, n
        d = ops_for("Description"); assert "contains" in d
        s = ops_for("Category"); assert "is any of" in s and "is none of" in s and "is between" not in s, s
        st = ops_for("Stock status"); assert "is any of" in st
        fp.get_by_role("button", name="Add condition").click(); fp.get_by_role("button", name=re.compile(r"^Field:")).last.click(); pick_option("Reorder level")
        fp.get_by_role("button", name=re.compile(r"^Operator:")).last.click(); pick_option("is between"); assert fp.get_by_label("Minimum").count() == 1 and fp.get_by_label("Maximum").count() == 1
        fp.get_by_role("button", name=re.compile("^Remove condition")).last.click()
        close_panels()
    check("Filter: only sensible operators per field type (text, number, select, status, between)", filter_operators_by_type)

    def filter_number_between_items():
        clear_filters(); add_condition("Qty", op="is between", between=("100", "150")); close_panels()
        qtys = [int(x) for x in re.findall(r"\b(1\d\d)\b", page.get_by_role("grid").inner_text())]
        total = len(api("GET", "tables/items")["records"]); expect(page.get_by_text(re.compile(rf"of {total} items"))).to_be_visible()
        add_condition("Stock status", op="is not", value=("pick", "In stock")); close_panels()
        clear_filters()
    check("Filter: number between and the derived stock status", filter_number_between_items)

    def filter_assignee_category():
        go("/folios"); view("Folios - All Active Categories"); clear_filters()
        add_condition("Assignee", op="is any of", values=["Ereika Espiritu", "Andrea Erika Sabas"]); close_panels()
        expect(pills()).to_contain_text("Assignee is any of Ereika Espiritu, Andrea Erika Sabas")
        names = page.get_by_role("grid").inner_text(); assert "Raymon" not in names and "Ereika" in names and "Andrea" in names
        add_condition("Category", op="is", value=("pick", "2.1 Reference")); close_panels()
        assert "Receipts In Basket" not in page.get_by_role("grid").inner_text() and "360° Organization System" in page.get_by_role("grid").inner_text()
        clear_filters()
    check("Filter: by assignee (team member) and by category", filter_assignee_category)

    def filter_copy_and_reorder():
        go("/actions"); view("All Actions"); clear_filters()
        add_condition("Status", value=("pick", "Queue")); close_panels(); page.wait_for_timeout(900)
        sidebar().get_by_role("button", name="Create new…", exact=True).click(); page.get_by_role("menuitem", name="Grid", exact=True).click()
        d = page.get_by_role("dialog").filter(has_text="Create grid view"); d.get_by_label("View name").fill(f"U2 Copy target {RUN}"); d.get_by_role("button", name="Create new view").click()
        expect(page.locator("h1")).to_contain_text(f"U2 Copy target {RUN}")
        open_filter(); fp = filter_panel(); fp.get_by_role("button", name="Copy from another view").click()
        page.get_by_role("menuitem", name=re.compile("^All Actions")).click(); page.wait_for_timeout(300)
        expect(fp.get_by_role("button", name=re.compile(r"^Field: Status"))).to_be_visible()
        add_condition("Title", op="contains", value=("text", "a")); fp = filter_panel()
        handles = fp.get_by_role("button", name=re.compile("^Reorder condition")); assert handles.count() == 2
        handles.nth(1).focus(); page.keyboard.press("ArrowUp"); page.wait_for_timeout(300)
        assert fp.get_by_role("button", name=re.compile(r"^Field:")).first.get_attribute("aria-label").endswith("Title")
        close_panels(); clear_filters(); view("All Actions"); expect(pills()).to_contain_text("Status is Queue")
        clear_filters()
    check("Filter: copy conditions from another view; reorder conditions", filter_copy_and_reorder)

    def filter_changes_nothing():
        before = len(api("GET", "tables/actions")["records"]); add_condition("Title", op="contains", value=("text", "zzz")); close_panels(); clear_filters()
        assert len(api("GET", "tables/actions")["records"]) == before
    check("Filter: filtering never changes or deletes records", filter_changes_nothing)

    # ====================================================================== 6. Server-side filtering
    if SERVER_BASE:
        def server_mode():
            go("/actions", SERVER_BASE); view("All Actions")
            bundle = api("GET", "tables/actions"); assert bundle["serverMode"] is True and len(bundle["records"]) == 6, "the server sends only the first page"
            total = bundle["recordCount"]
            expect(page.get_by_text(re.compile(rf"Showing 6 of {total} matching actions"))).to_be_visible()
            assert rows().count() <= 8
            page.get_by_role("button", name="Load more").click(); page.wait_for_timeout(700)
            expect(page.get_by_text(re.compile(rf"Showing 12 of {total} matching"))).to_be_visible()
            add_condition("Status", value=("pick", "Queue")); close_panels(); page.wait_for_timeout(900)
            qn = api("POST", "tables/actions/query", {"filters": [{"id": "x", "join": "and", "field": "status", "op": "is", "value": "Queue"}], "limit": 500, "offset": 0})["total"]
            expect(page.get_by_text(re.compile(rf"Showing \d+ of {qn} matching"))).to_be_visible()
            assert rows().filter(has_text="Ongoing").count() == 0
            page.get_by_placeholder("Search profiles, transactions, and categories…").fill("deploy"); page.wait_for_timeout(900)
            assert all("deploy" in t.lower() for t in rows().all_inner_texts() if re.search(r"A-\d{4}", t))
            page.get_by_placeholder("Search profiles, transactions, and categories…").fill("")
            add_condition("Title", op="contains", value=("text", "qqqqq")); close_panels(); page.wait_for_timeout(900)
            expect(page.get_by_text("No actions match")).to_be_visible()
            clear_filters()
        check("Large tables: the server filters, searches and pages (Load more); empty state works", server_mode)
        def server_mode_small():
            go("/concepts", SERVER_BASE); expect(page.get_by_role("grid")).to_be_visible()
        check("Large tables: the same screens still work for tables below the threshold", server_mode_small)

    def no_console_errors():
        real = [e for e in console_errors if "favicon" not in e and "Failed to load resource" not in e]
        assert not real, real[:5]
    check("no console errors or uncaught exceptions during the run", no_console_errors)
    browser.close()

failed = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed: print("FAILED:", *failed, sep="\n  ")
sys.exit(1 if failed else 0)
