/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { handleApiError, shouldSkipToast } from '@template/ui/lib/handleApiError';

// The app's QueryClient. Created once at the app root (beside the router) and handed to both the
// provider and the store — see each app's main.tsx. Construction lives outside the store so the
// store never depends on it (its error handlers read the store, not the other way around).
export const createAppQueryClient = (): QueryClient =>
  new QueryClient({
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
