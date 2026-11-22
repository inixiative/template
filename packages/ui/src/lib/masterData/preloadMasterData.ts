/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { QueryClient } from '@tanstack/react-query';
import {
  type ExecuteBatchQueriesResult,
  executeBatchQueries,
} from '@template/ui/lib/batch/executeBatchQueries';
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

export type PreloadMasterDataResult = ExecuteBatchQueriesResult;

const inFlightByClient = new WeakMap<QueryClient, Promise<PreloadMasterDataResult>>();

export const inFlightMasterDataPreload = (
  queryClient: QueryClient,
): Promise<PreloadMasterDataResult> | undefined => inFlightByClient.get(queryClient);

/**
 * Loads every uncached master-data `/info` catalog through `executeBatchQueries`
 * (`POST /api/v1/batch/execute`, `strategy: 'allowFailures'`) and seeds each successful
 * response into its own React Query cache key with infinite freshness. Concurrent calls
 * on the same `QueryClient` share one flight.
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
  const promise = executeBatchQueries(queryClient, entries, {
    token: options.token,
    spoofUserEmail: options.spoofUserEmail,
    skipCached: true,
    staleTime: MASTER_DATA_STALE_TIME,
    gcTime: MASTER_DATA_GC_TIME,
  }).finally(() => {
    if (inFlightByClient.get(queryClient) === promise) {
      inFlightByClient.delete(queryClient);
    }
  });

  if (!options.entries) {
    inFlightByClient.set(queryClient, promise);
  }

  return promise;
};
