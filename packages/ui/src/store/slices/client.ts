import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { ApiErrorBody } from '@template/shared/errors';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { toast } from '@template/ui/lib/toast';
import type { AppStore } from '@template/ui/store/types';
import type { ClientSlice } from '@template/ui/store/types/client';
import type { StateCreator } from 'zustand';

const shouldSkipToast = (meta: unknown) => {
  if (!meta || typeof meta !== 'object') return false;
  return 'skipErrorToast' in meta && meta.skipErrorToast === true;
};

const handleApiError = (error: unknown, getStore: () => AppStore) => {
  let message = 'An error occurred';
  let guidance: ApiErrorBody['guidance'] | undefined;

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') message = error.message;
    if ('guidance' in error && typeof error.guidance === 'string')
      guidance = error.guidance as ApiErrorBody['guidance'];
  }

  const handlers = {
    fixInput: () => toast.error(`${message}. Please double check your data.`),
    tryAgain: () => toast.error(`${message}. Please try again.`),
    reauthenticate: () =>
      toast.error('Session expired. Please log in again.', {
        action: { label: 'Login', onClick: () => navigateToLogin(getStore) },
      }),
    requestPermission: () => toast.error(`${message}. Contact an administrator to request access.`),
    refreshAndRetry: () =>
      toast.error(message, {
        action: { label: 'Refresh', onClick: () => window.location.reload() },
      }),
  } satisfies Partial<Record<NonNullable<ApiErrorBody['guidance']>, () => void>>;

  const handler = guidance && handlers[guidance as keyof typeof handlers];
  if (handler) handler();
  else
    toast.error(message, {
      action: {
        label: 'Contact Support',
        onClick: () => getStore().navigation.navigatePreserving('/support', 'context'),
      },
    });
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
