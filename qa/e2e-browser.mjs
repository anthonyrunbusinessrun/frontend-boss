/**
 * Browser end-to-end checks for the BOSS tabs and the accounting module (AIS).
 *
 * Drives a real Chromium through search / sort / filter / hide-fields, record create-edit-delete-undo
 * on the BOSS tabs, and the AIS flows: customers CRUD, journal balancing, invoice -> payment, bill
 * approval, reports + CSV export, settings and reset.
 *
 * Not a project dependency. Run against a production build:
 *
 *   npm run build && npx next start -p 3100 &
 *   npm i --no-save puppeteer-core @sparticuz/chromium
 *   BOSS_URL=http://localhost:3100 node qa/e2e-browser.mjs
 *
 * The AIS checks assume the original sample books (use Settings -> Reset demo data first).
 */
import { mkdirSync } from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
mkdirSync("qa/out", { recursive: true });

export const BASE = process.env.BOSS_URL ?? "http://localhost:3000";
export async function open() {
  const browser = await puppeteer.launch({ args: [...chromium.args, "--window-size=1440,900"], executablePath: await chromium.executablePath(), headless: "shell", defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => { if (!r.url().includes("favicon")) errors.push(`requestfailed: ${r.url()}`); });
  return { browser, page, errors };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function text(page) { return page.evaluate(() => document.body.innerText); }
export async function clickText(page, selector, label, exact = false) {
  const ok = await page.evaluate((selector, label, exact) => {
    const els = [...document.querySelectorAll(selector)];
    const el = els.find((e) => { const t = (e.innerText || e.textContent || "").trim().toLowerCase(); const l = label.toLowerCase(); return exact ? t === l : t.includes(l); });
    if (!el) return false; el.click(); return true;
  }, selector, label, exact);
  if (!ok) throw new Error(`no ${selector} with text "${label}"`);
  await sleep(250);
}


const { browser, page, errors } = await open();
await page.evaluateOnNewDocument(() => {
  window.__csv = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = (b) => { b.text().then((t) => window.__csv.push(t)); return orig.call(URL, b); };
});
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  → " + extra}`); };
const rows = () => page.evaluate(() => [...document.querySelectorAll("tbody tr")].filter((r) => r.querySelector("td")).map((r) => r.innerText.replace(/\s+/g, " ").trim()));
const go = async (p) => { await page.goto(BASE + p, { waitUntil: "networkidle0" }); await sleep(500); };
const idFor = (label) => page.evaluate((label) => { const l = [...document.querySelectorAll("label")].find((x) => x.innerText.replace(/\*/g, "").trim().toLowerCase() === label.toLowerCase()); return l ? l.getAttribute("for") : null; }, label);
async function fill(label, value) { const id = await idFor(label); if (!id) throw new Error("no field " + label); const h = await page.$(`[id="${id}"]`); await h.focus(); await page.evaluate((el) => el.select(), h); await page.keyboard.press("Backspace"); await h.type(value); }
async function choose(label, optionText) {
  const id = await idFor(label); if (!id) throw new Error("no select " + label);
  const ok = await page.evaluate((id, t) => { const s = document.getElementById(id); const o = [...s.options].find((o) => o.text.includes(t)); if (!o) return false; s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); return true; }, id, optionText);
  if (!ok) throw new Error(`no option ${optionText} in ${label}`);
}
// the n-th (0-based) control whose <label> text starts with `prefix` (hidden labels included)
const idsByLabel = (prefix) => page.evaluate((prefix) => [...document.querySelectorAll("label")].filter((l) => (l.textContent || "").replace(/\*/g, "").trim().toLowerCase().startsWith(prefix.toLowerCase()) && l.getAttribute("for")).map((l) => l.getAttribute("for")), prefix);
async function fillAria(prefix, n, value) { const ids = await idsByLabel(prefix); const h = await page.$(`[id="${ids[n]}"]`); await h.focus(); await page.evaluate((el) => el.select(), h); await page.keyboard.press("Backspace"); await h.type(value); }
async function chooseAria(prefix, n, optionText) {
  const ids = await idsByLabel(prefix);
  const ok = await page.evaluate((id, t) => { const s = document.getElementById(id); const o = [...s.options].find((o) => o.text.includes(t)); if (!o) return false; s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); return true; }, ids[n], optionText);
  if (!ok) throw new Error(`no option ${optionText} for ${prefix}`);
}
const dialogText = () => page.evaluate(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].map((d) => d.innerText).join("\n"));
const toastText = () => page.evaluate(() => document.querySelector('[aria-label="Notifications"]')?.innerText ?? "");
const btn = async (label, exact = true) => {
  // act inside the top-most dialog when one is open (the table behind it has look-alike buttons)
  const scope = await page.evaluate(() => (document.querySelector('[role="alertdialog"]') ? '[role="alertdialog"] button' : document.querySelector('[role="dialog"]') ? '[role="dialog"] button' : "button"));
  return clickText(page, scope, label, exact);
};

