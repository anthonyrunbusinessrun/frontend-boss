import { addDays } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { buildBillEntry, buildInvoiceEntry, buildPaymentEntry, invoiceTotal } from "@/services/ais/ledger";
import type { Account, AccountType, AisData, Bill, BillLine, Customer, Invoice, InvoiceLine, JournalEntry, PaymentMethod, PaymentTerms, Payment, Vendor } from "@/types/ais";

/**
 * Seed data for the Accounting Information System: one consistent set of books for
 * "Ray Land, Inc." (Apr–Sep 2026). Everything below flows through the same posting
 * functions the UI uses, so the ledger, receivables and payables always agree.
 * Reporting date: 30 Sep 2026.
 */

const TERM_DAYS: Record<PaymentTerms, number> = { "Due on receipt": 0, "Net 15": 15, "Net 30": 30, "Net 45": 45, "Net 60": 60 };

/* ------------------------------ chart of accounts ------------------------------ */

type A = [code: string, name: string, type: AccountType, subtype: string, description: string, contra?: boolean];
const ACCOUNTS: A[] = [
  ["1000", "Cash – Operating", "Asset", "Cash", "Main operating account at First Pacific Bank"],
  ["1010", "Cash – Payroll", "Asset", "Cash", "Payroll funding account"],
  ["1100", "Accounts Receivable", "Asset", "Current Asset", "Amounts owed by customers (control account)"],
  ["1200", "Prepaid Expenses", "Asset", "Current Asset", "Insurance and subscriptions paid in advance"],
  ["1500", "Equipment", "Asset", "Fixed Asset", "Vehicles, racking and office equipment"],
  ["1510", "Accumulated Depreciation", "Asset", "Fixed Asset", "Depreciation taken on equipment", true],
  ["2000", "Accounts Payable", "Liability", "Current Liability", "Amounts owed to vendors (control account)"],
  ["2100", "Accrued Expenses", "Liability", "Current Liability", "Expenses incurred but not yet billed"],
  ["2200", "Payroll Liabilities", "Liability", "Current Liability", "Withholdings and employer taxes payable"],
  ["2500", "Line of Credit", "Liability", "Long-term Liability", "Revolving line of credit"],
  ["3000", "Owner's Equity", "Equity", "Equity", "Capital contributed by the owners"],
  ["3100", "Retained Earnings", "Equity", "Equity", "Accumulated earnings from prior periods"],
  ["4000", "Logistics Services Revenue", "Revenue", "Operating Revenue", "Freight, staging and event logistics"],
  ["4100", "Supply Kit Sales", "Revenue", "Operating Revenue", "Responder, medical and provisioning kits"],
  ["4200", "Consulting Revenue", "Revenue", "Operating Revenue", "Advisory and training engagements"],
  ["5000", "Cost of Goods Sold", "Expense", "Cost of Sales", "Kit components and wholesale purchases"],
  ["5100", "Freight & Subcontractors", "Expense", "Cost of Sales", "Third-party freight and delivery"],
  ["5200", "Contract Labor", "Expense", "Cost of Sales", "Temporary and contract staffing"],
  ["6000", "Salaries & Wages", "Expense", "Operating Expense", "Employee payroll"],
  ["6100", "Payroll Taxes & Benefits", "Expense", "Operating Expense", "Employer taxes and benefits"],
  ["6200", "Rent", "Expense", "Operating Expense", "Warehouse and office rent"],
  ["6300", "Utilities", "Expense", "Operating Expense", "Power, water and telecom"],
  ["6400", "Marketing & Advertising", "Expense", "Operating Expense", "Print, signage and campaigns"],
  ["6500", "Software & Subscriptions", "Expense", "Operating Expense", "Cloud hosting and licences"],
  ["6600", "Professional Fees", "Expense", "Operating Expense", "Accounting and legal"],
  ["6800", "Insurance", "Expense", "Operating Expense", "Property, liability and cargo insurance"],
  ["6900", "Depreciation", "Expense", "Operating Expense", "Depreciation of equipment"],
  ["7000", "Bank Fees & Interest", "Expense", "Other Expense", "Service charges and credit line interest"],
];

