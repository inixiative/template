/**
 * @atlas
 * @kind registry
 * @partOf feature:email
 * @uses primitive:adapter
 */
import { createConsoleClient, createResendClient, type EmailClient } from '@template/email/client';
import { createBouncerVerifier, createNoopVerifier, type EmailVerifier } from '@template/email/client/verification';
import { makeBroadcastRegistry } from '@template/shared/adapter';
import { isTest } from '@template/shared/utils';

export type ReachContext =
  | { ownerModel: 'default' }
  | { ownerModel: 'Organization'; organizationId: string }
  | { ownerModel: 'Space'; spaceId: string };

export const contextKey = (c: ReachContext): string =>
  c.ownerModel === 'Organization'
    ? `Organization:${c.organizationId}`
    : c.ownerModel === 'Space'
      ? `Space:${c.spaceId}`
      : 'default';

export const emailRegistry = makeBroadcastRegistry<EmailClient>();

// Only register a connector when one is actually configured. In test, no
// connector is registered and sendEmail logs a warning + returns. Tests that
// want to exercise email delivery should register an adapter explicitly.
if (process.env.RESEND_API_KEY) {
  emailRegistry.register('resend', createResendClient(process.env.RESEND_API_KEY));
} else if (!isTest) {
  emailRegistry.register('console', createConsoleClient());
}

export const emailVerifier: EmailVerifier = process.env.BOUNCER_API_KEY
  ? createBouncerVerifier(process.env.BOUNCER_API_KEY)
  : createNoopVerifier();

export const resolveFromAddress = async (): Promise<string> => {
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
