import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';

/**
 * Store-aware API wrapper for mutations.
 * Automatically reads token and spoofUserEmail from the store.
 * Use this for mutations (create, update, delete operations).
 *
 * Generic over the SDK function type to preserve full type safety —
 * ReturnType<TFn> captures the exact conditional return type from hey-api,
 * and Parameters<TFn>[0] preserves the specific parameter shape.
 */
export const apiMutation = <TFn extends SdkFunction>(fn: TFn) => {
  return async (vars?: Parameters<TFn>[0]) => {
    const { auth } = useAppStore.getState();

    const fetcher = apiFetchInternal<Awaited<ReturnType<TFn>>, Parameters<TFn>[0]>(
      fn as (opts: Parameters<TFn>[0]) => Promise<Awaited<ReturnType<TFn>>>,
      {
        spoofUserEmail: auth.spoofUserEmail,
      },
    );

    if (vars === undefined) {
      return fetcher();
    }

    return fetcher(vars);
  };
};