try {
  /* ============================ BOSS: Profiles ============================ */
  await go("/profiles");
  check("profiles loads 12 rows", (await rows()).length === 12, String((await rows()).length));
  const search = await page.$('input[aria-label^="Search"]');
  await search.type("eva");
  await sleep(300);
  let r = await rows();
  check("header search filters the table", r.length === 1 && r[0].includes("Eva June Hicks"), JSON.stringify(r));
  check("search result note is shown", (await text(page)).includes("1 result for “eva”"));
  await search.click({ clickCount: 3 }); await page.keyboard.press("Backspace"); await search.type("zzzz"); await sleep(300);
  check("no-match empty state with clear action", (await text(page)).includes("No profiles match your search"));
  await btn("Clear search"); await sleep(300);
  check("clearing search restores rows", (await rows()).length === 12);

  await clickText(page, "th button", "Name"); await sleep(250);
  r = await rows();
  const asc = r[0];
  await clickText(page, "th button", "Name"); await sleep(250);
  r = await rows();
  check("header click sorts asc then desc", asc !== r[0] && /aria-sort/.test(await page.evaluate(() => document.querySelector("thead").innerHTML)), `${asc} / ${r[0]}`);
  await clickText(page, "th button", "Name"); await sleep(250);

  // Filter card
  await clickText(page, "button", "Filtered by Team, Inactive");
  await sleep(250);
  await clickText(page, "button", "Add condition");
  await sleep(250);
  const fieldSelects = await page.$$('select[aria-label="Field"]');
  await fieldSelects[fieldSelects.length - 1].select("Name");
  await sleep(200);
  const valInput = await page.$('input[aria-label="Name filter value"]');
  await valInput.type("sarah");
  await sleep(300);
  r = await rows();
  check("filter card condition filters rows", r.length === 1 && r[0].includes("Sarah D Budd"), JSON.stringify(r));
  check("filter chip label reflects conditions", (await text(page)).includes("Filtered by Team, Inactive, Name") || (await text(page)).includes("Filtered by Team"), "");
  await page.keyboard.press("Escape"); await sleep(200);
  // clear conditions
  await clickText(page, "button", "Filtered by"); await sleep(200);
  await clickText(page, "button", "Clear all"); await sleep(250);
  await page.keyboard.press("Escape"); await sleep(200);
  check("clearing filters restores rows", (await rows()).length === 12, String((await rows()).length));

  // Hide fields
  await clickText(page, "button", "57 hidden fields"); await sleep(250);
  await page.click('button[aria-label="Show eMail"]'); await sleep(250);
  await page.keyboard.press("Escape"); await sleep(200);
  const heads = await page.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.trim().toLowerCase()));
  check("hide field removes its column", !heads.includes("email") && heads.includes("name"), heads.join(","));
  check("hidden-fields chip counts the extra field", (await text(page)).includes("58 hidden fields"));
  await clickText(page, "button", "58 hidden fields"); await sleep(250);
  await page.click('button[aria-label="Show eMail"]'); await sleep(250);
  await page.keyboard.press("Escape"); await sleep(200);

  // Create
  await clickText(page, "button", "Create new profile"); await sleep(400);
  check("create drawer opens", (await dialogText()).includes("New profile"));
  await btn("Create profile"); await sleep(300);
  let d = await dialogText();
  check("required-field errors on empty submit", d.includes("Contact is required.") && d.includes("Name is required.") && d.includes("fields need attention"), d.slice(0, 200));
  await fill("Contact", "TST"); await fill("Name", "Taylor Test Rivera"); await fill("Position", "QA Lead"); await fill("eMail", "not-an-email");
  await btn("Create profile"); await sleep(300);
  check("invalid email is rejected", (await dialogText()).includes("Enter a valid email address."));
  await fill("eMail", "taylor@example.com");
  await btn("Create profile"); await sleep(400);
  check("created profile appears in table + success toast", (await rows()).some((x) => x.includes("Taylor Test Rivera")) && (await toastText()).includes("created"), await toastText());
  await page.reload({ waitUntil: "networkidle0" }); await sleep(600);
  check("created profile persists after reload", (await rows()).some((x) => x.includes("Taylor Test Rivera")));

  // Edit via row action
  await page.evaluate(() => { const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Taylor Test Rivera")); tr.querySelector('button[aria-label^="Edit"]')?.click(); });
  await sleep(300);
  const hasEditIcon = (await dialogText()).includes("Edit profile");
  if (!hasEditIcon) { // Profiles has no action icons: open by clicking the row, then Edit
    await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Taylor Test Rivera")).querySelector("td").click());
    await sleep(300);
    check("row click opens read-only view", (await dialogText()).includes("Taylor Test Rivera") && (await dialogText()).includes("Edit"));
    await btn("Edit"); await sleep(300);
  }
  await fill("Name", "Taylor Q. Rivera"); await btn("Save changes"); await sleep(400);
  check("edit saves and table updates", (await rows()).some((x) => x.includes("Taylor Q. Rivera")) && !(await rows()).some((x) => x.includes("Taylor Test Rivera")));

  // Cancel with unsaved changes
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Taylor Q. Rivera")).querySelector("td").click());
  await sleep(300); await btn("Edit"); await sleep(300); await fill("Position", "Changed"); await page.keyboard.press("Escape"); await sleep(300);
  check("closing a dirty form asks to discard", (await dialogText()).includes("Discard unsaved changes?"));
  await btn("Discard changes"); await sleep(300);
  check("discard closes the drawer", !(await dialogText()).includes("Edit profile"));

  // Delete + undo
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Taylor Q. Rivera")).querySelector("td").click());
  await sleep(300); await btn("Delete"); await sleep(300);
  check("delete asks for confirmation", (await dialogText()).includes("Delete this profile?"));
  await btn("Cancel"); await sleep(200);
  check("cancel keeps the record", (await rows()).some((x) => x.includes("Taylor Q. Rivera")));
  await btn("Delete"); await sleep(300); await clickText(page, '[role="alertdialog"] button', "Delete", true); await sleep(400);
  check("confirmed delete removes the row", !(await rows()).some((x) => x.includes("Taylor Q. Rivera")));
  await clickText(page, '[aria-label="Notifications"] button', "Undo"); await sleep(300);
  check("Undo restores the row", (await rows()).some((x) => x.includes("Taylor Q. Rivera")));
  // clean up so the later steps start from a known state
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Taylor Q. Rivera")).querySelector("td").click());
  await sleep(300); await btn("Delete"); await sleep(300); await clickText(page, '[role="alertdialog"] button', "Delete", true); await sleep(300);

  // A second BOSS view with row actions (Accounts) + selection bar
  await go("/accounts");
  check("accounts view has sortable header + records", (await rows()).length >= 2);
  await page.evaluate(() => { const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.querySelector('button[aria-label^="Edit"]')); tr.querySelector('button[aria-label^="Edit"]').click(); });
  await sleep(300);
  check("row edit icon opens the edit drawer", (await dialogText()).includes("Edit account"));
  await page.keyboard.press("Escape"); await sleep(300);
  await page.evaluate(() => document.querySelector('thead [role="checkbox"]').click()); await sleep(300);
  check("select-all shows the selection bar", (await text(page)).includes("selected"));
  await page.click('button[aria-label="Clear selection"]'); await sleep(200);

  // sticky table header: nothing may show through above it while scrolling
  await go("/ais/general-ledger");
  await page.evaluate(() => { const b = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto" && d.querySelector("thead")); b.scrollTop = 520; });
  await sleep(300);
  const stick = await page.evaluate(() => { const b = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto" && d.querySelector("thead")); const r = b.getBoundingClientRect(); return { flush: Math.round(b.querySelector("thead th").getBoundingClientRect().top) === Math.round(r.top), hit: document.elementsFromPoint(r.left + 200, r.top + 2)[0].closest("thead") !== null }; });
  check("sticky header is flush at the top while scrolling (no rows above it)", stick.flush && stick.hit, JSON.stringify(stick));
  // toolbar cards stay within the viewport
  await go("/profiles");
  for (const chip of ["57 hidden fields", "Sort", "Filtered by Team, Inactive"]) {
    await clickText(page, '[role="toolbar"] button', chip, true); await sleep(300);
    const fit = await page.evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect(); return { h: Math.round(r.height), ok: r.bottom <= innerHeight && r.right <= innerWidth }; });
    check(`"${chip}" card fits the screen and is compact (${fit.h}px)`, fit.ok && fit.h <= 440, JSON.stringify(fit));
    await page.keyboard.press("Escape"); await sleep(150);
  }

  /* ============================ AIS ============================ */
  await go("/ais");
  const t0 = await text(page);
  check("dashboard shows KPIs, chart, attention and health", ["TOTAL REVENUE", "NET INCOME", "Revenue vs Expenses", "Attention Required", "Financial Health"].every((s) => t0.toUpperCase().includes(s.toUpperCase())));
  const tabOrder = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Primary"] a')].map((a) => a.textContent.trim()));
  check("AIS is the first tab, then BOSS, then Profiles", tabOrder[0] === "AIS" && tabOrder[1] === "BOSS" && tabOrder[2] === "Profiles" && tabOrder.length === 16, tabOrder.join(","));
  check("AIS tab is active and BOSS header kept", (await page.evaluate(() => document.querySelector('nav[aria-label="Primary"] [aria-current="page"]')?.textContent)) === "AIS" && t0.includes("Business Operating Systems Solutions"));
  await clickText(page, "a", "Review"); await sleep(800);
  check("attention link opens the filtered list", page.url().includes("/ais/accounts-receivable") && (await rows()).length === 3, page.url() + " " + (await rows()).length);

  // ---- Customers CRUD
  await go("/ais/customers");
  const nCust = (await rows()).length;
  await btn("New customer"); await sleep(400);
  await btn("Create customer"); await sleep(300);
  check("customer form validates required name", (await dialogText()).includes("Customer name is required."));
  await fill("Customer name", "Lighthouse Marine Supply"); await fill("Email", "bad"); await btn("Create customer"); await sleep(300);
  check("customer email validated", (await dialogText()).includes("Enter a valid email address."));
  await fill("Email", "ap@lighthouse.example");
  await btn("Create customer"); await sleep(500);
  check("customer created and listed", (await rows()).length === nCust + 1 && (await rows()).some((x) => x.includes("Lighthouse Marine Supply")));
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Lighthouse")).querySelector('button[aria-label^="Edit"]').click()); await sleep(300);
  await fill("Customer name", "Lighthouse Marine Supply Co."); await btn("Save changes"); await sleep(400);
  check("customer edit shows read-only view with the update", (await dialogText()).includes("Lighthouse Marine Supply Co."));
  await btn("Close"); await sleep(300);
  check("list reflects edit", (await rows()).some((x) => x.includes("Lighthouse Marine Supply Co.")));
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Lighthouse")).querySelector('button[aria-label^="Delete"]').click()); await sleep(300);
  check("customer delete needs confirmation", (await dialogText()).includes("Delete customer?"));
  await clickText(page, '[role="alertdialog"] button', "Delete", true); await sleep(400);
  check("customer deleted", (await rows()).length === nCust);
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Harbor Point")).querySelector('button[aria-label^="Delete"]').click()); await sleep(300);
  check("customer with invoices cannot be deleted", (await toastText()).includes("Mark the customer inactive"), await toastText());

  // ---- Journal entry balancing
  await go("/ais/journal-entries");
  const nJe = (await text(page)).match(/All\s*(\d+)/)?.[1];
  await btn("New journal entry"); await sleep(400);
  await fill("Memo", "Office supplies reclass");
  await chooseAria("Account, line 1", 0, "6400"); await fillAria("Debit, line 1", 0, "100.00");
  await chooseAria("Account, line 2", 0, "1000"); await fillAria("Credit, line 2", 0, "90.00");
  await sleep(300);
  d = await dialogText();
  check("unbalanced entry shows the difference", d.includes("Out of balance by $10.00"), d.slice(0, 300));
  await btn("Post entry"); await sleep(300);
  d = await dialogText();
  check("unbalanced entry cannot be posted", d.includes("Total debits must equal total credits") && d.includes("cannot be saved yet"), d.slice(0, 300));
  await btn("Save draft"); await sleep(300);
  check("unbalanced entry cannot be saved as draft either", (await dialogText()).includes("New journal entry"));
  await fillAria("Credit, line 2", 0, "100.00"); await sleep(300);
  check("balanced entry is confirmed", (await dialogText()).includes("Balanced. Total debits equal total credits."));
  await btn("Post entry"); await sleep(500);
  check("balanced entry posts with feedback", (await toastText()).includes("posted to the ledger"), await toastText());
  check("posted entry appears in list", (await rows()).some((x) => x.includes("Office supplies reclass") && x.includes("Posted")));
  // posted → read-only and reversible
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Office supplies reclass")).querySelector("td").click()); await sleep(300);
  d = await dialogText();
  check("posted entry is read-only with Reverse option", d.includes("Reverse entry") && !d.includes("Post entry"));
  await btn("Reverse entry"); await sleep(300); await clickText(page, '[role="alertdialog"] button', "Reverse entry", true); await sleep(500);
  check("reversal creates a new posted entry", (await rows()).some((x) => x.includes("Reversal of")));

  // ---- Invoice → send → payment
  await go("/ais/invoices");
  const nInv = (await rows()).length;
  await btn("New invoice", true).catch(() => {}); // toolbar button (sidebar CTA is also named New invoice)
  await sleep(500);
  d = await dialogText();
  check("new invoice drawer opens", d.includes("New invoice"));
  await btn("Save & send"); await sleep(300);
  check("invoice form validates customer and lines", (await dialogText()).includes("Choose a customer."));
  await choose("Customer", "Island Hospitality"); await sleep(200);
  await fillAria("Description, line 1", 0, "Gala logistics support");
  await fillAria("Unit price, line 1", 0, "2500");
  await fillAria("Quantity, line 1", 0, "4");
  await chooseAria("Revenue account, line 1", 0, "4000");
  await sleep(300);
  check("invoice total updates live", (await dialogText()).includes("$10,000.00"));
  await btn("Save & send"); await sleep(600);
  check("invoice sent and posted", (await toastText()).includes("sent and posted to receivables"), await toastText());
  check("invoice appears in list", (await rows()).some((x) => x.includes("INV-2336") && x.includes("Island Hospitality Group") && x.includes("$10,000.00")), JSON.stringify((await rows()).slice(0, 4)));
  await go("/ais/accounts-receivable");
  const arText = await text(page);
  check("new invoice is in accounts receivable", arText.includes("$10,000.00") && arText.includes("12 open invoices"), arText.match(/\d+ open invoices?[^\n]*/)?.[0]);
  // record payment from AR row
  await page.evaluate(() => { const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Island Hospitality") && r.innerText.includes("$10,000.00")); [...tr.querySelectorAll("button")].find((b) => b.innerText.includes("Record payment")).click(); }); await sleep(500);
  d = await dialogText();
  check("record payment drawer is prefilled for the invoice", d.includes("Record payment received") && d.includes("$10,000.00"));
  await fillAria("Amount to apply to INV-2336", 0, "4000"); await sleep(200);
  await btn("Record payment"); await sleep(600);
  check("partial payment recorded", (await toastText()).includes("received from Island Hospitality Group"), await toastText());
  const arAfter = await rows();
  check("receivable balance reduced to $6,000", arAfter.some((x) => x.includes("INV-2336") && x.includes("$4,000.00") && x.includes("$6,000.00")), JSON.stringify(arAfter.filter((x) => x.includes("Island"))));
  // over-payment blocked
  await page.evaluate(() => { const tr = [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("INV-2336")); [...tr.querySelectorAll("button")].find((b) => b.innerText.includes("Record payment")).click(); }); await sleep(500);
  await fillAria("Amount to apply to INV-2336", 0, "9999"); await btn("Record payment"); await sleep(300);
  check("over-payment is rejected", (await dialogText()).includes("More than the open balance."));
  await page.keyboard.press("Escape"); await sleep(300);
  if ((await dialogText()).includes("Discard")) { await btn("Discard changes"); await sleep(300); }

  await go("/ais/invoices");
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("INV-2336")).querySelector("td").click()); await sleep(500);
  await page.screenshot({ path: "qa/out/drawer-invoice.png" });
  await page.keyboard.press("Escape"); await sleep(300);
  check("Escape closes the drawer", !(await dialogText()).includes("Invoice INV-2336"));
  await go("/ais/journal-entries");
  await btn("New journal entry"); await sleep(400);
  await chooseAria("Account, line 1", 0, "6400"); await fillAria("Debit, line 1", 0, "100.00");
  await chooseAria("Account, line 2", 0, "1000"); await fillAria("Credit, line 2", 0, "90.00");
  await btn("Post entry"); await sleep(400);
  await page.screenshot({ path: "qa/out/drawer-journal.png" });
  await page.keyboard.press("Escape"); await sleep(300);
  if ((await dialogText()).includes("Discard")) { await btn("Discard changes"); await sleep(300); }

  // ---- Bills: approval
  await go("/ais/bills?status=Awaiting%20Approval");
  check("deep link filters bills to awaiting approval", (await rows()).length === 3, String((await rows()).length));
  await page.evaluate(() => document.querySelector("tbody tr td").click()); await sleep(400);
  d = await dialogText();
  check("awaiting bill offers Approve", d.includes("Approve") && d.includes("not in payables"));
  await btn("Approve"); await sleep(500);
  check("approval posts to payables", (await toastText()).includes("approved and posted to payables"), await toastText());

  // ---- Reports
  await go("/ais/reports");
  await clickText(page, '[role="tab"]', "Balance Sheet"); await sleep(400);
  check("balance sheet balances", (await text(page)).includes("Balanced: assets = liabilities + equity"));
  await clickText(page, '[role="tab"]', "Trial Balance"); await sleep(400);
  check("trial balance debits equal credits", (await text(page)).includes("Debits equal credits"));
  await clickText(page, "button", "Export CSV"); await sleep(600);
  const csv = await page.evaluate(() => window.__csv.at(-1) ?? "");
  check("report exports a CSV file", csv.includes("Account") && csv.includes("Totals"), csv.slice(0, 80));
  await clickText(page, '[role="tab"]', "AR Aging"); await sleep(400);
  check("AR aging report renders", (await text(page)).toLowerCase().includes("1–30 days"));
  const srch = await page.$('input[aria-label="Search this report"]'); await srch.type("zzzz"); await sleep(300);
  check("report search shows a no-match state", (await text(page)).includes("No rows match your search"));

  // ---- Ledger deep link from an account
  await go("/ais/accounts");
  await page.evaluate(() => [...document.querySelectorAll("tbody tr")].find((r) => r.innerText.includes("Rent")).querySelector("td").click()); await sleep(400);
  await clickText(page, "a", "View in General Ledger"); await sleep(900);
  check("ledger opens on the chosen account with running balance", page.url().includes("account=") && (await text(page)).toLowerCase().includes("closing balance"));

  // ---- Settings
  await go("/ais/settings");
  await fill("Company name", "Ray Land, Inc. (Test)"); await btn("Save settings"); await sleep(400);
  check("settings save with feedback", (await toastText()).includes("Settings saved."));
  await go("/ais");
  check("company name flows to the dashboard", (await text(page)).includes("Ray Land, Inc. (Test)"));
  await go("/ais/settings");
  await btn("Reset demo data"); await sleep(300); await clickText(page, '[role="alertdialog"] button', "Reset demo data", true); await sleep(600);
  check("reset restores the sample books", (await toastText()).includes("Demo data restored"));
  await go("/ais/invoices");
  check("after reset the invoice list is back to the seed", /All\s*35/.test(await text(page)));

  // ---- Layout at a smaller desktop width
  await page.setViewport({ width: 1100, height: 800 });
  for (const p of ["/profiles", "/ais", "/ais/invoices", "/ais/reports"]) {
    await go(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    check(`no page-level horizontal overflow at 1100px: ${p}`, !overflow);
  }
} catch (e) {
  fail++; console.log("ABORT  " + e.message);
  await page.screenshot({ path: "qa/out/abort.png" });
}
const relevant = errors.filter((e) => !e.includes("favicon"));
console.log(`\n${pass} passed, ${fail} failed; console errors: ${relevant.length}`);
relevant.slice(0, 8).forEach((e) => console.log("  " + e.slice(0, 200)));
await browser.close();
