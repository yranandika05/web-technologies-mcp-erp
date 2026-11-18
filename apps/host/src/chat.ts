import type { ToolCallResult, ToolInfo } from './client-manager.js';
import type { ChatMessage, LlmProvider } from './llm/provider.js';
import { SYSTEM_PROMPT } from './system-prompt.js';

/** What the chat loop needs from the MCP side (implemented by McpClientManager). */
export interface ToolExecutor {
  listTools(): ToolInfo[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
}

/** Plain conversation turns as sent by the chat UI. */
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** One executed tool call – shown in the UI so the MCP flow becomes visible. */
export interface ToolStep {
  tool: string;
  arguments: Record<string, unknown>;
  result: string;
  isError: boolean;
}

export interface ChatResult {
  answer: string;
  steps: ToolStep[];
}

export interface ChatOptions {
  llm: LlmProvider;
  tools: ToolExecutor;
  history: HistoryMessage[];
  systemPrompt?: string;
  /** Maximum number of LLM rounds that may request tools. */
  maxSteps?: number;
  signal?: AbortSignal;
}

export async function runChat(options: ChatOptions): Promise<ChatResult> {
  const { llm, tools, history, systemPrompt = SYSTEM_PROMPT, maxSteps = 5, signal } = options;
  if (history.at(-1)?.role !== 'user') throw new Error('The conversation must end with a user message.');

  const llmTools = tools.listTools().map(tool => ({
    name: tool.name, description: tool.description, parameters: tool.inputSchema,
  }));
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];
  const steps: ToolStep[] = [];

  for (let round = 0; round < maxSteps; round++) {
    const response = await llm.complete(messages, llmTools, signal);
    if (response.toolCalls.length === 0) {
      return { answer: response.content ?? '', steps };
    }
    messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls });
    for (const call of response.toolCalls) {
      const result = await tools.callTool(call.name, call.arguments);
      steps.push({ tool: call.name, arguments: call.arguments, result: result.text, isError: result.isError });
      messages.push({ role: 'tool', toolCallId: call.id, content: result.text });
    }
  }
  return { answer: `Stopped after ${maxSteps} tool rounds without a final answer.`, steps };
}
