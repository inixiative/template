/**
 * @atlas
 * @kind transformer
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FieldDef } from '#/lib/prisma/fieldMetadata';

type Coercer = (value: unknown) => unknown;

const COERCERS: Record<string, Coercer> = {
  Int: (value) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) throw new Error(`Cannot coerce ${JSON.stringify(value)} to Int`);
    return num;
  },

  Boolean: (value) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Cannot coerce ${JSON.stringify(value)} to Boolean`);
  },

  DateTime: (value) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw new Error('Invalid Date instance');
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) throw new Error(`Cannot coerce ${JSON.stringify(value)} to DateTime`);
      return d;
    }
    if (typeof value === 'string') {
      // Numeric ms-timestamp string (`'1715353200000'`) first, then ISO.
      if (/^-?\d+$/.test(value)) {
        const d = new Date(Number(value));
        if (!Number.isNaN(d.getTime())) return d;
      }
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    throw new Error(`Cannot coerce ${JSON.stringify(value)} to DateTime`);
  },

  // Json filters carry their own values (path / string_contains / …) and are
  // handled by buildJsonWhere, not coercion — pass through unchanged.
};

export const coerceValueForField = (field: FieldDef, value: unknown): unknown => {
  if (value === null || typeof value === 'boolean') return value; // symbol values pass through
  if (Array.isArray(value)) return value.map((item) => coerceValueForField(field, item));
  if (field.kind !== 'scalar') return value; // enums + relations pass through
  return COERCERS[field.type]?.(value) ?? value;
};
