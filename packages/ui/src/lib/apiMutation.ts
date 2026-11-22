/**
 * @atlas
 * @kind constructor
 * @constructs mutationFn
 * @partOf primitive:ui
 * @uses none
 */
import { reverifyMethodsFromError } from '@template/ui/lib/auth/twoFactor';
import {
  makeAuthenticatedApiFetch,
  type RequestOptionsFor,
} from '@template/ui/lib/makeAuthenticatedApiFetch';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';

export const apiMutation = <TFn extends SdkFunction>(fn: TFn) => {
  return async (vars?: Parameters<TFn>[0]) => {
    const run = () => {
      const fetcher = makeAuthenticatedApiFetch<Awaited<ReturnType<TFn>>, Parameters<TFn>[0]>(
        fn as (opts: RequestOptionsFor<Parameters<TFn>[0]>) => Promise<Awaited<ReturnType<TFn>>>,
        { spoofUserEmail: useAppStore.getState().auth.spoofUserEmail },
      );
      return vars === undefined ? fetcher() : fetcher(vars);
    };

    try {
      return await run();
    } catch (error) {
      const methods = reverifyMethodsFromError(error);
      if (!methods) throw error;
      await useAppStore.getState().auth.requestTwoFactorVerify(methods);
      return await run();
    }
  };
};
