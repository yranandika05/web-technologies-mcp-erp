#!/usr/bin/env bash
# Runs inside the official ERPNext image. Never force/reinstall an existing site.
set -euo pipefail
cd /home/frappe/frappe-bench
: "${SITE_NAME:?}"
if [[ ! "$SITE_NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ || "$SITE_NAME" == *..* ]]; then
  echo "SITE_NAME must be a hostname, without paths or consecutive dots." >&2
  exit 1
fi
mode="${1:-setup}"
[[ "$mode" == setup || "$mode" == check ]] || exit 2
site_path="sites/$SITE_NAME"
if [[ ! -f "$site_path/site_config.json" ]]; then
  if [[ "$mode" == check ]]; then
    echo "Site is not initialized. Run ./scripts/setup-erpnext.sh first." >&2
    exit 1
  fi
  if [[ -e "$site_path" ]]; then
    echo "Incomplete site directory exists; inspect it before retrying. No data was removed." >&2
    exit 1
  fi
  bench new-site "$SITE_NAME" --db-host db --db-port 3306 \
    --db-root-username root --db-root-password "$DB_ROOT_PASSWORD" \
    --db-password "$DB_PASSWORD" --admin-password "$ADMIN_PASSWORD" \
    --mariadb-user-host-login-scope='%'
fi
# A failed query is an error, not evidence that the site is absent.
if ! installed_apps="$(bench --site "$SITE_NAME" list-apps)"; then
  echo "Existing site could not be queried. Inspect database/configuration; no reset was attempted." >&2
  exit 1
fi
if ! printf '%s\n' "$installed_apps" | grep -Eq '^erpnext([[:space:]]|$)'; then
  if [[ "$mode" == check ]]; then
    echo "ERPNext is not installed on the site. Run ./scripts/setup-erpnext.sh." >&2
    exit 1
  fi
  bench --site "$SITE_NAME" install-app erpnext
fi
if [[ "$mode" == setup ]]; then
  bench --site "$SITE_NAME" set-config host_name "$ERPNEXT_BASE_URL"
fi
echo "ERPNext site is ready: $SITE_NAME"
