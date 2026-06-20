/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { ReachContext } from '#/lib/email';

export type ResolvedSender = {
  platformName: string;
  webUrl: string;
};

// Resolves the {{sender.*}} context for an email. STUB: returns the platform env
// fallback for every sender. Real per-sender resolution (lens-expand the owner
// behind the ReachContext) lands here without changing callers.
export const resolveSender = async (_sender: ReachContext): Promise<ResolvedSender> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  webUrl: process.env.WEB_URL ?? '',
});
