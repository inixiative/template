/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */

type Row = Record<string, unknown>;

const isDeletedAtLeaf = (value: unknown): boolean =>
  value === null || value instanceof Date || typeof value === 'string';

const isDeletedAtUpdateValue = (value: unknown): boolean => {
  if (isDeletedAtLeaf(value)) return true;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value as Row);
    return keys.length === 1 && keys[0] === 'set' && isDeletedAtLeaf((value as Row).set);
  }
  return false;
};

/**
 * Returns true when a Prisma update `data` payload modifies ONLY `deletedAt`
 * (soft-delete `{ deletedAt: Date }`, `{ deletedAt: { set: Date } }`, or revive `{ deletedAt: null }`),
 * allowing write-time validators to skip schema re-validation during cascades and revives.
 */
export const isTombstoneOnlyUpdate = (data: unknown): boolean => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const entries = Object.entries(data as Row).filter(([, value]) => value !== undefined);
  if (entries.length !== 1) return false;
  const entry = entries[0];
  if (!entry) return false;
  const [field, value] = entry;
  return field === 'deletedAt' && isDeletedAtUpdateValue(value);
};
