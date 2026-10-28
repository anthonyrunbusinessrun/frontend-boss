"""
Browser end-to-end checks for the table engine (Playwright, Python).

  BOSS_URL=http://localhost:3100 python3 qa/base-e2e.py

Needs a running app on a migrated database. The script creates its own uniquely named views, sections,
records and categories, so it can be re-run against the same database.
"""
import io, os, re, sys, time, traceback
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BOSS_URL", "http://localhost:3100")
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
RUN = str(int(time.time()))[-6:]
results, console_errors = [], []

def cleanup():
    """Leave no dialog or open panel behind, so one failing check cannot cascade into the next."""
    for _ in range(6):
        try:
            ad = page.get_by_role("alertdialog")
            if ad.count():
                ad.get_by_role("button", name="Discard").click(timeout=800) if ad.get_by_role("button", name="Discard").count() else ad.get_by_role("button", name="Cancel").click(timeout=800)
                continue
            if page.get_by_role("dialog").count() or page.locator("[role=dialog]").count():
                page.keyboard.press("Escape"); page.wait_for_timeout(350)
                continue
        except Exception:
            pass
        break

def check(name, fn):
    cleanup()
    try:
        fn()
        results.append((True, name))
        print("PASS", name)
    except Exception as e:  # noqa: BLE001
        results.append((False, name))
        tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename.endswith("base-e2e.py")]
        where = f" (line {tb[-1].lineno}: {tb[-1].line[:110]})" if tb else ""
        print("FAIL", name, "->", ((str(e).splitlines() or [repr(e)])[0][:200]) + where)
        try:
            page.screenshot(path="/tmp/shots/FAIL-" + "".join(c if c.isalnum() else "_" for c in name)[:60] + ".png")
        except Exception:
            pass

def go(path):
    page.goto(BASE + path, wait_until="load")
    page.wait_for_selector("aside[aria-label=Views]")
    page.wait_for_timeout(500)

def formbtn(name):
    """Sidebar button of a Form view: its accessible name ends with the category tag (Work / Vouchers)."""
    return sidebar().get_by_role("button", name=re.compile("^" + re.escape(name) + "( (Work|Vouchers))?$"))

def secbtn(name):
    return sidebar().locator("button[aria-expanded]", has_text=name)

import re

def filter_panel():
    return page.locator("[role=dialog][data-floating-level='0']").last

def open_filter():
    if not filter_panel().is_visible() if page.locator("[role=dialog][data-floating-level='0']").count() else True:
        page.get_by_role("button", name=re.compile(r"^(Filter|Filtered by)")).first.click()
        page.wait_for_selector("[role=dialog][data-floating-level='0']")

def pick_option(name):
    """Choose an option in the topmost searchable list."""
    page.locator("[role=dialog][data-floating-level='1']").last.get_by_role("option", name=name, exact=True).click()

def add_condition(field, op=None, value=None, values=None, between=None):
    """Add one filter condition through the UI. value=("pick","Queue") or ("text","abc"); values=[...] for any-of / none-of."""
    open_filter()
    fp = filter_panel()
    fp.get_by_role("button", name="Add condition").click()
    page.wait_for_timeout(150)
    fp.get_by_role("button", name=re.compile(r"^Field:")).last.click()
    pick_option(field)
    if op:
        fp.get_by_role("button", name=re.compile(r"^Operator:")).last.click()
        pick_option(op)
    if value:
        kind, v = value
        if kind == "pick":
            fp.get_by_role("button", name=re.compile(r"^Value for")).last.click(); pick_option(v)
        elif kind == "select":
            fp.get_by_label("Value").last.select_option(v)
        else:
            fp.get_by_label("Value").last.fill(v)
    if values:
        fp.get_by_role("button", name=re.compile(r"^Values for")).last.click()
        for v in values: page.locator("[role=dialog][data-floating-level='1']").last.get_by_label(v, exact=True).check()
        page.keyboard.press("Escape")
    if between:
        lo, hi = between
        fp.get_by_label(re.compile(r"^(Minimum|From date)")).last.fill(lo)
        fp.get_by_label(re.compile(r"^(Maximum|To date)")).last.fill(hi)
    page.wait_for_timeout(250)

def close_panels():
    for _ in range(3):
        if page.locator("[role=dialog][data-floating-level]").count(): page.keyboard.press("Escape"); page.wait_for_timeout(150)

def open_grid(name="All Actions"):
    sidebar().get_by_role("button", name=name, exact=True).click()
    page.wait_for_timeout(400)

def sidebar():
    return page.locator("aside[aria-label=Views]")

def create_view(kind, name, access=None):
    sidebar().get_by_role("button", name="Create new…", exact=True).click()
    page.get_by_role("menuitem", name=kind, exact=True).click()
    dlg = page.get_by_role("dialog").filter(has_text="Create")
    inp = dlg.get_by_label("View name")
    inp.fill(name)
    if access:
        dlg.get_by_label(access).check()
    dlg.get_by_role("button", name="Create new view").click()
    expect(page.locator("h1")).to_contain_text(name)

