/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, type LensNarrowing, projectByPath, toPrisma } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';
import { makeError } from '#/lib/errors';
import { walkWhere } from '#/lib/prisma/whereWalker';

// Wheres declared on a lens's relation nodes, keyed by the node's dotted
// relation path from the root. Root wheres are buildWhereClause's — it
// composes them unconditionally into the query.
const visitWheres = (filterLens: LensNarrowing): Map<string, Record<string, unknown>[]> => {
  const lens = rootLens(filterLens);
  const byPath = projectByPath(filterLens) as Map<
    string,
    { modelName: string; mapName: string; whereClauses: Condition[] }
  >;
  const rootKey = byPath.keys().next().value;
  const wheres = new Map<string, Record<string, unknown>[]>();
  for (const [key, visit] of byPath) {
    if (key === rootKey || !visit.whereClauses.length) continue;
    const clauses = visit.whereClauses.map((clause: Condition) => {
      const plan = toPrisma(clause, { map: lens, mapName: visit.mapName, model: visit.modelName });
      const step = plan.steps[0];
      if (plan.steps.length !== 1 || !step || !('where' in step) || Object.keys(step.where).length === 0) {
        throw makeError({
          status: 500,
          message: `Narrowing where at '${key}' does not compile to a plain Prisma filter`,
        });
      }
      return step.where;
    });
    wheres.set(key.slice(rootKey!.length + 1), clauses);
  }
  return wheres;
};

// A where declared on a lens relation node applies wherever a query traverses
// that relation — same traversal semantics as the live scope. A relation the
// query never touches contributes nothing.
export const lensWhere = (filterLens: LensNarrowing, where: Record<string, unknown>): Record<string, unknown> => {
  const wheres = visitWheres(filterLens);
  if (!wheres.size) return where;
  return walkWhere(rootLens(filterLens).model, where, ({ path }) => wheres.get(path) ?? []);
};
