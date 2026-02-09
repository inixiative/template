import type { Hono } from 'hono';
import type { BatchRequest, RequestResult } from '#/modules/batch/services/strategies/types';
import type { AppEnv } from '#/types/appEnv';

export const executeRequest = async (
  app: Hono<AppEnv>,
  request: BatchRequest,
  batchId: string,
  sharedHeaders: Record<string, string>,
  baseRequest: Request,
): Promise<RequestResult> => {
  if (request.path.startsWith('http://') || request.path.startsWith('https://')) {
    throw new Error('Absolute URLs are not allowed in batch requests');
  }

  const mergedHeaders = {
    ...sharedHeaders,
    ...request.headers,
  };

  // Build full URL
  const url = new URL(request.path, baseRequest.url).toString();

  // Only pass essential headers - don't copy all base headers
  const headers: Record<string, string> = {
    ...mergedHeaders,
    'Content-Type': 'application/json',
    'x-batch-id': batchId,
  };

  const init: RequestInit = {
    method: request.method.toUpperCase(),
    headers,
  };

  if (request.body) {
    init.body = JSON.stringify(request.body);
  }

  // Construct new Request to avoid Bun cloning issues
  const testRequest = new Request(url, init);

  const response = await app.fetch(testRequest);
  const responseBody = await response.json();

  const result: RequestResult = {
    status: response.status,
    body: responseBody,
  };

  if (!response.ok) {
    result.error = (responseBody as { message?: string })?.message || 'Request failed';
  }

  return result;
};
