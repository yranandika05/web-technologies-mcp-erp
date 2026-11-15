#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -eq 0 ]] || { echo "Usage: $0" >&2; exit 2; }
check_docker
check_config
start_dependencies
# Refuse to start app services against an uninitialized or broken site.
compose run --rm --no-deps create-site check
compose up -d --wait --wait-timeout 360
print_access
