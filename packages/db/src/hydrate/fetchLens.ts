/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  check,
  type Condition,
  executePrismaQueryPlan,
  type Lens,
  type LensNarrowing,
  projectByPath,
  toPrisma,
} from '@inixiative/json-rules';
import type { Db } from '@template/db/clientTypes';
import { requireWhere } from '@template/db/hydrate/requireWhere';
import { includeFromLens, rootLens } from '@template/db/lens';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { type ModelName, toAccessor } from '@template/db/utils/modelNames';

export const fetchLens = async <T extends Record<string, unknown> = Record<string, unknown>>(
  db: Db,
  lens: Lens | LensNarrowing,
): Promise<T[]> => {
  const root = 'parent' in lens ? rootLens(lens) : lens;
  const byPath = projectByPath(lens);
  const [rootKey] = byPath.keys();
  const visit = rootKey ? byPath.get(rootKey) : undefined;
  if (!visit) return [];

  const model = root.model as ModelName;
  const clauses = visit.whereClauses;
  const condition: Condition = clauses.length === 1 ? clauses[0] : { all: clauses };

  const plan = toPrisma(condition, { map: root, mapName: root.mapName, model });
  const where = plan.steps.length ? await executePrismaQueryPlan(plan, db as never) : {};
  requireWhere(where);

  const include = includeFromLens(lens);
  const delegate = db[toAccessor(model)] as unknown as RuntimeDelegate;
  const rows = (await delegate.findMany(include ? { where, include } : { where })) as T[];

  return rows.filter((row) => check(condition, row) === true);
};
