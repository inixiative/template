import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { QueryFunctionContext } from '@tanstack/react-query';

const createClientMock = mock((config: Record<string, unknown>) => ({
  config,
  interceptors: {
    request: { use: mock(() => {}) },
  },
}));

const getTokenMock = mock(() => 'test-token');

mock.module('@template/ui/apiClient/client', () => ({
  createClient: createClientMock,
}));

mock.module('@template/ui/lib/auth/token', () => ({
  getToken: getTokenMock,
}));

import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useAppStore } from '@template/ui/store';

describe('api transport wrappers', () => {
  const initialAuth = useAppStore.getState().auth;

  beforeEach(() => {
    createClientMock.mockClear();
    getTokenMock.mockClear();
    getTokenMock.mockImplementation(() => 'test-token');
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
    const sdkFn = mock(async (opts: Record<string, unknown>) => opts);
    const fetcher = apiFetchInternal(sdkFn, { spoofUserEmail: 'spoof@example.com' });

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
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
          'x-spoof-user-email': 'spoof@example.com',
        }),
      }),
    );
  });

  it('apiFetchInternal forwards direct mutation variables', async () => {
    const sdkFn = mock(async (opts: Record<string, unknown>) => opts);
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

  it('apiQuery reads spoofing state from the app store and forwards query vars', async () => {
    useAppStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        spoofUserEmail: 'store-spoof@example.com',
      },
    }));

    const sdkFn = mock(async (opts: Record<string, unknown>) => opts);
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
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-spoof-user-email': 'store-spoof@example.com',
        }),
      }),
    );
  });

  it('apiMutation reads spoofing state from the app store and forwards vars', async () => {
    useAppStore.setState((state) => ({
      ...state,
      auth: {
        ...state.auth,
        spoofUserEmail: 'mutation-spoof@example.com',
      },
    }));

    const sdkFn = mock(async (opts: Record<string, unknown>) => opts);
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
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-spoof-user-email': 'mutation-spoof@example.com',
        }),
      }),
    );
  });
});
