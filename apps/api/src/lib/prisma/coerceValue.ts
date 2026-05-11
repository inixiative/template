/**
 * Coerce a raw input value (typically a URL-string from bracket-query
 * parsing) into the runtime type Prisma expects for a given field.
 *
 * Throws on inputs that can't be coerced — `buildWhereClause` lets those
 * bubble up to a 400 at the controller boundary.
 *
 *   String/enum: pass through (Prisma validates enum values at query time)
 *   Int        : Number(v); throws on NaN
 *   Boolean    : true | false | 'true' | 'false'; throws otherwise
 *   DateTime   : Date | ISO string | ms-timestamp (string or number);
 *                throws on Invalid Date
 *   Json       : ALWAYS throws — JSON fields aren't searchable via this
 *                surface. Postgres JSON equality is structural and silently
 *                mismatches across compact/pretty/key-order variations. Use
 *                Prisma's typed JSON operators (`path`, `string_contains`,
 *                etc.) directly when needed.
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

  Json: (value) => {
    throw new Error(
      `JSON fields aren't searchable via this filter surface (got ${JSON.stringify(value)}). Use Prisma's typed JSON operators directly.`,
    );
  },
};

export const coerceValueForField = (field: FieldDef, value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => coerceValueForField(field, item));
  if (field.kind !== 'scalar') return value; // enums + relations pass through
  return COERCERS[field.type]?.(value) ?? value;
};
