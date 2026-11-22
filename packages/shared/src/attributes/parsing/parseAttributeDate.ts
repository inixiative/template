/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

/** Parses a Date or ISO-8601 date string into a valid Date, or returns null if invalid. */
export const parseAttributeDate = (raw: unknown): Date | null => {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};
