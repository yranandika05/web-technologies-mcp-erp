# ERPNext MCP Server

A small read-only TypeScript server. It calls the Frappe REST API directly using `src/erpnext.ts`; there is no separate ERP adapter package or application-side Host/Client here.

```text
MCP-capable AI application / MCP Client
                    ↓ stdio
                MCP Server
                    ↓ HTTP GET
          ERPNext / Frappe REST API
                    ↓
                 ERPNext
```

## Install and run

For the complete fresh-clone setup, demo data and Unsloth configuration, follow the [root getting-started guide](../../README.md). This page covers server development, protocol behavior and tests.

Use Node.js 22+ and npm. ERPNext must already be available, normally at `http://localhost:8080`. In the repository root `.env`, configure:

```dotenv
ERPNEXT_BASE_URL=http://localhost:8080
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=
```

Fill the two empty values with your API user's credentials. The user needs read access to Item and Bin, including the warehouses used in the demo. The server reads only these three configuration values. Node's dotenv loader loads the root file relative to the server module, independent of the working directory; existing process environment values take precedence. Keep dotenv values literal (no variable interpolation). Credentials and upstream exception bodies are never included in tool errors.

From `packages/mcp-server`:

```bash
npm ci
npm run build
npm start
```

`npm run dev` runs the TypeScript entry with `tsx`. `npm start` runs the compiled entry and waits for MCP requests; it is not an interactive terminal UI. For a desktop host, use the absolute Node executable as its command and the absolute path to `packages/mcp-server/dist/index.js` as the argument. Launch Node directly, rather than npm, to keep npm banners out of the protocol channel. Unsloth Desktop can launch this command directly; its verified configuration is documented in the [root guide](../../README.md#5-connect-unsloth-desktop).

## Tools

Both tools require an object such as `{"itemCode":"MCP-EL-001"}`. Missing, empty, whitespace-only and non-string codes are rejected by the input schema. Surrounding whitespace is trimmed. Dot path segments are rejected, item document names are URL-encoded, and Bin filters are JSON-encoded query parameters.

| Tool | Business result |
| --- | --- |
| `get_product_information` | `itemCode`, `itemName`, `itemGroup`, `stockUom`, nullable `description`, boolean `isStockItem` and `disabled` |
| `get_product_inventory` | `itemCode` and `warehouses`, each with `warehouse`, `actualQty`, `projectedQty`, `reservedQty` |

Successful results contain both `structuredContent` and JSON text, with output schemas for clients. The inventory tool follows Bin pagination in pages of 100 and returns every row visible to the API user, without assuming a warehouse name. It reads current data; multiple pages are not a transactional snapshot. An empty result returns `warehouses: []` and an explicit message. This does not establish whether the Item exists; use the information tool to check that separately.

HTTP 401, 403, 404, server/unavailability errors, invalid JSON and unexpected field types produce readable `isError: true` tool results. Unknown exceptions produce a generic message. No quantities are invented, no raw ERP documents are returned, and only GET requests are sent. Requests have a 20-second timeout per HTTP page and follow MCP cancellation. HTTP redirects are rejected rather than forwarding API credentials.

## MCP revision and transport

The runtime dependency is pinned to `@modelcontextprotocol/server` **2.4.0**, with Zod v4 input/output schemas. The server uses the current [`serveStdio(factory)` entry](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html), `registerTool`, `supportedProtocolVersions: ['2026-07-28']` and `legacy: 'reject'`.

The SDK handles [2026-07-28 request metadata and wire behavior](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio); this code does not implement an initialization/session handshake. Only MCP JSON-RPC goes to stdout; startup/transport diagnostics go to stderr. Closing stdin shuts down the connection; SIGINT/SIGTERM also close the SDK handle.

A host must support the 2026-07-28 revision. A host that only sends a legacy `initialize` exchange is rejected intentionally. The local Unsloth Desktop connection has been verified with both tools, including a product-information chat request. A different host/build still needs to support this revision; the tested Desktop version and model are not pinned in this repository. See the official [v2 revision guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html); using a v2 package with old transport wiring alone would not select the new protocol.

## Development and live tests

```bash
npm test
npm run test:live
```

`npm test` uses Node's test runner, a temporary loopback mock ERP server and the official `@modelcontextprotocol/client` **2.4.0** as a test-only dependency. It launches the built server over real stdio, pins negotiation to `2026-07-28` without fallback, and checks discovery, both results, multiple warehouses/pagination, invalid arguments, not-found/empty data, authentication/permission failures, malformed responses, unavailable ERPNext, encoding, credential redaction and modern per-request metadata. It does not use your ERP data. Tests need permission to listen on loopback.

`npm run test:live` uses the root `.env` against the real ERPNext instance, through the same stdio server. It expects the prepared demo Item `MCP-EL-001` to be **Wireless Mouse**, a stock Item, with totals of **48 actual**, **48 projected** and **0 reserved** units across returned warehouses. These assertions live only in the test, not in the tools. If the dataset changes, review the assertions. The missing-item check assumes `__MCP_SMOKE_MISSING_ITEM__` does not exist. It also checks empty-code rejection and empty inventory for that missing code. The smoke test performs no writes and prints pass/fail summaries rather than credentials or complete ERP documents. A successful scripted test does not test LLM tool selection; use the [chat examples](../../README.md#6-test-the-complete-mcp-flow) for that separate check.