const acct = (code: string) => `acct-${code}`;

function buildAccounts(): Account[] {
  return ACCOUNTS.map(([code, name, type, subtype, description, contra]) => ({
    id: acct(code),
    code,
    name,
    type,
    subtype,
    description,
    active: true,
    normalBalance: (type === "Asset" || type === "Expense") !== Boolean(contra) ? "debit" : "credit",
  }));
}

/* ------------------------------ customers & vendors ------------------------------ */

type C = [code: string, name: string, contact: string, email: string, phone: string, address: string, terms: PaymentTerms, limit: number, owner: string, inactive?: boolean];
const CUSTOMERS: C[] = [
  ["C-1001", "Harbor Point Logistics Group", "Marisol Quintanilla", "accounts@harborpointlogistics.example", "(671) 555-0142", "120 Marine Corps Dr, Tamuning, GU 96913", "Net 30", 150000, "EJH"],
  ["C-1002", "Marianas Medical Supply Co.", "Daniel Reyes", "ap@marianasmedical.example", "(671) 555-0117", "88 Army Dr, Barrigada, GU 96913", "Net 30", 100000, "RL3"],
  ["C-1003", "Orion Federal Services LLC", "Janet Okafor", "invoices@orionfederal.example", "(202) 555-0178", "1400 Defense Ave, Arlington, VA 22202", "Net 45", 250000, "JAD"],
  ["C-1004", "Pacific Rim Provisions", "Hiroshi Tanaka", "billing@pacificrimprovisions.example", "(670) 555-0163", "Beach Rd, Garapan, Saipan, MP 96950", "Net 30", 80000, "EJH"],
  ["C-1005", "Island Hospitality Group", "Leilani Cruz", "finance@islandhospitality.example", "(671) 555-0129", "1 Pale San Vitores Rd, Tumon, GU 96913", "Net 15", 60000, "SDB"],
  ["C-1006", "Sandcastle Property Management", "Brian Mendiola", "office@sandcastlepm.example", "(671) 555-0191", "55 Chalan Pasaheru, Tamuning, GU 96913", "Due on receipt", 25000, "AES"],
  ["C-1007", "Blue Reef Marine Services", "Ana Santos", "accounting@bluereefmarine.example", "(671) 555-0108", "Apra Harbor, Piti, GU 96915", "Net 30", 75000, "EJE"],
  ["C-1008", "Northgate Construction Inc.", "Victor Alcantara", "payables@northgateconstruction.example", "(671) 555-0155", "300 Route 16, Dededo, GU 96929", "Net 60", 200000, "RL3"],
  ["C-1009", "Summit Relief Partners", "Grace Hollis", "ap@summitrelief.example", "(415) 555-0136", "500 Market St, San Francisco, CA 94105", "Net 30", 120000, "LFG"],
  ["C-1010", "Coral Bay Education Foundation", "Rosa Villanueva", "admin@coralbayedu.example", "(670) 555-0184", "Capitol Hill Rd, Saipan, MP 96950", "Net 30", 30000, "SDB", true],
];

