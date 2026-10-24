/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { toSourceQueries } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { hasDeletedAt } from '@template/db/utils/fieldMetadata';
import { sourceQueryValues } from '@template/db/utils/sourceQueryValues';
import { type RuleLens, type RuleReference, referenceKey } from '@template/shared/rules';
import { groupBy, map } from 'lodash-es';

export type ReferenceScope = { lens: RuleLens; references: RuleReference[] };

export type DeadRuleReference = RuleReference & { state: 'deleted' | 'missing' };

const ownerScopeIds = async (lens: RuleLens, model: string): Promise<Set<string>> => {
  const source = toSourceQueries(lens).find(
    (query) => query.model === model && query.field === 'id',
  );
  if (!source) return new Set();
  const { options } = await sourceQueryValues(source, { lens });
  return new Set(options.map((option) => String(option.value)));
};

const deletedAtById = async (model: string, ids: string[]): Promise<Map<string, Date | null>> => {
  const rows = (await db.withDeleted(() =>
    db.delegate(model).findMany({
      where: { id: { in: ids } },
      select: { id: true, ...(hasDeletedAt(model) ? { deletedAt: true } : {}) },
    }),
  )) as { id: string; deletedAt?: Date | null }[];
  return new Map(rows.map((row) => [row.id, row.deletedAt ?? null]));
};

/** The references that point at a deleted row, or at no row in their scope's owner scope. */
export const deadRuleReferences = async (
  scopes: ReferenceScope[],
  references: RuleReference[] = scopes.flatMap((scope) => scope.references),
): Promise<DeadRuleReference[]> => {
  const dead = new Map<string, DeadRuleReference>();
  const scoped = new Set(scopes.flatMap((scope) => scope.references.map(referenceKey)));
  for (const reference of references)
    if (!scoped.has(referenceKey(reference)))
      dead.set(referenceKey(reference), { ...reference, state: 'missing' });
  for (const { lens, references: scopeReferences } of scopes)
    for (const [model, group] of Object.entries(groupBy(scopeReferences, 'model'))) {
      const ids = [...new Set(map(group, 'id'))];
      const inScope = await ownerScopeIds(lens, model);
      const deletedAt = await deletedAtById(model, ids);
      for (const id of ids) {
        const state = deletedAt.get(id) ? 'deleted' : inScope.has(id) ? null : 'missing';
        if (state) dead.set(referenceKey({ model, id }), { model, id, state });
      }
    }
  return [...dead.values()];
};
