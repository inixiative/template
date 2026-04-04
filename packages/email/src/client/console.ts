import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { LogScope, log } from '@template/shared/logger';

export const createConsoleClient = (): EmailClient => {
  const send = async (options: SendEmailOptions): Promise<SendEmailResult> => {
    const id = crypto.randomUUID();
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    log.info(`${options.subject} → ${to} (${options.html.length} chars)`, LogScope.email);
    log.debug(`ID: ${id}, From: ${options.from}`, LogScope.email);

    return {
      id,
      success: true,
    };
  };

  return {
    send,
    sendBatch: async (batch: SendEmailOptions[]): Promise<SendEmailResult[]> => {
      const results: SendEmailResult[] = [];
      for (const options of batch) {
        results.push(await send(options));
      }
      return results;
    },
  };
};
