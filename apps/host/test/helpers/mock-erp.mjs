// Minimal Frappe REST API mock for the ERPNext MCP server (packages/mcp-server).
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

export const ERP_SERVER_SCRIPT = fileURLToPath(new URL('../../../../packages/mcp-server/dist/index.js', import.meta.url));

const item = {
  item_code: 'MCP-EL-001', item_name: 'Wireless Mouse', item_group: 'Products',
  stock_uom: 'Nos', description: 'Compact wireless mouse.', is_stock_item: 1, disabled: 0,
};

export async function startMockErp() {
  const http = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const respond = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/api/resource/Item/MCP-EL-001') return respond(200, { data: item });
    if (url.pathname.startsWith('/api/resource/Item/')) return respond(404, {});
    if (url.pathname === '/api/resource/Bin') {
      const rows = [{ item_code: 'MCP-EL-001', warehouse: 'Stores - MCP', actual_qty: 48, projected_qty: 48, reserved_qty: 0 }];
      return respond(200, { data: Number(url.searchParams.get('limit_start')) > 0 ? [] : rows });
    }
    respond(404, {});
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  return {
    env: {
      ERPNEXT_BASE_URL: `http://127.0.0.1:${http.address().port}`,
      ERPNEXT_API_KEY: 'test-key',
      ERPNEXT_API_SECRET: 'test-secret',
    },
    close: () => { http.closeAllConnections(); http.close(); },
  };
}
