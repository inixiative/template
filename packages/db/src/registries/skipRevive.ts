/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// why: a grant or 2FA credential revived with its parent re-grants access nobody decided on; issue a new one instead
export const SKIP_REVIVE: readonly string[] = ['Token', 'TwoFactor', 'Passkey'];

export const SKIP_REVIVE_SET: ReadonlySet<string> = new Set(SKIP_REVIVE);

export const isSkippedOnRevive = (model: string): boolean => SKIP_REVIVE_SET.has(model);
