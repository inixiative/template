import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { QueryFunctionContext } from '@tanstack/react-query';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';

// Captures the `client` (Hey API client) that apiFetchInternal hands to the
// SDK function — gives us a real `getConfig()` to assert on instead of
// stubbing out createClient at the module boundary.
type SdkOpts = {
  client?: { getConfig: () => { headers?: Headers | Record<string, string> } };
  [key: string]: unknown;
};

const headerMap = (h: Headers | Record<string, string> | undefined): Record<string, string> => {
  if (!h) return {};
  // Duck-type: happy-dom's GlobalRegistrator replaces the global Headers, but the
  // SDK's internal Headers reference is the original — `instanceof Headers` fails.
  // Lowercase keys explicitly: WHATWG spec returns lowercased, but happy-dom's
  // forEach yields the original casing.
  if (typeof (h as Headers).forEach === 'function') {
    const out: Record<string, string> = {};
    (h as Headers).forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  }
  return h as Record<string, string>;
};

describe('api transport wrappers', () => {
  const initialAuth = useAppStore.getState().auth;

  beforeEach(() => {
    useAppStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        spoofUserEmail: null,
      },
    }));
  });

  afterEach(() => {
    useAppStore.setState((state) => ({
      ...state,
      auth: initialAuth,
    }));
  });

  it('apiFetchInternal forwards request options from generated query keys', async () => {
    const sdkFn = mock(async (opts: SdkOpts) => opts);
    const fetcher = apiFetchInternal(sdkFn, { token: 'test-token', spoofUserEmail: 'spoof@example.com' });

    const result = await fetcher({
      queryKey: [
        {
          path: { id: 'org-123' },
          query: { page: 2, pageSize: 50 },
        },
      ],
    } as unknown as QueryFunctionContext);

    expect(sdkFn).toHaveBeenCalledTimes(1);
    expect(sdkFn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: 'org-123' },
        query: { page: 2, pageSize: 50 },
        throwOnError: true,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        path: { id: 'org-123' },
        query: { page: 2, pageSize: 50 },
      }),
    );

    const handedClient = sdkFn.mock.calls[0][0].client!;
    const headers = headerMap(handedClient.getConfig().headers);
    expect(headers.authorization).toBe('Bearer test-token');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-spoof-user-email']).toBe('spoof@example.com');
  });

  it('apiFetchInternal forwards direct mutation variables', async () => {
    const sdkFn = mock(async (opts: SdkOpts) => opts);
    const fetcher = apiFetchInternal(sdkFn);

    const result = await fetcher({
      path: { id: 'token-123' },
      body: { name: 'My token' },
    });

    expect(sdkFn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: 'token-123' },
        body: { name: 'My token' },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        path: { id: 'token-123' },
        body: { name: 'My token' },
      }),
    );
  });

  it('unwraps nested { data: { data, pagination } } response', async () => {
    const sdkFn = mock(async () => ({
      data: {
        data: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, pageSize: 10, total: 2 },
      },
      response: new Response(),
    }));
    const fetcher = apiFetchInternal(sdkFn);

    const result = await fetcher();

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect((result as Record<string, unknown>).pagination).toEqual({ page: 1, pageSize: 10, total: 2 });
    expect((result as Record<string, unknown>).response).toBeInstanceOf(Response);
  });

  it('returns non-nested { data } responses as-is', async () => {
    const sdkFn = mock(async () => ({
      data: { id: 1, name: 'test' },
      response: new Response(),
    }));
    const fetcher = apiFetchInternal(sdkFn);

    const result = await fetcher();

    expect(result.data).toEqual({ id: 1, name: 'test' });
    expect((result as Record<string, unknown>).response).toBeInstanceOf(Response);
  });

  it('unwraps nested response even when throwOnError is false', async () => {
    const sdkFn = mock(async () => ({
      data: {
        data: [{ id: 1 }],
        pagination: { page: 1, pageSize: 10, total: 1 },
      },
      response: new Response(),
    }));
    const fetcher = apiFetchInternal(sdkFn, { throwOnError: false });

    const result = await fetcher();

    expect(result.data).toEqual([{ id: 1 }]);
    expect((result as Record<string, unknown>).pagination).toEqual({ page: 1, pageSize: 10, total: 1 });
  });

  it('preserves error and response.status when throwOnError is false (404 check pattern)', async () => {
    const sdkFn = mock(async () => ({
      data: undefined,
      error: { message: 'Not found' },
      response: new Response(null, { status: 404 }),
    }));
    const fetcher = apiFetchInternal(sdkFn, { throwOnError: false });

    const result = await fetcher();
    const raw = result as Record<string, unknown>;

    expect(raw.error).toEqual({ message: 'Not found' });
    expect(raw.response).toBeInstanceOf(Response);
    expect((raw.response as Response).status).toBe(404);
    expect(raw.data).toBeUndefined();
  });

  it('throws error field when throwOnError is true', async () => {
    const errorObj = { message: 'Server error' };
    const sdkFn = mock(async () => ({
      data: undefined,
      error: errorObj,
      response: new Response(null, { status: 500 }),
    }));
    const fetcher = apiFetchInternal(sdkFn);

    expect(fetcher()).rejects.toEqual(errorObj);
  });

  it('apiQuery reads spoofing state from the app store and forwards query vars', async () => {
    useAppStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        spoofUserEmail: 'store-spoof@example.com',
      },
    }));

    const sdkFn = mock(async (opts: SdkOpts) => opts);
    const queryFn = apiQuery(sdkFn);

    await queryFn({
      queryKey: [
        {
          path: { id: 'space-123' },
          query: { search: 'acme' },
        },
      ],
    } as unknown as QueryFunctionContext);

    expect(sdkFn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: 'space-123' },
        query: { search: 'acme' },
      }),
    );

    const handedClient = sdkFn.mock.calls[0][0].client!;
    expect(headerMap(handedClient.getConfig().headers)['x-spoof-user-email']).toBe('store-spoof@example.com');
  });

  it('apiMutation reads spoofing state from the app store and forwards vars', async () => {
    useAppStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        spoofUserEmail: 'mutation-spoof@example.com',
      },
    }));

    const sdkFn = mock(async (opts: SdkOpts) => opts);
    const mutationFn = apiMutation(sdkFn);

    await mutationFn({
      path: { id: 'org-user-123' },
      body: { role: 'admin' },
    });

    expect(sdkFn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: 'org-user-123' },
        body: { role: 'admin' },
      }),
    );

    const handedClient = sdkFn.mock.calls[0][0].client!;
    expect(headerMap(handedClient.getConfig().headers)['x-spoof-user-email']).toBe('mutation-spoof@example.com');
  });
});
