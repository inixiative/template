/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import type { ApiErrorBody } from '@template/shared/errors';
import { navigateToLogin } from '@template/ui/lib/routeRedirect';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';

export const shouldSkipToast = (meta: unknown) => {
  if (!meta || typeof meta !== 'object') return false;
  return 'skipErrorToast' in meta && meta.skipErrorToast === true;
};

export const handleApiError = (error: unknown) => {
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
        action: { label: 'Login', onClick: () => navigateToLogin(useAppStore.getState) },
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
        onClick: () => useAppStore.getState().navigation.navigatePreserving('/support', 'context'),
      },
    });
};