type V = [code: string, name: string, contact: string, email: string, phone: string, address: string, terms: PaymentTerms, taxId: string, owner: string];
const VENDORS: V[] = [
  ["V-2001", "Pacific Office & Janitorial", "Carla Benavente", "billing@pacificofficejanitorial.example", "(671) 555-0121", "47 Harmon Loop Rd, Dededo, GU 96929", "Net 30", "66-0412881", "AES"],
  ["V-2002", "Islandwide Freight Forwarders", "Tomas Aguon", "ar@islandwidefreight.example", "(671) 555-0166", "Cabras Island Rd, Piti, GU 96915", "Net 30", "66-0537204", "JAD"],
  ["V-2003", "Reef Cloud Hosting", "Priya Nair", "invoices@reefcloud.example", "(808) 555-0149", "1001 Bishop St, Honolulu, HI 96813", "Net 15", "99-3318420", "JWO"],
  ["V-2004", "Territorial Utilities Co.", "Billing Department", "customercare@territorialutilities.example", "(671) 555-0100", "590 S Marine Corps Dr, Tamuning, GU 96913", "Net 15", "66-0200317", "EJE"],
  ["V-2005", "Delgado & Park CPAs", "Eunice Park", "accounts@delgadopark.example", "(671) 555-0187", "Suite 400, 210 Archbishop Flores St, Hagåtña, GU 96910", "Net 30", "66-0609955", "EJE"],
  ["V-2006", "Coastal Insurance Brokers", "Mark Leon Guerrero", "premiums@coastalinsurance.example", "(671) 555-0133", "Tumon Bay Plaza, Tumon, GU 96913", "Net 30", "66-0488102", "RL3"],
  ["V-2007", "Meridian Print & Signage", "Kenji Aoki", "orders@meridianprint.example", "(671) 555-0172", "14 Aspinall Ave, Hagåtña, GU 96910", "Net 30", "66-0721340", "AES"],
  ["V-2008", "Tropic Staffing Solutions", "Dolores Camacho", "ar@tropicstaffing.example", "(671) 555-0159", "Suite 12, 33 Chalan San Antonio, Tamuning, GU 96913", "Net 30", "66-0390776", "SDB"],
  ["V-2009", "Lagoon Properties LLC", "Reggie Taitano", "rent@lagoonproperties.example", "(671) 555-0114", "9 Ypao Rd, Tamuning, GU 96913", "Due on receipt", "66-0155230", "RL3"],
  ["V-2010", "Pacific Provisioning Wholesale", "Nina Salas", "ar@pacificprovisioning.example", "(671) 555-0138", "Cabras Industrial Park, Piti, GU 96915", "Net 30", "66-0274418", "JAD"],
];

function buildCustomers(): Customer[] {
  return CUSTOMERS.map(([code, name, contact, email, phone, address, terms, limit, owner, inactive], i) => ({
    id: `cus-${i + 1}`, code, name, contact, email, phone, address, terms, creditLimit: toCents(limit), status: inactive ? "Inactive" : "Active", profileRef: owner, notes: "",
  }));
}
function buildVendors(): Vendor[] {
  return VENDORS.map(([code, name, contact, email, phone, address, terms, taxId, owner], i) => ({
    id: `ven-${i + 1}`, code, name, contact, email, phone, address, terms, taxId, status: "Active", profileRef: owner, notes: "",
  }));
}

/* ----------------------------------- invoices ----------------------------------- */

type L = [description: string, quantity: number, unitPrice: number, account: string];
type InvState = "paid" | "open" | "draft" | "void" | { partial: number };
type I = [no: number, customer: number, issued: string, lines: L[], state: InvState];

