/**
 * @atlas
 * @kind transformer
 * @partOf infrastructure:prisma
 * @uses none
 *
 * null (the `[:]` is-null wire symbol) passes through untouched for any field —
 * it's the is-null sentinel, valid on every field. A boolean is only accepted for
 * a Boolean-kind field; on any other field it is rejected with an error (so e.g.
 * `searchFields[createdAt][:]=true` no longer builds an invalid Prisma filter).
 */
import { makeError } from '#/lib/errors';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';

type Coercer = (value: unknown) => unknown;

const COERCERS: Record<string, Coercer> = {
  Int: (value) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num))
      throw makeError({ status: 400, message: `Cannot coerce ${JSON.stringify(value)} to Int` });
    return num;
  },

  Boolean: (value) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw makeError({ status: 400, message: `Cannot coerce ${JSON.stringify(value)} to Boolean` });
  },

  DateTime: (value) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) throw makeError({ status: 400, message: 'Invalid Date instance' });
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime()))
        throw makeError({ status: 400, message: `Cannot coerce ${JSON.stringify(value)} to DateTime` });
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
    throw makeError({ status: 400, message: `Cannot coerce ${JSON.stringify(value)} to DateTime` });
  },

  // Json filters carry their own values (path / string_contains / …) and are
  // handled by buildJsonWhere, not coercion — pass through unchanged.
};

const kindLabel = (field: FieldDef): string => (field.kind === 'enum' ? 'enum' : field.type);

export const coerceValueForField = (field: FieldDef, value: unknown): unknown => {
  // null is the `[:]` is-null wire symbol — valid on any field, pass through.
  if (value === null) return value;
  if (Array.isArray(value)) return value.map((item) => coerceValueForField(field, item));
  // A boolean is only valid for a Boolean-kind field. For everything else it must
  // be rejected here rather than passing through and building an invalid Prisma filter.
  if (typeof value === 'boolean') {
    if (field.kind === 'scalar' && field.type === 'Boolean') return value;
    throw makeError({ status: 400, message: `Cannot coerce ${JSON.stringify(value)} to ${kindLabel(field)}` });
  }
  if (field.kind !== 'scalar') return value; // enums + relations pass through
  return COERCERS[field.type]?.(value) ?? value;
};
