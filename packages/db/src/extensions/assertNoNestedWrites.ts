/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldOf, modelOf } from '@inixiative/field-map';
import type { Prisma } from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import { toAccessor } from '@template/db/utils/modelNames';
import { castArray } from 'lodash-es';

const NESTED_WRITE_OPS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'connectOrCreate',
]);

// Nested relation writes run in the parent's SQL and skip the related model's hooks; connect/disconnect/set are pure links and allowed.
export const assertNoNestedWrites = (model: Prisma.ModelName, args: unknown): void => {
  if (!modelOf(prismaMap, model)) return;

  const { data, create, update } = (args ?? {}) as {
    data?: unknown;
    create?: unknown;
    update?: unknown;
  };
  for (const payload of [data, create, update].flatMap((d) => castArray(d))) {
    if (!payload || typeof payload !== 'object') continue;
    for (const [field, value] of Object.entries(payload)) {
      const relation = fieldOf(prismaMap, model, field);
      if (relation?.kind !== 'object' || !value || typeof value !== 'object') continue;
      if (Object.keys(value).some((op) => NESTED_WRITE_OPS.has(op))) {
        const accessor = toAccessor(relation.type as Prisma.ModelName);
        throw new Error(
          `Nested write on ${model}.${field} skips ${relation.type} hooks - decompose into top-level db.${accessor} calls inside db.txn().`,
        );
      }
    }
  }
};
