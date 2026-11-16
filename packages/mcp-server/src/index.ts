import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { ErpnextError, readConfig } from './erpnext.js';
import { registerProductInformation } from './tools/get-product-information.js';
import { registerProductInventory } from './tools/get-product-inventory.js';

try {
  const config = readConfig();
  const handle = serveStdio(() => {
    const server = new McpServer(
      { name: 'erpnext-workshop', version: '0.1.0' },
      { supportedProtocolVersions: ['2026-07-28'] },
    );
    registerProductInformation(server, config);
    registerProductInventory(server, config);
    return server;
  }, {
    legacy: 'reject',
    onerror: () => console.error('MCP transport error. Check the client’s MCP revision and request format.'),
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void handle.close(); });
  }
} catch (error) {
  console.error(error instanceof ErpnextError ? error.message : 'Unable to start the ERPNext MCP server.');
  process.exitCode = 1;
}
