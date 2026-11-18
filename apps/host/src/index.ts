import { ConfigError, loadRootEnv, readHostConfig } from './config.js';

try {
  loadRootEnv();
  const config = readHostConfig();
  console.log(`MCP chat host configured for model ${config.nim.model} on port ${config.port}.`);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exitCode = 1;
}
