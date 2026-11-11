#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OFBIZ_DIR="$PROJECT_ROOT/.local/ofbiz-framework"

if [ ! -d "$OFBIZ_DIR" ]; then
  echo "Error: OFBiz has not been installed."
  echo "Run ./scripts/setup-ofbiz.sh first."
  exit 1
fi

cd "$OFBIZ_DIR"

echo "==> Starting Apache OFBiz"
echo "==> WebTools: https://localhost:8443/webtools"
echo "==> Swagger:  https://localhost:8443/docs/api/swagger-ui.html"
echo
echo "Press Ctrl+C to stop OFBiz."
echo

./gradlew ofbiz