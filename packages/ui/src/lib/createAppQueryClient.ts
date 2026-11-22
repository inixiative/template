/**
 * @atlas
 * @kind constructor
 * @constructs queryClient
 * @partOf primitive:ui
 * @uses none
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { twoFactorActionFromError } from '@template/ui/lib/auth/twoFactor';
import { invalidateUnfinishedActiveFlow } from '@template/ui/lib/flows/invalidateUnfinishedActiveFlow';
import { navigateToTwoFactorSetup } from '@template/ui/lib/routeRedirect';
import { doesQueryMetaSkipErrorToast, showApiErrorToast } from '@template/ui/lib/showApiErrorToast';
import { useAppStore } from '@template/ui/store';

export const createAppQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const twoFactorAction = twoFactorActionFromError(error);
        if (twoFactorAction) {
          navigateToTwoFactorSetup(twoFactorAction, useAppStore.getState);
          return;
        }
        if (doesQueryMetaSkipErrorToast(query.meta)) return;
        showApiErrorToast(error);
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) => {
        if (mutation.meta?.skipFlowInvalidate) return;
        invalidateUnfinishedActiveFlow(queryClient);
      },
      onError: (error, _variables, _context, mutation) => {
        const twoFactorAction = twoFactorActionFromError(error);
        if (twoFactorAction) {
          navigateToTwoFactorSetup(twoFactorAction, useAppStore.getState);
          return;
        }
        if (doesQueryMetaSkipErrorToast(mutation.meta)) return;
        showApiErrorToast(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: (count, error) => !twoFactorActionFromError(error) && count < 1,
        throwOnError: (error) => !twoFactorActionFromError(error),
      },
      mutations: {
        throwOnError: (error) => !twoFactorActionFromError(error),
      },
    },
  });
  useAppStore.getState().connectQueryClientToWebsocket(queryClient);
  return queryClient;
};
