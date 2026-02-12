import type { QueryFunctionContext } from '@tanstack/react-query';
import { useAppStore } from '@template/ui/store';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';

/**
 * Store-aware API wrapper for TanStack Query queries.
 * Automatically reads token and spoofUserEmail from the store.
 * Use this for queryFn in useQuery hooks.
 *
 * Generic over the SDK function type to preserve full type safety.
 */
export const apiQuery = <TFn extends (opts: any) => Promise<any>>(
  fn: TFn,
) => {
  return async (context: QueryFunctionContext) => {
    const { auth } = useAppStore.getState();

    return apiFetchInternal<Awaited<ReturnType<TFn>>, any>(fn, {
      spoofUserEmail: auth.spoofUserEmail,
    })(context);
  };
};
