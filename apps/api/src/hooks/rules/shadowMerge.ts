import { cloneDeep } from 'lodash-es';

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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && PRISMA_OPS.includes(keys[0] as (typeof PRISMA_OPS)[number]);
};

const applyPrismaOp = (prev: unknown, op: PrismaOp): unknown => {
  if ('set' in op) return op.set;
  if ('increment' in op) return ((prev as number) ?? 0) + op.increment!;
  if ('decrement' in op) return ((prev as number) ?? 0) - op.decrement!;
  if ('multiply' in op) return ((prev as number) ?? 0) * op.multiply!;
  if ('divide' in op) return ((prev as number) ?? 0) / op.divide!;

  if ('push' in op) {
    const prevArr = Array.isArray(prev) ? prev : [];
    const toPush = Array.isArray(op.push) ? op.push : [op.push];
    return [...prevArr, ...toPush];
  }

  return prev;
};

export const shadowMerge = (
  previous: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const result = previous ? cloneDeep(previous) : {};

  for (const [key, value] of Object.entries(data)) {
    if (isPrismaOp(value)) {
      result[key] = applyPrismaOp(previous?.[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
};
