import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { executeBatchQueries } from '@template/ui/lib/batch';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('executeBatchQueries', () => {
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('seeds both array list responses (with pagination) and object responses into individual query keys', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({
        data: {
          batch: [
            [
              {
                status: 200,
                body: { data: [{ id: 'sig-1' }], pagination: { total: 1, page: 1 } },
              },
              {
                status: 200,
                body: { data: { counts: { active: 3 } } },
              },
            ],
          ],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 2,
            successfulRequests: 2,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      })) as unknown as typeof fetch);

    const queryClient = new QueryClient();
    const listKey = [{ _id: 'meReadManySignets' }] as const;
    const summaryKey = [{ _id: 'meOverview' }] as const;

    const result = await executeBatchQueries(
      queryClient,
      [
        { key: 'signets', path: '/api/v1/me/signets', queryKey: listKey },
        { key: 'overview', path: '/api/v1/me/overview', queryKey: summaryKey },
      ],
      { token: 'jwt-test' },
    );

    expect(result).toEqual({ loaded: ['signets', 'overview'], failed: [], skipped: [] });
    expect(queryClient.getQueryData(listKey)).toEqual({
      data: [{ id: 'sig-1' }],
      pagination: { total: 1, page: 1 },
    });
    expect(queryClient.getQueryData(summaryKey)).toEqual({
      data: { counts: { active: 3 } },
    });
  });

  it('re-fetches cached keys when skipCached is false (dashboard refresh)', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({
        data: {
          batch: [[{ status: 200, body: { data: [{ id: 'sig-2' }] } }]],
          summary: {
            totalRounds: 1,
            completedRounds: 1,
            totalRequests: 1,
            successfulRequests: 1,
            failedRequests: 0,
            strategy: 'allowFailures',
            status: 'success',
          },
        },
      })) as unknown as typeof fetch);

    const queryClient = new QueryClient();
    const listKey = [{ _id: 'meReadManySignets' }] as const;
    queryClient.setQueryData(listKey, { data: [{ id: 'sig-1' }] });

    const result = await executeBatchQueries(
      queryClient,
      [{ key: 'signets', path: '/api/v1/me/signets', queryKey: listKey }],
      { token: 'jwt-test', skipCached: false },
    );

    expect(result).toEqual({ loaded: ['signets'], failed: [], skipped: [] });
    expect(queryClient.getQueryData(listKey)).toEqual({ data: [{ id: 'sig-2' }] });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
