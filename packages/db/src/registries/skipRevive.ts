/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// Rows soft-deleted with their parent that never come back with it. The tombstone stays for its
// audit trail; when the parent is revived, a new one has to be issued. Keyed by the child, like
// HARD_DELETE_ON_TOMBSTONE: whether a grant survives its parent's revival is a property of the
// grant. Each delete behavior has its own registry: HARD_DELETE_ON_TOMBSTONE (dies, gone),
// REGENERATE_ON_REVIVE (dies, rebuilt from the revived parent), SKIP_REVIVE (tombstoned, stays dead).
export const SKIP_REVIVE: readonly string[] = [];

export const SKIP_REVIVE_SET: ReadonlySet<string> = new Set(SKIP_REVIVE);

export const isSkippedOnRevive = (model: string): boolean => SKIP_REVIVE_SET.has(model);
