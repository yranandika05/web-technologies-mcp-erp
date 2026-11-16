import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod/v4';

export interface ErpnextConfig {
  baseUrl: URL;
  apiKey: string;
  apiSecret: string;
}

export class ErpnextError extends Error {}

// This path works from both src/ and dist/, regardless of the host's cwd.
export function readConfig(): ErpnextConfig {
  const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(envFile)) {
    try {
      loadEnvFile(envFile);
    } catch {
      throw new ErpnextError('Cannot read the repository .env file. Check its permissions and syntax.');
    }
  }
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value?.trim()) throw new ErpnextError(`Missing ${name}. Set it in the repository .env or process environment.`);
    return value;
  };
  let baseUrl: URL;
  try {
    baseUrl = new URL(required('ERPNEXT_BASE_URL'));
  } catch (error) {
    if (error instanceof ErpnextError) throw error;
    throw new ErpnextError('ERPNEXT_BASE_URL must be a valid HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new ErpnextError('ERPNEXT_BASE_URL must be an HTTP(S) URL without embedded credentials, query or fragment.');
  }
  if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/';
  return { baseUrl, apiKey: required('ERPNEXT_API_KEY'), apiSecret: required('ERPNEXT_API_SECRET') };
}

export async function erpnextGet<T>(
  config: ErpnextConfig,
  resource: string,
  schema: z.ZodType<T>,
  query: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`api/resource/${resource}`, config.baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const timeout = AbortSignal.timeout(20_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `token ${config.apiKey}:${config.apiSecret}`,
      },
      // Do not forward credentials to a login redirect or another origin.
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    if (signal?.aborted) throw new ErpnextError('ERPNext request was cancelled.');
    if (timeout.aborted) throw new ErpnextError('ERPNext request timed out. Check that ERPNext is running.');
    throw new ErpnextError('ERPNext is unavailable. Check ERPNEXT_BASE_URL and the Docker services.');
  }
  if (!response.ok) {
    // Never return ERPNext exception bodies: they can contain sensitive internals.
    await response.body?.cancel();
    if (response.status === 401) throw new ErpnextError('ERPNext authentication failed. Check ERPNEXT_API_KEY and ERPNEXT_API_SECRET.');
    if (response.status === 403) throw new ErpnextError('ERPNext permission denied. Check the API user’s read permissions for Item and Bin.');
    if (response.status === 404) throw new ErpnextError('ERPNext resource was not found. Check itemCode.');
    if (response.status >= 500) throw new ErpnextError('ERPNext is unavailable or returned a server error. Try again when the service is healthy.');
    throw new ErpnextError(`ERPNext rejected the request (HTTP ${response.status}).`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ErpnextError('ERPNext returned invalid JSON or an incomplete response.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ErpnextError('ERPNext returned an unexpected response. Required fields are missing or have invalid types.');
  return parsed.data;
}
