/**
 * @atlas
 * @kind constructor
 * @constructs queryClient
 * @partOf primitive:ui
 * @uses none
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { invalidateUnfinishedActiveFlow } from '@template/ui/lib/flows/invalidateUnfinishedActiveFlow';
import { doesQueryMetaSkipErrorToast, showApiErrorToast } from '@template/ui/lib/showApiErrorToast';
import { useAppStore } from '@template/ui/store';

export const createAppQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
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
        if (doesQueryMetaSkipErrorToast(mutation.meta)) return;
        showApiErrorToast(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        retry: 1,
        throwOnError: true,
      },
      mutations: {
        throwOnError: true,
      },
    },
  });
  useAppStore.getState().connectQueryClientToWebsocket(queryClient);
  return queryClient;
};
