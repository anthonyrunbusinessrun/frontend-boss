#!/usr/bin/env python3
"""Import read-only Airtable CSV exports without adding source data to Git."""

import csv
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request


TABLES = (
    ("boss", "BOSS", "SYSTEM", "BOSS-SYSTEM.csv"),
    ("profiles", "Profiles", "SYSTEM", "Profiles-SYSTEM.csv"),
    ("categories", "Categories", "SYSTEM", "Categories-SYSTEM.csv"),
    ("folios", "Folios", "SYSTEM", "Folios-SYSTEM.csv"),
    ("actions", "Actions", "SYSTEM", "Actions-SYSTEM.csv"),
    ("packet", "Packet", "SYSTEM", "Packet-SYSTEM.csv"),
    ("vouchers", "Vouchers", "SYSTEM", "Vouchers-SYSTEM.csv"),
    ("transactions", "Transactions", "All Transactions", "Transactions-All Transactions.csv"),
    ("items", "Items", "SYSTEM", "Items-SYSTEM.csv"),
    ("accounts", "Accounts", "Grid view", "Accounts-Grid view.csv"),
    ("forms", "Forms", "SYSTEM", "Forms-SYSTEM.csv"),
    ("x", "< X >", "N/A", "_ X _-N_A.csv"),
    ("concepts", "Concepts", "SYSTEM", "Concepts-SYSTEM.csv"),
    ("capabilities", "Capabilities", "SYSTEM", "Capabilities-SYSTEM.csv"),
    ("leads", "Leads", "SYSTEM", "Leads-SYSTEM.csv"),
    ("registries", "Registries", "Grid view", "Registries-Grid view.csv"),
)


def read_csv(path: pathlib.Path):
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        columns = reader.fieldnames or []
        records = [dict(row) for row in reader]
    return columns, records


def main():
    csv_dir = pathlib.Path(os.environ.get("AIRTABLE_CSV_DIR", ""))
    base_url = os.environ.get("AIRTABLE_IMPORT_URL", "").rstrip("/")
    token = os.environ.get("API_WRITE_TOKEN", "")
    if not csv_dir.is_dir() or not base_url or not token:
        raise SystemExit("AIRTABLE_CSV_DIR, AIRTABLE_IMPORT_URL, and API_WRITE_TOKEN are required")

    total = 0
    for slug, display_name, view_name, filename in TABLES:
        path = csv_dir / filename
        if not path.is_file():
            raise SystemExit(f"Missing export: {filename}")
        columns, records = read_csv(path)
        payload = json.dumps(
            {
                "slug": slug,
                "displayName": display_name,
                "viewName": view_name,
                "columns": columns,
                "records": records,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{base_url}/api/airtable/{slug}",
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            message = error.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Import failed for {display_name}: HTTP {error.code} {message}") from error
        total += int(result["records"])
        print(f"Imported {display_name}: {result['records']} rows")

    print(f"Imported {len(TABLES)} tables and {total} rows")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
