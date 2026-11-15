# Web Technologies – MCP ERP Integration

A prototype and workshop preparation project demonstrating how an AI application can access ERP functionality through the **Model Context Protocol (MCP)**, using **ERPNext** as the example ERP system.

The project is developed as technical preparation for a Web Technologies workshop (*Schulung*). Its purpose is to provide a working reference implementation of an MCP-based ERP integration and to serve as a technical basis for later exercise preparation.

## Project goal

The prototype demonstrates how a user can ask questions about ERP data in natural language while access to the ERP system is exposed through structured MCP tools.

The intended request flow is:

```text
User
  ↓
AI Application / MCP Host
  ├── Local LLM
  └── MCP Client
          ↓
       MCP Server
          ↓
     ERPNext Client
          ↓
 ERPNext / Frappe REST API
          ↓
       ERPNext
```

For the prototype, an MCP-capable local AI application such as **Unsloth Desktop** can provide the user interface, local LLM runtime, tool orchestration and MCP Client functionality.

This keeps the implementation focused on the MCP and ERP integration instead of requiring a custom chat frontend and host application from the beginning.

The MCP Server remains the central integration component developed in this repository. It exposes controlled ERP capabilities as structured tools and delegates ERP-specific HTTP communication to a dedicated ERPNext client.

The initial scope focuses on read-only ERP access.

## Reference architecture

The compact prototype architecture does not mean that all components must always run inside one application.

A more explicitly separated architecture can look like this:

```text
User
  ↓
Chat UI
  ↓
MCP Host / Agent
  ├── LLM
  └── MCP Client
          ↓
       MCP Server
          ↓
     ERPNext Client
          ↓
 ERPNext / Frappe REST API
          ↓
       ERPNext
```

A separated frontend and host application may be useful for demonstrations where the individual responsibilities of the MCP Host, MCP Client and MCP Server should be shown more explicitly.

For the prototype itself, these components do not need to be implemented as separate applications if the selected AI application already provides the required functionality.

## MCP tool flow

The MCP Server defines and exposes the available tools.

Examples include:

```text
get_product_information
get_product_inventory
get_product_price
```

The MCP Client discovers the available tools from the MCP Server and makes their descriptions and input schemas available to the LLM.

A typical request follows this pattern:

```text
User:
"How much stock is available for MCP-EL-001?"

        ↓

LLM selects:
get_product_inventory

        ↓

MCP Client
        ↓
MCP Server
        ↓
ERPNext Client
        ↓
ERPNext REST API

        ↓

Structured inventory result

        ↓

LLM formulates the final answer
```

The LLM selects the appropriate tool and its arguments. The tool itself is provided by the MCP Server and executed through the MCP integration.

## Repository structure

```text
web-technologies-mcp-erp/
├── apps/
│   ├── frontend/           # optional reference/demo application
│   └── host/               # optional custom MCP Host
│
├── packages/
│   ├── mcp-server/         # MCP Server and ERP-facing MCP tools
│   ├── erpnext-client/     # ERPNext/Frappe REST API adapter
│   └── shared/             # shared types and utilities
│
├── docker/
│   └── erpnext/
│
├── scripts/
│   ├── lib/
│   ├── setup-erpnext.sh
│   ├── start-erpnext.sh
│   ├── stop-erpnext.sh
│   └── reset-erpnext.sh
│
├── docs/
│   ├── migration-ofbiz-to-erpnext.md
│   ├── setup-erpnext.md
│   └── archive/
│
├── compose.yml
├── .env.example
├── .gitignore
└── README.md
```

All ERPNext/Frappe HTTP communication belongs in `packages/erpnext-client`.

The MCP Server should use this client instead of calling the ERPNext API directly. This separates ERP-specific communication from MCP-specific tool definitions and keeps the integration easier to maintain and test.

`packages/shared` is reserved for shared types and utilities.

The directories under `apps/` are optional for the prototype and can be used later for a separated reference implementation.

## ERP system

The project uses **ERPNext** as the ERP system and **Frappe** as the underlying application framework.

