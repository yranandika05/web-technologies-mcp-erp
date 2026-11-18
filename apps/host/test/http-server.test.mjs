import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createChatServer } from '../dist/http-server.js';
import { LlmError } from '../dist/llm/provider.js';

const staticDir = mkdtempSync(join(tmpdir(), 'mcp-host-static-'));
writeFileSync(join(staticDir, 'index.html'), '<h1>Chat</h1>');
writeFileSync(join(staticDir, 'chat.js'), 'console.log(1)');
writeFileSync(join(tmpdir(), 'secret.txt'), 'secret');

const tools = {
  listTools: () => [{ name: 'erpnext__get_product_inventory', server: 'erpnext', toolName: 'get_product_inventory', description: 'Stock', inputSchema: { type: 'object' } }],
  callTool: async () => ({ text: '48', isError: false }),
  status: () => [{ name: 'erpnext', connected: true, toolCount: 1 }],
};

async function start(llm) {
  const server = createChatServer({ llm, tools, staticDir, model: 'test-model', frameAncestors: ['http://localhost:8080'] });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => { server.closeAllConnections(); server.close(); } };
}

const postChat = (base, body, contentType = 'application/json') => fetch(`${base}/api/chat`, {
  method: 'POST', headers: { 'Content-Type': contentType }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('serves the chat UI with frame-ancestors for ERPNext and blocks path traversal', async t => {
  const { base, close } = await start({ complete: async () => ({ content: 'x', toolCalls: [] }) });
  t.after(close);
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(index.headers.get('content-security-policy'), /frame-ancestors 'self' http:\/\/localhost:8080/);
  assert.equal(await index.text(), '<h1>Chat</h1>');
  assert.match((await fetch(`${base}/chat.js`)).headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/missing.css`)).status, 404);
  assert.equal((await fetch(`${base}/..%2fsecret.txt`)).status, 404);
});

test('GET /api/status lists model, servers and tools', async t => {
  const { base, close } = await start({ complete: async () => ({ content: 'x', toolCalls: [] }) });
  t.after(close);
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.model, 'test-model');
  assert.deepEqual(status.servers, [{ name: 'erpnext', connected: true, toolCount: 1 }]);
  assert.deepEqual(status.tools, [{ name: 'erpnext__get_product_inventory', server: 'erpnext', description: 'Stock' }]);
});

test('POST /api/chat runs the chat loop', async t => {
  const responses = [
    { content: null, toolCalls: [{ id: '1', name: 'erpnext__get_product_inventory', arguments: { itemCode: 'A' } }] },
    { content: '48 Stück', toolCalls: [] },
  ];
  const { base, close } = await start({ complete: async () => responses.shift() });
  t.after(close);
  const response = await postChat(base, { messages: [{ role: 'user', content: 'Bestand A?' }] });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.answer, '48 Stück');
  assert.equal(result.steps[0].tool, 'erpnext__get_product_inventory');
});

test('POST /api/chat validates input and content type', async t => {
  const { base, close } = await start({ complete: async () => ({ content: 'x', toolCalls: [] }) });
  t.after(close);
  assert.equal((await postChat(base, '{broken')).status, 400);
  assert.equal((await postChat(base, { messages: [] })).status, 400);
  assert.equal((await postChat(base, { messages: [{ role: 'system', content: 'x' }] })).status, 400);
  assert.equal((await postChat(base, { messages: [{ role: 'user', content: 'x' }] }, 'text/plain')).status, 415);
  assert.equal((await fetch(`${base}/api/chat`)).status, 405);
});

test('LLM errors become 502 with a readable message, other errors a generic 500', async t => {
  const llmFail = await start({ complete: async () => { throw new LlmError('NIM request failed with HTTP 401. Check NIM_API_KEY.'); } });
  t.after(llmFail.close);
  const response = await postChat(llmFail.base, { messages: [{ role: 'user', content: 'x' }] });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /NIM_API_KEY/);

  const crash = await start({ complete: async () => { throw new Error('internal secret detail'); } });
  t.after(crash.close);
  const crashed = await postChat(crash.base, { messages: [{ role: 'user', content: 'x' }] });
  assert.equal(crashed.status, 500);
  assert.doesNotMatch((await crashed.json()).error, /secret/);
});
