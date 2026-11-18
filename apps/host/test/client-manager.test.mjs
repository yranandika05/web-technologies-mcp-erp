import assert from 'node:assert/strict';
import { test } from 'node:test';
import { McpClientManager } from '../dist/client-manager.js';
import { ERP_SERVER_SCRIPT, startMockErp } from './helpers/mock-erp.mjs';

await test('one MCP client per configured server, namespaced tools and routing', { timeout: 60_000 }, async t => {
  const erp = await startMockErp();
  t.after(erp.close);
  const server = name => ({ name, command: process.execPath, args: [ERP_SERVER_SCRIPT], env: erp.env, cwd: process.cwd() });
  const manager = await McpClientManager.connect([
    server('erp-a'),
    server('erp-b'),
    { name: 'broken', command: process.execPath, args: ['does-not-exist.js'], env: {}, cwd: process.cwd() },
  ]);
  t.after(() => manager.close());

  await t.test('status reports connected and failed servers', () => {
    const status = Object.fromEntries(manager.status().map(s => [s.name, s]));
    assert.equal(status['erp-a'].connected, true);
    assert.equal(status['erp-b'].connected, true);
    assert.equal(status['erp-a'].toolCount, 2);
    assert.equal(status.broken.connected, false);
    assert.match(status.broken.error, /\S/);
  });

  await t.test('tools of all connected servers are listed with a server prefix', () => {
    const tools = manager.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), [
      'erp-a__get_product_information', 'erp-a__get_product_inventory',
      'erp-b__get_product_information', 'erp-b__get_product_inventory',
    ]);
    const tool = tools.find(x => x.name === 'erp-a__get_product_inventory');
    assert.equal(tool.server, 'erp-a');
    assert.equal(tool.toolName, 'get_product_inventory');
    assert.match(tool.description, /\S/);
    assert.equal(tool.inputSchema.type, 'object');
  });

  await t.test('a tool call is routed to the right client and returns text', async () => {
    const result = await manager.callTool('erp-b__get_product_information', { itemCode: 'MCP-EL-001' });
    assert.equal(result.isError, false);
    assert.match(result.text, /Wireless Mouse/);
  });

  await t.test('tool errors from the server are passed through as isError', async () => {
    const result = await manager.callTool('erp-a__get_product_information', { itemCode: 'UNKNOWN' });
    assert.equal(result.isError, true);
  });

  await t.test('unknown tools give an error result instead of throwing', async () => {
    const result = await manager.callTool('nope__tool', {});
    assert.equal(result.isError, true);
    assert.match(result.text, /nope__tool/);
  });
});
