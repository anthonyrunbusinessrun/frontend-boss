#!/usr/bin/env python3
"""
Regenerate src/data/femaVouchers.ts from a CSV export of the Vouchers table
(e.g. "Vouchers-VOUCHERS - Simplified.csv").

  python3 scripts/vouchers-csv-to-seed.py path/to/export.csv

Column -> field: Voucher/No are computed in the app; Accrue (m/d/yyyy) -> accrualDate; Form -> docType; Form Title -> headline;
Status -> docStatus; By; Issued -> vendorCode; Reference 1 -> contractNo; Perform -> operatorCode; Reference 2 -> reference2;
Via -> deliverVia; Resource; Tracking # -> tracking; ID -> i; VSF (a link to the voucher record) -> vsf;
Manifest (a comma-joined list of lines; items containing commas are quoted) -> manifest, one line per row; Notes -> voucherNote.
Scans and QR are attachments whose links are temporary download URLs: they are NOT read (nothing downloadable is stored in the
repository). QR codes are made by the app; Scans are uploaded in the app.
"""
import csv, io, json, re, sys

ID_BY_I_PATH = "src/data/femaVouchers.ts"
src = open(sys.argv[1], "rb").read().decode("utf-8-sig")
rows = list(csv.DictReader(io.StringIO(src)))
EXPECTED = ["Voucher", "Accrue", "Form", "Form Title", "Status", "By", "Issued", "Reference 1", "Perform", "Reference 2", "Via", "Resource", "Tracking #", "Scans", "ID", "No", "VSF", "Manifest", "QR", "Notes"]
assert list(rows[0].keys()) == EXPECTED, f"unexpected columns: {list(rows[0].keys())}"

def iso(d):
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", d.strip())
    assert m, f"bad date {d!r}"
    return f"{m[3]}-{int(m[1]):02d}-{int(m[2]):02d}"

def manifest(cell):
    return "\n".join(next(csv.reader(io.StringIO(cell)))) if cell.strip() else ""

def notes(cell):
    return "\n".join(l.rstrip() for l in cell.strip().splitlines())

out = []
for n, r in enumerate(rows, start=1):
    out.append({
        "id": f"v{n}", "i": int(r["ID"]), "accrualDate": iso(r["Accrue"]), "docType": r["Form"], "headline": r["Form Title"],
        "docStatus": r["Status"], "by": r["By"], "vendorCode": r["Issued"], "contractNo": r["Reference 1"], "operatorCode": r["Perform"],
        "reference2": r["Reference 2"].strip(), "deliverVia": r["Via"], "resource": r["Resource"], "tracking": r["Tracking #"],
        "vsf": r["VSF"].strip(), "manifest": manifest(r["Manifest"]), "voucherNote": notes(r["Notes"]),
    })
    assert r["Voucher"] == f"LLG-{r['Form']}-{int(r['ID']) + 4000}" and int(r["No"]) == int(r["ID"]) + 1000, f"row {n}: Voucher/No do not follow ID"

ts = '''/**
 * FEMA / Infant & Toddlers vouchers, from the CSV export of the Vouchers table (16 rows).
 * Column order matches the export: Voucher, Accrue, Form, Form Title, Status, By, Issued, Reference 1, Perform, Reference 2, Via,
 * Resource, Tracking #, Scans, ID, No, VSF, Manifest, QR, Notes. `voucherNo` and `no` are computed from `i` + `docType` at read time.
 * Scans and QR (attachments) are not part of the seed. Regenerate with scripts/vouchers-csv-to-seed.py.
 */
export type FemaVoucherSeed = {
  id: string;
  i: number;
  accrualDate: string;
  docType: "FD" | "FT" | "BL" | "FQ" | "IN";
  headline: string;
  docStatus: "Issued" | "Planned" | "BOOKED";
  by: string;
  vendorCode: string;
  contractNo: string;
  operatorCode: string;
  reference2: string;
  deliverVia: string;
  resource: string;
  tracking: string;
  /** link to the voucher's record */
  vsf: string;
  /** one shipment line per line */
  manifest: string;
  voucherNote: string;
};

export const FEMA_VOUCHERS: FemaVoucherSeed[] = ''' + json.dumps(out, indent=2, ensure_ascii=False) + ";\n"
open(ID_BY_I_PATH, "w").write(ts)
print(len(out), "vouchers written to", ID_BY_I_PATH)
