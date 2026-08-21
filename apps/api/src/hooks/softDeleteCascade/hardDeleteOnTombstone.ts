/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// Child models revoked (hard-deleted) when their parent is tombstoned, keyed
// by parent model → child models. For ephemeral grants only: state that must
// not survive a revive and is a hazard while the parent is dead. Never logs,
// never user data.
export const HARD_DELETE_ON_TOMBSTONE: Record<string, readonly string[]> = {
  User: ['Session'],
};
