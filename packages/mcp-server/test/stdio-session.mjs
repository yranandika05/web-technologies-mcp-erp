// Test harness only: the application does not implement its own MCP client.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export async function connectServer(overrides = {}) {
  const client = new Client({ name: 'erpnext-test', version: '0.1.0' }, {
    versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 5_000 } },
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
    env: Object.fromEntries(Object.entries({ ...process.env, ...overrides }).filter(([, value]) => value !== undefined)),
    stderr: 'pipe',
    // Deliberately not the repository root: the server must find .env independently.
    cwd: fileURLToPath(new URL('.', import.meta.url)),
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  const sent = [];
  const send = transport.send.bind(transport);
  transport.send = async (message, ...rest) => {
    sent.push(message);
    return send(message, ...rest);
  };
  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), 'modern');
    assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');
  } catch (error) {
    await client.close();
    throw new Error(stderr.trim() || 'Could not connect to the MCP server using revision 2026-07-28.', { cause: error });
  }
  return { client, sent, stderr: () => stderr };
}
