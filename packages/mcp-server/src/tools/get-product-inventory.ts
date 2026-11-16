import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { erpnextGet, ErpnextError, type ErpnextConfig } from '../erpnext.js';
import { itemInput, readOnlyAnnotations, toolResult } from './result.js';

const binResponse = z.object({
  data: z.array(z.object({
    item_code: z.string().min(1),
    warehouse: z.string().min(1),
    actual_qty: z.number(), projected_qty: z.number(), reserved_qty: z.number(),
  })),
});
const warehouseSchema = z.object({
  warehouse: z.string(), actualQty: z.number(), projectedQty: z.number(), reservedQty: z.number(),
});

export function registerProductInventory(server: McpServer, config: ErpnextConfig): void {
  server.registerTool('get_product_inventory', {
    description: 'Retrieve current inventory quantities for an ERPNext item across its warehouses: actual, projected and reserved quantities. Use this for stock questions, not item descriptions. An empty warehouses list means no inventory records were found; it does not confirm whether the Item exists.',
    inputSchema: itemInput,
    outputSchema: z.object({
      itemCode: z.string(), warehouses: z.array(warehouseSchema), message: z.string().optional(),
    }),
    annotations: readOnlyAnnotations,
  }, async ({ itemCode }, ctx) => toolResult(async () => {
    const warehouses: z.infer<typeof warehouseSchema>[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data } = await erpnextGet(config, 'Bin', binResponse, {
        filters: JSON.stringify([['item_code', '=', itemCode]]),
        fields: JSON.stringify(['item_code', 'warehouse', 'actual_qty', 'projected_qty', 'reserved_qty']),
        order_by: 'name asc',
        limit_page_length: String(pageSize),
        limit_start: String(offset),
      }, ctx.mcpReq.signal);
      for (const row of data) {
        if (row.item_code !== itemCode) throw new ErpnextError('ERPNext returned an inventory row for an unexpected item code.');
        warehouses.push({
          warehouse: row.warehouse,
          actualQty: row.actual_qty,
          projectedQty: row.projected_qty,
          reservedQty: row.reserved_qty,
        });
      }
      if (data.length < pageSize) break;
    }
    return warehouses.length
      ? { itemCode, warehouses }
      : { itemCode, warehouses, message: 'No inventory records found for this item. Item existence is not established by an empty Bin result.' };
  }));
}
