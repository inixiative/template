import { log } from '@template/shared/logger';
import type { EmailClient, SendEmailOptions, SendEmailResult } from './types';

export const createConsoleClient = (): EmailClient => {
  return {
    send: async (options: SendEmailOptions): Promise<SendEmailResult> => {
      const id = crypto.randomUUID();
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      log.info(`[email] ${options.subject} → ${to} (${options.html.length} chars)`);
      log.debug(`[email] ID: ${id}, From: ${options.from}`);

      return {
        id,
        success: true,
      };
    },
  };
};
