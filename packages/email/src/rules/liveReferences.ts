/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, type ModelName } from '@template/db';
import { type RuleRowReference, referenceKey } from '@template/email/rules/ruleReferences';

const byModel = (references: RuleRowReference[]): Map<string, Set<string>> => {
  const idsByModel = new Map<string, Set<string>>();
  for (const reference of references) {
    idsByModel.set(reference.model, (idsByModel.get(reference.model) ?? new Set()).add(reference.id));
  }
  return idsByModel;
};

/**
 * The references that resolve to a live row, with those rows locked for the rest of the
 * transaction — the save gate's fence, so a concurrent delete cannot land between the check and
 * the edge it admits. Absence is the answer: never created and soft deleted both fail closed.
 */
export const lockedLiveReferences = async (references: RuleRowReference[]): Promise<Set<string>> => {
  const live = new Set<string>();
  for (const [model, ids] of byModel(references)) {
    const rows = await db.findForUpdate<{ id: string; deletedAt: Date | null }>(model as ModelName, {
      id: { in: [...ids] },
    });
    for (const row of rows) if (row.deletedAt == null) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};
