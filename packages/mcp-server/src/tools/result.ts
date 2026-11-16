import type { CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ErpnextError } from '../erpnext.js';

export const itemInput = z.object({
  itemCode: z.string().trim().min(1, 'itemCode must be a non-empty string')
    .refine(value => value !== '.' && value !== '..', 'itemCode must identify an item, not a path segment')
    .describe('ERPNext Item code, for example MCP-EL-001'),
});

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export async function toolResult(operation: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await operation();
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error instanceof ErpnextError ? error.message : 'The ERPNext tool could not complete the request.' }],
    };
  }
}
