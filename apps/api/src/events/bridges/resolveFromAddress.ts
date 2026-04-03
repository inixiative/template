import type { EmailContext, EmailHandoff } from '#/events/types';

/**
 * Resolve the sender ("from") address for an email.
 *
 * Phase 1: handoff.from override → platform default env var.
 * Future: handoff.senderId → Template.senderId → Space default sender
 *         → Org default sender → User default sender → platform default.
 * When EmailSender model lands, this function gains cascade DB lookups
 * without changing callers.
 */
export const resolveFromAddress = async (
  _ctx: EmailContext,
  handoff: EmailHandoff,
): Promise<string> => {
  if (handoff.from) return handoff.from;
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
