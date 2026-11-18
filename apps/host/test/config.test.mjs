import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigError, readHostConfig } from '../dist/config.js';

test('reads NIM settings and port from the environment', () => {
  const config = readHostConfig({
    NIM_BASE_URL: 'http://localhost:8000/v1/',
    NIM_API_KEY: 'nvapi-test',
    NIM_MODEL: 'meta/llama-3.3-70b-instruct',
    CHAT_HOST_PORT: '4000',
  });
  assert.equal(config.nim.baseUrl, 'http://localhost:8000/v1');
  assert.equal(config.nim.apiKey, 'nvapi-test');
  assert.equal(config.nim.model, 'meta/llama-3.3-70b-instruct');
  assert.equal(config.port, 4000);
});

test('uses the hosted NIM endpoint, default model and port 3000 when unset', () => {
  const config = readHostConfig({ NIM_API_KEY: 'nvapi-test' });
  assert.equal(config.nim.baseUrl, 'https://integrate.api.nvidia.com/v1');
  assert.equal(config.nim.model, 'nvidia/nemotron-3.5-lightning-30b-a3b');
  assert.equal(config.port, 3000);
});

test('ERPNext origin from ERPNEXT_BASE_URL may embed the chat', () => {
  assert.deepEqual(readHostConfig({ NIM_API_KEY: 'x' }).frameAncestors, ['http://localhost:8080']);
  assert.deepEqual(readHostConfig({ NIM_API_KEY: 'x', ERPNEXT_BASE_URL: 'https://erp.example.test/app' }).frameAncestors, ['https://erp.example.test']);
});

test('API key is optional for a self-hosted NIM', () => {
  const config = readHostConfig({ NIM_BASE_URL: 'http://localhost:8000/v1' });
  assert.equal(config.nim.apiKey, undefined);
});

test('hosted NIM without API key is rejected', () => {
  assert.throws(() => readHostConfig({}), ConfigError);
});

test('invalid port and URL are rejected', () => {
  assert.throws(() => readHostConfig({ NIM_API_KEY: 'x', CHAT_HOST_PORT: 'abc' }), /CHAT_HOST_PORT/);
  assert.throws(() => readHostConfig({ NIM_API_KEY: 'x', NIM_BASE_URL: 'not a url' }), /NIM_BASE_URL/);
});
