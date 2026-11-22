/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { QueryClient } from '@tanstack/react-query';
import { batchExecute } from '@template/sdk';
import { makeAuthenticatedApiFetch } from '@template/ui/lib/makeAuthenticatedApiFetch';

export type BatchQueryDescriptor = {
  readonly key: string;
  readonly path: string;
  readonly queryKey: readonly unknown[];
};

export type ExecuteBatchQueriesOptions = {
  token?: string | null;
  spoofUserEmail?: string | null;
  /** Skip entries whose `queryKey` already has cached data in `queryClient`. Defaults to `true`. */
  skipCached?: boolean;
  /** Optional React Query defaults registered per `queryKey` before seeding. */
  staleTime?: number;
  gcTime?: number;
};

export type ExecuteBatchQueriesResult = {
  loaded: string[];
  failed: string[];
  skipped: string[];
};

const isSeedableResponseBody = (body: unknown): body is { data: object } => {
  if (!body || typeof body !== 'object' || !('data' in body)) return false;
  const inner = (body as { data?: unknown }).data;
  return inner != null && typeof inner === 'object';
};

/**
 * Shared client-side batch transport (`POST /api/v1/batch/execute`, `strategy: 'allowFailures'`)
 * for React Query (R-2026-11-18-10): sends a group of GET queries in one HTTP round-trip and
 * seeds each successful response into its own React Query cache key (`{ data: ... }`), matching
 * the unwrapped shape returned by `apiQuery(...)`. Failed entries are left unseeded so each
 * individual `useQuery` hook falls back cleanly to its own endpoint. Never throws.
 */
export const executeBatchQueries = async (
  queryClient: QueryClient,
  entries: readonly BatchQueryDescriptor[],
  options: ExecuteBatchQueriesOptions = {},
): Promise<ExecuteBatchQueriesResult> => {
  const skipCached = options.skipCached ?? true;
  const skipped: string[] = [];
  const pending: BatchQueryDescriptor[] = [];

  for (const entry of entries) {
    if (options.staleTime !== undefined || options.gcTime !== undefined) {
      queryClient.setQueryDefaults(entry.queryKey, {
        ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
        ...(options.gcTime !== undefined ? { gcTime: options.gcTime } : {}),
      });
    }
    if (skipCached && queryClient.getQueryData(entry.queryKey) !== undefined) {
      skipped.push(entry.key);
    } else {
      pending.push(entry);
    }
  }

  if (pending.length === 0) {
    return { loaded: [], failed: [], skipped };
  }

  const loaded: string[] = [];
  const failed: string[] = [];

  try {
    const runBatch = makeAuthenticatedApiFetch<
      Awaited<ReturnType<typeof batchExecute>>,
      Parameters<typeof batchExecute>[0]
    >((opts) => batchExecute(opts), {
      token: options.token,
      spoofUserEmail: options.spoofUserEmail,
      throwOnError: false,
    });

    const response = await runBatch({
      body: {
        strategy: 'allowFailures',
        requests: [pending.map((entry) => ({ method: 'GET' as const, path: entry.path }))],
      },
    });

    const roundResults = response?.data?.batch?.[0];
    if (!Array.isArray(roundResults)) {
      return { loaded: [], failed: pending.map((entry) => entry.key), skipped };
    }

    for (const [index, entry] of pending.entries()) {
      const result = roundResults[index];
      if (
        result &&
        typeof result.status === 'number' &&
        result.status >= 200 &&
        result.status < 300 &&
        isSeedableResponseBody(result.body)
      ) {
        queryClient.setQueryData(entry.queryKey, result.body);
        loaded.push(entry.key);
      } else {
        failed.push(entry.key);
      }
    }
  } catch {
    return { loaded: [], failed: pending.map((entry) => entry.key), skipped };
  }

  return { loaded, failed, skipped };
};
