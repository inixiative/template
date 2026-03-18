import type { QueryFunctionContext } from '@tanstack/react-query';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { useAppStore } from '@template/ui/store';

/**
 * Store-aware API wrapper for TanStack Query queries.
 * Automatically reads token and spoofUserEmail from the store.
 * Use this for queryFn in useQuery hooks.
 *
 * Generic over the SDK function type to preserve full type safety.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic constraint — any required to match any SDK function signature
export const apiQuery = <TFn extends (opts: any) => Promise<any>>(fn: TFn) => {
  return async (context: QueryFunctionContext) => {
    const { auth } = useAppStore.getState();

    // biome-ignore lint/suspicious/noExplicitAny: TFn variables type not narrowable without any
    return apiFetchInternal<Awaited<ReturnType<TFn>>, any>(fn, {
      spoofUserEmail: auth.spoofUserEmail,
    })(context);
  };
};
