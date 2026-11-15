#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -eq 0 ]] || { echo "Usage: $0" >&2; exit 2; }
check_docker
check_config
compose --profile setup down
echo "ERPNext stopped. Named volumes and the dataset were preserved."
