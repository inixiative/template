import { createConsoleClient, createResendClient, type EmailClient } from '@template/email/client';
import { createBouncerVerifier, createNoopVerifier, type EmailVerifier } from '@template/email/client/verification';
import { makeBroadcastRegistry } from '@template/shared/adapter';

export const emailRegistry = makeBroadcastRegistry<EmailClient>();

if (process.env.RESEND_API_KEY) {
  emailRegistry.register('resend', createResendClient(process.env.RESEND_API_KEY));
} else {
  emailRegistry.register('console', createConsoleClient());
}

export const emailVerifier: EmailVerifier = process.env.BOUNCER_API_KEY
  ? createBouncerVerifier(process.env.BOUNCER_API_KEY)
  : createNoopVerifier();

/**
 * Stub: always returns platform default.
 * Future: cascade resolution via EmailSender model (Space → Org → User → platform).
 */
export const resolveFromAddress = async (): Promise<string> => {
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
