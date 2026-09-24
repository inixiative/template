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

// The lock is only meaningful for the one row a scalar-equality key can name. A list, an operator
// object or a null names a set the lock key cannot stand for, so upserting mode refuses them.
// Entries are sorted by key so the same where locks the same key whatever its object order, and
// hashed so the key stays bounded and carries no raw column values.
export const findForUpdateLockIdentifier = (model: string, where: Record<string, unknown>): string => {
  const entries = Object.entries(where).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!entries.length) throw new Error('db.findForUpdate() upserting mode requires at least one field');
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
