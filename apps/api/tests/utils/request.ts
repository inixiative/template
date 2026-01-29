// Test request helpers

import type { PaginationMetadata } from '#/lib/routeTemplates';

type SuccessResponse<T> = { data: T; pagination?: PaginationMetadata };
type ErrorResponse = { error: string; message: string; stack?: string; guidance?: string };

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export async function json<T = unknown>(response: Response): Promise<SuccessResponse<T>> {
  const body = await response.json();
  if (!response.ok) console.error(`[${response.status}]`, body);
  return body as SuccessResponse<T>;
}

export async function jsonError(response: Response): Promise<ErrorResponse> {
  return response.json() as Promise<ErrorResponse>;
}

export function createRequest(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  const url = `http://t${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };

  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }

  return new Request(url, init);
}

export function get(path: string, headers?: Record<string, string>) {
  return createRequest('GET', path, { headers });
}

export function post(path: string, body?: unknown, headers?: Record<string, string>) {
  return createRequest('POST', path, { body, headers });
}

export function patch(path: string, body?: unknown, headers?: Record<string, string>) {
  return createRequest('PATCH', path, { body, headers });
}

export function del(path: string, headers?: Record<string, string>) {
  return createRequest('DELETE', path, { headers });
}
