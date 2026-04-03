import type { EmailContext, EmailHandoff } from '#/events/types';

/**
 * Resolve the sender ("from") address for an email.
 *
 * Phase 1: handoff.from override → platform default env var.
 * Future cascade: handoff.from → sender owner default (Space → Org → User)
 *                 → platform default.
 * When EmailSender model lands, this function uses handoff.sender
 * (false polymorphism: ownerModel + organizationId/spaceId/userId)
 * to look up the configured sender for that scope.
 */
export const resolveFromAddress = async (
  _ctx: EmailContext,
  handoff: EmailHandoff,
): Promise<string> => {
  if (handoff.from) return handoff.from;

  // Future: if (handoff.sender) → lookup sender by ownerModel + IDs
  // e.g. EmailSender where ownerModel + orgId + isDefault

  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
