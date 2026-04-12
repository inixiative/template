import type { EmailSenderContext } from '@template/email/send/types';

/**
 * Stub: always returns platform default.
 * Future: cascade resolution via EmailSender model (Space → Org → User → platform),
 * keyed off the provided sender context.
 */
export const resolveFromAddress = async (_sender?: EmailSenderContext): Promise<string> => {
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
