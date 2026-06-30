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
import type { Sender } from '#/lib/email/sender';

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

// The email client we send through. Today a single adapter is registered (resend
// XOR console; first-registered wins) — deliverEmail resolves it here rather than
// receiving an adapter name, because we don't route by adapter.
export const defaultEmailClient = (): EmailClient => {
  const [name] = emailRegistry.names();
  if (!name) throw new Error('No email adapter registered');
  return emailRegistry.get(name);
};

// Resolves the envelope from-address. STUB: returns the platform env fallback for
// every (template, sender). Real per-category (system vs promotional) + per-sender
// resolution — for sender-reputation isolation — lands here without changing callers.
export const resolveFromAddress = async (_template: string, _sender: Sender): Promise<string> => {
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
