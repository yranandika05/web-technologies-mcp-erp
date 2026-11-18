/**
 * Provider-neutral chat types. A new LLM backend (Ollama, Claude, ...) only has to
 * implement LlmProvider and translate these types to its own API.
 */

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

/** A tool as offered to the LLM (JSON Schema parameters). */
export interface LlmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  complete(messages: ChatMessage[], tools: LlmTool[], signal?: AbortSignal): Promise<LlmResponse>;
}

export class LlmError extends Error {}
