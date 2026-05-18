import type { QueryFunctionContext } from '@tanstack/react-query';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';

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
