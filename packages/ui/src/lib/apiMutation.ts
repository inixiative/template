/**
 * @atlas
 * @partOf primitive:ui
 */
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';

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
