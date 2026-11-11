# Web Technologies – MCP ERP Integration

Prototype and workshop project for integrating an ERP system with an AI application using the **Model Context Protocol (MCP)**.

The project is developed as part of the Web Technologies course and will later serve as the technical basis for the presentation, live demonstration and practical exercise.

## Project Goal

The final prototype should demonstrate the following flow:

**User → Chat UI → LLM / MCP Host → MCP Client → MCP Server → Apache OFBiz → MCP Server → LLM → User**

The user should be able to request ERP information in natural language. The LLM selects an appropriate MCP tool, the MCP server accesses the corresponding ERP functionality, and the result is returned to the user as a natural-language response.

The initial prototype focuses on read-only operations such as product information and inventory data.

---

## Repository Structure

The planned repository structure is:

```text
web-technologies-mcp-erp/
├── apps/
│   ├── frontend/
│   └── host/
│
├── packages/
│   ├── mcp-server/
│   ├── ofbiz-client/
│   └── shared/
│
├── scripts/
│   ├── setup-ofbiz.sh
│   └── start-ofbiz.sh
│
├── .local/
│   └── ofbiz-framework/
│
├── .gitignore
└── README.md
```

Apache OFBiz itself is **not part of this Git repository**.

The OFBiz source code is cloned into `.local/ofbiz-framework` during local setup. The complete `.local` directory is ignored by Git.

This avoids committing the complete OFBiz repository as a nested repository while still allowing every team member to use exactly the same OFBiz version.

---

## Requirements

Before running the project, the following software should be available:

- Git
- Java Development Kit (JDK)
- Bash-compatible shell
- Internet connection for the initial OFBiz dependency download

The currently used OFBiz trunk documentation should be checked for the required JDK version.

Verify Java with:

```bash
java -version
```

and Git with:

```bash
git --version
```

---

## Apache OFBiz Version

For reproducibility, the project currently uses the following OFBiz commit:

```text
27ca871d3212468196f3ae7cbc02ab08880207d3
```

All team members should use this revision until the project explicitly updates it.

---

## Initial Setup

Clone this repository and enter the project directory:

```bash
git clone <repository-url>
cd web-technologies-mcp-erp
```

Make the setup scripts executable:

```bash
chmod +x scripts/setup-ofbiz.sh
chmod +x scripts/start-ofbiz.sh
```

Then run:

```bash
./scripts/setup-ofbiz.sh
```

The setup script:

1. clones Apache OFBiz into `.local/ofbiz-framework`;
2. checks out the pinned OFBiz commit;
3. initializes the Gradle wrapper;
4. downloads the required dependencies;
5. resets OFBiz and loads the complete demo dataset.

> **Warning:** `cleanAll loadAll` resets the local OFBiz database and restores the demo data. Do not use this command later if local data needs to be preserved.

---

## Starting OFBiz

After the initial setup, start OFBiz with:

```bash
./scripts/start-ofbiz.sh
```

The OFBiz process remains active while the server is running.

The following interfaces can then be opened locally:

- WebTools: `https://localhost:8443/webtools`
- Catalog Manager: `https://localhost:8443/catalog`
- Order Manager: `https://localhost:8443/ordermgr`
- REST Swagger UI: `https://localhost:8443/docs/api/swagger-ui.html`
- REST WADL: `https://localhost:8443/rest/application.wadl`

The demo installation currently uses:

```text
Username: admin
Password: ofbiz
```

Because the local OFBiz server uses a development HTTPS certificate, the browser may display a certificate warning for `localhost`.

---

## Current Development Status

The basic OFBiz setup has already been tested successfully.

The following steps are confirmed to work:

- OFBiz source code can be cloned and built locally.
- The Gradle wrapper can be initialized.
- The complete OFBiz demo dataset can be loaded.
- OFBiz can be started locally.
- The WebTools and Catalog Manager interfaces are accessible.
- Demo products are available.
- The REST API is active.
- JWT authentication through the REST API works.
- REST endpoints can be inspected through Swagger and WADL.
- Product-related ERP data can be retrieved programmatically.

