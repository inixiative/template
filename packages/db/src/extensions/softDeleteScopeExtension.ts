/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getSoftDeleteScoper, type SoftDeleteScoper } from '@template/db/extensions/softDeleteScopeRegistry';
import { Prisma } from '@template/db/generated/client/client';
import { auditActorContext } from '@template/db/lib/auditActorContext';

const SCOPED_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

const bypassed = (): boolean => {
  const scope = auditActorContext.getScope();
  return !!scope && (scope.platformSuperadmin || scope.bypassSoftDeleteScope);
};

const scopeArgs = (scoper: SoftDeleteScoper, model: string, args: unknown): Record<string, unknown> => {
  const next = { ...((args ?? {}) as Record<string, unknown>) };
  next.where = scoper.liveWhere(model, (next.where as Record<string, unknown>) ?? {});
  for (const key of ['include', 'select'] as const) {
    const tree = next[key];
    if (tree && typeof tree === 'object') next[key] = scoper.liveIncludes(model, tree as Record<string, unknown>);
  }
  return next;
};

export const softDeleteScopeExtension = () =>
  Prisma.defineExtension({
    name: 'softDeleteScope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoper = getSoftDeleteScoper();
          if (!scoper || bypassed() || !SCOPED_OPS.has(operation)) return query(args);
          return query(scopeArgs(scoper, model, args) as typeof args);
        },
      },
    },
  });
