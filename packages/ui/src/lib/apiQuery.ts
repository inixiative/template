/**
 * @atlas
 * @kind constructor
 * @constructs queryFn
 * @partOf primitive:ui
 * @uses none
 */
import type { QueryFunctionContext } from '@tanstack/react-query';
import {
  makeAuthenticatedApiFetch,
  type RequestOptionsFor,
} from '@template/ui/lib/makeAuthenticatedApiFetch';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';

export const apiQuery = <TFn extends SdkFunction>(fn: TFn) => {
  return async (context: QueryFunctionContext) => {
    const { auth } = useAppStore.getState();

    return makeAuthenticatedApiFetch<Awaited<ReturnType<TFn>>, Parameters<TFn>[0]>(
      fn as (opts: RequestOptionsFor<Parameters<TFn>[0]>) => Promise<Awaited<ReturnType<TFn>>>,
      {
        spoofUserEmail: auth.spoofUserEmail,
      },
    )(context);
  };
};
