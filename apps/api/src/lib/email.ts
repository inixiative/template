import { createConsoleClient, createResendClient, type EmailClient } from '@template/email/client';

const createEmailClient = (): EmailClient => {
  if (process.env.RESEND_API_KEY) {
    return createResendClient(process.env.RESEND_API_KEY);
  }

  return createConsoleClient();
};

export const emailClient: EmailClient = createEmailClient();
