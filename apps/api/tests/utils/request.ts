// Test request helpers

import { LogScope, log } from '@template/shared/logger';
import type { PaginationMetadata } from '#/lib/routeTemplates';

type SuccessResponse<T> = { data: T; pagination?: PaginationMetadata };
type ErrorResponse = { error: string; message: string; stack?: string; guidance?: string };

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export const json = async <T = unknown>(response: Response): Promise<SuccessResponse<T>> => {
  const body = await response.json();
  if (!response.ok) log.error(`[${response.status}] ${JSON.stringify(body)}`, LogScope.test);
  return body as SuccessResponse<T>;
};

export const jsonError = async (response: Response): Promise<ErrorResponse> => {
  return response.json() as Promise<ErrorResponse>;
};

export const createRequest = (
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  },
) => {
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
};

export const get = (path: string, headers?: Record<string, string>) => {
  return createRequest('GET', path, { headers });
};

export const post = (path: string, body?: unknown, headers?: Record<string, string>) => {
  return createRequest('POST', path, { body, headers });
};

export const patch = (path: string, body?: unknown, headers?: Record<string, string>) => {
  return createRequest('PATCH', path, { body, headers });
};

export const del = (path: string, headers?: Record<string, string>) => {
  return createRequest('DELETE', path, { headers });
};
