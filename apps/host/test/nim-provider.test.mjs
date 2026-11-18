import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { LlmError } from '../dist/llm/provider.js';
import { NimProvider } from '../dist/llm/nim-provider.js';

async function mockNim(handler) {
  const requests = [];
  const http = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, headers: req.headers, body: body ? JSON.parse(body) : undefined });
    const [code, response] = handler(requests.at(-1));
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(typeof response === 'string' ? response : JSON.stringify(response));
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  return { baseUrl: `http://127.0.0.1:${http.address().port}/v1`, requests, close: () => { http.closeAllConnections(); http.close(); } };
}

const tools = [{ name: 'erpnext__get_product_inventory', description: 'Stock', parameters: { type: 'object', properties: { itemCode: { type: 'string' } } } }];

test('sends an OpenAI-compatible request and maps tool calls back', async t => {
  const nim = await mockNim(() => [200, {
    choices: [{ message: { role: 'assistant', content: null, tool_calls: [
      { id: 'call_1', type: 'function', function: { name: 'erpnext__get_product_inventory', arguments: '{"itemCode":"MCP-EL-001"}' } },
    ] } }],
  }]);
  t.after(nim.close);
  const provider = new NimProvider({ baseUrl: nim.baseUrl, apiKey: 'nvapi-test', model: 'test-model' });

  const response = await provider.complete([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'Stock of MCP-EL-001?' },
    { role: 'assistant', content: null, toolCalls: [{ id: 'old', name: 'x__y', arguments: { a: 1 } }] },
    { role: 'tool', toolCallId: 'old', content: 'result' },
  ], tools);

  assert.deepEqual(response.toolCalls, [{ id: 'call_1', name: 'erpnext__get_product_inventory', arguments: { itemCode: 'MCP-EL-001' } }]);
  const [request] = nim.requests;
  assert.equal(request.url, '/v1/chat/completions');
  assert.equal(request.headers.authorization, 'Bearer nvapi-test');
  assert.equal(request.body.model, 'test-model');
  assert.deepEqual(request.body.tools[0], { type: 'function', function: tools[0] });
  assert.deepEqual(request.body.messages[2], {
    role: 'assistant', content: null,
    tool_calls: [{ id: 'old', type: 'function', function: { name: 'x__y', arguments: '{"a":1}' } }],
  });
  assert.deepEqual(request.body.messages[3], { role: 'tool', tool_call_id: 'old', content: 'result' });
});

test('plain answers have no tool calls; no tools means no tools field and no auth header without key', async t => {
  const nim = await mockNim(() => [200, { choices: [{ message: { role: 'assistant', content: 'Hello' } }] }]);
  t.after(nim.close);
  const provider = new NimProvider({ baseUrl: nim.baseUrl, apiKey: undefined, model: 'm' });
  const response = await provider.complete([{ role: 'user', content: 'Hi' }], []);
  assert.deepEqual(response, { content: 'Hello', toolCalls: [] });
  assert.equal(nim.requests[0].body.tools, undefined);
  assert.equal(nim.requests[0].headers.authorization, undefined);
});

test('invalid tool-call JSON from the model becomes empty arguments', async t => {
  const nim = await mockNim(() => [200, { choices: [{ message: { content: null, tool_calls: [
    { id: 'c', type: 'function', function: { name: 'a__b', arguments: '{broken' } },
  ] } }] }]);
  t.after(nim.close);
  const response = await new NimProvider({ baseUrl: nim.baseUrl, apiKey: 'k', model: 'm' }).complete([{ role: 'user', content: 'x' }], tools);
  assert.deepEqual(response.toolCalls[0].arguments, {});
});

test('HTTP errors become readable LlmErrors without leaking the key', async t => {
  const nim = await mockNim(req => req.headers.authorization === 'Bearer bad' ? [401, { detail: 'nope' }] : [500, 'boom']);
  t.after(nim.close);
  const messages = [{ role: 'user', content: 'x' }];
  await assert.rejects(new NimProvider({ baseUrl: nim.baseUrl, apiKey: 'bad', model: 'm' }).complete(messages, tools), error => {
    assert.ok(error instanceof LlmError);
    assert.match(error.message, /401/);
    assert.match(error.message, /NIM_API_KEY/);
    assert.doesNotMatch(error.message, /bad/);
    return true;
  });
  await assert.rejects(new NimProvider({ baseUrl: nim.baseUrl, apiKey: 'ok', model: 'm' }).complete(messages, tools), /500/);
});

test('unreachable endpoint and malformed responses become LlmErrors', async t => {
  const nim = await mockNim(() => [200, { unexpected: true }]);
  t.after(nim.close);
  await assert.rejects(new NimProvider({ baseUrl: nim.baseUrl, apiKey: 'k', model: 'm' }).complete([{ role: 'user', content: 'x' }], []), LlmError);
  await assert.rejects(new NimProvider({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k', model: 'm' }).complete([{ role: 'user', content: 'x' }], []), LlmError);
});