const INVOICES: I[] = [
  [2301, 1, "2026-04-06", [["Port-to-site freight coordination – April", 1, 42500, "4000"], ["Warehouse staging (pallet-days)", 640, 18.5, "4000"]], "paid"],
  [2302, 3, "2026-04-09", [["Responder supply kit – Type A", 120, 385, "4100"]], "paid"],
  [2303, 2, "2026-04-14", [["Medical supply kitting", 80, 295, "4100"], ["Cold-chain handling", 1, 4800, "4000"]], "paid"],
  [2304, 5, "2026-04-20", [["Event logistics support", 1, 18750, "4000"]], "paid"],
  [2305, 8, "2026-04-27", [["Site materials delivery program – Phase 1", 1, 68000, "4000"]], "paid"],
  [2306, 1, "2026-05-05", [["Port-to-site freight coordination – May", 1, 44100, "4000"], ["Warehouse staging (pallet-days)", 500, 18.5, "4000"]], "paid"],
  [2307, 4, "2026-05-11", [["Provisioning kits", 150, 240, "4100"]], "paid"],
  [2308, 7, "2026-05-16", [["Marine logistics consulting (hours)", 90, 165, "4200"]], "paid"],
  [2309, 3, "2026-05-22", [["Responder supply kit – Type B", 100, 420, "4100"]], "paid"],
  [2310, 9, "2026-05-29", [["Disaster relief logistics plan", 1, 36500, "4200"]], "paid"],
  [2311, 1, "2026-06-04", [["Port-to-site freight coordination – June", 1, 46800, "4000"], ["Warehouse staging (pallet-days)", 600, 18.5, "4000"]], "paid"],
  [2312, 2, "2026-06-10", [["Medical supply kitting", 95, 295, "4100"]], "paid"],
  [2313, 8, "2026-06-17", [["Site materials delivery program – Phase 2", 1, 72500, "4000"]], "paid"],
  [2314, 5, "2026-06-24", [["Event logistics support", 1, 21400, "4000"]], "paid"],
  [2315, 6, "2026-06-26", [["Property turnover logistics", 1, 6200, "4000"]], "paid"],
  [2316, 1, "2026-07-06", [["Port-to-site freight coordination – July", 1, 47250, "4000"], ["Warehouse staging (pallet-days)", 562, 18.5, "4000"]], "paid"],
  [2317, 3, "2026-07-12", [["Responder supply kit – Type A", 140, 385, "4100"]], "paid"],
  [2318, 9, "2026-07-18", [["Field operations advisory (hours)", 120, 175, "4200"]], "paid"],
  [2319, 4, "2026-07-22", [["Provisioning kits", 170, 240, "4100"]], "paid"],
  [2320, 7, "2026-07-29", [["Vessel provisioning logistics", 1, 15400, "4000"]], "paid"],
  [2321, 1, "2026-08-05", [["Port-to-site freight coordination – August", 1, 49800, "4000"], ["Warehouse staging (pallet-days)", 665, 18.5, "4000"]], "paid"],
  [2322, 2, "2026-08-11", [["Medical supply kitting", 82, 295, "4100"], ["Cold-chain handling", 1, 5200, "4000"]], { partial: 15000 }],
  [2323, 8, "2026-08-19", [["Site materials delivery program – Phase 3", 1, 61000, "4000"]], "open"],
  [2324, 5, "2026-08-21", [["Event logistics support", 1, 19800, "4000"]], "open"],
  [2325, 3, "2026-08-26", [["Responder supply kit – Type B", 130, 420, "4100"]], "open"],
  [2326, 1, "2026-09-04", [["Port-to-site freight coordination – September", 1, 51200, "4000"], ["Warehouse staging (pallet-days)", 710, 18.5, "4000"]], "open"],
  [2327, 6, "2026-09-08", [["Property turnover logistics", 1, 7350, "4000"]], "open"],
  [2328, 9, "2026-09-14", [["Field operations advisory (hours)", 140, 175, "4200"], ["Training workshop", 1, 18000, "4200"]], "open"],
  [2329, 4, "2026-09-18", [["Provisioning kits", 190, 240, "4100"]], "open"],
  [2330, 7, "2026-09-24", [["Vessel provisioning logistics", 1, 27900, "4000"]], "open"],
  [2331, 2, "2026-09-28", [["Medical supply kitting", 98, 295, "4100"]], "open"],
  [2332, 8, "2026-09-30", [["Site materials delivery program – Phase 3b", 1, 38000, "4000"]], "open"],
  [2333, 8, "2026-10-01", [["Site materials delivery program – Phase 4", 1, 76000, "4000"]], "draft"],
  [2334, 3, "2026-10-01", [["Responder supply kit – Type C", 110, 410, "4100"]], "draft"],
  [2335, 5, "2026-09-02", [["Event logistics support (duplicate of INV-2324)", 1, 19800, "4000"]], "void"],
];

const METHODS: PaymentMethod[] = ["Bank transfer", "Check", "Bank transfer", "Card"];

/* ------------------------------------- bills ------------------------------------- */

type B = [no: number, vendor: number, date: string, lines: Array<[string, number, string]>, state: "paid" | "approved" | "awaiting" | "draft", ref: string];