---

## Tested Demo Product

The current prototype uses the following OFBiz demo product:

```text
Product ID:   GZ-2644
Product Name: Round Gizmo
Product Type: Finished Good
```

The product exists in the demo dataset and can be inspected through the OFBiz Catalog Manager.

---

## REST API Authentication

The current OFBiz REST API uses JWT authentication.

For the default native API group, an access token can be obtained from:

```text
POST /rest/auth/api/token
```

Example:

```bash
curl -k -X POST "https://localhost:8443/rest/auth/api/token" \
  -H "accept: application/json" \
  -H "Authorization: Basic YWRtaW46b2ZiaXo"
```

The encoded credentials in this development example represent the default demo credentials `admin:ofbiz`.

A successful response contains an `access_token`, a `refresh_token`, the token type and the expiration time.

The access token must then be supplied to protected endpoints using:

```text
Authorization: Bearer <access-token>
```

> Tokens, passwords and other credentials must never be committed to Git. Later project components will use environment variables through `.env` files.

The `-k` option is currently used only because the local OFBiz instance uses a development HTTPS certificate.

---

## Inspecting Available REST Endpoints

The REST API can be inspected through Swagger:

```text
https://localhost:8443/docs/api/swagger-ui.html
```

or through the generated WADL:

```bash
curl -k "https://localhost:8443/rest/application.wadl"
```

For example, product-related routes can be searched with:

```bash
curl -k "https://localhost:8443/rest/application.wadl" | grep -i product
```

This is useful because only REST endpoints actually registered by the current OFBiz revision should be used. Example endpoints from older documentation may differ from the current trunk implementation.

---

## Successfully Tested Product Request

A product-related endpoint has already been tested successfully:

```text
GET /rest/api/bom-management/{productId}
```

For the demo product:

```bash
curl -k "https://localhost:8443/rest/api/bom-management/GZ-2644" \
  -H "Authorization: Bearer $TOKEN"
```

The current response contains information such as:

```text
productId:      GZ-2644
productName:    Round Gizmo
internalName:   Round Gizmo
bomType:        MANUF_COMPONENT
componentCount: 0
```

This endpoint belongs to the **BOM Management API**. It proves that OFBiz data can already be accessed programmatically, but it is not necessarily the final endpoint that will be used by the MCP prototype.

---

## Important Findings

### OFBiz is an external dependency

OFBiz is not installed like an npm package. The OFBiz source code is downloaded separately and then built and executed using Gradle.

Therefore the project repository does not contain the complete OFBiz source code.

### Existing ERP functionality should be reused

The MCP server should not directly contain OFBiz-specific database logic.

The planned separation is:

**MCP Tool → OFBiz Client → OFBiz REST API / Service → OFBiz**

This keeps MCP-specific functionality separate from the ERP implementation.

### REST endpoints depend on the OFBiz revision

Endpoints shown in older examples or documentation may not exist in the currently used OFBiz trunk revision.

The locally generated Swagger documentation and WADL are therefore the primary sources for inspecting the endpoints actually available in the running instance.

### Current REST authentication path

For the current revision, the tested authentication endpoint is:

```text
/rest/auth/api/token
```

The `api` segment represents the API group.

---

## Next Steps

The next technical goals are:

1. identify an appropriate OFBiz service or REST endpoint for product information;
2. identify an appropriate endpoint for product inventory;
3. create a TypeScript `ofbiz-client`;
4. verify that the client can retrieve OFBiz data;
5. implement the first MCP server tool;
6. test the MCP server without an LLM;
7. implement the MCP Host and MCP Client;
8. connect an LLM and enable automatic tool selection;
9. add a simple React/Vite chat interface;
10. derive the practical workshop exercise from the working implementation.

The first planned MCP tools are:

```text
getProductInformation(productId)
getProductInventory(productId)
```

The practical exercise will later focus on implementing or completing selected MCP tools while the frontend, LLM integration, MCP client and OFBiz infrastructure are already prepared.