#!/usr/bin/env python3
"""
Regenerate src/data/actionsExport.ts from a CSV export of the Actions table
(e.g. "Actions-OPEN ACTIONS - HOT QA NEXT.csv").

  python3 scripts/actions-csv-to-seed.py path/to/export.csv

Columns: Code, Wk, Accrue (ISO date, blank for undated "Action" rows), Status, Task Title, Type, Folio, Asn, QA, Sort.
Asn holds team contact codes, comma-joined when there are several ("JAD,AES"); they become a list here and are linked to
Profiles by their Contact code when loaded. A Folio containing a comma is quoted in the export; the quotes are removed.
Whitespace around values is trimmed. The rows keep the export's order.
"""
import csv, io, json, re, sys

src = open(sys.argv[1], "rb").read().decode("utf-8-sig")
rows = list(csv.DictReader(io.StringIO(src)))
EXPECTED = ["Code", "Wk", "Accrue", "Status", "Task Title", "Type", "Folio", "Asn", "QA", "Sort"]
assert list(rows[0].keys()) == EXPECTED, f"unexpected columns: {list(rows[0].keys())}"

def one(cell):
    """A cell holding one value; the export quotes a value that contains a comma."""
    vals = next(csv.reader(io.StringIO(cell.strip()))) if cell.strip() else []
    return ", ".join(v.strip() for v in vals) if len(vals) <= 1 else cell.strip()

def many(cell):
    return [v.strip() for v in next(csv.reader(io.StringIO(cell))) if v.strip()] if cell.strip() else []

out, seen = [], set()
for r in rows:
    code = r["Code"].strip()
    m = re.fullmatch(r"A-(\d+)", code)
    assert m and code not in seen, f"bad or repeated code {code!r}"
    seen.add(code)
    accrue = r["Accrue"].strip()
    assert accrue == "" or re.fullmatch(r"\d{4}-\d{2}-\d{2}", accrue), f"bad date {accrue!r}"
    assert r["QA"].strip() == "", "QA has values: the importer needs a rule for them"
    out.append({
        "id": code, "code": code, "wk": r["Wk"].strip(), "accrue": accrue, "status": r["Status"].strip(),
        "title": r["Task Title"].strip(), "type": r["Type"].strip(), "folio": one(r["Folio"]), "asn": many(r["Asn"]),
        "sort": int(r["Sort"]) if r["Sort"].strip() else None,
    })

ts = '''/**
 * The Actions table, from the CSV export "Actions-OPEN ACTIONS - HOT QA NEXT.csv" (158 actions, in the export's order).
 * Columns: Code, Wk, Accrue, Status, Task Title, Type, Folio, Asn, QA, Sort. Regenerate with scripts/actions-csv-to-seed.py.
 * QA is empty in the export, so it is not listed.
 */
export type ActionSeed = {
  id: string;
  code: string;
  /** week such as "26.28", or "Action" for undated actions */
  wk: string;
  /** ISO date, "" when undated */
  accrue: string;
  status: string;
  title: string;
  type: string;
  folio: string;
  /** team contact codes (Profiles → Contact) */
  asn: string[];
  sort: number | null;
};

export const ACTION_EXPORT: ActionSeed[] = ''' + json.dumps(out, indent=1, ensure_ascii=False) + ";\n"
open("src/data/actionsExport.ts", "w").write(ts)
print(len(out), "actions written")