function monthly(vendor: number, day: string, desc: string, amounts: number[], account: string, refPrefix: string, startMonth = 4): B[] {
  return amounts.map((amt, i) => {
    const m = String(startMonth + i).padStart(2, "0");
    return [0, vendor, `2026-${m}-${day}`, [[desc, amt, account]], "paid", `${refPrefix}-${m}`] as B;
  });
}

const BILLS: B[] = [
  ...monthly(9, "01", "Warehouse & office rent", [14500, 14500, 14500, 14500, 14500, 14500], "6200", "RENT"),
  [0, 9, "2026-10-01", [["Warehouse & office rent – October", 14500, "6200"]], "awaiting", "RENT-10"],
  ...monthly(4, "08", "Utilities – power, water, telecom", [2140, 2380, 2610, 2790, 2840, 2460], "6300", "UT"),
  ...monthly(3, "05", "Cloud hosting & software licences", [1850, 1850, 1850, 1850, 1920, 1920], "6500", "RC"),
  [0, 2, "2026-04-12", [["Freight – April lanes", 21400, "5100"]], "paid", "IFF-0412"],
  [0, 2, "2026-05-14", [["Freight – May lanes", 19800, "5100"]], "paid", "IFF-0514"],
  [0, 2, "2026-06-15", [["Freight – June lanes", 22600, "5100"]], "paid", "IFF-0615"],
  [0, 2, "2026-07-16", [["Freight – July lanes", 24100, "5100"]], "paid", "IFF-0716"],
  [0, 2, "2026-08-18", [["Freight – August lanes", 27300, "5100"]], "paid", "IFF-0818"],
  [0, 2, "2026-09-17", [["Freight – September lanes", 25900, "5100"]], "approved", "IFF-0917"],
  [0, 10, "2026-04-08", [["Kit components – April", 34000, "5000"]], "paid", "PPW-4410"],
  [0, 10, "2026-05-09", [["Kit components – May", 26500, "5000"]], "paid", "PPW-4511"],
  [0, 10, "2026-06-10", [["Kit components – June", 21000, "5000"]], "paid", "PPW-4620"],
  [0, 10, "2026-07-11", [["Kit components – July", 33000, "5000"]], "paid", "PPW-4733"],
  [0, 10, "2026-08-12", [["Kit components – August", 36500, "5000"]], "paid", "PPW-4841"],
  [0, 10, "2026-09-15", [["Kit components – September", 38200, "5000"]], "approved", "PPW-4950"],
  [0, 8, "2026-05-30", [["Contract warehouse staff – May", 12400, "5200"]], "paid", "TSS-0530"],
  [0, 8, "2026-06-29", [["Contract warehouse staff – June", 12900, "5200"]], "paid", "TSS-0629"],
  [0, 8, "2026-07-30", [["Contract warehouse staff – July", 13100, "5200"]], "paid", "TSS-0730"],
  [0, 8, "2026-08-30", [["Contract warehouse staff – August", 13600, "5200"]], "approved", "TSS-0830"],
  [0, 8, "2026-09-30", [["Contract warehouse staff – September", 14200, "5200"]], "awaiting", "TSS-0930"],
  [0, 5, "2026-06-20", [["Quarterly bookkeeping and tax planning", 6500, "6600"]], "paid", "DP-2206"],
  [0, 5, "2026-09-10", [["Audit preparation – interim", 4800, "6600"]], "approved", "DP-2209"],
  [0, 6, "2026-04-05", [["Cargo & liability insurance – Q2", 4500, "6800"]], "paid", "CIB-Q2"],
  [0, 6, "2026-07-05", [["Cargo & liability insurance – Q3", 4500, "6800"]], "paid", "CIB-Q3"],
  [0, 7, "2026-05-18", [["Vehicle graphics and signage", 3200, "6400"]], "paid", "MPS-0518"],
  [0, 7, "2026-08-22", [["Trade-show banners and print collateral", 4100, "6400"]], "awaiting", "MPS-0822"],
  [0, 7, "2026-09-20", [["Quarterly mailer", 2750, "6400"]], "draft", "MPS-0920"],
];

/* --------------------------- manual journal entries --------------------------- */

