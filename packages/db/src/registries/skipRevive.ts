/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// why: a grant revived with its parent re-grants access nobody decided on; a canceled inquiry is closed for good
export const SKIP_REVIVE: readonly string[] = ['Token', 'Inquiry'];

export const SKIP_REVIVE_SET: ReadonlySet<string> = new Set(SKIP_REVIVE);

export const isSkippedOnRevive = (model: string): boolean => SKIP_REVIVE_SET.has(model);
