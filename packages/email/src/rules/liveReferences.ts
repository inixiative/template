/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, type ModelName, type RuntimeDelegate, toAccessor } from '@template/db';
import { type RuleRowReference, referenceKey } from '@template/email/rules/ruleReferences';

const delegate = (model: string): RuntimeDelegate => db[toAccessor(model as ModelName)] as unknown as RuntimeDelegate;

const byModel = (references: RuleRowReference[]): Map<string, Set<string>> => {
  const idsByModel = new Map<string, Set<string>>();
  for (const reference of references) {
    idsByModel.set(reference.model, (idsByModel.get(reference.model) ?? new Set()).add(reference.id));
  }
  return idsByModel;
};

/**
 * The rows a set of rule references actually resolves to, as reference keys. Absence is the
 * answer to every way a reference can fail — never created, hard deleted, soft deleted — so a
 * caller asks `has()` and fails closed on `false` without needing to know which it was.
 */
export const liveReferences = async (references: RuleRowReference[]): Promise<Set<string>> => {
  const live = new Set<string>();
  for (const [model, ids] of byModel(references)) {
    const rows = (await delegate(model).findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
    })) as { id: string }[];
    for (const row of rows) live.add(referenceKey({ model, id: row.id }));
  }
  return live;
};

/** Locking variant: the save path fences its targets so a concurrent delete cannot slip past the gate. */
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
