import type { EmailClient } from '@template/email/client';
import type { EmailContext } from '#/events/types';
import { emailClient } from '#/lib/email';

/**
 * Resolve the email client for a given context.
 *
 * Phase 1: always returns platform default.
 * Future: Space provider → Org provider → User provider → platform default.
 * When EmailProvider model lands, this function gains cascade DB lookups
 * without changing callers.
 */
export const resolveEmailClient = async (_ctx: EmailContext): Promise<EmailClient> => {
  return emailClient;
};
