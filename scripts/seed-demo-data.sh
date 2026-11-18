#!/usr/bin/env bash
# Seeds the ERPNext demo data: the items from docs/erpnext_dummy_items.csv and their stock from
# "docs/Stock Entry - Demo Material Receipts.csv". Run after the ERPNext setup wizard.
# Safe to run repeatedly (existing items and stock are kept). Usage: scripts/seed-demo-data.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -eq 0 ]] || { echo "Usage: $0" >&2; exit 2; }
check_docker
check_config

site="$(grep -E '^SITE_NAME=' "$PROJECT_ROOT/.env" | cut -d= -f2- || true)"
items_csv="$PROJECT_ROOT/docs/erpnext_dummy_items.csv"
stock_csv="$PROJECT_ROOT/docs/Stock Entry - Demo Material Receipts.csv"

# Copy the CSVs into the container via stdin (works the same on Linux, macOS and Git Bash).
compose exec -T backend bash -c 'cat > /tmp/mcp-demo-items.csv' < "$items_csv"
compose exec -T backend bash -c 'cat > /tmp/mcp-demo-stock.csv' < "$stock_csv"

# bash -c with cd: Git Bash on Windows would rewrite a bare /home/... argument.
# Frappe expects to run from the sites directory.
compose exec -T -e SITE="$site" backend bash -c '
  cd ~/frappe-bench/sites
  ~/frappe-bench/env/bin/python - "$SITE" /tmp/mcp-demo-items.csv /tmp/mcp-demo-stock.csv
  status=$?
  rm -f /tmp/mcp-demo-items.csv /tmp/mcp-demo-stock.csv
  exit $status
' < "$PROJECT_ROOT/docker/erpnext/seed-demo-data.py"
