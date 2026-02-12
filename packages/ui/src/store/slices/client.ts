import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { StateCreator } from 'zustand';
import type { AppStore } from '@template/ui/store/types';
import type { ClientSlice } from '@template/ui/store/types/client';
import { toast } from '@template/ui/lib/toast';
import type { ApiErrorBody } from '@template/shared/errors';

const shouldSkipToast = (meta: unknown) => {
  if (!meta || typeof meta !== 'object') return false;
  return 'skipErrorToast' in meta && meta.skipErrorToast === true;
};

const handleApiError = (error: unknown, getStore: () => AppStore) => {
  // Default values
  let message = 'An error occurred';
  let guidance: ApiErrorBody['guidance'] | undefined;

  // Parse API error response
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      message = error.message;
    }
    if ('guidance' in error && typeof error.guidance === 'string') {
      guidance = error.guidance as ApiErrorBody['guidance'];
    }
  }

  // Handle based on guidance
  switch (guidance) {
    case 'fixInput':
      // Show toast, inline errors will provide details
      toast.error(`${message}. Please double check your data.`);
      break;

    case 'tryAgain':
      // Show toast with retry hint
      toast.error(`${message}. Please try again.`);
      break;

    case 'reauthenticate':
      // Show toast with login link
      toast.error('Session expired. Please log in again.', {
        action: {
          label: 'Login',
          onClick: () => {
            const currentPath = window.location.pathname + window.location.search;
            getStore().navigation.navigatePreservingContext(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
          },
        },
      });
      break;

    case 'requestPermission':
      // Show persistent error with admin CTA
      toast.error(`${message}. Contact an administrator to request access.`);
      break;

    case 'refreshAndRetry':
      // Show toast with refresh button
      toast.error(message, {
        action: {
          label: 'Refresh',
          onClick: () => {
            window.location.reload();
          },
        },
      });
      break;

    case 'contactSupport':
    default:
      // Persistent error toast with support link
      toast.error(message, {
        action: {
          label: 'Contact Support',
          onClick: () => {
            getStore().navigation.navigatePreservingContext('/support');
          },
        },
      });
      break;
  }
};

export const createClientSlice: StateCreator<AppStore, [], [], ClientSlice> = (_set, get) => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (shouldSkipToast(query.meta)) return;
        handleApiError(error, get);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (shouldSkipToast(mutation.meta)) return;
        handleApiError(error, get);
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

  return {
    client: queryClient,
  };
};
