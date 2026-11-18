import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { z } from 'zod/v4';
import { runChat, type ToolExecutor } from './chat.js';
import type { ServerStatus } from './client-manager.js';
import { LlmError, type LlmProvider } from './llm/provider.js';

export interface ChatServerOptions {
  llm: LlmProvider;
  tools: ToolExecutor & { status(): ServerStatus[] };
  /** Directory with the chat UI (apps/frontend). */
  staticDir: string;
  model: string;
  /** Origins allowed to embed the chat in an iframe, e.g. the ERPNext URL. */
  frameAncestors: string[];
}

const MAX_BODY_BYTES = 1_000_000;

const chatRequest = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(20_000),
  })).min(1).max(100),
});

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createChatServer(options: ChatServerOptions): Server {
  const csp = `frame-ancestors 'self' ${options.frameAncestors.join(' ')}`.trim();

  return createServer((req, res) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    handle(req, res, options).catch(error => {
      console.error('Unexpected error:', error);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error in the chat host. See the host log.' });
      else res.end();
    });
  });
}

async function handle(req: IncomingMessage, res: ServerResponse, options: ChatServerOptions): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

  if (pathname === '/api/status') {
    return sendJson(res, 200, {
      model: options.model,
      servers: options.tools.status(),
      tools: options.tools.listTools().map(t => ({ name: t.name, server: t.server, description: t.description })),
    });
  }

  if (pathname === '/api/chat') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST.' });
    // Requiring JSON forces a CORS preflight, so other websites cannot trigger chats via the browser.
    if (!req.headers['content-type']?.startsWith('application/json')) {
      return sendJson(res, 415, { error: 'Content-Type must be application/json.' });
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Request body must be JSON (max. 1 MB).' });
    }
    const parsed = chatRequest.safeParse(body);
    if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') {
      return sendJson(res, 400, { error: 'Expected { messages: [...] } ending with a user message.' });
    }
    try {
      const result = await runChat({ llm: options.llm, tools: options.tools, history: parsed.data.messages });
      return sendJson(res, 200, result);
    } catch (error) {
      if (error instanceof LlmError) return sendJson(res, 502, { error: error.message });
      throw error;
    }
  }

  if (req.method === 'GET') return serveStatic(pathname, res, options.staticDir);
  return sendJson(res, 404, { error: 'Not found.' });
}

async function serveStatic(pathname: string, res: ServerResponse, staticDir: string): Promise<void> {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    return sendJson(res, 400, { error: 'Bad path.' });
  }
  const root = normalize(staticDir + sep);
  const file = normalize(join(root, relative));
  const type = CONTENT_TYPES[extname(file)];
  if (!file.startsWith(root) || !type) return sendJson(res, 404, { error: 'Not found.' });
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Not found.' });
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
