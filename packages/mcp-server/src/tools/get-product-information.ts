import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { erpnextGet, ErpnextError, type ErpnextConfig } from '../erpnext.js';
import { itemInput, readOnlyAnnotations, toolResult } from './result.js';

const flag = z.union([z.literal(0), z.literal(1), z.boolean()]);
const itemResponse = z.object({
  data: z.object({
    item_code: z.string().min(1),
    item_name: z.string(),
    item_group: z.string(),
    stock_uom: z.string(),
    description: z.string().nullable(),
    is_stock_item: flag,
    disabled: flag,
  }),
});

export function registerProductInformation(server: McpServer, config: ErpnextConfig): void {
  server.registerTool('get_product_information', {
    description: 'Retrieve master data and descriptive information for an ERPNext item by item code. Use this for its name, group, unit, description and stock/disabled flags, not warehouse quantities.',
    inputSchema: itemInput,
    outputSchema: z.object({
      itemCode: z.string(), itemName: z.string(), itemGroup: z.string(),
      stockUom: z.string(), description: z.string().nullable(),
      isStockItem: z.boolean(), disabled: z.boolean(),
    }),
    annotations: readOnlyAnnotations,
  }, async ({ itemCode }, ctx) => toolResult(async () => {
    const { data } = await erpnextGet(config, `Item/${encodeURIComponent(itemCode)}`, itemResponse, {}, ctx.mcpReq.signal);
    if (data.item_code !== itemCode) throw new ErpnextError('ERPNext returned an unexpected item code.');
    return {
      itemCode: data.item_code,
      itemName: data.item_name,
      itemGroup: data.item_group,
      stockUom: data.stock_uom,
      description: data.description,
      isStockItem: Boolean(data.is_stock_item),
      disabled: Boolean(data.disabled),
    };
  }));
}
