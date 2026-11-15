# ERPNext with Docker Compose

## Scope and prerequisites

Docker isolates Frappe/ERPNext, Python, MariaDB, Redis and worker dependencies so developers, the instructor and workshop participants share the same runtime. Install Git and Docker Desktop on macOS, or Docker Engine with the Compose plugin on Linux. Use `docker compose` v2 or newer, with support for `up --wait`. Start the Docker daemon before running scripts. Bash is required. Node.js will be needed later for the MCP exercise; no host Bench, database, Redis or Python environment is required.

Check `docker --version`, `docker compose version`, and `docker info`. Allow enough disk/memory for the full ERP stack; first pull and site initialization can take several minutes. The candidate ERPNext services use `linux/amd64`, following upstream's base Compose configuration. Apple Silicon needs Docker's amd64 emulation enabled and must be tested before the workshop. All participants should use the same validated platform/version configuration.

## Architecture and image selection

The root `compose.yml` adapts the [official Frappe Docker base stack](https://github.com/frappe/frappe_docker/blob/main/compose.yaml), [MariaDB override](https://github.com/frappe/frappe_docker/blob/main/overrides/compose.mariadb.yaml) and [Redis override](https://github.com/frappe/frappe_docker/blob/main/overrides/compose.redis.yaml). Only the small project configuration and initialization scripts live here; no upstream checkout, nested Git repository or custom image build is needed. This is a persistent, single-site local workshop stack rather than `pwd.yml`.

| Service | Responsibility |
| --- | --- |
| `frontend` | Nginx, HTTP on host loopback port 8080; routes to the configured site |
| `backend` | Frappe/ERPNext HTTP application on internal port 8000 |
| `websocket` | Frappe Socket.IO on internal port 9000 |
| `queue-short`, `queue-long` | Background workers |
| `scheduler` | Scheduled work |
| `db` | MariaDB; not published on the host |
| `redis-cache`, `redis-queue` | Cache and job/realtime queues; not published on the host |
| `configurator`, `create-site` | Explicit one-off setup services, excluded from normal startup |

All ERP services use the same official `frappe/erpnext` image, which includes Frappe and ERPNext. Candidate tags are isolated in `.env.example`: ERPNext `v16.55.0`, MariaDB `11.8`, Redis `8.6-alpine`. These reflect upstream examples inspected during this change, not a combination validated by this project. The ERPNext tag fixes its bundled framework; no separate Frappe version is selected. MariaDB/Redis tags select release lines and tags can be republished. Before the workshop, confirm compatibility, test Intel/Apple Silicon hosts, and freeze tested image digests (including the bundled Frappe version recorded by `docker compose exec backend bench version`). Do not change tags on an existing dataset as an implicit upgrade: back up and plan migrations separately.

The [Docker integration notes](../docker/erpnext/README.md) record upstream references and adaptations.

## First setup

From the repository root:

```bash
cp .env.example .env
# Edit .env before continuing.
./scripts/setup-erpnext.sh
./scripts/start-erpnext.sh
```

Fill `ADMIN_PASSWORD`, `DB_ROOT_PASSWORD` (MariaDB root), and `DB_PASSWORD` (the site's database user) with distinct local secrets. No default password is supplied. Keep `.env` private; single-quote values containing `$` or `#` using Compose dotenv syntax. Scripts let Compose parse `.env`; they never execute it as shell code. Existing exported shell variables take precedence under normal Compose rules; unset stale overrides when troubleshooting. Avoid printing `docker compose config` or `config --environment` into shared logs because resolved configuration contains passwords. Use `docker compose --profile setup config --quiet` for validation.

If `.env` is absent, setup copies the template with restrictive permissions and stops for you to fill it. It never overwrites an existing `.env`. Scripts work from any working directory and select the root Compose file and fixed project name `mcp-erpnext` explicitly. Run raw Compose commands below from the repository root, without overriding the project name.

Setup pulls official images, waits for MariaDB and Redis, writes shared Frappe connection settings, creates the site if absent and installs ERPNext if missing. Existing site queries must succeed before proceeding; a query failure is never treated as a missing site. It never passes force/reinstall or resets data. An incomplete site directory stops setup for inspection; database/schema errors require diagnosis rather than automatic deletion. Do not run setup concurrently in multiple terminals. Run it before app services on first use; normal start does not initialize a site.

Open `http://localhost:8080`. Log in as `Administrator` with `ADMIN_PASSWORD` and complete the setup wizard. The frontend sends `SITE_NAME` as the Frappe site header, so no hosts-file changes are required. If port 8080 is occupied, change `HTTP_PORT` and `ERPNEXT_BASE_URL` consistently in `.env`, then rerun setup/start. Only the frontend port is published, bound to `127.0.0.1`.

Changing passwords in `.env` does not update an existing site's Administrator/database credentials or the persisted MariaDB root password. Use the existing values when restarting. Site renaming, upgrades and credential rotation are separate manual maintenance tasks, not automatic setup operations. The API keys in `.env` are reserved for the future client and are not injected into containers.

## Normal start, stop and inspection

```bash
./scripts/start-erpnext.sh
docker compose ps
docker compose logs -f --tail=100 frontend backend
docker compose logs --tail=100 db queue-short queue-long scheduler websocket
./scripts/stop-erpnext.sh
```

Start waits for infrastructure, checks the site's installed apps, then starts the runtime and waits for frontend HTTP health. A timeout leaves containers/data available for diagnosis; inspect `ps` and logs. Stop uses `docker compose down` without volume removal. Ctrl+C exits log following, not the running containers. Neither normal start/stop nor setup removes data. Restarting does not require re-running the setup wizard.

## Persistent data and explicit reset

The fixed Compose project creates these named volumes:

| Volume | Contents |
| --- | --- |
| `mcp-erpnext_db-data` | MariaDB databases and database users |
| `mcp-erpnext_sites` | Site configuration/secrets, public/private files and site-local backups |
| `mcp-erpnext_logs` | Frappe application logs |
| `mcp-erpnext_redis-queue-data` | Redis queue append-only persistence |

Redis cache is ephemeral. The shared sites volume is mounted into all ERP services; database and files must be preserved together. Normal `docker compose down` keeps the dataset. Docker volumes are outside Git and outside the project directory. Historical `.local/ofbiz-framework` and any former `.local/frappe-bench` directories remain ignored and untouched. Backups inside `sites` are lost on reset too; export backups outside these volumes before deleting data you need.

The only provided deletion workflow is:

```bash
./scripts/reset-erpnext.sh
```

It warns about the fixed project's database, sites/files/backups, logs and queue data, requires an interactive terminal and the exact word `RESET`, then removes the project's volumes and recreates/starts a fresh environment. No flag bypasses confirmation. Cancellation, piped input and EOF cannot delete data. `.env` survives, so the recreated site uses its current passwords. Do not run manual Compose volume-removal or Docker volume-prune commands as a normal stop operation.

## API checks and later MCP integration

After browser setup, create a test stock Item and an API user with appropriate read permissions. Generate its key/secret in User settings and store them only in `.env`. The future `packages/erpnext-client` will own all HTTP calls; MCP tools will depend on it. The client will need explicit environment loading later.

For now, set `ERPNEXT_BASE_URL`, `ERPNEXT_API_KEY`, and `ERPNEXT_API_SECRET` in a local shell, then run these manual checks (do not source an arbitrary dotenv file as shell):

```bash
curl --fail-with-body http://localhost:8080/api/method/ping
curl --fail-with-body "$ERPNEXT_BASE_URL/api/method/frappe.auth.get_logged_user" \
  -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET"
curl --fail-with-body --get "$ERPNEXT_BASE_URL/api/resource/Item" \
  --data-urlencode 'fields=["name","item_code","item_name"]' \
  --data-urlencode 'limit_page_length=1' \
  -H "Authorization: token $ERPNEXT_API_KEY:$ERPNEXT_API_SECRET"
```

An empty Item list means no permitted test Item was retrieved. See the [Frappe REST reference](https://docs.frappe.io/framework/user/en/api/rest) for token authentication and DocType routes. Stock validation still requires a warehouse and stock transaction; no workshop dataset is seeded automatically.

The host-side MCP client will use `http://localhost:8080`. If a future MCP server is containerized on this Compose network, use `http://frontend:8080`, not container-local `localhost`. The configured frontend site header handles routing in both cases. Keep this stack local; remote hosting/TLS is outside this setup task.

## Validation status

Compose rendering, shell syntax and simulated script safety/idempotency checks can run without a Docker daemon. End-to-end image pulling, site creation, browser/API access, persistence across stop/start and confirmed reset still require a running Docker engine. These must be tested before the instructor demo/workshop; no live ERPNext validation is claimed in this change.
