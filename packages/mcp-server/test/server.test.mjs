import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { connectServer } from './stdio-session.mjs';

const item = {
  item_code: 'MCP-EL-001', item_name: 'Wireless Mouse', item_group: 'Products',
  stock_uom: 'Nos', description: 'Compact wireless mouse for office use.',
  is_stock_item: 1, disabled: 0, internal_secret: 'must not be returned',
};
const row = warehouse => ({
  item_code: 'MCP-EL-001', warehouse, actual_qty: 48, projected_qty: 48, reserved_qty: 0,
});

await test('stdio server speaks MCP 2026-07-28 and exposes safe, read-only ERP tools', { timeout: 30_000 }, async t => {
  let behavior = 'normal';
  const requests = [];
  const http = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    requests.push({ url, method: req.method });
    assert.equal(req.headers.authorization, 'token test-key:test-secret');
    const respond = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (['401', '403', '500'].includes(behavior)) return respond(Number(behavior), { exception: 'test-secret: private ERP traceback' });
    if (behavior === 'invalid-json') { res.writeHead(200); return res.end('<html>not JSON</html>'); }
    if (behavior === 'invalid-shape') return respond(200, { data: { internal_secret: 'test-secret' } });
    if (behavior === 'bad-row') return respond(200, { data: [{ ...row('Other'), actual_qty: '48' }] });
    if (behavior === 'redirect') { res.writeHead(302, { Location: '/login' }); return res.end(); }
    if (url.pathname.startsWith('/api/resource/Item/')) {
      if (url.pathname !== '/api/resource/Item/MCP-EL-001') return respond(404, { exception: 'test-secret' });
      return respond(200, { data: item });
    }
    assert.equal(url.pathname, '/api/resource/Bin');
    const requestedItem = JSON.parse(url.searchParams.get('filters'))[0][2];
    assert.deepEqual(JSON.parse(url.searchParams.get('fields')), ['item_code', 'warehouse', 'actual_qty', 'projected_qty', 'reserved_qty']);
    if (requestedItem !== 'MCP-EL-001' || behavior === 'empty') return respond(200, { data: [] });
    const rows = behavior === 'paged' ? Array.from({ length: 102 }, (_, i) => row(`Warehouse ${i}`)) : [row('Stores - MCP'), row('Second warehouse')];
    const offset = Number(url.searchParams.get('limit_start'));
    return respond(200, { data: rows.slice(offset, offset + Number(url.searchParams.get('limit_page_length'))) });
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  t.after(() => { http.closeAllConnections(); http.close(); });
  const { client, sent, stderr } = await connectServer({
    ERPNEXT_BASE_URL: `http://127.0.0.1:${http.address().port}`,
    ERPNEXT_API_KEY: 'test-key', ERPNEXT_API_SECRET: 'test-secret',
  });
  t.after(() => client.close());
  const call = (name, args = { itemCode: 'MCP-EL-001' }) => client.callTool({ name, arguments: args });
  const text = result => result.content.filter(block => block.type === 'text').map(block => block.text).join('\n');

  await t.test('discovery lists exactly two validated read-only tools', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_product_information', 'get_product_inventory']);
    for (const tool of tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.deepEqual(tool.inputSchema.required, ['itemCode']);
      assert.equal(tool.inputSchema.properties.itemCode.type, 'string');
      assert.ok(tool.outputSchema);
    }
  });
  await t.test('product maps only business fields', async () => {
    const result = await call('get_product_information');
    assert.ok(!result.isError, text(result));
    assert.deepEqual(result.structuredContent, {
      itemCode: 'MCP-EL-001', itemName: 'Wireless Mouse', itemGroup: 'Products', stockUom: 'Nos',
      description: item.description, isStockItem: true, disabled: false,
    });
    assert.ok(!JSON.stringify(result).includes('internal_secret'));
  });
  await t.test('inventory returns all warehouses and follows pagination', async () => {
    const result = await call('get_product_inventory');
    assert.ok(!result.isError, text(result));
    assert.equal(result.structuredContent.warehouses.length, 2);
    assert.deepEqual(result.structuredContent.warehouses[0], { warehouse: 'Stores - MCP', actualQty: 48, projectedQty: 48, reservedQty: 0 });
    behavior = 'paged';
    const paged = await call('get_product_inventory');
    assert.equal(paged.structuredContent.warehouses.length, 102);
    assert.equal(paged.structuredContent.warehouses[101].warehouse, 'Warehouse 101');
    behavior = 'normal';
  });
  await t.test('schema rejects missing, empty, whitespace, wrong-type and dot-path item codes before HTTP', async () => {
    const before = requests.length;
    for (const tool of ['get_product_information', 'get_product_inventory']) {
      for (const args of [{}, { itemCode: '' }, { itemCode: '   ' }, { itemCode: 12 }, { itemCode: '..' }]) {
        const result = await call(tool, args);
        assert.equal(result.isError, true);
        assert.match(text(result), /itemCode|arguments/i);
      }
    }
    assert.equal(requests.length, before);
  });
  await t.test('not found is an error; no Bin rows are an explicit empty result', async () => {
    const missing = await call('get_product_information', { itemCode: 'MISSING' });
    assert.equal(missing.isError, true); assert.match(text(missing), /not found/i);
    const empty = await call('get_product_inventory', { itemCode: 'MISSING' });
    assert.ok(!empty.isError);
    assert.deepEqual(empty.structuredContent.warehouses, []);
    assert.match(empty.structuredContent.message, /No inventory records/);
  });
  await t.test('item codes and filters are URL encoded', async () => {
    await call('get_product_information', { itemCode: 'A/B ?#' });
    assert.equal(requests.at(-1).url.pathname, '/api/resource/Item/A%2FB%20%3F%23');
    const code = 'A" OR 1=1';
    await call('get_product_inventory', { itemCode: code });
    assert.deepEqual(JSON.parse(requests.at(-1).url.searchParams.get('filters')), [['item_code', '=', code]]);
  });
  await t.test('HTTP and malformed responses are understandable and do not expose upstream secrets', async () => {
    for (const [mode, message, tool] of [
      ['401', /authentication failed/i, 'get_product_information'],
      ['403', /permission denied/i, 'get_product_inventory'],
      ['500', /unavailable/i, 'get_product_information'],
      ['invalid-json', /invalid JSON/i, 'get_product_information'],
      ['invalid-shape', /unexpected response/i, 'get_product_information'],
      ['bad-row', /unexpected response/i, 'get_product_inventory'],
      ['redirect', /unavailable/i, 'get_product_information'],
    ]) {
      behavior = mode;
      const result = await call(tool);
      assert.equal(result.isError, true, mode); assert.match(text(result), message);
      assert.ok(!JSON.stringify(result).includes('test-secret'));
    }
    behavior = 'normal';
  });
  await t.test('requests carry modern metadata and never initialize a session', () => {
    const requests = sent.filter(message => message.method);
    assert.ok(requests.some(message => message.method === 'tools/call'));
    assert.ok(!requests.some(message => message.method === 'initialize'));
    for (const message of requests) {
      assert.equal(message.params._meta['io.modelcontextprotocol/protocolVersion'], '2026-07-28');
      assert.ok(message.params._meta['io.modelcontextprotocol/clientCapabilities']);
    }
    assert.ok(!stderr().includes('test-secret'));
  });
  await t.test('unavailable ERPNext produces a tool error', async () => {
    http.closeAllConnections();
    await new Promise(resolve => http.close(resolve));
    const result = await call('get_product_information');
    assert.equal(result.isError, true); assert.match(text(result), /unavailable/i);
  });
  assert.ok(requests.every(request => request.method === 'GET'));
});

