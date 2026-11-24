/**
 * @atlas
 * @kind utils, error
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import type { ApiErrorBody } from '@template/shared/errors';
import { isTwoFactorReverifyError } from '@template/ui/lib/auth/twoFactor';
import { formatFieldErrors } from '@template/ui/lib/formatFieldErrors';
import { navigateToLogin, navigateToTwoFactorReverify } from '@template/ui/lib/routeRedirect';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';

export const doesQueryMetaSkipErrorToast = (meta: unknown) => {
  if (!meta || typeof meta !== 'object') return false;
  return 'skipErrorToast' in meta && meta.skipErrorToast === true;
};

export const showApiErrorToast = (error: unknown) => {
  if (isTwoFactorReverifyError(error)) {
    toast.error('Two-factor verification required.', {
      action: {
        label: 'Verify 2FA',
        onClick: () => navigateToTwoFactorReverify(useAppStore.getState),
      },
    });
    return;
  }

  let message = 'An error occurred';
  let guidance: ApiErrorBody['guidance'] | undefined;

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') message = error.message;
    if ('guidance' in error && typeof error.guidance === 'string')
      guidance = error.guidance as ApiErrorBody['guidance'];
    if ('fieldErrors' in error && error.fieldErrors && typeof error.fieldErrors === 'object') {
      const details = formatFieldErrors(
        error.fieldErrors as NonNullable<ApiErrorBody['fieldErrors']>,
      );
      if (details) message = details;
    }
  }

  const handlers = {
    fixInput: () => toast.error(`${message}. Please double check your data.`),
    tryAgain: () => toast.error(`${message}. Please try again.`),
    reauthenticate: () =>
      toast.error('Your sign-in has ended. Please log in again.', {
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
        onClick: () =>
          useAppStore.getState().navigation.navigateKeepingSearchParams('/support', 'context'),
      },
    });
};
