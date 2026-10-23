/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { projectLens } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { type RuleLens, type RuleReference, referenceKey } from '@template/shared/rules';
import { get, groupBy, map, setWith } from 'lodash-es';

const labelPaths = (lenses: RuleLens[]): Map<string, string> => {
  const paths = new Map<string, string>();
  for (const lens of lenses)
    for (const visit of Object.values(projectLens(lens))) {
      const label = visit.sourceLabels.id;
      if (label && !paths.has(visit.model)) paths.set(visit.model, label);
    }
  return paths;
};

const labelSelect = (path: string): Record<string, unknown> => {
  const [head, ...rest] = path.split('.');
  return setWith({}, head!, rest.length ? { select: labelSelect(rest.join('.')) } : true, Object);
};

/** Each reference's display label, read through the label the lens declares for its model's id source. */
export const ruleReferenceLabels = async (
  lenses: RuleLens[],
  references: RuleReference[],
): Promise<Map<string, string>> => {
  const paths = labelPaths(lenses);
  const labels = new Map<string, string>();
  for (const [model, refs] of Object.entries(groupBy(references, 'model'))) {
    const path = paths.get(model);
    if (!path) continue;
    const rows = (await db.withDeleted(() =>
      db.delegate(model).findMany({
        where: { id: { in: [...new Set(map(refs, 'id'))] } },
        select: { id: true, ...labelSelect(path) },
      }),
    )) as Record<string, unknown>[];
    for (const row of rows) {
      const label = get(row, path);
      if (typeof label === 'string')
        labels.set(referenceKey({ model, id: row.id as string }), label);
    }
  }
  return labels;
};
