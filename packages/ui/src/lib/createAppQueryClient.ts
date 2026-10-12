/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 * @uses none
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { Flow } from '@template/sdk';
import { flowReadQueryKeyFor } from '@template/ui/lib/flows/flowReadQuery';
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
      onSuccess: (_data, _variables, _context, mutation) => {
        const { flowId } = useAppStore.getState().navigation;
        if (!flowId || mutation.meta?.skipFlowInvalidate) return;
        const queryKey = flowReadQueryKeyFor(flowId);
        const flow = queryClient.getQueryData<Flow>(queryKey);
        if (flow && flow.currentStep >= flow.steps.length) return;
        void queryClient.invalidateQueries({ queryKey });
      },
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
