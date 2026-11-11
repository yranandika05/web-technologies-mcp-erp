#!/usr/bin/env bash

set -euo pipefail

OFBIZ_REPO="https://github.com/apache/ofbiz-framework.git"
OFBIZ_COMMIT="27ca871d3212468196f3ae7cbc02ab08880207d3"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OFBIZ_DIR="$PROJECT_ROOT/.local/ofbiz-framework"

echo "==> Checking requirements"

command -v git >/dev/null 2>&1 || {
  echo "Error: git is not installed."
  exit 1
}

command -v java >/dev/null 2>&1 || {
  echo "Error: Java/JDK is not installed."
  exit 1
}

echo "Java:"
java -version

echo
echo "==> Preparing local directory"
mkdir -p "$PROJECT_ROOT/.local"

if [ ! -d "$OFBIZ_DIR/.git" ]; then
  echo "==> Cloning Apache OFBiz"
  git clone "$OFBIZ_REPO" "$OFBIZ_DIR"
else
  echo "==> Existing OFBiz repository found"
fi

cd "$OFBIZ_DIR"

echo
echo "==> Fetching OFBiz repository"
git fetch origin

echo
echo "==> Checking out pinned OFBiz commit"
git checkout "$OFBIZ_COMMIT"

echo
echo "==> Initializing Gradle wrapper"
./gradle/init-gradle-wrapper.sh

echo
echo "==> Loading OFBiz demo data"
echo "WARNING: This resets the local OFBiz database."
./gradlew cleanAll loadAll

echo
echo "========================================"
echo "OFBiz setup completed successfully."
echo
echo "Start OFBiz with:"
echo "  ./scripts/start-ofbiz.sh"
echo "========================================"