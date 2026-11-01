/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db, type HardDeletedOnTombstone } from '@template/db';
import { syncRuleReferences } from '#/hooks/ruleReference/hook';

type Row = Record<string, unknown>;

// Hard-deleted children that are DERIVED from their parent, and how to rebuild them when it is
// revived. HARD_DELETE_ON_TOMBSTONE decides what dies with a parent; this decides what comes back.
// A revocation (Session, Token) has no entry and stays gone — that is the point of revoking it.
// A soft-deleted grant that must stay dead is listed in SKIP_REVIVE instead.
// The rebuild takes every revived parent at once, the same batch the cascade revived their other
// children with.
export const REGENERATE_ON_REVIVE: Partial<
  Record<HardDeletedOnTombstone, (parentModel: string, rows: Row[]) => Promise<void>>
> = {
  RuleReference: async (model, rows) => {
    const ids = rows.flatMap((row) => (typeof row.id === 'string' ? [row.id] : []));
    if (!ids.length) return;
    await syncRuleReferences(
      model,
      (await db.delegate(model).findMany({ where: { id: { in: ids } } })) as Row[],
    );
  },
};
