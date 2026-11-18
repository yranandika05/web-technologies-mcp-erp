"""Seeds the ERPNext demo data from docs/*.csv: the MCP-EL-* items and their opening stock.

Runs inside the backend container (started by scripts/seed-demo-data.sh):
    python - <site> <items.csv> <stock.csv>  (cwd: ~/frappe-bench/sites)

Safe to run repeatedly: existing items are kept, and an item only gets stock booked when it has
no stock ledger entries yet.
"""
import csv
import sys

import frappe
from frappe import _


def read_csv(path):
    # utf-8-sig: the CSVs were exported with a byte order mark.
    with open(path, encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def seed_items(rows):
    created = 0
    for row in rows:
        if frappe.db.exists("Item", row["Item Code"]):
            continue
        frappe.get_doc({
            "doctype": "Item",
            "item_code": row["Item Code"],
            "item_name": row["Item Name"],
            "item_group": row["Item Group"],
            "stock_uom": row["Default Unit of Measure"],
            "is_stock_item": int(row["Maintain Stock"] or 0),
            "description": row["Description"],
        }).insert()
        created += 1
    print(f"Items: {created} created, {len(rows) - created} already there.")


def resolve_company(name):
    if name and frappe.db.exists("Company", name):
        return name
    default = frappe.db.get_default("company")
    if not default:
        sys.exit("No company found. Finish the ERPNext setup wizard first.")
    return default


def resolve_warehouse(name, company):
    """The CSV says "Stores - MCP"; ERPNext names that warehouse in the site language."""
    if name and frappe.db.exists("Warehouse", name):
        return name
    stores = frappe.db.get_value(
        "Warehouse", {"company": company, "warehouse_name": _("Stores"), "is_group": 0}, "name")
    if not stores:
        sys.exit(f'Warehouse "{name}" not found and company "{company}" has no "{_("Stores")}" warehouse.')
    return stores


def seed_stock(rows):
    company = resolve_company(rows[0]["Company"])
    warehouse = resolve_warehouse(rows[0]["Default Target Warehouse"], company)
    todo = [row for row in rows
            if not frappe.db.exists("Stock Ledger Entry", {"item_code": row["Item Code (Items)"], "is_cancelled": 0})]
    if not todo:
        print(f"Stock: all {len(rows)} items already have stock.")
        return
    entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Receipt",
        "company": company,
        "to_warehouse": warehouse,
        "remarks": "MCP workshop demo data (scripts/seed-demo-data.sh)",
        "items": [{
            "item_code": row["Item Code (Items)"],
            "qty": float(row["Qty (Items)"]),
            "uom": row["UOM (Items)"],
            "conversion_factor": float(row["Conversion Factor (Items)"] or 1),
            "basic_rate": float(row["Basic Rate (as per Stock UOM) (Items)"]),
            "t_warehouse": warehouse,
        } for row in todo],
    })
    entry.insert()
    entry.submit()
    print(f"Stock: {len(todo)} items booked into {warehouse} ({entry.name}), "
          f"{len(rows) - len(todo)} already had stock.")


def main(site, items_csv, stock_csv):
    frappe.init(site=site, sites_path=".")
    frappe.connect()
    try:
        frappe.set_user("Administrator")
        # Translate "Stores" etc. like the setup wizard did.
        frappe.local.lang = frappe.db.get_default("lang") or "en"
        seed_items(read_csv(items_csv))
        seed_stock(read_csv(stock_csv))
        frappe.db.commit()
    finally:
        frappe.destroy()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage: python - <site> <items.csv> <stock.csv>")
    main(*sys.argv[1:])
