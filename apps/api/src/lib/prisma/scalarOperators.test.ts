import { describe, expect, it } from 'bun:test';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';
import {
  getDefaultOperator,
  getValidOperators,
  isValidOperatorForField,
  STRING_OPS_WITH_MODE,
} from '#/lib/prisma/scalarOperators';

const scalar = (type: string): FieldDef => ({ kind: 'scalar', type });
const enumField: FieldDef = { kind: 'enum', type: 'PlatformRole' };
const relation: FieldDef = { kind: 'object', type: 'User' };

describe('getValidOperators', () => {
  it('returns string ops for String fields', () => {
    expect(getValidOperators(scalar('String'))).toEqual([
      'contains',
      'startsWith',
      'endsWith',
      'equals',
      'in',
      'notIn',
      'not',
    ]);
  });

  it('returns enum ops for enum fields (no fuzzy match, no inequality)', () => {
    expect(getValidOperators(enumField)).toEqual(['equals', 'in', 'notIn', 'not']);
  });

  it('returns numeric ops for Int (no contains/startsWith)', () => {
    const ops = getValidOperators(scalar('Int'));
    expect(ops).toContain('gt');
    expect(ops).toContain('gte');
    expect(ops).toContain('lt');
    expect(ops).toContain('lte');
    expect(ops).not.toContain('contains');
    expect(ops).not.toContain('startsWith');
  });

  it('returns date ops for DateTime (no in/notIn)', () => {
    const ops = getValidOperators(scalar('DateTime'));
    expect(ops).toEqual(['equals', 'gt', 'gte', 'lt', 'lte', 'not']);
    expect(ops).not.toContain('in');
  });

  it('returns boolean ops for Boolean (equals + not only)', () => {
    expect(getValidOperators(scalar('Boolean'))).toEqual(['equals', 'not']);
  });

  it('returns empty list for Json (any operator on json is invalid)', () => {
    expect(getValidOperators(scalar('Json'))).toEqual([]);
  });

  it('returns empty list for relations', () => {
    expect(getValidOperators(relation)).toEqual([]);
  });

  it('returns empty list for unknown scalar types', () => {
    expect(getValidOperators(scalar('Bytes'))).toEqual([]);
  });
});

describe('getDefaultOperator', () => {
  it("returns 'contains' for String (fuzzy match default)", () => {
    expect(getDefaultOperator(scalar('String'))).toBe('contains');
  });

  it("returns 'equals' for enums + non-string scalars", () => {
    expect(getDefaultOperator(enumField)).toBe('equals');
    expect(getDefaultOperator(scalar('Int'))).toBe('equals');
    expect(getDefaultOperator(scalar('Boolean'))).toBe('equals');
    expect(getDefaultOperator(scalar('DateTime'))).toBe('equals');
  });
});

describe('isValidOperatorForField', () => {
  it('accepts valid ops for the field kind', () => {
    expect(isValidOperatorForField(scalar('String'), 'contains')).toBe(true);
    expect(isValidOperatorForField(enumField, 'equals')).toBe(true);
    expect(isValidOperatorForField(scalar('DateTime'), 'gte')).toBe(true);
  });

  it("rejects 'contains' on enum (no fuzzy match for enums)", () => {
    expect(isValidOperatorForField(enumField, 'contains')).toBe(false);
  });

  it("rejects 'gt' on string (numeric comparison meaningless for text)", () => {
    expect(isValidOperatorForField(scalar('String'), 'gt')).toBe(false);
  });

  it("rejects 'in' on DateTime (Prisma DateTime filter doesn't support in)", () => {
    expect(isValidOperatorForField(scalar('DateTime'), 'in')).toBe(false);
  });

  it('rejects any operator on Json', () => {
    expect(isValidOperatorForField(scalar('Json'), 'equals')).toBe(false);
  });
});

describe('STRING_OPS_WITH_MODE', () => {
  it('contains every string op that supports Prisma mode insensitive', () => {
    expect(STRING_OPS_WITH_MODE.has('contains')).toBe(true);
    expect(STRING_OPS_WITH_MODE.has('startsWith')).toBe(true);
    expect(STRING_OPS_WITH_MODE.has('endsWith')).toBe(true);
    expect(STRING_OPS_WITH_MODE.has('equals')).toBe(true);
    expect(STRING_OPS_WITH_MODE.has('not')).toBe(true);
  });

  it("excludes 'in' / 'notIn' (Prisma doesn't support mode on array ops)", () => {
    expect(STRING_OPS_WITH_MODE.has('in')).toBe(false);
    expect(STRING_OPS_WITH_MODE.has('notIn')).toBe(false);
  });
});
