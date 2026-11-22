/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldOf } from '@inixiative/field-map';
import { Prisma } from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { ModelName } from '@template/db/utils/modelNames';
import { castArray, cloneDeep } from 'lodash-es';

type PrismaOp = {
  increment?: number;
  decrement?: number;
  multiply?: number;
  divide?: number;
  set?: unknown;
  push?: unknown | unknown[];
};

const PRISMA_OPS = ['increment', 'decrement', 'multiply', 'divide', 'set', 'push'] as const;

const isPrismaOp = (value: unknown): value is PrismaOp => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date)
    return false;
  if (value === Prisma.DbNull || value === Prisma.JsonNull || value === Prisma.AnyNull)
    return false;
  const keys = Object.keys(value);
  return keys.length === 1 && PRISMA_OPS.includes(keys[0] as (typeof PRISMA_OPS)[number]);
};

const applyPrismaOp = (prev: unknown, op: PrismaOp): unknown => {
  if ('set' in op) return op.set === Prisma.DbNull ? null : op.set;
  if ('increment' in op && op.increment !== undefined)
    return ((prev as number) ?? 0) + op.increment;
  if ('decrement' in op && op.decrement !== undefined)
    return ((prev as number) ?? 0) - op.decrement;
  if ('multiply' in op && op.multiply !== undefined) return ((prev as number) ?? 0) * op.multiply;
  if ('divide' in op && op.divide !== undefined) return ((prev as number) ?? 0) / op.divide;

  if ('push' in op) {
    const prevArr = Array.isArray(prev) ? prev : [];
    const toPush = castArray(op.push);
    return [...prevArr, ...toPush];
  }

  return prev;
};

const isJsonColumn = (model: ModelName | undefined, field: string): boolean => {
  if (!model) return false;
  const def = fieldOf(prismaMap, model, field);
  return def?.kind === 'scalar' && def.type === 'Json';
};

export type ApplyWriteDataOptions = {
  model?: ModelName;
};

/**
 * Merges a Prisma update `data` payload over a `previous` row so before-update hooks
 * see the post-update field state:
 * - Translates `Prisma.DbNull` to `null` (preserving `Prisma.JsonNull` as a JSONB null sentinel).
 * - Applies single-key Prisma atomic ops (`set`, `increment`, `decrement`, `multiply`, `divide`, `push`)
 *   on non-Json columns while leaving Json object payloads (e.g. `{ set: 'strict' }`) untouched.
 */
export const applyWriteDataOverPreviousRow = (
  previous: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
  options: ApplyWriteDataOptions = {},
): Record<string, unknown> => {
  const result = previous ? cloneDeep(previous) : {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value === Prisma.DbNull) {
      result[key] = null;
      continue;
    }
    if (!isJsonColumn(options.model, key) && isPrismaOp(value)) {
      result[key] = applyPrismaOp(previous?.[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
};