type M = [date: string, memo: string, status: "Posted" | "Draft", lines: Array<[code: string, description: string, debit: number, credit: number]>];

function manualEntries(): M[] {
  const out: M[] = [
    ["2026-04-01", "Opening balances as of April 1", "Posted", [
      ["1000", "Opening cash – operating", 420000, 0], ["1010", "Opening cash – payroll", 60000, 0], ["1200", "Prepaid insurance and licences", 12000, 0], ["1500", "Equipment at cost", 90000, 0],
      ["2500", "Line of credit balance", 0, 40000], ["3000", "Owner capital", 0, 400000], ["3100", "Retained earnings brought forward", 0, 142000],
    ]],
  ];
  const months: Array<[string, string]> = [["04", "April"], ["05", "May"], ["06", "June"], ["07", "July"], ["08", "August"], ["09", "September"]];
  const last: Record<string, string> = { "04": "30", "05": "31", "06": "30", "07": "31", "08": "31", "09": "30" };
  for (const [m, name] of months) {
    out.push([`2026-${m}-25`, `Fund payroll account – ${name}`, "Posted", [["1010", "Transfer to payroll", 70000, 0], ["1000", "Transfer from operating", 0, 70000]]]);
    out.push([`2026-${m}-28`, `${name} payroll`, "Posted", [["6000", "Salaries and wages", 62000, 0], ["6100", "Employer taxes and benefits", 7800, 0], ["1010", "Net payroll paid", 0, 69800]]]);
    out.push([`2026-${m}-${last[m]}`, `${name} depreciation`, "Posted", [["6900", "Monthly depreciation", 1250, 0], ["1510", "Accumulated depreciation", 0, 1250]]]);
  }
  out.push(["2026-09-30", "Line of credit interest – Q3", "Posted", [["7000", "Interest charged", 410, 0], ["1000", "Debited from operating", 0, 410]]]);
  out.push(["2026-09-30", "Accrue September contractor bonus", "Draft", [["6000", "Bonus accrual", 2500, 0], ["2100", "Accrued bonuses", 0, 2500]]]);
  out.push(["2026-09-30", "Reclass hosting from marketing", "Draft", [["6500", "Hosting reclass", 1200, 0], ["6400", "Hosting reclass", 0, 1200]]]);
  return out;
}

/* --------------------------------- assembly --------------------------------- */

const lineRows = <T,>(id: string, rows: T[], make: (row: T, lineId: string) => unknown) => rows.map((r, i) => make(r, `${id}-l${i + 1}`));

