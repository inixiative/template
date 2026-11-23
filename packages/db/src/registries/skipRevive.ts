/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// why: a grant or canceled billing account revived with its parent would re-grant access or restore external billing nobody decided on
export const SKIP_REVIVE: readonly string[] = ['Token', 'BillingAccount'];

export const SKIP_REVIVE_SET: ReadonlySet<string> = new Set(SKIP_REVIVE);

export const isSkippedOnRevive = (model: string): boolean => SKIP_REVIVE_SET.has(model);
