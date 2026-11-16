// Read-only smoke test against the real ERPNext instance and repository .env.
import assert from 'node:assert/strict';
import { connectServer } from './stdio-session.mjs';

const itemCode = 'MCP-EL-001';
let client;
try {
  ({ client } = await connectServer());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_product_information', 'get_product_inventory']);
  console.log('PASS: stdio startup, MCP 2026-07-28 and both tool definitions.');
  for (const name of ['get_product_information', 'get_product_inventory']) {
    const result = await client.callTool({ name, arguments: { itemCode } });
    assert.ok(!result.isError, result.content.map(block => block.text ?? '').join('\n'));
    const data = result.structuredContent;
    assert.equal(data.itemCode, itemCode);
    if (name === 'get_product_information') {
      assert.equal(data.itemName, 'Wireless Mouse');
      assert.equal(data.isStockItem, true);
    } else {
      // Checks the stated demo quantity across returned warehouses; no warehouse name is hard-coded.
      assert.ok(data.warehouses.length > 0, 'The demo item has no inventory records.');
      assert.equal(data.warehouses.reduce((sum, row) => sum + row.actualQty, 0), 48);
      assert.equal(data.warehouses.reduce((sum, row) => sum + row.projectedQty, 0), 48);
      assert.equal(data.warehouses.reduce((sum, row) => sum + row.reservedQty, 0), 0);
    }
    console.log(`PASS: ${name}(${itemCode}).`);
  }
  for (const name of ['get_product_information', 'get_product_inventory']) {
    const invalid = await client.callTool({ name, arguments: { itemCode: '' } });
    assert.equal(invalid.isError, true);
  }
  // Dot segments cannot be Item document names under this server's input schema;
  // this other non-empty value must be absent from the workshop dataset.
  const missingCode = '__MCP_SMOKE_MISSING_ITEM__';
  const missing = await client.callTool({ name: 'get_product_information', arguments: { itemCode: missingCode } });
  assert.equal(missing.isError, true);
  assert.match(JSON.stringify(missing.content), /not found/i);
  const empty = await client.callTool({ name: 'get_product_inventory', arguments: { itemCode: missingCode } });
  assert.ok(!empty.isError);
  assert.deepEqual(empty.structuredContent.warehouses, []);
  console.log('PASS: invalid arguments, missing item and empty inventory behavior.');
} catch (error) {
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client?.close();
}
