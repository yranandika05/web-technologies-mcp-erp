#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -eq 0 ]] || { echo "Usage: $0" >&2; exit 2; }
check_docker
check_config
echo "WARNING: All local ERPNext data for Compose project mcp-erpnext will be lost."
echo "This deletes its database, sites/files/backups, logs and Redis queue volumes."
echo "The .env file and historical .local runtimes are preserved."
if [[ ! -t 0 ]]; then
  echo "Reset requires an interactive terminal; no data was removed." >&2
  exit 1
fi
read -r -p "Type RESET to delete all local ERPNext data: " confirmation
if [[ "$confirmation" != RESET ]]; then
  echo "Reset cancelled; no data was removed."
  exit 1
fi
compose --profile setup down --volumes
bash "$SCRIPT_DIR/setup-erpnext.sh"
bash "$SCRIPT_DIR/start-erpnext.sh"
