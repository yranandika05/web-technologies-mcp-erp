import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export class ConfigError extends Error {}

export interface NimConfig {
  /** OpenAI-compatible base URL without trailing slash, e.g. https://integrate.api.nvidia.com/v1 */
  baseUrl: string;
  /** Required for the hosted NVIDIA API, optional for a self-hosted NIM container. */
  apiKey: string | undefined;
  model: string;
}

export interface HostConfig {
  nim: NimConfig;
  port: number;
}

const HOSTED_NIM = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';

/** Loads the repository root .env (works from src/ and dist/). Existing env values win. */
export function loadRootEnv(): void {
  const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(envFile)) loadEnvFile(envFile);
}

export function readHostConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  const value = (name: string) => env[name]?.trim() || undefined;

  const rawUrl = value('NIM_BASE_URL') ?? HOSTED_NIM;
  try {
    new URL(rawUrl);
  } catch {
    throw new ConfigError(`NIM_BASE_URL is not a valid URL: ${rawUrl}`);
  }
  const baseUrl = rawUrl.replace(/\/+$/, '');
  const apiKey = value('NIM_API_KEY');
  if (baseUrl === HOSTED_NIM && !apiKey) {
    throw new ConfigError('Missing NIM_API_KEY. Create a key at build.nvidia.com and set it in the repository .env.');
  }

  const rawPort = value('CHAT_HOST_PORT') ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`CHAT_HOST_PORT must be a port number, got: ${rawPort}`);
  }

  return { nim: { baseUrl, apiKey, model: value('NIM_MODEL') ?? DEFAULT_MODEL }, port };
}
