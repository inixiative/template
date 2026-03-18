import * as Sentry from '@sentry/bun';
import type { ErrorReporter } from '#/lib/errorReporter/types';

export const sentryReporter = (dsn: string): ErrorReporter => {
  Sentry.init({ dsn });
  return {
    captureException: (err, context) => {
      Sentry.captureException(err, { extra: context?.extra });
    },
  };
};
