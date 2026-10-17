/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import { createHash } from 'node:crypto';

type UpsertingValue = string | number | bigint | boolean | Date;

const isUpsertingValue = (value: unknown): value is UpsertingValue =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'bigint' ||
  typeof value === 'boolean' ||
  (value instanceof Date && !Number.isNaN(value.getTime()));

const serializeValue = (value: UpsertingValue): string => {
  if (value instanceof Date) return `date:${value.toISOString()}`;
  return `${typeof value}:${String(value)}`;
};

// The lock stands for exactly what a scalar-equality key names: one row, or a claim on a value such
// as a slug. A list, an operator object or a null names a set the lock key cannot stand for.
// Entries are sorted by key so the same where locks the same key whatever its object order, and
// hashed so the key stays bounded and carries no raw column values.
export const findForUpdateLockIdentifier = (
  model: string,
  where: Record<string, unknown>,
): string => {
  const entries = Object.entries(where).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!entries.length)
    throw new Error('db.findForUpdate() upserting mode requires at least one field');
  const serialized = entries.map(([key, value]) => {
    if (!isUpsertingValue(value)) {
      throw new Error(
        `db.findForUpdate() upserting mode requires a scalar equality for '${key}' on model '${model}' — no arrays, operators, null or undefined`,
      );
    }
    return [key, serializeValue(value)];
  });
  const digest = createHash('sha256').update(JSON.stringify(serialized)).digest('hex');
  return `${model}:${digest}`;
};

const isInList = (value: unknown): value is { in: unknown } =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  'in' in value;

// A batch fences many rows at once by listing values in one field as `{ in: [...] }`; every other
// field stays a scalar, so `{ email: { in: [a, b] }, tenantId }` names the rows (a, tenantId) and
// (b, tenantId). Each value becomes the identifier a single-row fence on it computes, so a batch and
// a single-row writer contend on the same keys. Only one field may list values: two lists name a
// cross product nobody asked for. An empty list names no row and takes no lock.
export const findForUpdateLockIdentifiers = (
  model: string,
  where: Record<string, unknown>,
): string[] => {
  const listed = Object.entries(where).filter(([, value]) => isInList(value));
  if (!listed.length) return [findForUpdateLockIdentifier(model, where)];
  if (listed.length > 1)
    throw new Error(
      `db.findForUpdate() upserting mode: only one field may list values on model '${model}', got ${listed.map(([key]) => `'${key}'`).join(', ')}`,
    );
  const [[field, { in: values }]] = listed as [[string, { in: unknown }]];
  if (!Array.isArray(values))
    throw new Error(`db.findForUpdate(): the 'in' for '${field}' must be an array`);
  return [
    ...new Set(
      values.map((value) => findForUpdateLockIdentifier(model, { ...where, [field]: value })),
    ),
  ];
};
