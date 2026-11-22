/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { QueryClient } from '@tanstack/react-query';
import { batchExecute } from '@template/sdk';
import { makeAuthenticatedApiFetch } from '@template/ui/lib/makeAuthenticatedApiFetch';
import {
  MASTER_DATA_ENTRIES,
  MASTER_DATA_GC_TIME,
  MASTER_DATA_STALE_TIME,
  type MasterDataEntry,
} from '@template/ui/lib/masterData/registry';

export type PreloadMasterDataOptions = {
  entries?: readonly MasterDataEntry[];
  spoofUserEmail?: string | null;
  token?: string | null;
};

export type PreloadMasterDataResult = {
  loaded: string[];
  failed: string[];
  skipped: string[];
};

const inFlightByClient = new WeakMap<QueryClient, Promise<PreloadMasterDataResult>>();

export const inFlightMasterDataPreload = (
  queryClient: QueryClient,
): Promise<PreloadMasterDataResult> | undefined => inFlightByClient.get(queryClient);

const isSeedableInfoBody = (body: unknown): body is { data: Record<string, unknown> } => {
  if (!body || typeof body !== 'object' || !('data' in body)) return false;
  const inner = (body as { data?: unknown }).data;
  return inner != null && typeof inner === 'object';
};

const executePreload = async (
  queryClient: QueryClient,
  entries: readonly MasterDataEntry[],
  options: PreloadMasterDataOptions,
): Promise<PreloadMasterDataResult> => {
  const skipped: string[] = [];
  const pending: MasterDataEntry[] = [];

  for (const entry of entries) {
    queryClient.setQueryDefaults(entry.queryKey, {
      staleTime: MASTER_DATA_STALE_TIME,
      gcTime: MASTER_DATA_GC_TIME,
    });
    if (queryClient.getQueryData(entry.queryKey) !== undefined) {
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
        isSeedableInfoBody(result.body)
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

/**
 * Loads every uncached master-data `/info` catalog in one `POST /api/v1/batch/execute`
 * call (`strategy: 'allowFailures'`) and seeds each successful response into its own
 * React Query cache key. Concurrent calls on the same `QueryClient` share one flight.
 * Never throws: unseeded entries fall back to their individual `use*Info()` query hooks.
 */
export const preloadMasterData = (
  queryClient: QueryClient,
  options: PreloadMasterDataOptions = {},
): Promise<PreloadMasterDataResult> => {
  const existing = inFlightByClient.get(queryClient);
  if (existing && !options.entries) {
    return existing;
  }

  const entries = options.entries ?? MASTER_DATA_ENTRIES;
  const promise = executePreload(queryClient, entries, options).finally(() => {
    if (inFlightByClient.get(queryClient) === promise) {
      inFlightByClient.delete(queryClient);
    }
  });

  if (!options.entries) {
    inFlightByClient.set(queryClient, promise);
  }

  return promise;
};
