#!/usr/bin/env bash
# Adds the "MCP Chat" workspace to the running ERPNext (iframe to the chat host).
# Safe to run repeatedly. Usage: scripts/setup-chat-workspace.sh [chat-url]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/erpnext-common.sh"
[[ $# -le 1 ]] || { echo "Usage: $0 [chat-url]" >&2; exit 2; }
check_docker
check_config

env_value() { grep -E "^$1=" "$PROJECT_ROOT/.env" | cut -d= -f2- || true; }
port="$(env_value CHAT_HOST_PORT)"
chat_url="${1:-http://localhost:${port:-3000}}"

# bash -c with cd: Frappe expects cwd=sites, and Git Bash on Windows would rewrite a bare /home/... argument.
compose exec -T -e CHAT_URL="$chat_url" -e SITE_NAME="$(env_value SITE_NAME)" backend \
  bash -c 'cd ~/frappe-bench/sites && exec ~/frappe-bench/env/bin/python -' < "$PROJECT_ROOT/docker/erpnext/chat-workspace.py"