export function createSeedData(): AisData {
  const data: AisData = {
    version: 1,
    settings: {
      companyName: "Ray Land, Inc.",
      fiscalYear: 2026,
      fiscalYearStartMonth: 1,
      reportingDate: "2026-09-30",
      currency: "USD",
      defaultCustomerTerms: "Net 30",
      defaultVendorTerms: "Net 30",
      invoicePrefix: "INV-",
      billPrefix: "BILL-",
      journalPrefix: "JE-",
      paymentPrefix: "PMT-",
    },
    accounts: buildAccounts(),
    customers: buildCustomers(),
    vendors: buildVendors(),
    invoices: [],
    bills: [],
    payments: [],
    journalEntries: [],
  };

  const dated: Array<{ order: number; entry: JournalEntry }> = [];
  const push = (entry: JournalEntry, order: number) => dated.push({ entry, order });
  const payments: Array<{ payment: Payment; order: number }> = [];

  // invoices (+ receipts)
  for (const [no, cus, issued, lines, state] of INVOICES) {
    const customer = data.customers[cus - 1];
    const id = `inv-${no}`;
    const invoice: Invoice = {
      id,
      number: `INV-${no}`,
      customerId: customer.id,
      issueDate: issued,
      dueDate: addDays(issued, TERM_DAYS[customer.terms]),
      terms: customer.terms,
      status: state === "draft" ? "Draft" : state === "void" ? "Void" : "Sent",
      reference: "",
      notes: "",
      lines: lineRows(id, lines, ([description, quantity, unitPrice, code], lineId) => ({ id: lineId, description, quantity, unitPrice: toCents(unitPrice), accountId: acct(code) }) satisfies InvoiceLine) as InvoiceLine[],
    };
    data.invoices.push(invoice);
    const total = invoiceTotal(invoice);
    const settle = (amount: number, wanted: string, n: number) => {
      const date = wanted < issued ? issued : wanted > data.settings.reportingDate ? data.settings.reportingDate : wanted;
      payments.push({
        order: n,
        payment: { id: `pay-in-${no}`, number: "", direction: "received", partyId: customer.id, date, method: METHODS[no % METHODS.length], accountId: acct("1000"), reference: `RCPT-${no}`, memo: "", allocations: [{ documentId: id, amount }] },
      });
    };
    if (state === "paid") settle(total, addDays(invoice.dueDate, -(2 + (no % 4))), no);
    else if (typeof state === "object") settle(toCents(state.partial), "2026-09-02", no);
  }

  // bills (+ disbursements)
  let billNo = 0;
  for (const [, ven, date, lines, state, ref] of BILLS) {
    billNo += 1;
    const vendor = data.vendors[ven - 1];
    const id = `bill-${String(billNo).padStart(3, "0")}`;
    const bill: Bill = {
      id,
      number: `BILL-${String(billNo).padStart(4, "0")}`,
      vendorId: vendor.id,
      billDate: date,
      dueDate: addDays(date, TERM_DAYS[vendor.terms]),
      terms: vendor.terms,
      status: state === "paid" || state === "approved" ? "Approved" : state === "awaiting" ? "Awaiting Approval" : "Draft",
      reference: ref,
      notes: "",
      lines: lineRows(id, lines, ([description, amount, code], lineId) => ({ id: lineId, description, amount: toCents(amount), accountId: acct(code) }) satisfies BillLine) as BillLine[],
    };
    data.bills.push(bill);
    if (state === "paid") {
      const total = bill.lines.reduce((s, l) => s + l.amount, 0);
      const payDate = addDays(bill.dueDate, -1) > data.settings.reportingDate ? data.settings.reportingDate : addDays(bill.dueDate, -1);
      payments.push({
        order: 1000 + billNo,
        payment: { id: `pay-out-${billNo}`, number: "", direction: "made", partyId: vendor.id, date: payDate < date ? date : payDate, method: METHODS[billNo % METHODS.length], accountId: acct("1000"), reference: ref, memo: "", allocations: [{ documentId: id, amount: total }] },
      });
    }
  }

  // payments in chronological order get sequential numbers
  payments.sort((a, b) => a.payment.date.localeCompare(b.payment.date) || a.order - b.order);
  payments.forEach(({ payment }, i) => {
    payment.number = `PMT-${String(i + 1).padStart(4, "0")}`;
    data.payments.push(payment);
  });

  // auto-posted journal entries (numbers assigned below)
  for (const inv of data.invoices) {
    const e = buildInvoiceEntry(data, inv, "");
    if (e) push(e, 1);
  }
  for (const bill of data.bills) {
    const e = buildBillEntry(data, bill, "");
    if (e) push(e, 2);
  }
  for (const p of data.payments) {
    const e = buildPaymentEntry(data, p, "");
    if (e) push(e, 3);
  }
  // manual entries
  manualEntries().forEach(([date, memo, status, lines], i) => {
    push(
      {
        id: `je-manual-${i + 1}`,
        number: "",
        date,
        memo,
        status,
        source: "Manual",
        lines: lines.map(([code, description, debit, credit], li) => ({ id: `je-manual-${i + 1}-l${li + 1}`, accountId: acct(code), description, debit: toCents(debit), credit: toCents(credit) })),
      },
      i === 0 ? 0 : 4,
    );
  });

  dated.sort((a, b) => a.entry.date.localeCompare(b.entry.date) || a.order - b.order || a.entry.id.localeCompare(b.entry.id));
  dated.forEach(({ entry }, i) => {
    entry.number = `JE-${String(i + 1).padStart(4, "0")}`;
    data.journalEntries.push(entry);
  });

  return data;
}
