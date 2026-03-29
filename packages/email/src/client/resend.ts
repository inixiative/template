import type { EmailClient, SendEmailOptions, SendEmailResult } from '@template/email/client/types';
import { Resend } from 'resend';

const resendClients = new Map<string, Resend>();

const getResendClient = (apiKey: string): Resend => {
  const existingClient = resendClients.get(apiKey);
  if (existingClient) {
    return existingClient;
  }

  const resendClient = new Resend(apiKey);
  resendClients.set(apiKey, resendClient);
  return resendClient;
};

export const createResendClient = (apiKey: string): EmailClient => {
  const resend = getResendClient(apiKey);

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
