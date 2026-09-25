/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 * @uses none
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { handleApiError, shouldSkipToast } from '@template/ui/lib/handleApiError';
import { useAppStore } from '@template/ui/store';

export const createAppQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (shouldSkipToast(query.meta)) return;
        handleApiError(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (shouldSkipToast(mutation.meta)) return;
        handleApiError(error);
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
  useAppStore.getState().setClient(queryClient);
  return queryClient;
};
