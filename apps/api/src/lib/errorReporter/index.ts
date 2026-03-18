import { makeAdapterRouter } from '@template/shared/adapter';
import { consoleReporter } from '#/lib/errorReporter/console';
import { sentryReporter } from '#/lib/errorReporter/sentry';

export type { ErrorContext, ErrorReporter } from '#/lib/errorReporter/types';

const reporter =
  process.env.SENTRY_ENABLED && process.env.SENTRY_DSN
    ? sentryReporter(process.env.SENTRY_DSN)
    : consoleReporter();

export const errorReporter = makeAdapterRouter({
  prod: reporter,
  staging: reporter,
  default: consoleReporter(),
});
