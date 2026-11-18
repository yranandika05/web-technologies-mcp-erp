import { fileURLToPath } from 'node:url';
import { McpClientManager } from './client-manager.js';
import { ConfigError, loadRootEnv, readHostConfig } from './config.js';
import { createChatServer } from './http-server.js';
import { NimProvider } from './llm/nim-provider.js';
import { loadServersConfig } from './servers-config.js';

// Paths work from both src/ (tsx) and dist/ (node).
const SERVERS_FILE = fileURLToPath(new URL('../mcp-servers.json', import.meta.url));
const FRONTEND_DIR = fileURLToPath(new URL('../../frontend', import.meta.url));

try {
  loadRootEnv();
  const config = readHostConfig();
  const servers = loadServersConfig(SERVERS_FILE);

  const manager = await McpClientManager.connect(servers);
  for (const server of manager.status()) {
    console.log(server.connected
      ? `MCP server "${server.name}": connected, ${server.toolCount} tool(s)`
      : `MCP server "${server.name}": NOT connected (${server.error})`);
  }

  const llm = new NimProvider(config.nim);
  const http = createChatServer({
    llm, tools: manager, staticDir: FRONTEND_DIR, model: config.nim.model, frameAncestors: config.frameAncestors,
  });
  // Localhost only: the chat can use the ERP API credentials of the MCP servers.
  http.listen(config.port, '127.0.0.1', () => {
    console.log(`MCP chat host running at http://localhost:${config.port} (model ${config.nim.model})`);
  });

  const shutdown = () => {
    http.close();
    void manager.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exitCode = 1;
}
