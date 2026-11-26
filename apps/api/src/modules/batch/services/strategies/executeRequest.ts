/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses infrastructure:observability
 */
import { captureTraceContext } from '@template/shared/telemetry';
import type { Hono } from 'hono';
import { omitBy } from 'lodash-es';
import { AUTH_PROBE_HEADER } from '#/lib/utils/authProbe';
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

const STRIPPED_SUBREQUEST_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-spoof-user-email',
  'x-forwarded-for',
  'x-real-ip',
  'x-batch-id',
  'x-internal-secret',
  AUTH_PROBE_HEADER,
  'traceparent',
  'tracestate',
]);

const omitDisallowedSubrequestHeaders = (headers: Record<string, string>): Record<string, string> =>
  omitBy(headers, (_value, key) => STRIPPED_SUBREQUEST_HEADERS.has(key.toLowerCase()));

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

  const mergedHeaders = omitDisallowedSubrequestHeaders({
    ...sharedHeaders,
    ...request.headers,
  });

  // Build full URL
  const url = new URL(request.path, baseRequest.url).toString();

  // Only pass essential headers - don't copy all base headers
  const headers = new Headers({
    ...mergedHeaders,
    'Content-Type': 'application/json',
    'x-batch-id': batchId,
  });
  for (const [key, value] of Object.entries(captureTraceContext())) headers.set(key, value);

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
  };

  if (request.body !== undefined && method !== 'GET' && method !== 'HEAD') {
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
