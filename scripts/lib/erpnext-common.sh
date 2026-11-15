#!/usr/bin/env bash
# Sourced by the public scripts; .env is read by Compose, never executed as shell.
set -euo pipefail

SCRIPT_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_LIB_DIR/../.." && pwd)"

compose() {
  docker compose --project-directory "$PROJECT_ROOT" --project-name mcp-erpnext \
    --env-file "$PROJECT_ROOT/.env" -f "$PROJECT_ROOT/compose.yml" "$@"
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is missing. Install Docker Desktop or Docker Engine manually." >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 or newer is required (docker compose)." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is unavailable. Start Docker Desktop/Engine and retry." >&2
    exit 1
  fi
}

check_config() {
  if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
    echo "Missing .env. Copy .env.example to .env and fill the required passwords." >&2
    exit 1
  fi
  # Quiet validation avoids printing resolved secrets.
  compose --profile setup config --quiet
}

start_dependencies() {
  compose up -d --wait --wait-timeout 240 db redis-cache redis-queue
}

print_access() {
  local base_url
  base_url="$(compose config --environment | sed -n 's/^ERPNEXT_BASE_URL=//p')"
  echo "ERPNext: $base_url (Administrator; password from .env)"
  echo "Status: docker compose ps"
  echo "Logs:   docker compose logs -f --tail=100 frontend backend"
  echo "Run these Compose commands from: $PROJECT_ROOT"
}
