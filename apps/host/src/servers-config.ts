import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod/v4';
import { ConfigError } from './config.js';

/**
 * One MCP server the host connects to. The host creates one MCP client per entry.
 * Add a server by adding an entry to mcp-servers.json – no code change needed.
 */
export interface ServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

// The name becomes the tool prefix ("<name>__<tool>"), so it must fit LLM tool-name rules.
const serverName = z.string().regex(/^[A-Za-z0-9-]{1,20}$/, 'Use 1-20 letters, digits or "-"');

const fileSchema = z.object({
  mcpServers: z.record(serverName, z.object({
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).default({}),
    cwd: z.string().optional(),
    disabled: z.boolean().default(false),
  })),
});

export function parseServersConfig(data: unknown, baseDir: string): ServerConfig[] {
  const parsed = fileSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid MCP server configuration – ${issues}`);
  }
  return Object.entries(parsed.data.mcpServers)
    .filter(([, server]) => !server.disabled)
    .map(([name, server]) => ({
      name,
      // "node" means the Node binary running the host – avoids PATH problems on Windows.
      command: server.command === 'node' ? process.execPath : server.command,
      args: server.args,
      env: server.env,
      cwd: resolve(baseDir, server.cwd ?? '.'),
    }));
}

export function loadServersConfig(file: string): ServerConfig[] {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new ConfigError(`Cannot read MCP server configuration: ${file}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ConfigError(`MCP server configuration is not valid JSON: ${file}`);
  }
  return parseServersConfig(data, dirname(file));
}
