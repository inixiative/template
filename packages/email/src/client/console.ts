import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { LogScope, log } from '@template/shared/logger';

export const createConsoleClient = (): EmailClient => {
  return {
    send: async (options: SendEmailOptions): Promise<SendEmailResult> => {
      const id = crypto.randomUUID();
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      log.info(`${options.subject} → ${to} (${options.html.length} chars)`, LogScope.email);
      log.debug(`ID: ${id}, From: ${options.from}`, LogScope.email);

      return {
        id,
        success: true,
      };
    },
  };
};
