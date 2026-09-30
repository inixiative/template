/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { HardDeletedOnTombstone } from '@template/db';
import { regenerateRuleReferences } from '#/hooks/ruleReference/regenerate';

type Row = Record<string, unknown>;

// Hard-deleted children that are DERIVED from their parent, and how to rebuild them when it is
// revived. HARD_DELETE_ON_TOMBSTONE decides what dies with a parent; this decides what comes back.
// A revocation (Session, Token) has no entry and stays gone — that is the point of revoking it.
export const REGENERATE_ON_REVIVE: Partial<
  Record<HardDeletedOnTombstone, (parentModel: string, row: Row) => Promise<void>>
> = {
  RuleReference: regenerateRuleReferences,
};