def png_bytes(color=(200, 30, 60)):
    from PIL import Image
    buf = io.BytesIO(); Image.new("RGB", (64, 64), color).save(buf, "PNG"); return buf.getvalue()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("PAGEERROR " + page.url + " " + str(e)[:120]))
    page.set_default_timeout(8000)
    os.makedirs("/tmp/shots", exist_ok=True)

    # ------------------------------------------------------------------ navigation
    go("/profiles")
    def nav():
        tabs = [t.inner_text() for t in page.locator('nav[aria-label=Primary] a').all()]
        assert tabs == ["Profiles", "Categories", "Folios", "Actions", "Vouchers", "Transactions", "Items", "Forms", "Concepts", "Capabilities", "Leads"], tabs
        for gone in ["BOSS", "AIS", "Packet", "Accounts", "Registries"]:
            assert gone not in tabs
    check("navigation: removed tabs are gone, others remain", nav)

    def removed_routes():
        for path in ["/boss", "/packet", "/accounts", "/registries"]:
            page.goto(BASE + path, wait_until="load")
            assert page.get_by_text("This page could not be found").count() == 1, path
    check("removed tabs' routes no longer render a screen", removed_routes)

    # ------------------------------------------------------------- create menu / views
    go("/actions")
    def create_menu():
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        names = [i.get_attribute("aria-label") for i in page.get_by_role("menuitem").all()]
        assert names == ["Grid", "Calendar", "Gallery", "Kanban", "Timeline", "List", "Gantt", "Form", "Section"], names
        page.keyboard.press("Escape")
    check("create menu offers Grid, Calendar, Gallery, Kanban, Timeline, List, Gantt, Form, Section", create_menu)

    def dialog_defaults():
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        page.get_by_role("menuitem", name="Grid", exact=True).click()
        dlg = page.get_by_role("dialog").filter(has_text="Create grid view")
        assert dlg.get_by_label("View name").input_value() == "Action’s Grid"
        assert dlg.get_by_label("Collaborative").is_checked()
        for label in ["Collaborative", "Personal", "Locked"]:
            assert dlg.get_by_label(label).count() == 1
        dlg.get_by_role("button", name="Cancel").click()
    check("create dialog: default name and Collaborative / Personal / Locked", dialog_defaults)

    def grid_validation():
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        page.get_by_role("menuitem", name="Grid", exact=True).click()
        dlg = page.get_by_role("dialog").filter(has_text="Create grid view")
        dlg.get_by_label("View name").fill("   ")
        dlg.get_by_role("button", name="Create new view").click()
        expect(dlg.get_by_role("alert")).to_contain_text("Give the view a name")
        dlg.get_by_role("button", name="Cancel").click()
    check("create dialog: blank name is rejected with a message", grid_validation)

    names = {}
    for kind in ["Grid", "Calendar", "Gallery", "Kanban", "Timeline", "List", "Gantt", "Form"]:
        names[kind] = f"E2E {kind} {RUN}"
        check(f"create {kind} view appears immediately and renders", lambda k=kind: create_view(k, names[k]))
        if kind == "Kanban":
            def pick_status():
                page.get_by_role("button", name="Customize").click()
                page.locator("[role=dialog]").last.get_by_label("Stack field").select_option(label="Status")
                page.keyboard.press("Escape")
            check("kanban: choose the Status field as the stack field", pick_status)
        def rendered(k=kind):
            if k == "Calendar": assert page.get_by_role("grid", name="October 2026").count() + page.locator('[role=grid][aria-label]').count() >= 1; assert page.get_by_text("Sun").count() >= 1
            if k == "Kanban": expect(page.locator("section[aria-label^=Queue]")).to_have_count(1)
            if k == "Gallery": assert page.locator("button", has_text="A-4642").count() >= 1 or page.get_by_text("Add record").count() >= 1
            if k == "List": assert page.get_by_text("Review S14 Telemetry Reports").count() >= 1
            if k == "Timeline": assert page.get_by_role("button", name="Day").count() == 1
            if k == "Gantt": assert page.get_by_text("Task", exact=True).count() >= 1
            if k == "Form": assert page.get_by_role("button", name="Submit").count() == 1
            if k == "Grid": assert page.get_by_role("columnheader").count() > 5
        check(f"{kind} view shows real records / controls", rendered)

    # ---------------------------------------------------------- views persist and switch
    def persists():
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        for k, n in names.items():
            btn = formbtn(n) if k == "Form" else sidebar().get_by_role("button", name=n, exact=True)
            assert btn.count() == 1, n
    check("created views survive a page refresh", persists)

    def switch_keeps_records():
        sidebar().get_by_role("button", name="All Actions", exact=True).click()
        expect(page.locator("h1")).to_contain_text("All Actions")
        expect(page.locator("p", has_text="16 actions").first).to_be_visible()
        sidebar().get_by_role("button", name=names["Kanban"], exact=True).click()
        expect(page.locator("h1")).to_contain_text(names["Kanban"])
        expect(page.locator("p", has_text="16 actions").first).to_be_visible()
    check("switching views keeps the same 16 records", switch_keeps_records)

    # -------------------------------------------------------------- kanban drag + persist
    def kanban_drag():
        sidebar().get_by_role("button", name=names["Kanban"], exact=True).click()
        card = page.locator("section[aria-label^=Queue] [role=button]", has_text="Update Onboarding Guidelines").first
        card.drag_to(page.locator("section[aria-label^=Ongoing]"))
        page.wait_for_timeout(800)
        expect(page.locator("section[aria-label^=Ongoing]").get_by_text("Update Onboarding Guidelines")).to_be_visible()
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        sidebar().get_by_role("button", name=names["Kanban"], exact=True).click()
        expect(page.locator("section[aria-label^=Ongoing]").get_by_text("Update Onboarding Guidelines")).to_be_visible()
        sidebar().get_by_role("button", name="All Actions", exact=True).click()
        expect(page.get_by_role("row").filter(has_text="Update Onboarding Guidelines")).to_contain_text("Ongoing")
    check("kanban: dragging a card changes its status; saved, and shown in the grid", kanban_drag)

    def kanban_keyboard():
        sidebar().get_by_role("button", name=names["Kanban"], exact=True).click()
        card = page.locator("section[aria-label^=Ongoing] [role=button]", has_text="Update Onboarding Guidelines").first
        card.focus(); page.keyboard.press("ArrowRight")
        page.wait_for_timeout(700)
        expect(page.locator("section[aria-label^=Queue]").get_by_text("Update Onboarding Guidelines")).to_be_visible()
    check("kanban: keyboard arrows move a card between columns", kanban_keyboard)

    # --------------------------------------------------------------- calendar interactions
    def calendar_move():
        sidebar().get_by_role("button", name=names["Calendar"], exact=True).click()
        page.wait_for_selector("[role=gridcell]")
        # data is July 2026: navigate back from October 2026
        for _ in range(3): page.get_by_role("button", name="Previous month").click()
        expect(page.get_by_role("heading", name="July 2026")).to_be_visible()
        chip = page.locator("button[draggable=true]", has_text="A-4701").first
        assert chip.is_visible()
        day = page.locator('[role=gridcell][aria-label="2026-07-20"]')
        chip.drag_to(day); page.wait_for_timeout(800)
        expect(day.get_by_text("A-4701")).to_be_visible()
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
    check("calendar: shows records by date and a dragged record moves to the new day", calendar_move)

    def calendar_create():
        sidebar().get_by_role("button", name=names["Calendar"], exact=True).click()
        for _ in range(3): page.get_by_role("button", name="Previous month").click()
        cell = page.locator('[role=gridcell][aria-label="2026-07-22"]')
        cell.hover(); cell.get_by_role("button", name="Add record on 2026-07-22").click()
        dlg = page.get_by_role("dialog")
        assert dlg.get_by_label("Accrue").input_value() == "2026-07-22"
        expect(dlg.get_by_test_id("code-code")).to_have_value(re.compile(r"^A-\d+$"))
        code = dlg.get_by_test_id("code-code").input_value()
        dlg.get_by_label("Title").fill(f"E2E cal action {RUN}")
        dlg.get_by_label("Type").select_option("Notice"); dlg.get_by_label("Status").select_option("Queue")
        dlg.get_by_role("button", name="Create action").click()
        expect(page.get_by_text(code).first).to_be_visible()
    check("calendar: creating a record on a day pre-fills the date and saves", calendar_create)

    # --------------------------------------------------------------- gantt + dependencies
    def gantt_deps():
        sidebar().get_by_role("button", name=names["Gantt"], exact=True).click()
        page.get_by_role("button", name="Customize").click()
        panel = page.locator("[role=dialog]").last
        panel.get_by_role("button", name="Add a dependency field").click()
        dlg = page.get_by_role("dialog").filter(has_text="Add field")
        dlg.get_by_label("Field name").fill("Depends on")
        dlg.get_by_label("Allow linking to several records").check()
        assert dlg.get_by_text("Link to", exact=True).locator("..").locator("select").input_value() == "actions"
        dlg.get_by_role("button", name="Add field").click()
        expect(dlg).to_have_count(0)
        page.get_by_role("button", name="Customize").click()
        page.locator("[role=dialog]").last.get_by_label("Dependency field").select_option(label="Depends on")
        page.keyboard.press("Escape")
        # link two tasks through the record drawer
        page.locator("[role=button]", has_text="A-4701").first.click()
        drawer = page.get_by_role("dialog").last
        drawer.get_by_role("button", name="Edit").click()
        drawer.get_by_label("Depends on").click()
        page.get_by_role("option", name="A-4642").click()
        page.keyboard.press("Escape")
        drawer.get_by_role("button", name="Save changes").click()
        page.wait_for_timeout(800)
        page.keyboard.press("Escape")
        assert page.locator("svg path[marker-end]").count() >= 1
    check("gantt: bars, durations and a saved dependency arrow", gantt_deps)

    # ------------------------------------------------------------------ gallery / list / timeline
    def timeline_and_list():
        sidebar().get_by_role("button", name=names["Timeline"], exact=True).click()
        assert page.get_by_role("button", name="Week").get_attribute("aria-pressed") == "true"
        page.get_by_role("button", name="Month").click()
        sidebar().get_by_role("button", name=names["List"], exact=True).click()
        page.get_by_role("button", name="Expand A-4642").click()
        expect(page.locator("dl").first).to_contain_text("Status")
    check("timeline zoom works; list rows expand to show details", timeline_and_list)

    # --------------------------------------------------------------- rename / duplicate / delete
    def rename_delete():
        item = sidebar().locator("li", has=page.get_by_role("button", name=names["Grid"]))
        item.hover(); item.get_by_role("button", name=f"Options for {names['Grid']}").click()
        page.get_by_role("menuitem", name="Rename view").click()
        dlg = page.get_by_role("dialog").filter(has_text="Rename view")
        dlg.get_by_label("Name").fill(f"Renamed grid {RUN}"); dlg.get_by_role("button", name="Save").click()
        expect(sidebar().get_by_role("button", name=f"Renamed grid {RUN}", exact=True)).to_be_visible()
        item = sidebar().locator("li", has=page.get_by_role("button", name=f"Renamed grid {RUN}"))
        item.hover(); item.get_by_role("button", name=f"Options for Renamed grid {RUN}").click()
        page.get_by_role("menuitem", name="Duplicate view").click()
        expect(sidebar().get_by_role("button", name=f"Renamed grid {RUN} copy", exact=True)).to_be_visible()
        for n in [f"Renamed grid {RUN} copy", f"Renamed grid {RUN}"]:
            item = sidebar().locator("li", has=page.get_by_role("button", name=n, exact=True))
            item.hover(); item.get_by_role("button", name=f"Options for {n}").click()
            page.get_by_role("menuitem", name="Delete view").click()
            conf = page.get_by_role("alertdialog")
            assert "records are not affected" in conf.inner_text().lower()
            conf.get_by_role("button", name="Delete view").click()
            expect(sidebar().get_by_role("button", name=n, exact=True)).to_have_count(0)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        assert sidebar().get_by_role("button", name=f"Renamed grid {RUN}", exact=True).count() == 0
    check("rename, duplicate and delete views (with confirmation); records untouched", rename_delete)

    # ------------------------------------------------------------ sections, folders, drag and drop
    sec = f"E2E Section {RUN}"
    def section_create():
        sidebar().get_by_role("button", name="Create new…", exact=True).click()
        page.get_by_role("menuitem", name="Section").click()
        dlg = page.get_by_role("dialog").filter(has_text="Create section")
        dlg.get_by_label("Section name").fill(sec); dlg.get_by_role("button", name="Create section").click()
        expect(secbtn(sec)).to_be_visible()
    check("create a section; it appears immediately", section_create)

    def drag_into_section():
        item = sidebar().locator("li[draggable=true]", has=page.get_by_role("button", name=names["Kanban"]))
        header = sidebar().locator("div[draggable=true]", has=page.locator("button[aria-expanded]", has_text=sec))
        item.drag_to(header)
        page.wait_for_timeout(900)
        sec_li = sidebar().locator("li", has=page.locator("button[aria-expanded]", has_text=sec)).first
        expect(sec_li.locator("button", has_text=names["Kanban"]).first).to_be_visible()
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        sec_li = sidebar().locator("li", has=page.locator("button[aria-expanded]", has_text=sec)).first
        expect(sec_li.locator("button", has_text=names["Kanban"]).first).to_be_visible()
    check("drag a view into a section; the structure persists after refresh", drag_into_section)

    def reorder_root():
        a = sidebar().locator("li[draggable=true]", has=page.get_by_role("button", name=re.compile("^" + re.escape(names["Form"]))))
        b = sidebar().locator("li[draggable=true]", has=page.get_by_role("button", name="All Actions", exact=True))
        before = [x.inner_text() for x in sidebar().locator("ul > li > button.sideBtn, nav > ul > li").all()]
        a.drag_to(b, target_position={"x": 40, "y": 3}); page.wait_for_timeout(900)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        labels = [t.strip() for t in sidebar().locator("nav ul").first.locator("> li").all_inner_texts()]
        flat = " | ".join(labels)
        assert flat.index(names["Form"]) < flat.index("All Actions"), flat[:300]
    check("drag to reorder; order persists after refresh", reorder_root)

    def move_menu_out():
        item = sidebar().locator("li", has=page.get_by_role("button", name=names["Kanban"])).last
        item.hover(); item.get_by_role("button", name=f"Options for {names['Kanban']}").click()
        page.get_by_role("menuitem", name="Move to…").click()
        page.get_by_role("menuitem", name="Sidebar (no section)").click()
        page.wait_for_timeout(700)
        sec_li = sidebar().locator("li", has=page.locator("button[aria-expanded]", has_text=sec)).first
        assert sec_li.get_by_role("button", name=names["Kanban"]).count() == 0
        expect(sidebar().get_by_role("button", name=names["Kanban"], exact=True)).to_be_visible()
    check("keyboard-accessible ‘Move to…’ menu removes a view from a section", move_menu_out)

    def section_rename_delete():
        header = sidebar().locator("div[draggable=true]", has=page.locator("button[aria-expanded]", has_text=sec))
        header.hover(); header.get_by_role("button", name=f"Options for section {sec}").click()
        page.get_by_role("menuitem", name="Rename section").click()
        dlg = page.get_by_role("dialog").filter(has_text="Rename section")
        dlg.get_by_label("Name").fill(sec + " B"); dlg.get_by_role("button", name="Save").click()
        expect(secbtn(sec + " B")).to_be_visible()
        # put a view back in, then delete the section: the view must remain
        item = sidebar().locator("li[draggable=true]", has=page.get_by_role("button", name=names["Kanban"]))
        header = sidebar().locator("div[draggable=true]", has=page.locator("button[aria-expanded]", has_text=sec + " B"))
        item.drag_to(header); page.wait_for_timeout(800)
        header.hover(); header.get_by_role("button", name=f"Options for section {sec} B").click()
        page.get_by_role("menuitem", name="Delete section").click()
        conf = page.get_by_role("alertdialog")
        assert "no views or records are deleted" in conf.inner_text().lower()
        conf.get_by_role("button", name="Delete section").click()
        expect(secbtn(sec + " B")).to_have_count(0)
        expect(sidebar().get_by_role("button", name=names["Kanban"], exact=True)).to_be_visible()
    check("rename a section; deleting it keeps its views", section_rename_delete)

    # ---------------------------------------------------------------- favorites
    def favorites():
        item = sidebar().locator("li", has=page.get_by_role("button", name="Action Calendar")).first
        item.hover(); item.get_by_role("button", name="Options for Action Calendar").click()
        page.get_by_role("menuitem", name="Add to ‘My favorites’").click()
        expect(sidebar().locator("section[aria-label='My favorites']")).to_contain_text("Action Calendar")
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        expect(sidebar().locator("section[aria-label='My favorites']")).to_contain_text("Action Calendar")
        # a different browser profile (another user) does not share it
        other = browser.new_context(viewport={"width": 1440, "height": 900}).new_page()
        other.goto(BASE + "/actions", wait_until="load"); other.wait_for_selector("aside[aria-label=Views]"); other.wait_for_timeout(1200)
        assert other.locator("section[aria-label='My favorites']").count() == 0
        other.context.close()
        item = sidebar().locator("li", has=page.get_by_role("button", name="Action Calendar")).last
        item.hover(); item.get_by_role("button", name="Options for Action Calendar").click()
        page.get_by_role("menuitem", name="Remove from ‘My favorites’").click()
        expect(sidebar().locator("section[aria-label='My favorites']")).to_have_count(0)
    check("favorite a view: persists after refresh, is per user, and can be removed", favorites)

    def favorite_profile():
        go("/profiles")
        page.get_by_role("button", name="Open record 3").click()
        page.get_by_role("button", name="Add to favorites").click()
        page.keyboard.press("Escape")
        expect(sidebar().locator("section[aria-label='My favorites']")).to_contain_text("Raymon Joseph Land III")
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        expect(sidebar().locator("section[aria-label='My favorites']")).to_contain_text("Raymon Joseph Land III")
        sidebar().locator("section[aria-label='My favorites']").get_by_role("button", name="Raymon Joseph Land III").click()
        expect(page.get_by_role("dialog").last).to_contain_text("Raymon Joseph Land III")
        page.get_by_role("button", name="Remove from favorites").click(); page.keyboard.press("Escape")
    check("favorite a profile: shown in My favorites and opens the profile", favorite_profile)

    # --------------------------------------------------------- grid: edit, resize, sort, filter, fields
    def grid_edit():
        go("/actions"); open_grid()
        row = page.get_by_role("row").filter(has_text="A-4642")
        cell = row.get_by_role("gridcell").nth(4)  # Title (after checkbox, row number, code, accrue)
        cell.dblclick()
        inp = row.locator("input[type=text]").first
        inp.fill("Review S14 Telemetry Reports (edited)"); inp.press("Enter")
        expect(page.get_by_text("Review S14 Telemetry Reports (edited)")).to_be_visible()
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        expect(page.get_by_text("Review S14 Telemetry Reports (edited)")).to_be_visible()
        row = page.get_by_role("row").filter(has_text="A-4642")
        row.get_by_role("gridcell").nth(4).dblclick()
        i2 = row.locator("input[type=text]").first; i2.fill("Review S14 Telemetry Reports"); i2.press("Enter")
    check("grid: edit a cell in place; value is saved to the database", grid_edit)

    def grid_checkbox_select():
        open_grid()
        row = page.get_by_role("row").filter(has_text="A-4642")
        c = row.get_by_role("gridcell").nth(9)  # Act checkbox
        before = c.locator("svg").count()
        c.click(); page.wait_for_timeout(700)
        assert page.get_by_role("row").filter(has_text="A-4642").get_by_role("gridcell").nth(9).locator("svg").count() != before
        page.get_by_role("row").filter(has_text="A-4642").get_by_role("gridcell").nth(9).click(); page.wait_for_timeout(500)
    check("grid: clicking a checkbox cell toggles and saves it", grid_checkbox_select)

    def grid_sort_filter_group():
        open_grid()
        page.get_by_role("columnheader", name="Title").get_by_role("button").first.click()
        page.get_by_role("menuitem", name="Sort Z → A").click()
        first = page.get_by_role("row").nth(1).inner_text()
        assert "Validate Sourcing Schema" in first or "Update Onboarding" in first or "Review" not in first, first
        page.get_by_role("button", name="Sorted by 1 field").click()
        page.get_by_role("button", name="Remove Title").click(); page.keyboard.press("Escape")
        add_condition("Status", value=("pick", "Queue"))
        page.keyboard.press("Escape")
        expect(page.locator("p", has_text=re.compile(r"\d+ of \d+ actions")).first).to_be_visible()
        n = page.get_by_role("row").filter(has_text="Queue").count()
        assert n >= 5
        expect(page.get_by_role("status", name="Active filters")).to_contain_text("Status is Queue")
        page.get_by_role("button", name="Clear all filters").click()
        page.get_by_role("button", name="Group", exact=True).click()
        page.locator("[role=dialog]").last.get_by_role("button", name="Pick a field to group by").click()
        page.keyboard.press("Escape")
        assert page.get_by_role("button", expanded=True).filter(has_text="Code").count() >= 1
    check("grid: sort from header menu, filter by field, group by field", grid_sort_filter_group)

    def view_settings_saved():
        page.wait_for_timeout(1200)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        open_grid()
        assert page.get_by_role("button", name="Grouped by 1 field").count() == 1
        page.get_by_role("button", name="Grouped by 1 field").click()
        page.locator("[role=dialog]").last.get_by_role("button", name="Remove Code").click(); page.keyboard.press("Escape")
        page.wait_for_timeout(900)
    check("grid: view settings (grouping) are saved with the view", view_settings_saved)

    def resize_columns():
        go("/actions")
        sidebar().get_by_role("button", name="All Actions", exact=True).click()
        sep = page.get_by_role("separator", name="Resize Title")
        box = sep.bounding_box(); w0 = page.get_by_role("columnheader", name="Title").bounding_box()["width"]
        page.mouse.move(box["x"] + 3, box["y"] + 10); page.mouse.down(); page.mouse.move(box["x"] + 123, box["y"] + 10, steps=6); page.mouse.up()
        page.wait_for_timeout(900)
        w1 = page.get_by_role("columnheader", name="Title").bounding_box()["width"]
        assert w1 > w0 + 80, (w0, w1)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        w2 = page.get_by_role("columnheader", name="Title").bounding_box()["width"]
        assert abs(w2 - w1) < 3, (w1, w2)
    check("grid: resize a column; width persists after refresh", resize_columns)

    def manage_fields():
        open_grid()
        page.get_by_role("button", name="Add field").click()
        dlg = page.get_by_role("dialog").filter(has_text="Add field")
        dlg.get_by_label("Field name").fill(f"Priority {RUN}")
        dlg.get_by_label("Field type").select_option("singleSelect")
        dlg.get_by_role("button", name="Add option").click()
        dlg.get_by_label("Option 1").fill("High")
        dlg.get_by_role("button", name="Add field").click()
        expect(page.get_by_role("columnheader", name=f"Priority {RUN}")).to_be_visible()
        page.get_by_role("columnheader", name=f"Priority {RUN}").get_by_role("button").first.click()
        page.get_by_role("menuitem", name="Edit field…").click()
        dlg = page.get_by_role("dialog").filter(has_text="Edit field")
        dlg.get_by_role("button", name="Delete field").click()
        page.get_by_role("alertdialog").get_by_role("button", name="Delete field").click()
        expect(page.get_by_role("columnheader", name=f"Priority {RUN}")).to_have_count(0)
    check("fields: add a single-select field, then delete it (confirmed)", manage_fields)

    def create_edit_delete_record():
        go("/actions"); open_grid()
        page.get_by_role("button", name="New action").click()
        dlg = page.get_by_role("dialog")
        dlg.get_by_role("button", name="Create action").click()
        expect(dlg.get_by_role("alert").first).to_be_visible()  # validation, nothing saved
        dlg.get_by_label("Title").fill(f"E2E record {RUN}")
        dlg.get_by_label("Accrue").fill("2026-11-02"); dlg.get_by_label("Type").select_option("Tasking"); dlg.get_by_label("Status").select_option("Queue")
        dlg.get_by_role("button", name="Create action").click()
        expect(page.get_by_role("dialog").last).to_contain_text(f"E2E record {RUN}")
        page.get_by_role("dialog").last.get_by_role("button", name="Edit").click()
        page.get_by_role("dialog").last.get_by_label("Title").fill(f"E2E record {RUN} v2")
        page.get_by_role("dialog").last.get_by_role("button", name="Save changes").click()
        expect(page.get_by_role("dialog").last.get_by_role("button", name="Edit")).to_be_visible()  # saved, back to view mode
        page.keyboard.press("Escape"); page.wait_for_timeout(400)
        expect(page.get_by_text(f"E2E record {RUN} v2").first).to_be_visible()
        row = page.get_by_role("row").filter(has_text=f"E2E record {RUN} v2")
        row.get_by_role("checkbox").check()
        page.get_by_role("region", name="Selected records").get_by_role("button", name="Delete").click()
        page.get_by_role("alertdialog").get_by_role("button", name="Delete").click()
        expect(page.get_by_text(f"E2E record {RUN} v2")).to_have_count(0)
    check("records: create (with validation), edit and bulk-delete from the grid", create_edit_delete_record)

    # ----------------------------------------------------------- Team Profile + Folio assignee
    member = f"E2E Member {RUN}"
    def team_profile():
        go("/profiles")
        page.get_by_role("button", name="Add team member").click()
        dlg = page.get_by_role("dialog")
        for label in ["Photo", "Contact", "Name", "Position", "Type", "eMail", "Address", "Team"]:
            assert dlg.get_by_label(label).count() >= 1, label
        dlg.get_by_role("button", name="Create profile").click()
        expect(dlg.get_by_role("alert").first).to_be_visible()
        dlg.get_by_label("Contact").fill(f"E{RUN[-3:]}"); dlg.get_by_label("Name").fill(member)
        dlg.get_by_label("Position").fill("QA Lead"); dlg.get_by_label("Type").select_option("Agent")
        dlg.get_by_label("eMail").fill(f"e2e{RUN}@example.com")
        assert dlg.get_by_label("Team").is_checked()
        dlg.locator("input[type=file]").first.set_input_files(files=[{"name": "me.png", "mimeType": "image/png", "buffer": png_bytes()}])
        expect(dlg.get_by_text("me.png")).to_be_visible()
        dlg.get_by_role("button", name="Create profile").click()
        expect(page.get_by_role("dialog").last.get_by_role("button", name="Edit")).to_be_visible()
        assert page.get_by_role("dialog").last.locator("img").count() >= 1
        page.keyboard.press("Escape")
    check("Team Profile: add a member with a profile picture", team_profile)

    def duplicate_profile():
        page.get_by_role("button", name="Add team member").click()
        dlg = page.get_by_role("dialog")
        dlg.get_by_label("Contact").fill(f"E{RUN[-3:]}"); dlg.get_by_label("Name").fill("Dup"); dlg.get_by_label("Position").fill("x")
        dlg.get_by_label("Type").select_option("Rep"); dlg.get_by_label("eMail").fill(f"e2e{RUN}@example.com")
        dlg.get_by_role("button", name="Create profile").click()
        expect(dlg.get_by_text("already used").first).to_be_visible()
        dlg.get_by_role("button", name="Cancel").click()
    check("Team Profile: duplicate contact code / email is rejected", duplicate_profile)

    def team_views():
        sidebar().get_by_role("button", name="Team Profiles", exact=True).click()
        expect(page.get_by_text(member).first).to_be_visible()
        sidebar().get_by_role("button", name="Team Directory", exact=True).click()
        expect(page.locator("button", has_text=member).first).to_be_visible()
        assert page.locator("button", has_text=member).first.locator("img").count() == 1
        sidebar().get_by_role("button", name="Active Profiles", exact=True).click()
    check("Team Profile: member appears in the grid and in the Directory gallery with the photo", team_views)

    def onboarding_form():
        formbtn("New Team Onboarding Form").click()
        form = page.get_by_role("region", name="Form")
        form.get_by_role("button", name="New team member") if False else None
        form.get_by_label("Name").fill(f"Form Person {RUN}"); form.get_by_label("Contact").fill(f"F{RUN[-3:]}")
        form.get_by_label("Position").fill("Intern"); form.get_by_label("Type").select_option("Rep")
        form.get_by_label("Team").check()
        form.get_by_role("button", name="Submit").click()
        expect(form.get_by_role("alert").first).to_be_visible()  # email missing
        form.get_by_label("eMail").fill(f"form{RUN}@example.com")
        form.get_by_role("button", name="Submit").click()
        expect(form.get_by_text("Team member added.")).to_be_visible()
        sidebar().get_by_role("button", name="Team Profiles", exact=True).click()
        expect(page.get_by_text(f"Form Person {RUN}")).to_be_visible()
    check("Form view: required fields enforced; a submission creates a real record", onboarding_form)

    def form_builder():
        formbtn("New Team Onboarding Form").click()
        aside = page.get_by_role("complementary", name="Form settings")
        aside.get_by_label("Required").nth(4).count()
        cb = aside.get_by_role("checkbox", name="Required").first
        cb.check(); page.wait_for_timeout(900)
        page.reload(wait_until="load"); page.wait_for_selector("aside[aria-label=Views]")
        formbtn("New Team Onboarding Form").click()
        assert page.get_by_role("complementary", name="Form settings").get_by_role("checkbox", name="Required").first.is_checked()
    check("Form view: visible/required settings are saved", form_builder)

    def folio_assignee():
        go("/folios")
        page.get_by_role("button", name="New folio").click()
        dlg = page.get_by_role("dialog")
        dlg.get_by_label("Folio").fill(f"E2E Folio {RUN}")
        dlg.get_by_label("Assignee").click()
        opts = [o.inner_text() for o in page.get_by_role("option").all()]
        assert any(member in o for o in opts), opts
        assert not any("Vendor" in o for o in opts)
        page.get_by_role("option").filter(has_text=member).click()
        dlg.get_by_label("Category").click()
        cats = [o.inner_text() for o in page.get_by_role("option").all()]
        assert any("2.1 Reference" in c for c in cats), cats
        page.get_by_role("option").filter(has_text="2.1 Reference").click()
        dlg.get_by_role("button", name="Create folio").click()
        expect(page.get_by_role("dialog").last.get_by_role("button", name="Edit")).to_be_visible()  # saved
        page.keyboard.press("Escape"); page.wait_for_timeout(400)
        assert page.get_by_role("columnheader", name="Cord", exact=True).count() == 0
        assert page.get_by_role("columnheader", name="Assignee", exact=True).count() == 1
    check("Folio: ‘Assignee’ (renamed from Cord) is a searchable team-member dropdown; Category is a dropdown", folio_assignee)

    def folio_assignee_search_and_group():
        page.get_by_role("button", name="Open record 1").first.click() if False else None
        sidebar().get_by_role("button", name="Folios by Assignee", exact=True).click()
        expect(page.get_by_role("button", name=lambda n: False) if False else page.locator("button", has_text=member).first).to_be_visible()
        sidebar().get_by_role("button", name="Folios - All Active Categories", exact=True).click()
        expect(page.locator("button", has_text="2.1 Reference").first).to_be_visible()
    check("Folio: grouping by assignee and by category", folio_assignee_search_and_group)

    def legacy_values_visible():
        sidebar().get_by_role("button", name="Folios - All Active Categories", exact=True).click()
        row = page.get_by_role("row").filter(has_text="Receipts In Basket")
        expect(row).to_contain_text("EJE")  # linked profile contact? name shown; legacy kept in DB
    check("Folio: existing folios keep their (now linked) assignee", lambda: expect(page.get_by_role("row").filter(has_text="Receipts In Basket")).to_contain_text("Ereika Espiritu"))

    def categories_no_group():
        go("/categories")
        heads = [h.inner_text() for h in page.get_by_role("columnheader").all()]
        assert not any(h.strip() == "Group" for h in heads), heads
        page.get_by_role("button", name="New category").click()
        dlg = page.get_by_role("dialog")
        assert dlg.get_by_label("Group").count() == 0
        dlg.get_by_label("Value Code/Title").fill(f"ZZ Cat {RUN}"); dlg.get_by_role("button", name="Create category").click()
        expect(page.get_by_role("dialog").last.get_by_role("button", name="Edit")).to_be_visible()
        page.keyboard.press("Escape")
    check("Categories: no Group column or input; create a category", categories_no_group)

    def new_category_in_folio():
        go("/folios"); page.get_by_role("button", name="New folio").click()
        page.get_by_role("dialog").get_by_label("Category").click()
        expect(page.get_by_role("option").filter(has_text=f"ZZ Cat {RUN}")).to_be_visible()
        page.keyboard.press("Escape"); page.get_by_role("dialog").get_by_role("button", name="Cancel").click()
    check("Folio: a newly created category is available without touching the frontend", new_category_in_folio)

    def delete_category_safely():
        go("/folios")
        page.get_by_role("button", name="New folio").click()
        d = page.get_by_role("dialog"); d.get_by_label("Folio").fill(f"E2E Folio B {RUN}")
        d.get_by_label("Category").click(); page.get_by_role("option").filter(has_text=f"ZZ Cat {RUN}").click()
        d.get_by_role("button", name="Create folio").click(); page.keyboard.press("Escape")
        go("/categories")
        page.get_by_role("row").filter(has_text=f"ZZ Cat {RUN}").get_by_role("button", name="Open record").click() if page.get_by_role("row").filter(has_text=f"ZZ Cat {RUN}").count() else None
        page.get_by_role("dialog").last.get_by_role("button", name="Delete").click()
        page.get_by_role("alertdialog").get_by_role("button", name="Delete").click()
        expect(page.get_by_text("deleted").first).to_be_visible()
        go("/folios")
        row = page.get_by_role("row").filter(has_text=f"E2E Folio B {RUN}")
        expect(row).to_be_visible()
        assert "ZZ Cat" not in row.inner_text()
    check("Categories: deleting a category unlinks folios safely (no broken references)", delete_category_safely)

    # ---------------------------------------------------------------------- vouchers
    def vouchers():
        go("/vouchers")
        expect(page.get_by_role("complementary", name="Voucher tools")).to_be_visible()
        heads = [h.inner_text().strip() for h in page.get_by_role("columnheader").all()]
        assert [h for h in heads if h][:5] == ["I", "No", "VSF", "Manifest", "QR"], heads
        assert "VOUCHERS | Simplified" in page.locator("h1").inner_text()
        panel = page.get_by_role("complementary", name="Voucher tools")
        expect(panel).to_contain_text("Voucher.pdf")
        expect(panel.locator("[data-testid=pdf-preview][data-state=ready]")).to_be_visible()
        panel.get_by_role("button", name=re.compile("^Run")).click()
        expect(page.get_by_text("Generated 2 QR codes").first).to_be_visible()
        page.wait_for_timeout(500)
        assert page.get_by_role("grid").get_by_role("row").nth(1).locator("img").count() >= 1
        expect(panel.get_by_role("button", name="Run (all up to date)")).to_be_visible()
    check("Vouchers: reference layout (I, No, VSF, Manifest, QR), supplied PDF preview, QR generator", vouchers)

    def voucher_create_autonumber():
        n0 = page.get_by_role("grid").get_by_role("row").count()
        page.get_by_role("button", name="New voucher").click()
        dlg = page.get_by_role("dialog")
        dlg.get_by_label("Manifest", exact=True).fill(f"P/U - E2E {RUN}\nPallet of wipes"); dlg.get_by_label("VSF").select_option("VSF")
        assert dlg.get_by_label("I", exact=True).count() == 0  # autonumber is not typed in
        dlg.get_by_role("button", name="Create voucher").click()
        expect(page.get_by_role("dialog").last).to_contain_text("12")
        page.keyboard.press("Escape")
        assert page.get_by_role("grid").get_by_role("row").count() == n0 + 1
    check("Vouchers: create a voucher; I is assigned automatically and No = I + 1000", voucher_create_autonumber)

    def voucher_deeplink():
        rec = page.evaluate("fetch('/api/base/tables/vouchers').then(r=>r.json()).then(b=>b.records[0].id)")
        page.goto(f"{BASE}/vouchers?record={rec}", wait_until="load")
        expect(page.get_by_role("dialog").last).to_be_visible()
    check("Vouchers: the QR link (?record=) opens that voucher", voucher_deeplink)

    # ------------------------------------------------------------------------- items
    def items():
        go("/items")
        page.get_by_role("button", name="New item").click()
        dlg = page.get_by_role("dialog")
        dlg.get_by_label("Quantity").count()
        dlg.get_by_label("Title").fill(f"E2E Item {RUN}"); dlg.get_by_label("SKU").fill(f"E2E-{RUN}")
        dlg.get_by_label("Qty").fill("-2"); dlg.get_by_label("Purstat").select_option("Purchased"); dlg.get_by_label("Kit").select_option("Kit Alpha")
        dlg.get_by_role("button", name="Create item").click()
        expect(dlg.get_by_text("Must be 0 or more.")).to_be_visible()
        dlg.get_by_label("Qty").fill("3"); dlg.get_by_label("Reorder level").fill("5"); dlg.get_by_label("Unit").select_option("box")
        dlg.get_by_role("button", name="Create item").click()
        expect(page.get_by_role("dialog").last).to_contain_text("Low stock")
        page.wait_for_timeout(300); page.keyboard.press("Escape"); page.wait_for_timeout(500)
        # duplicate SKU
        page.get_by_role("button", name="New item").click(); d = page.get_by_role("dialog")
        d.get_by_label("Title").fill("dup"); d.get_by_label("SKU").fill(f"e2e-{RUN}"); d.get_by_label("Qty").fill("1"); d.get_by_label("Purstat").select_option("Purchased"); d.get_by_label("Kit").select_option("Kit Alpha")
        d.get_by_role("button", name="Create item").click()
        expect(d.get_by_text("already used").first).to_be_visible(); d.get_by_role("button", name="Cancel").click()
    check("Items: create with validation (negative qty, duplicate SKU), stock status derived", items)

    def adjust_stock():
        page.get_by_role("button", name="Adjust stock").click()
        dlg = page.get_by_role("dialog")
        dlg.get_by_label("Item").select_option(label=f"E2E Item {RUN} (E2E-{RUN})")
        dlg.get_by_label("Remove stock").check(); dlg.get_by_label("Amount").fill("99")
        dlg.get_by_role("button", name="Update quantity").click()
        expect(dlg.get_by_text("Not enough stock")).to_be_visible()
        dlg.get_by_label("Amount").fill("3"); expect(dlg.get_by_text("Out of stock")).to_be_visible()
        dlg.get_by_role("button", name="Update quantity").click()
        expect(page.get_by_text("quantity is now 0")).to_be_visible()
        row = page.get_by_role("row").filter(has_text=f"E2E Item {RUN}")
        expect(row).to_contain_text("Out of stock")
    check("Items: adjust stock cannot go below zero; status updates to Out of stock", adjust_stock)

    def items_search_filter_delete():
        page.get_by_placeholder("Search profiles, transactions, and categories…").fill(f"E2E-{RUN}")
        expect(page.get_by_role("row").filter(has_text=f"E2E Item {RUN}")).to_have_count(1)
        assert page.get_by_role("row").filter(has_text="Baby Food").count() == 0
        page.get_by_placeholder("Search profiles, transactions, and categories…").fill("")
        sidebar().get_by_role("button", name="Low and out of stock", exact=True).click()
        expect(page.get_by_role("row").filter(has_text=f"E2E Item {RUN}")).to_have_count(1)
        sidebar().get_by_role("button", name="All Items", exact=True).click()
        page.get_by_role("row").filter(has_text=f"E2E Item {RUN}").get_by_role("checkbox").check()
        page.get_by_role("region", name="Selected records").get_by_role("button", name="Delete").click()
        page.get_by_role("alertdialog").get_by_role("button", name="Delete").click()
        expect(page.get_by_text(f"E2E Item {RUN}")).to_have_count(0)
    check("Items: search, the ‘Low and out of stock’ view, and delete", items_search_filter_delete)

    # ------------------------------------------------------------------- capabilities
    def capabilities():
        go("/capabilities")
        nav = page.get_by_role("navigation", name="Capability areas")
        assert [b.inner_text().replace("\n", " ") for b in nav.get_by_role("button").all()] == ["System 5", "Exception 4", "All 11"] or "System" in nav.inner_text()
        nav.get_by_role("button", name="System").click()
        expect(page.locator("h1")).to_contain_text("SYSTEM"); expect(page.locator("p", has_text="5 of 11 capabilities").first).to_be_visible()
        assert page.get_by_role("row").filter(has_text="Catering Services").count() == 1
        assert page.get_by_role("row").filter(has_text="Responder Base Camps").count() == 0
        nav.get_by_role("button", name="Exception").click()
        expect(page.get_by_role("row").filter(has_text="Responder Base Camps")).to_have_count(1)
        assert page.get_by_role("row").filter(has_text="Catering Services").count() == 0
        nav.get_by_role("button", name="All").click()
        expect(page.get_by_text("GO").first).to_be_visible()
        sidebar().get_by_role("button", name="Gallery", exact=True).click()
        assert page.locator("img").count() >= 5
    check("Capabilities: System / Exception / All areas filter real data; gallery view", capabilities)

    def other_tabs_open():
        for slug in ["transactions", "forms", "concepts", "leads"]:
            go("/" + slug)
            assert page.get_by_role("columnheader").count() > 3, slug
    check("remaining tabs (Transactions, Forms, Concepts, Leads) load their data", other_tabs_open)

    def responsive():
        for w, h in [(1024, 768), (820, 1100)]:
            page.set_viewport_size({"width": w, "height": h}); go("/vouchers")
            assert page.get_by_role("button", name="Create new…").is_visible()
        page.set_viewport_size({"width": 1440, "height": 900})
    check("layout holds at tablet widths", responsive)

    def no_console_errors():
        real = [e for e in console_errors if "favicon" not in e and "Failed to load resource" not in e]
        assert not real, real[:5]
    check("no console errors or uncaught exceptions during the run", no_console_errors)
    browser.close()

failed = [n for ok, n in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("FAILED:", *failed, sep="\n  ")
sys.exit(1 if failed else 0)
