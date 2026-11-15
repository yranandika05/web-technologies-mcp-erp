# Local ERPNext setup (manual preparation, checked wrappers)

## Workflow decision

Use native Frappe Bench as the proposed development workflow, with an external ERP runtime in ignored `.local/frappe-bench/`. This keeps the MCP project separate from ERP source and data and avoids assuming Docker. The wrappers support macOS/Linux Bash and deliberately leave system installation and database provisioning to the developer.

Before installing, the team must agree on compatible, exact Frappe and ERPNext release tags from the same supported major version, a Bench CLI version and matching dependency versions. No release pair has been tested or pinned by this repository yet. These wrappers are preparation for a repeatable workshop setup, not a validated one-command installer. Record the selected versions here after validation; moving branches alone are not a reproducibility guarantee.

Docker is an alternative if the team later agrees to it; the [official frappe_docker project](https://github.com/frappe/frappe_docker) provides development environments and a disposable demo. No Docker software or configuration is installed here.

## Manual prerequisites

Follow the [official Frappe installation guide](https://docs.frappe.io/framework/user/en/installation) for the chosen release and platform. It covers macOS and Debian/Ubuntu; other Linux distributions may need adaptation. Install a compatible Python, Node.js, Yarn, Redis, MariaDB server/client, Git, build tools and the Bench CLI. Prefer isolated Python tooling for Bench. Prerequisite versions vary substantially between Frappe majors; use the upstream matrix rather than mixing versions.

Database service initialization, authentication, character-set configuration and any system package installation are manual decisions. MariaDB must be running and a database account able to create the site's database must be available. Bench's development Procfile manages its own Redis processes; ensure their ports and web port 8000 are available. The checker accepts `mariadb` or the compatible `mysql` client command and expects `redis-server` in PATH.

The checker verifies executable presence, local files and site app installation, not version compatibility or full service health. No script uses sudo or changes global configuration.

## Prepare Bench and the site manually

These commands are instructions only, not executed by the project scripts. Run from the repository root after prerequisites are installed. Supply the agreed release tags and Python executable using the prompts; do not use this sequence on an existing Bench directory. Review [Bench command documentation](https://docs.frappe.io/framework/user/en/bench/bench-commands) and the installed CLI's `--help` before proceeding.

```bash
read -r -p "Agreed Frappe release tag: " FRAPPE_REF
read -r -p "Agreed ERPNext release tag: " ERPNEXT_REF
read -r -p "Compatible Python executable (absolute path): " FRAPPE_PYTHON
: "${FRAPPE_REF:?Release tag required}"
: "${ERPNEXT_REF:?Release tag required}"
: "${FRAPPE_PYTHON:?Python executable required}"
mkdir -p .local
bench init --frappe-branch "$FRAPPE_REF" --python "$FRAPPE_PYTHON" .local/frappe-bench
cd .local/frappe-bench
bench get-app --branch "$ERPNEXT_REF" erpnext https://github.com/frappe/erpnext
bench new-site erpnext.localhost
bench --site erpnext.localhost install-app erpnext
bench version > workshop-versions.txt
bench --version >> workshop-versions.txt
cd ../..
```

Run the block in Bash (`read -p` is Bash syntax). Bench downloads ERP source and dependencies, and site creation creates a local database. Enter database and Administrator passwords interactively; do not put them in commands or committed files. If database authentication requires different options, inspect `bench new-site --help` and follow upstream instructions. On partial failure, inspect the existing Bench/site before retrying; do not reset or reinstall it blindly. The local version record is ignored; copy only non-secret validated version information into this guide before a workshop.

Check and start from the repository root:

```bash
./scripts/setup-erpnext.sh
./scripts/start-erpnext.sh
```

Open `http://erpnext.localhost:8000`, sign in as `Administrator` using the password you chose, and complete the ERPNext setup wizard. If the hostname does not resolve to loopback on your system, resolve that manually before use; the scripts do not edit hosts files. This is a local development server, not a production deployment. Ctrl+C stops Bench; MariaDB remains managed separately.

## Prepare the API smoke test

Copy `.env.example` to `.env` if it does not already exist. Keep the base URL aligned with the site hostname and port. The wrappers do not source this file. The future TypeScript client will need to load these variables explicitly.

Create an API user with read permissions for the required data and generate its API key/secret in User settings. Store those credentials only in the ignored `.env`. Frappe uses `Authorization: token <api-key>:<api-secret>` and checks that user's permissions; see the [official REST API reference](https://docs.frappe.io/framework/user/en/api/rest).

In a shell with the three `ERPNEXT_*` variables set, verify authentication and retrieve one Item:

```bash
curl --fail-with-body "$ERPNEXT_BASE_URL/api/method/frappe.auth.get_logged_user" \
  -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET"
curl --fail-with-body --get "$ERPNEXT_BASE_URL/api/resource/Item" \
  --data-urlencode 'fields=["name","item_code","item_name"]' \
  --data-urlencode 'limit_page_length=1' \
  -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET"
```

A fresh site may have no Items. Create a test stock Item through ERPNext first; an empty list does not prove an Item was retrieved. Use the returned document name (URL-encoded) with `/api/resource/Item/<name>` for a single document. Stock validation is the next separate step: create a warehouse and stock transaction through ERPNext and confirm expected quantities before implementing inventory tools. Demo data is not automatically loaded.
