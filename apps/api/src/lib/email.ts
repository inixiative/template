import { createConsoleClient, createResendClient, type EmailClient } from '@template/email/client';
import {
  createBouncerVerifier,
  createNoopVerifier,
  type EmailVerifier,
} from '@template/email/client/verification';

const createEmailClient = (): EmailClient => {
  if (process.env.RESEND_API_KEY) return createResendClient(process.env.RESEND_API_KEY);
  return createConsoleClient();
};

const createEmailVerifier = (): EmailVerifier => {
  if (process.env.BOUNCER_API_KEY) return createBouncerVerifier(process.env.BOUNCER_API_KEY);
  return createNoopVerifier();
};

export const emailClient: EmailClient = createEmailClient();
export const emailVerifier: EmailVerifier = createEmailVerifier();

export const resolveEmailClient = async (): Promise<EmailClient> => {
  return emailClient;
};

export const resolveFromAddress = async (): Promise<string> => {
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