await test('missing credentials fail at startup without stdout or secrets', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
    env: { ...process.env, ERPNEXT_BASE_URL: 'http://localhost:8080', ERPNEXT_API_KEY: '', ERPNEXT_API_SECRET: 'not-for-output' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [code] = await once(child, 'close');
  assert.equal(code, 1); assert.equal(stdout, '');
  assert.match(stderr, /Missing ERPNEXT_API_KEY/);
  assert.ok(!stderr.includes('not-for-output'));
});

await test('legacy initialization is rejected instead of silently using an older MCP revision', { timeout: 10_000 }, async t => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
    env: { ...process.env, ERPNEXT_BASE_URL: 'http://localhost:8080', ERPNEXT_API_KEY: 'test-key', ERPNEXT_API_SECRET: 'test-secret' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const lines = createInterface({ input: child.stdout });
  const answer = once(lines, 'line', { signal: t.signal });
  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-test', version: '1.0.0' },
    },
  }) + '\n');
  const [line] = await answer;
  const response = JSON.parse(line);
  assert.equal(response.id, 1);
  assert.ok(response.error);
  assert.match(JSON.stringify(response.error), /2026-07-28/);
  assert.equal(response.result, undefined);
  const closed = once(child, 'close');
  child.stdin.end();
  await closed;
  lines.close();
});
