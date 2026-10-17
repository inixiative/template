import { describe, expect, it } from 'bun:test';
import {
  getDefaultOperator,
  getValidOperators,
  isValidOperatorForField,
} from '#/lib/prisma/scalarOperators';
import { enumField, relationField, scalarField } from '#tests/utils/modelFields';

describe('getValidOperators', () => {
  it('returns string ops for String fields', () => {
    expect(getValidOperators(scalarField('String'))).toEqual([
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
    expect(getValidOperators(enumField('PlatformRole', ['user', 'superadmin']))).toEqual([
      'equals',
      'in',
      'notIn',
      'not',
    ]);
  });

  it('returns numeric ops for Int (no contains/startsWith)', () => {
    const ops = getValidOperators(scalarField('Int'));
    expect(ops).toContain('gt');
    expect(ops).toContain('gte');
    expect(ops).toContain('lt');
    expect(ops).toContain('lte');
    expect(ops).not.toContain('contains');
    expect(ops).not.toContain('startsWith');
  });

  it('returns date ops for DateTime (no in/notIn)', () => {
    const ops = getValidOperators(scalarField('DateTime'));
    expect(ops).toEqual(['equals', 'gt', 'gte', 'lt', 'lte', 'not']);
    expect(ops).not.toContain('in');
  });

  it('returns boolean ops for Boolean (equals + not only)', () => {
    expect(getValidOperators(scalarField('Boolean'))).toEqual(['equals', 'not']);
  });

  it('returns empty list for Json (any operator on json is invalid)', () => {
    expect(getValidOperators(scalarField('Json'))).toEqual([]);
  });

  it('returns empty list for relations', () => {
    expect(getValidOperators(relationField('User'))).toEqual([]);
  });

  it('returns empty list for unknown scalar types', () => {
    expect(getValidOperators(scalarField('Bytes'))).toEqual([]);
  });
});

describe('getDefaultOperator', () => {
  it("returns 'contains' for String (fuzzy match default)", () => {
    expect(getDefaultOperator(scalarField('String'))).toBe('contains');
  });

  it("returns 'equals' for enums + non-string scalars", () => {
    expect(getDefaultOperator(enumField('PlatformRole', ['user', 'superadmin']))).toBe('equals');
    expect(getDefaultOperator(scalarField('Int'))).toBe('equals');
    expect(getDefaultOperator(scalarField('Boolean'))).toBe('equals');
    expect(getDefaultOperator(scalarField('DateTime'))).toBe('equals');
  });
});

describe('isValidOperatorForField', () => {
  it('accepts valid ops for the field kind', () => {
    expect(isValidOperatorForField(scalarField('String'), 'contains')).toBe(true);
    expect(
      isValidOperatorForField(enumField('PlatformRole', ['user', 'superadmin']), 'equals'),
    ).toBe(true);
    expect(isValidOperatorForField(scalarField('DateTime'), 'gte')).toBe(true);
  });

  it("rejects 'contains' on enum (no fuzzy match for enums)", () => {
    expect(
      isValidOperatorForField(enumField('PlatformRole', ['user', 'superadmin']), 'contains'),
    ).toBe(false);
  });

  it("rejects 'gt' on string (numeric comparison meaningless for text)", () => {
    expect(isValidOperatorForField(scalarField('String'), 'gt')).toBe(false);
  });

  it("rejects 'in' on DateTime (Prisma DateTime filter doesn't support in)", () => {
    expect(isValidOperatorForField(scalarField('DateTime'), 'in')).toBe(false);
  });

  it('rejects any operator on Json', () => {
    expect(isValidOperatorForField(scalarField('Json'), 'equals')).toBe(false);
  });
});
