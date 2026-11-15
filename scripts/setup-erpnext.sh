#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -eq 0 ]] || { echo "Usage: $0" >&2; exit 2; }
check_docker
if [[ ! -e "$PROJECT_ROOT/.env" ]]; then
  (umask 077; cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env")
  echo "Created .env. Fill ADMIN_PASSWORD, DB_ROOT_PASSWORD and DB_PASSWORD, then rerun." >&2
  exit 1
fi
check_config
compose --profile setup pull
start_dependencies
compose run --rm --no-deps configurator
compose run --rm --no-deps create-site
# App services are started separately, once site initialization succeeds.
echo "Site setup completed. Run: $PROJECT_ROOT/scripts/start-erpnext.sh"
