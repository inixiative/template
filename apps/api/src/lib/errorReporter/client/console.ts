import { log } from '@template/shared/logger';
import type { ErrorReporter } from '#/lib/errorReporter/types';

export const createConsoleReporter = (): ErrorReporter => ({
  captureException: (err, context) => {
    log.error('[errorReporter]', err, context?.extra);
  },
});
