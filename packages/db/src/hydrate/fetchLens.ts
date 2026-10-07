/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type Condition,
  check,
  executePrismaPlan,
  type Lens,
  type LensNarrowing,
  projectLens,
  toPrisma,
} from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { requireWhere } from '@template/db/hydrate/requireWhere';
import { includeFromLens, rootLens } from '@template/db/lens';
import { toModelName } from '@template/db/utils/modelNames';

export const fetchLens = async <T extends Record<string, unknown> = Record<string, unknown>>(
  lens: Lens | LensNarrowing,
): Promise<T[]> => {
  const root = 'parent' in lens ? rootLens(lens) : lens;
  const visit = projectLens(lens)[root.model];
  if (!visit) return [];

  const model = toModelName(root.model);
  const clauses = visit.whereClauses;
  const condition: Condition = clauses.length === 1 ? clauses[0] : { all: clauses };

  const plan = toPrisma(condition, { map: root, mapName: root.mapName, model });
  const where = plan.steps.length ? await executePrismaPlan(plan, db as never) : {};
  requireWhere(where);

  const include = includeFromLens(lens);
  const delegate = db.delegate(model);
  const rows = (await delegate.findMany(include ? { where, include } : { where })) as T[];

  return rows.filter((row) => check(condition, row) === true);
};
