import { makeAdapterRouter } from '@template/shared/adapter';
import { createConsoleReporter } from '#/lib/errorReporter/client/console';
import { createSentryReporter } from '#/lib/errorReporter/client/sentry';

export type { ErrorContext, ErrorReporter } from '#/lib/errorReporter/types';

const reporter =
  process.env.SENTRY_ENABLED && process.env.SENTRY_DSN
    ? createSentryReporter(process.env.SENTRY_DSN)
    : createConsoleReporter();

export const errorReporter = makeAdapterRouter({
  prod: reporter,
  staging: reporter,
  pr: reporter,
  default: createConsoleReporter(),
});
