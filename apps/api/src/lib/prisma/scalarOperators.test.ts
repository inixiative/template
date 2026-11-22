import { describe, expect, it } from 'bun:test';
import {
  defaultOperatorForField,
  isValidOperatorForField,
  validOperatorsForField,
} from '#/lib/prisma/scalarOperators';
import { enumField, relationField, scalarField } from '#tests/utils/modelFields';

describe('validOperatorsForField', () => {
  it('returns string ops for String fields', () => {
    expect(validOperatorsForField(scalarField('String'))).toEqual([
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
    expect(validOperatorsForField(enumField('PlatformRole', ['user', 'superadmin']))).toEqual([
      'equals',
      'in',
      'notIn',
      'not',
    ]);
  });

  it('returns numeric ops for Int (no contains/startsWith)', () => {
    const ops = validOperatorsForField(scalarField('Int'));
    expect(ops).toContain('gt');
    expect(ops).toContain('gte');
    expect(ops).toContain('lt');
    expect(ops).toContain('lte');
    expect(ops).not.toContain('contains');
    expect(ops).not.toContain('startsWith');
  });

  it('returns date ops for DateTime (no in/notIn)', () => {
    const ops = validOperatorsForField(scalarField('DateTime'));
    expect(ops).toEqual(['equals', 'gt', 'gte', 'lt', 'lte', 'not']);
    expect(ops).not.toContain('in');
  });

  it('returns boolean ops for Boolean (equals + not only)', () => {
    expect(validOperatorsForField(scalarField('Boolean'))).toEqual(['equals', 'not']);
  });

  it('returns empty list for Json (any operator on json is invalid)', () => {
    expect(validOperatorsForField(scalarField('Json'))).toEqual([]);
  });

  it('returns empty list for relations', () => {
    expect(validOperatorsForField(relationField('User'))).toEqual([]);
  });

  it('returns empty list for unknown scalar types', () => {
    expect(validOperatorsForField(scalarField('Bytes'))).toEqual([]);
  });
});

describe('defaultOperatorForField', () => {
  it("returns 'contains' for String (fuzzy match default)", () => {
    expect(defaultOperatorForField(scalarField('String'))).toBe('contains');
  });

  it("returns 'equals' for enums + non-string scalars", () => {
    expect(defaultOperatorForField(enumField('PlatformRole', ['user', 'superadmin']))).toBe(
      'equals',
    );
    expect(defaultOperatorForField(scalarField('Int'))).toBe('equals');
    expect(defaultOperatorForField(scalarField('Boolean'))).toBe('equals');
    expect(defaultOperatorForField(scalarField('DateTime'))).toBe('equals');
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
