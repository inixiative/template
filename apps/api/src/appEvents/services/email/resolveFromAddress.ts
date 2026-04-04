import type { EmailSenderContext } from '#/appEvents/types';

/**
 * Resolve the sender ("from") address for an email.
 *
 * Phase 1: platform default env var.
 * Future: sender owner cascade (Space → Org → User → platform default).
 * When EmailSender model lands, this function uses the sender context
 * (false polymorphism: ownerModel + organizationId/spaceId/userId)
 * to look up the configured sender for that scope.
 */
export const resolveFromAddress = async (
  _sender: EmailSenderContext | Record<string, unknown>,
  _handoff: unknown,
): Promise<string> => {
  return process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
};