ERPNext is treated as an external system. Its source code and runtime dependencies are not copied into this repository.

The MCP integration communicates with ERPNext through the Frappe REST API.

The intended separation is:

```text
MCP Server
    ↓
ERPNext Client
    ↓
Frappe REST API
    ↓
ERPNext
```

The MCP Server does not access the ERP database directly.

This keeps ERP access behind the application's existing API and business logic instead of exposing unrestricted database operations.

## Local ERPNext setup

Docker is the default environment for running ERPNext locally.

This reduces dependency differences between developers, demonstrations and later workshop preparation.

The setup follows the official Frappe Docker architecture and uses persistent Docker volumes for ERPNext data.

### Requirements

Install:

- Git
- Docker Desktop on macOS or Docker Engine on Linux
- Docker Compose v2 or newer

Node.js is required for the TypeScript-based MCP components.

A local installation of Bench, MariaDB, Redis or the Frappe Python environment is not required.

### Initial setup

Clone the repository:

```bash
git clone <repository-url>
cd web-technologies-mcp-erp
```

Create the local environment file:

```bash
cp .env.example .env
```

Configure the required local credentials:

```text
ADMIN_PASSWORD=
DB_ROOT_PASSWORD=
DB_PASSWORD=
```

The `.env` file contains local credentials and must not be committed.

Start the initial ERPNext setup:

```bash
./scripts/setup-erpnext.sh
./scripts/start-erpnext.sh
```

ERPNext is available at:

```text
http://localhost:8080
```

Log in using the configured administrator credentials and complete the ERPNext setup wizard if necessary.

## Starting and stopping ERPNext

Start the environment:

```bash
./scripts/start-erpnext.sh
```

Check the container status:

```bash
docker compose ps
```

Test the Frappe API:

```bash
curl --fail http://localhost:8080/api/method/ping
```

Expected response:

```json
{"message":"pong"}
```

Stop the environment:

```bash
./scripts/stop-erpnext.sh
```

Stopping the environment does not delete the ERPNext dataset.

The database, site data and other persistent runtime data are stored in named Docker volumes and are restored when the environment is started again.

Inspect logs with:

```bash
docker compose logs -f --tail=100 frontend backend
```

## Resetting the ERP environment

A complete reset can be performed with:

```bash
./scripts/reset-erpnext.sh
```

This operation is destructive and removes the local ERPNext dataset.

The script therefore requires an explicit confirmation:

```text
RESET
```

Use a normal stop/start cycle during regular development and only reset the environment when a completely fresh ERPNext instance is required.

See [docs/setup-erpnext.md](docs/setup-erpnext.md) for additional setup details and troubleshooting.

## MCP Server

The MCP Server exposes business-oriented ERP capabilities as structured tools.

The initial design uses read-only tools such as:

```text
get_product_information(itemCode)
get_product_inventory(itemCode)
get_product_price(itemCode)
```

Additional capabilities can be added as the prototype evolves.

The project deliberately avoids unrestricted SQL execution or direct database access.

Instead, each MCP tool represents a clearly defined ERP capability with explicit input validation and a controlled implementation.

## Local AI application

The prototype can use an MCP-capable local AI application such as **Unsloth Desktop**.

In this setup, the AI application can provide:

- the user-facing chat interface,
- the local LLM runtime,
- tool selection,
- MCP Client functionality,
- and the orchestration between the LLM and MCP Server.

The MCP Server remains independent from the selected LLM application.

This means the same MCP Server can also be connected to another compatible MCP Host or to a custom host implementation.

## Prototype purpose

The goal of this repository is not to build a complete production ERP chatbot.

Its purpose is to demonstrate and understand the integration pattern:

```text
AI Application
      ↓
MCP Client
      ↓
MCP Server
      ↓
Business-oriented ERP integration
      ↓
ERPNext
```

The prototype serves as a technical reference for:

- understanding the MCP architecture,
- validating ERP access through structured MCP tools,
- demonstrating the complete request flow,
- and supporting later workshop and exercise preparation.