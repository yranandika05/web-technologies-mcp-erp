# Web Technologies – MCP ERP Integration

A prototype and workshop project demonstrating how an AI application can access ERP functionality through the Model Context Protocol (MCP), using ERPNext as the example ERP system.

## Project goal

The planned request flow is:

```text
User
→ Chat UI
→ LLM / MCP Host
→ MCP Client
→ MCP Server
→ ERPNext Client
→ ERPNext / Frappe REST API
→ ERPNext
```

The LLM will select a tool to retrieve ERP information and use its result to answer the user. Initial tools will provide read-only product and inventory access.

## Planned repository structure

```text
web-technologies-mcp-erp/
├── apps/
│   ├── frontend/
│   └── host/
├── packages/
│   ├── mcp-server/
│   ├── erpnext-client/
│   └── shared/
├── docker/
│   └── erpnext/
├── scripts/
│   ├── lib/
│   ├── setup-erpnext.sh
│   ├── start-erpnext.sh
│   ├── stop-erpnext.sh
│   └── reset-erpnext.sh
├── docs/
│   ├── migration-ofbiz-to-erpnext.md
│   ├── setup-erpnext.md
│   └── archive/
├── compose.yml
├── .env.example
├── .gitignore
└── README.md
```

`apps/host` will contain the LLM/MCP Host and MCP Client; `apps/frontend` will contain the chat UI. All ERPNext/Frappe HTTP communication will belong in `packages/erpnext-client`. The MCP server will depend on that client instead of making ERP API calls directly. `packages/shared` is reserved for shared types. These directories currently contain only `.gitkeep` files.

ERPNext runs as an external runtime in official Docker images. Named Docker volumes hold its database, sites/files, logs and queue data. ERP source and dependencies are not copied into this repository. Historical ignored `.local/` runtimes remain untouched.

## Current development status

The earlier OFBiz prototype proved that the general ERP integration concept is feasible: local startup, demo data, JWT REST authentication and programmatic ERP data access worked. The project is now migrating to ERPNext for a cleaner integration interface. See the [migration rationale](docs/migration-ofbiz-to-erpnext.md) and [historical OFBiz documentation](docs/archive/README-ofbiz.md).

This revision prepares structure, documentation and setup wrappers only. ERPNext startup and API access have not yet been validated for this project. No ERP client, MCP server/client, LLM integration or frontend is implemented.

## Local ERPNext setup

Docker is the default to reduce dependency differences between the three developers, instructor demo and workshop participants. The stack adapts the [official Frappe Docker Compose approach](https://github.com/frappe/frappe_docker) with persistent volumes and explicit site initialization, rather than the disposable `pwd.yml` demo.

Install Git, Docker Desktop (macOS) or Docker Engine (Linux), and Docker Compose v2 or newer. Node.js will be needed later for the MCP exercise. No host Bench, MariaDB, Redis or Python environment is required.

```bash
git clone <repository-url>
cd web-technologies-mcp-erp
cp .env.example .env
# Edit .env: fill ADMIN_PASSWORD, DB_ROOT_PASSWORD and DB_PASSWORD.
./scripts/setup-erpnext.sh
./scripts/start-erpnext.sh
```

Open `http://localhost:8080`, sign in as `Administrator` with your configured password, and complete the ERPNext setup wizard. Setup pulls the images and creates the site, installing ERPNext only if needed. Re-running setup preserves an existing working site. Password changes in `.env` do not rotate credentials already stored in persistent data.

```bash
./scripts/stop-erpnext.sh                 # Keeps the dataset
docker compose ps
docker compose logs -f --tail=100 frontend backend
./scripts/reset-erpnext.sh                # Requires interactive RESET; deletes data
```

See the [setup guide](docs/setup-erpnext.md) for versions, architecture, persistence, troubleshooting and manual API checks. Runtime startup has not yet been validated on this machine. The future MCP server will call the ERPNext REST API through `packages/erpnext-client`; no application functionality is implemented here.

## Planned MCP tools

- `getProductInformation(itemCode)`
- `getProductInventory(itemCode)`
- Optionally later: `getCustomerOrders(customerId)`

## Next steps

1. Set up ERPNext locally.
2. Confirm access to ERPNext/Frappe REST API.
3. Retrieve one test `Item`.
4. Retrieve inventory/stock information.
5. Implement the TypeScript `erpnext-client`.
6. Implement the first MCP tool.
7. Implement the MCP Host and Client.
8. Add LLM tool selection.
9. Add a simple frontend.
10. Derive the workshop exercise from the working prototype.
