import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runChat } from '../dist/chat.js';

function scriptedLlm(responses) {
  const calls = [];
  return {
    calls,
    async complete(messages, tools) {
      calls.push({ messages: structuredClone(messages), tools });
      const next = responses.shift();
      if (!next) throw new Error('no more scripted responses');
      return next;
    },
  };
}

function fakeTools() {
  const calls = [];
  return {
    calls,
    listTools: () => [{
      name: 'erpnext__get_product_inventory', server: 'erpnext', toolName: 'get_product_inventory',
      description: 'Stock per warehouse', inputSchema: { type: 'object', properties: { itemCode: { type: 'string' } } },
    }],
    async callTool(name, args) {
      calls.push({ name, args });
      return { text: '{"actualQty":48}', isError: false };
    },
  };
}

test('answers directly when the LLM needs no tool', async () => {
  const llm = scriptedLlm([{ content: 'Hallo!', toolCalls: [] }]);
  const result = await runChat({ llm, tools: fakeTools(), history: [{ role: 'user', content: 'Hi' }] });
  assert.equal(result.answer, 'Hallo!');
  assert.deepEqual(result.steps, []);
  const [first] = llm.calls;
  assert.equal(first.messages[0].role, 'system');
  assert.deepEqual(first.messages.at(-1), { role: 'user', content: 'Hi' });
  assert.deepEqual(first.tools, [{ name: 'erpnext__get_product_inventory', description: 'Stock per warehouse', parameters: { type: 'object', properties: { itemCode: { type: 'string' } } } }]);
});

test('executes requested tools and feeds results back to the LLM', async () => {
  const tools = fakeTools();
  const llm = scriptedLlm([
    { content: null, toolCalls: [{ id: 'c1', name: 'erpnext__get_product_inventory', arguments: { itemCode: 'MCP-EL-001' } }] },
    { content: '48 Stück auf Lager.', toolCalls: [] },
  ]);
  const result = await runChat({ llm, tools, history: [{ role: 'user', content: 'Bestand MCP-EL-001?' }] });

  assert.equal(result.answer, '48 Stück auf Lager.');
  assert.deepEqual(tools.calls, [{ name: 'erpnext__get_product_inventory', args: { itemCode: 'MCP-EL-001' } }]);
  assert.deepEqual(result.steps, [{
    tool: 'erpnext__get_product_inventory', arguments: { itemCode: 'MCP-EL-001' }, result: '{"actualQty":48}', isError: false,
  }]);
  const second = llm.calls[1].messages;
  assert.deepEqual(second.at(-2), { role: 'assistant', content: null, toolCalls: [{ id: 'c1', name: 'erpnext__get_product_inventory', arguments: { itemCode: 'MCP-EL-001' } }] });
  assert.deepEqual(second.at(-1), { role: 'tool', toolCallId: 'c1', content: '{"actualQty":48}' });
});

test('keeps earlier conversation turns and accepts a custom system prompt', async () => {
  const llm = scriptedLlm([{ content: 'ok', toolCalls: [] }]);
  await runChat({
    llm, tools: fakeTools(), systemPrompt: 'Custom',
    history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }],
  });
  assert.deepEqual(llm.calls[0].messages, [
    { role: 'system', content: 'Custom' },
    { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' },
  ]);
});

test('stops after maxSteps tool rounds', async () => {
  const loop = { content: null, toolCalls: [{ id: 'x', name: 'erpnext__get_product_inventory', arguments: {} }] };
  const llm = scriptedLlm([loop, loop, loop]);
  const result = await runChat({ llm, tools: fakeTools(), history: [{ role: 'user', content: 'x' }], maxSteps: 2 });
  assert.equal(llm.calls.length, 2);
  assert.equal(result.steps.length, 2);
  assert.match(result.answer, /2/);
});

test('rejects an empty history or one that does not end with a user message', async () => {
  const llm = scriptedLlm([]);
  await assert.rejects(runChat({ llm, tools: fakeTools(), history: [] }), /user/);
  await assert.rejects(runChat({ llm, tools: fakeTools(), history: [{ role: 'assistant', content: 'x' }] }), /user/);
});
