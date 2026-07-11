/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type Condition,
  executePrismaQueryPlan,
  type LensNarrowing,
  projectByPath,
  toPrisma,
} from '@inixiative/json-rules';
import { db } from '@template/db';
import { rootLens } from '@template/db/lens';
import { makeError } from '#/lib/errors';
import { walkWhere } from '#/lib/prisma/whereWalker';

type Visit = { modelName: string; mapName: string; whereClauses: Condition[] };

// Every narrowing where — the root visit keys to '' — compiled per visit.
// Plain rules compile directly; count-operator rules execute their query plan
// down to an id-set filter. Bridge conditions compile to the over-fetch
// sentinel, which cannot run inside a paginated query: fail closed.
const visitWheres = async (filterLens: LensNarrowing): Promise<Map<string, Record<string, unknown>[]>> => {
  const lens = rootLens(filterLens);
  const byPath = projectByPath(filterLens) as Map<string, Visit>;
  const rootKey = byPath.keys().next().value;
  const wheres = new Map<string, Record<string, unknown>[]>();
  for (const [key, visit] of byPath) {
    if (!visit.whereClauses.length) continue;
    const clauses = await Promise.all(
      visit.whereClauses.map(async (clause) => {
        const plan = toPrisma(clause, { map: lens, mapName: visit.mapName, model: visit.modelName });
        const step = plan.steps[0];
        const where =
          plan.steps.length === 1 && step && 'where' in step
            ? step.where
            : await executePrismaQueryPlan(plan, db as never);
        if (Object.keys(where).length === 0) {
          throw makeError({
            status: 500,
            message: `Narrowing where at '${key}' is a bridge condition — not expressible in a paginated query`,
          });
        }
        return where;
      }),
    );
    wheres.set(key === rootKey ? '' : key.slice((rootKey as string).length + 1), clauses);
  }
  return wheres;
};

// A where declared on any lens node applies wherever the query is at that
// node: the root where colors every row, a relation-node where colors every
// traversal of that relation. Applied for superadmin too — narrowing is
// authorization, not visibility.
export const lensWhere = async (
  filterLens: LensNarrowing,
  where: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const wheres = await visitWheres(filterLens);
  if (!wheres.size) return where;
  return walkWhere(rootLens(filterLens).model, where, ({ path }) => wheres.get(path) ?? []);
};
