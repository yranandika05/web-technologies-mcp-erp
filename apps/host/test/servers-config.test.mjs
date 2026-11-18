import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { ConfigError } from '../dist/config.js';
import { loadServersConfig, parseServersConfig } from '../dist/servers-config.js';

test('parses stdio servers and resolves cwd relative to the config directory', () => {
  const servers = parseServersConfig({
    mcpServers: {
      erpnext: { command: 'node', args: ['../../packages/mcp-server/dist/index.js'] },
      weather: { command: 'python', args: ['server.py'], env: { API_KEY: 'x' }, cwd: 'weather' },
    },
  }, '/repo/apps/host');
  assert.equal(servers.length, 2);
  const [erpnext, weather] = servers;
  assert.equal(erpnext.name, 'erpnext');
  assert.equal(erpnext.command, process.execPath, '"node" maps to the running Node binary');
  assert.deepEqual(erpnext.args, ['../../packages/mcp-server/dist/index.js']);
  assert.equal(erpnext.cwd, resolve('/repo/apps/host'));
  assert.deepEqual(erpnext.env, {});
  assert.equal(weather.command, 'python');
  assert.equal(weather.cwd, resolve('/repo/apps/host', 'weather'));
  assert.deepEqual(weather.env, { API_KEY: 'x' });
});

test('disabled servers are skipped', () => {
  const servers = parseServersConfig({
    mcpServers: { a: { command: 'x' }, b: { command: 'y', disabled: true } },
  }, '/tmp');
  assert.deepEqual(servers.map(s => s.name), ['a']);
});

test('server names must be usable as tool-name prefixes', () => {
  assert.throws(() => parseServersConfig({ mcpServers: { 'my server': { command: 'x' } } }, '/tmp'), /my server/);
});

test('invalid structure is rejected with a readable error', () => {
  assert.throws(() => parseServersConfig({ servers: {} }, '/tmp'), ConfigError);
  assert.throws(() => parseServersConfig({ mcpServers: { a: { args: [] } } }, '/tmp'), /a.*command/s);
});

test('loads a JSON file from disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-host-'));
  const file = join(dir, 'mcp-servers.json');
  writeFileSync(file, JSON.stringify({ mcpServers: { a: { command: 'x' } } }));
  assert.equal(loadServersConfig(file)[0].cwd, dir);
});

test('missing file and broken JSON give a ConfigError', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-host-'));
  assert.throws(() => loadServersConfig(join(dir, 'missing.json')), ConfigError);
  const file = join(dir, 'broken.json');
  writeFileSync(file, '{ not json');
  assert.throws(() => loadServersConfig(file), ConfigError);
});
