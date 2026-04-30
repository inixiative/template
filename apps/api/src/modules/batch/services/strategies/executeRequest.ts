import type { Hono } from 'hono';
import type { BatchRequest, RequestResult } from '#/modules/batch/services/strategies/types';
import type { AppEnv } from '#/types/appEnv';

const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return null;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
};

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
  // Block protocol-relative ("//evil.com/foo") and require sub-requests to
  // target the API surface. `app.fetch` keeps everything internal, but
  // accepting arbitrary paths lets callers probe routes outside the namespace.
  if (request.path.startsWith('//') || !request.path.startsWith('/api/')) {
    throw new Error('Batch sub-request path must start with /api/');
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
  const responseBody = await parseResponseBody(response);

  const result: RequestResult = {
    status: response.status,
    body: responseBody,
  };

  if (!response.ok) {
    result.error = (responseBody as { message?: string })?.message || 'Request failed';
  }

  return result;
};
