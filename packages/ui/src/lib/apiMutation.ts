import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { useAppStore } from '@template/ui/store';

/**
 * Extracts the parameter type from a function
 */
// biome-ignore lint/suspicious/noExplicitAny: conditional type infer — any required to extract param type from any function signature
type FunctionParams<TFn> = TFn extends (params: infer P) => any ? P : never;

/**
 * Store-aware API wrapper for mutations.
 * Automatically reads token and spoofUserEmail from the store.
 * Use this for mutations (create, update, delete operations).
 *
 * Generic over the SDK function type to preserve full type safety.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic constraint — any required to match any SDK function signature
export const apiMutation = <TFn extends (opts: any) => Promise<any>>(fn: TFn) => {
  return async (vars?: FunctionParams<TFn>) => {
    const { auth } = useAppStore.getState();

    const fetcher = apiFetchInternal<Awaited<ReturnType<TFn>>, FunctionParams<TFn>>(fn, {
      spoofUserEmail: auth.spoofUserEmail,
    });

    if (vars === undefined) {
      return fetcher();
    }

    return fetcher(vars);
  };
};
