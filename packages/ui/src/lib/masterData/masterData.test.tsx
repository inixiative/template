import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  contactInfoQueryKey,
  inquiryInfoQueryKey,
  segmentInfoQueryKey,
  webhookSubscriptionInfoQueryKey,
} from '@template/sdk';
import {
  MASTER_DATA_ENTRIES,
  MasterDataPreloader,
  preloadMasterData,
  useContactInfo,
  useInquiryInfo,
  usePreloadMasterData,
  useSegmentInfo,
  useWebhookSubscriptionInfo,
} from '@template/ui/lib/masterData';
import { render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const wrapperFor =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

const samplePayloads = {
  contact: { types: { email: { input: { type: 'object' } } } },
  inquiry: { types: { invite: { content: { type: 'object' } } } },
  segment: { types: { CustomerRelationship: { operators: ['equals'] } } },
  webhookSubscription: { types: { CustomerRelationship: { events: ['create'] } } },
};

describe('masterData batch preloader', () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

  beforeEach(() => {
    fetchSpy = undefined;
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('batches all uncached /info catalogs into one POST /api/v1/batch/execute call and seeds each React Query cache key', async () => {
    const requestedUrls: string[] = [];
    const requestedBodies: unknown[] = [];

    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      requestedUrls.push(`${request.method} ${new URL(request.url).pathname}`);
      requestedBodies.push(await request.clone().json());
      return jsonResponse({
        data: {
          batch: [
            [
              { status: 200, body: { data: samplePayloads.contact } },
              { status: 200, body: { data: samplePayloads.inquiry } },
              { status: 200, body: { data: samplePayloads.segment } },
              { status: 200, body: { data: samplePayloads.webhookSubscription } },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 4,
            successfulRequests: 4,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      });
    }) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const result = await preloadMasterData(queryClient, { token: 'jwt-test' });

    expect(result).toEqual({
      loaded: ['contact', 'inquiry', 'segment', 'webhookSubscription'],
      failed: [],
      skipped: [],
    });
    expect(requestedUrls).toEqual(['POST /api/v1/batch/execute']);
    expect(requestedBodies).toEqual([
      {
        strategy: 'allowFailures',
        requests: [MASTER_DATA_ENTRIES.map((entry) => ({ method: 'GET', path: entry.path }))],
      },
    ]);

    expect(queryClient.getQueryData(contactInfoQueryKey())).toEqual({
      data: samplePayloads.contact,
    });
    expect(queryClient.getQueryData(inquiryInfoQueryKey())).toEqual({
      data: samplePayloads.inquiry,
    });
    expect(queryClient.getQueryData(segmentInfoQueryKey())).toEqual({
      data: samplePayloads.segment,
    });
    expect(queryClient.getQueryData(webhookSubscriptionInfoQueryKey())).toEqual({
      data: samplePayloads.webhookSubscription,
    });

    // Reader hooks consume the seeded cache with zero extra network calls.
    const { result: contactHook } = renderHook(() => useContactInfo(), {
      wrapper: wrapperFor(queryClient),
    });
    const { result: inquiryHook } = renderHook(() => useInquiryInfo(), {
      wrapper: wrapperFor(queryClient),
    });
    const { result: segmentHook } = renderHook(() => useSegmentInfo(), {
      wrapper: wrapperFor(queryClient),
    });
    const { result: webhookHook } = renderHook(() => useWebhookSubscriptionInfo(), {
      wrapper: wrapperFor(queryClient),
    });

    expect(contactHook.current.data?.data).toEqual(samplePayloads.contact as never);
    expect(inquiryHook.current.data?.data).toEqual(samplePayloads.inquiry as never);
    expect(segmentHook.current.data?.data).toEqual(samplePayloads.segment as never);
    expect(webhookHook.current.data?.data).toEqual(samplePayloads.webhookSubscription as never);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('skips already-cached entries and makes zero requests when every catalog is already loaded', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => {
      throw new Error('fetch should not be called');
    }) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    queryClient.setQueryData(contactInfoQueryKey(), { data: samplePayloads.contact });
    queryClient.setQueryData(inquiryInfoQueryKey(), { data: samplePayloads.inquiry });
    queryClient.setQueryData(segmentInfoQueryKey(), { data: samplePayloads.segment });
    queryClient.setQueryData(webhookSubscriptionInfoQueryKey(), {
      data: samplePayloads.webhookSubscription,
    });

    const result = await preloadMasterData(queryClient, { token: 'jwt-test' });
    expect(result).toEqual({
      loaded: [],
      failed: [],
      skipped: ['contact', 'inquiry', 'segment', 'webhookSubscription'],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('deduplicates concurrent preload calls on the same QueryClient (StrictMode safe)', async () => {
    let resolveBatch: ((response: Response) => void) | undefined;
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => {
      return new Promise<Response>((resolve) => {
        resolveBatch = resolve;
      });
    }) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const first = preloadMasterData(queryClient, { token: 'jwt-test' });
    const second = preloadMasterData(queryClient, { token: 'jwt-test' });

    await waitFor(() => expect(resolveBatch).toBeDefined());
    resolveBatch?.(
      jsonResponse({
        data: {
          batch: [
            [
              { status: 200, body: { data: samplePayloads.contact } },
              { status: 200, body: { data: samplePayloads.inquiry } },
              { status: 200, body: { data: samplePayloads.segment } },
              { status: 200, body: { data: samplePayloads.webhookSubscription } },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 4,
            successfulRequests: 4,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      }),
    );

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toEqual(r2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('seeds successful catalogs on partial failure and lets failed entries fall back to individual GET /info', async () => {
    const calls: string[] = [];
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      const path = new URL(request.url).pathname;
      calls.push(`${request.method} ${path}`);

      if (path === '/api/v1/batch/execute') {
        return jsonResponse({
          data: {
            batch: [
              [
                { status: 200, body: { data: samplePayloads.contact } },
                { status: 200, body: { data: samplePayloads.inquiry } },
                { status: 500, body: { error: 'temporary failure' } },
                { status: 200, body: { data: samplePayloads.webhookSubscription } },
              ],
            ],
            summary: {
              totalRounds: 1,
              completedRounds: 1,
              totalRequests: 4,
              successfulRequests: 3,
              failedRequests: 1,
              strategy: 'allowFailures',
              status: 'partialSuccess',
            },
          },
        });
      }

      if (path === '/api/v1/segment/info') {
        return jsonResponse({ data: samplePayloads.segment });
      }

      throw new Error(`Unexpected request: ${request.method} ${path}`);
    }) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const preloadResult = await preloadMasterData(queryClient, { token: 'jwt-test' });
    expect(preloadResult).toEqual({
      loaded: ['contact', 'inquiry', 'webhookSubscription'],
      failed: ['segment'],
      skipped: [],
    });
    expect(queryClient.getQueryData(segmentInfoQueryKey())).toBeUndefined();

    const { result: segmentHook } = renderHook(() => useSegmentInfo(), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(segmentHook.current.isSuccess).toBe(true));
    expect(segmentHook.current.data?.data).toEqual(samplePayloads.segment as never);
    expect(calls).toEqual(['POST /api/v1/batch/execute', 'GET /api/v1/segment/info']);
  });

  it('absorbs transport failures cleanly without throwing so layout ErrorBoundary is never tripped', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => {
      throw new Error('network offline');
    }) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const result = await preloadMasterData(queryClient, { token: 'jwt-test' });

    expect(result).toEqual({
      loaded: [],
      failed: ['contact', 'inquiry', 'segment', 'webhookSubscription'],
      skipped: [],
    });
  });

  it('usePreloadMasterData skips network when enabled is false and fires once when enabled', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({
        data: {
          batch: [
            [
              { status: 200, body: { data: samplePayloads.contact } },
              { status: 200, body: { data: samplePayloads.inquiry } },
              { status: 200, body: { data: samplePayloads.segment } },
              { status: 200, body: { data: samplePayloads.webhookSubscription } },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 4,
            successfulRequests: 4,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      })) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const { rerender } = renderHook(({ enabled }) => usePreloadMasterData(enabled), {
      initialProps: { enabled: false },
      wrapper: wrapperFor(queryClient),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(0);

    rerender({ enabled: true });
    await waitFor(() =>
      expect(queryClient.getQueryData(contactInfoQueryKey())).toEqual({
        data: samplePayloads.contact,
      }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deduplicates child useContactInfo mounted alongside MasterDataPreloader into a single batch request', async () => {
    const calls: string[] = [];
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      calls.push(`${request.method} ${new URL(request.url).pathname}`);
      return jsonResponse({
        data: {
          batch: [
            [
              { status: 200, body: { data: samplePayloads.contact } },
              { status: 200, body: { data: samplePayloads.inquiry } },
              { status: 200, body: { data: samplePayloads.segment } },
              { status: 200, body: { data: samplePayloads.webhookSubscription } },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 4,
            successfulRequests: 4,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      });
    }) as unknown as typeof fetch);

    const ChildReader = () => {
      const { data } = useContactInfo();
      return <div data-testid="contact-keys">{Object.keys(data?.data?.types ?? {}).join(',')}</div>;
    };

    const queryClient = makeQueryClient();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <MasterDataPreloader />
        <ChildReader />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getByTestId('contact-keys').textContent).toBe('email'));
    expect(calls).toEqual(['POST /api/v1/batch/execute']);
  });

  it('refuses to seed { data: null } or { data: undefined } into the infinite-staleTime cache', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({
        data: {
          batch: [
            [
              { status: 200, body: { data: null } },
              { status: 200, body: {} },
              { status: 200, body: { data: samplePayloads.segment } },
              { status: 200, body: { data: samplePayloads.webhookSubscription } },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 4,
            successfulRequests: 4,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      })) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const result = await preloadMasterData(queryClient, { token: 'jwt-test' });

    expect(result).toEqual({
      loaded: ['segment', 'webhookSubscription'],
      failed: ['contact', 'inquiry'],
      skipped: [],
    });
    expect(queryClient.getQueryData(contactInfoQueryKey())).toBeUndefined();
    expect(queryClient.getQueryData(inquiryInfoQueryKey())).toBeUndefined();
  });

  it('handles HTTP 401/500 JSON error responses from batch/execute without throwing or seeding', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({ error: 'Unauthorized' }, 401)) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const result = await preloadMasterData(queryClient, { token: 'expired-jwt' });

    expect(result).toEqual({
      loaded: [],
      failed: ['contact', 'inquiry', 'segment', 'webhookSubscription'],
      skipped: [],
    });
    expect(queryClient.getQueryData(contactInfoQueryKey())).toBeUndefined();
  });

  it('concurrent child useSegmentInfo mounted during an in-flight partial failure falls back to GET /api/v1/segment/info', async () => {
    const calls: string[] = [];
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      const path = new URL(request.url).pathname;
      calls.push(`${request.method} ${path}`);

      if (path === '/api/v1/batch/execute') {
        return jsonResponse({
          data: {
            batch: [
              [
                { status: 200, body: { data: samplePayloads.contact } },
                { status: 200, body: { data: samplePayloads.inquiry } },
                { status: 500, body: { error: 'segment error' } },
                { status: 200, body: { data: samplePayloads.webhookSubscription } },
              ],
            ],
            summary: {
              totalRounds: 1,
              completedRounds: 1,
              totalRequests: 4,
              successfulRequests: 3,
              failedRequests: 1,
              strategy: 'allowFailures',
              status: 'partialSuccess',
            },
          },
        });
      }

      if (path === '/api/v1/segment/info') {
        return jsonResponse({ data: samplePayloads.segment });
      }

      throw new Error(`Unexpected request: ${request.method} ${path}`);
    }) as unknown as typeof fetch);

    const SegmentReader = () => {
      const { data } = useSegmentInfo();
      return <div data-testid="segment-keys">{Object.keys(data?.data?.types ?? {}).join(',')}</div>;
    };

    const queryClient = makeQueryClient();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <MasterDataPreloader />
        <SegmentReader />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(getByTestId('segment-keys').textContent).toBe('CustomerRelationship'),
    );
    expect(calls).toEqual(['POST /api/v1/batch/execute', 'GET /api/v1/segment/info']);
  });

  it('re-populates cleanly after queryClient.clear() (e.g. logout -> login)', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({
        data: {
          batch: [
            [
              { status: 200, body: { data: samplePayloads.contact } },
              { status: 200, body: { data: samplePayloads.inquiry } },
              { status: 200, body: { data: samplePayloads.segment } },
              { status: 200, body: { data: samplePayloads.webhookSubscription } },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 4,
            successfulRequests: 4,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      })) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    await preloadMasterData(queryClient, { token: 'jwt-1' });
    expect(queryClient.getQueryData(contactInfoQueryKey())).toEqual({
      data: samplePayloads.contact,
    });

    queryClient.clear();
    expect(queryClient.getQueryData(contactInfoQueryKey())).toBeUndefined();

    const second = await preloadMasterData(queryClient, { token: 'jwt-2' });
    expect(second.loaded).toEqual(['contact', 'inquiry', 'segment', 'webhookSubscription']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('anonymous useContactInfo hits GET /api/v1/contact/info directly without calling batch/execute', async () => {
    const calls: string[] = [];
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      calls.push(`${request.method} ${new URL(request.url).pathname}`);
      return jsonResponse({ data: samplePayloads.contact });
    }) as unknown as typeof fetch);

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useContactInfo(), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(samplePayloads.contact as never);
    expect(calls).toEqual(['GET /api/v1/contact/info']);
  });
});
