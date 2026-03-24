import type { QueryFunctionContext } from '@tanstack/react-query';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';

/**
 * Store-aware API wrapper for TanStack Query queries.
 * Automatically reads token and spoofUserEmail from the store.
 * Use this for queryFn in useQuery hooks.
 *
 * Generic over the SDK function type to preserve full type safety —
 * ReturnType<TFn> captures the exact conditional return type from hey-api,
 * and Parameters<TFn>[0] preserves the specific parameter shape.
 */
export const apiQuery = <TFn extends SdkFunction>(fn: TFn) => {
  return async (context: QueryFunctionContext) => {
    const { auth } = useAppStore.getState();

    return apiFetchInternal<Awaited<ReturnType<TFn>>, Parameters<TFn>[0]>(
      fn as (opts: Parameters<TFn>[0]) => Promise<Awaited<ReturnType<TFn>>>,
      {
        spoofUserEmail: auth.spoofUserEmail,
      },
    )(context);
  };
};
