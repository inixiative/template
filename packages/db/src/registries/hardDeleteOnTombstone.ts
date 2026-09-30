/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

// Rows that cannot outlive their parent. Keyed by the child, not the parent: whether a row dies
// with its parent is a property of what the row is, and the per-parent form silently missed every
// parent nobody thought to list.
export const HARD_DELETE_ON_TOMBSTONE = [
  'Session',
  'Token',
  'WebhookSubscription',
  'WebhookEvent',
] as const;

export type HardDeletedOnTombstone = (typeof HARD_DELETE_ON_TOMBSTONE)[number];

export const HARD_DELETE_ON_TOMBSTONE_SET: ReadonlySet<string> = new Set(HARD_DELETE_ON_TOMBSTONE);

export const isHardDeletedOnTombstone = (model: string): model is HardDeletedOnTombstone =>
  HARD_DELETE_ON_TOMBSTONE_SET.has(model);
