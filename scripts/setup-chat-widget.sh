#!/usr/bin/env bash
# Adds the floating MCP chat button to every ERPNext desk page. ERPNext loads the launcher
# script from the chat host via `app_include_js` in the site config.
# Safe to run repeatedly. Usage: scripts/setup-chat-widget.sh [chat-url]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -le 1 ]] || { echo "Usage: $0 [chat-url]" >&2; exit 2; }
check_docker
check_config

env_value() { grep -E "^$1=" "$PROJECT_ROOT/.env" | cut -d= -f2- || true; }
port="$(env_value CHAT_HOST_PORT)"
chat_url="${1:-http://localhost:${port:-3000}}"
site="$(env_value SITE_NAME)"
script_url="${chat_url%/}/erpnext-launcher.js"

# bash -c with cd: Git Bash on Windows would rewrite a bare /home/... argument.
compose exec -T -e SITE="$site" -e SCRIPT_URL="$script_url" backend bash -c '
  cd ~/frappe-bench
  bench --site "$SITE" set-config -p app_include_js "[\"$SCRIPT_URL\"]"
  bench --site "$SITE" clear-cache
'
# The web workers cache the site config; clear-cache alone does not reach them.
compose restart backend >/dev/null
echo "Chat button enabled: ERPNext loads $script_url (reload the desk page)."
