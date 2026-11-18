import type { NimConfig } from '../config.js';
import { type ChatMessage, LlmError, type LlmProvider, type LlmResponse, type LlmTool, type ToolCall } from './provider.js';

const TIMEOUT_MS = 120_000;

/** NVIDIA NIM via its OpenAI-compatible /chat/completions endpoint (hosted or self-hosted). */
export class NimProvider implements LlmProvider {
  constructor(private readonly config: NimConfig) {}

  async complete(messages: ChatMessage[], tools: LlmTool[], signal?: AbortSignal): Promise<LlmResponse> {
    const body = {
      model: this.config.model,
      messages: messages.map(toOpenAiMessage),
      ...(tools.length > 0 ? { tools: tools.map(tool => ({ type: 'function', function: tool })), tool_choice: 'auto' } : {}),
      temperature: 0.2,
    };
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch {
      throw new LlmError(`NIM endpoint not reachable at ${this.config.baseUrl}. Check NIM_BASE_URL and your network.`);
    }

    if (!response.ok) {
      const hint = response.status === 401 || response.status === 403
        ? ' Check NIM_API_KEY.'
        : response.status === 404 ? ' Check NIM_BASE_URL and NIM_MODEL.' : '';
      throw new LlmError(`NIM request failed with HTTP ${response.status}.${hint}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new LlmError('NIM returned a response that is not JSON.');
    }
    const message = (data as { choices?: { message?: OpenAiAssistantMessage }[] }).choices?.[0]?.message;
    if (!message || typeof message !== 'object') throw new LlmError('NIM returned an unexpected response format.');

    return {
      content: typeof message.content === 'string' ? message.content : null,
      toolCalls: (message.tool_calls ?? []).map(fromOpenAiToolCall),
    };
  }
}

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiAssistantMessage {
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
}

function toOpenAiMessage(message: ChatMessage): Record<string, unknown> {
  switch (message.role) {
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length ? {
          tool_calls: message.toolCalls.map(call => ({
            id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          })),
        } : {}),
      };
    default:
      return { role: message.role, content: message.content };
  }
}

function fromOpenAiToolCall(call: OpenAiToolCall): ToolCall {
  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    args = {};
  }
  return {
    id: call.id,
    name: call.function.name,
    arguments: args && typeof args === 'object' && !Array.isArray(args) ? args as Record<string, unknown> : {},
  };
}
