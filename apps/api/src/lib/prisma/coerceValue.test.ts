import { describe, expect, it } from 'bun:test';
import { coerceValueForField } from '#/lib/prisma/coerceValue';
import { enumField, relationField, scalarField } from '#tests/utils/modelFields';

describe('coerceValueForField', () => {
  describe('pass-through types', () => {
    it('returns string values unchanged', () => {
      expect(coerceValueForField(scalarField('String'), 'foo')).toBe('foo');
      expect(coerceValueForField(scalarField('String'), '')).toBe('');
    });

    it('returns enum values unchanged (Prisma validates at query time)', () => {
      expect(
        coerceValueForField(enumField('PlatformRole', ['user', 'superadmin']), 'superadmin'),
      ).toBe('superadmin');
      expect(
        coerceValueForField(enumField('PlatformRole', ['user', 'superadmin']), 'not-a-real-role'),
      ).toBe('not-a-real-role');
    });
  });

  describe('Int', () => {
    it('coerces numeric strings to numbers', () => {
      expect(coerceValueForField(scalarField('Int'), '42')).toBe(42);
      expect(coerceValueForField(scalarField('Int'), '-7')).toBe(-7);
      expect(coerceValueForField(scalarField('Int'), '0')).toBe(0);
    });

    it('passes through numbers unchanged', () => {
      expect(coerceValueForField(scalarField('Int'), 99)).toBe(99);
    });

    it('throws on non-numeric inputs', () => {
      expect(() => coerceValueForField(scalarField('Int'), 'abc')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('Int'), 'NaN')).toThrow(/Cannot coerce/);
    });

    it('rejects non-integer floats (Prisma Int would error at query time)', () => {
      expect(() => coerceValueForField(scalarField('Int'), '3.5')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('Int'), 3.5)).toThrow(/Cannot coerce/);
    });
  });

  describe('BigInt', () => {
    it('coerces integer strings and numbers to bigint', () => {
      expect(coerceValueForField(scalarField('BigInt'), '42')).toBe(42n);
      expect(coerceValueForField(scalarField('BigInt'), 42)).toBe(42n);
      expect(coerceValueForField(scalarField('BigInt'), 9007199254740993n)).toBe(9007199254740993n);
    });

    it('throws on non-integer or non-numeric inputs', () => {
      expect(() => coerceValueForField(scalarField('BigInt'), '3.5')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('BigInt'), 'abc')).toThrow(/Cannot coerce/);
    });
  });

  describe('Float', () => {
    it('coerces numeric strings (integer or decimal) to numbers', () => {
      expect(coerceValueForField(scalarField('Float'), '3.5')).toBe(3.5);
      expect(coerceValueForField(scalarField('Float'), '42')).toBe(42);
    });

    it('throws on non-numeric inputs', () => {
      expect(() => coerceValueForField(scalarField('Float'), 'abc')).toThrow(/Cannot coerce/);
    });
  });

  describe('Boolean', () => {
    it('passes through real booleans', () => {
      expect(coerceValueForField(scalarField('Boolean'), true)).toBe(true);
      expect(coerceValueForField(scalarField('Boolean'), false)).toBe(false);
    });

    it("coerces 'true' and 'false' strings", () => {
      expect(coerceValueForField(scalarField('Boolean'), 'true')).toBe(true);
      expect(coerceValueForField(scalarField('Boolean'), 'false')).toBe(false);
    });

    it("rejects '1', 'yes', or non-boolean strings", () => {
      expect(() => coerceValueForField(scalarField('Boolean'), '1')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('Boolean'), 'yes')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('Boolean'), 0)).toThrow(/Cannot coerce/);
    });
  });

  describe('DateTime', () => {
    it('passes through valid Date instances', () => {
      const d = new Date('2026-05-10T12:00:00Z');
      expect(coerceValueForField(scalarField('DateTime'), d)).toBe(d);
    });

    it('throws on Invalid Date instances', () => {
      expect(() => coerceValueForField(scalarField('DateTime'), new Date('not-a-date'))).toThrow(
        /Invalid Date/,
      );
    });

    it('coerces ISO strings', () => {
      const result = coerceValueForField(scalarField('DateTime'), '2026-05-10T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe('2026-05-10T12:00:00.000Z');
    });

    it('coerces numeric ms-timestamp (number form)', () => {
      const result = coerceValueForField(scalarField('DateTime'), 1715353200000);
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(1715353200000);
    });

    it('coerces numeric ms-timestamp (string form)', () => {
      const result = coerceValueForField(scalarField('DateTime'), '1715353200000');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(1715353200000);
    });

    it('throws on garbage strings', () => {
      expect(() => coerceValueForField(scalarField('DateTime'), 'not-a-date')).toThrow(
        /Cannot coerce/,
      );
    });
  });

  describe('Json', () => {
    it('passes values through — json coercion is handled by buildJsonWhere, not here', () => {
      expect(coerceValueForField(scalarField('Json'), { foo: 'bar' })).toEqual({ foo: 'bar' });
      expect(coerceValueForField(scalarField('Json'), 'anything')).toBe('anything');
    });
  });

  describe('arrays', () => {
    it('maps over arrays for in/notIn operands', () => {
      expect(coerceValueForField(scalarField('Int'), ['1', '2', '3'])).toEqual([1, 2, 3]);
    });

    it('throws on first uncoercible element', () => {
      expect(() => coerceValueForField(scalarField('Int'), ['1', 'bad'])).toThrow(/Cannot coerce/);
    });
  });

  describe('null + boolean symbols', () => {
    it('null passes through untouched for any field (is-null sentinel)', () => {
      expect(coerceValueForField(scalarField('Int'), null)).toBe(null);
      expect(coerceValueForField(scalarField('DateTime'), null)).toBe(null);
      expect(coerceValueForField(scalarField('String'), null)).toBe(null);
    });

    it('a boolean is accepted only for a Boolean field', () => {
      expect(coerceValueForField(scalarField('Boolean'), true)).toBe(true);
      expect(coerceValueForField(scalarField('Boolean'), false)).toBe(false);
    });

    it('a boolean on a non-Boolean field is rejected (no invalid Prisma filter)', () => {
      expect(() => coerceValueForField(scalarField('DateTime'), true)).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('Int'), true)).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalarField('String'), false)).toThrow(/Cannot coerce/);
      expect(() =>
        coerceValueForField(enumField('PlatformRole', ['user', 'superadmin']), true),
      ).toThrow(/Cannot coerce/);
    });
  });

  describe('relations and unknown types', () => {
    it('passes through values for object-kind fields (relations are handled separately)', () => {
      expect(coerceValueForField(relationField('User'), 'whatever')).toBe('whatever');
    });
  });
});
