import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { ServerConfig } from './servers-config.js';

/** Separator between server name and tool name, e.g. "erpnext__get_product_inventory". */
export const TOOL_SEPARATOR = '__';

export interface ToolInfo {
  /** Name shown to the LLM: "<server>__<tool>". */
  name: string;
  server: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallResult {
  text: string;
  isError: boolean;
}

export interface ServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

interface Connection {
  config: ServerConfig;
  client?: Client;
  tools: ToolInfo[];
  error?: string;
}

/**
 * The MCP part of the host: one MCP client per configured server.
 * A server that fails to start is reported in status() and does not block the others.
 */
export class McpClientManager {
  private constructor(private readonly connections: Connection[]) {}

  static async connect(servers: ServerConfig[]): Promise<McpClientManager> {
    return new McpClientManager(await Promise.all(servers.map(connectOne)));
  }

  status(): ServerStatus[] {
    return this.connections.map(c => ({
      name: c.config.name,
      connected: c.client !== undefined,
      toolCount: c.tools.length,
      ...(c.error ? { error: c.error } : {}),
    }));
  }

  listTools(): ToolInfo[] {
    return this.connections.flatMap(c => c.tools);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const connection = this.connections.find(c => c.tools.some(t => t.name === name));
    const tool = connection?.tools.find(t => t.name === name);
    if (!connection?.client || !tool) return { text: `Unknown tool: ${name}`, isError: true };
    try {
      const result = await connection.client.callTool({ name: tool.toolName, arguments: args });
      return { text: resultToText(result), isError: result.isError === true };
    } catch (error) {
      return { text: `Tool ${name} failed: ${errorMessage(error)}`, isError: true };
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.connections.map(c => c.client?.close()));
  }
}

async function connectOne(config: ServerConfig): Promise<Connection> {
  // 'auto' prefers the 2026-07-28 revision and falls back to older servers,
  // so participants can also plug in existing third-party MCP servers.
  const client = new Client({ name: 'mcp-erp-chat-host', version: '0.1.0' }, {
    versionNegotiation: { mode: 'auto', probe: { timeoutMs: 5_000 } },
  });
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    // Only the default environment plus the configured env – host secrets (NIM_API_KEY) stay private.
    env: { ...getDefaultEnvironment(), ...config.env },
    cwd: config.cwd,
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-2_000); });
  try {
    await client.connect(transport);
    const tools: ToolInfo[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      for (const tool of page.tools) {
        tools.push({
          name: `${config.name}${TOOL_SEPARATOR}${tool.name}`,
          server: config.name,
          toolName: tool.name,
          description: tool.description ?? '',
          inputSchema: tool.inputSchema as Record<string, unknown>,
        });
      }
      cursor = page.nextCursor;
    } while (cursor);
    return { config, client, tools };
  } catch (error) {
    await client.close().catch(() => {});
    const detail = stderr.trim().split('\n').at(-1) || errorMessage(error);
    console.error(`MCP server "${config.name}" could not be connected: ${detail}`);
    return { config, tools: [], error: detail };
  }
}

function resultToText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n');
  if (text) return text;
  return JSON.stringify(result.structuredContent ?? content);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
