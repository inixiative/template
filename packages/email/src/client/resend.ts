import { Resend } from 'resend';
import type { EmailClient, SendEmailOptions, SendEmailResult } from './types';

export const createResendClient = (apiKey: string): EmailClient => {
  const resend = new Resend(apiKey);

  return {
    send: async (options: SendEmailOptions): Promise<SendEmailResult> => {
      const { data, error } = await resend.emails.send({
        to: options.to,
        from: options.from,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
        tags: options.tags?.map((name) => ({ name, value: 'true' })),
      });

      if (error) {
        throw new Error(`Resend error: ${error.message}`);
      }

      return {
        id: data?.id ?? '',
        success: true,
      };
    },
  };
};
