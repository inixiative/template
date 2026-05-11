import { describe, expect, it } from 'bun:test';
import { coerceValueForField } from '#/lib/prisma/coerceValue';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';

const scalar = (type: string): FieldDef => ({ kind: 'scalar', type });
const enumField: FieldDef = { kind: 'enum', type: 'PlatformRole', values: ['user', 'superadmin'] };

describe('coerceValueForField', () => {
  describe('pass-through types', () => {
    it('returns string values unchanged', () => {
      expect(coerceValueForField(scalar('String'), 'foo')).toBe('foo');
      expect(coerceValueForField(scalar('String'), '')).toBe('');
    });

    it('returns enum values unchanged (Prisma validates at query time)', () => {
      expect(coerceValueForField(enumField, 'superadmin')).toBe('superadmin');
      expect(coerceValueForField(enumField, 'not-a-real-role')).toBe('not-a-real-role');
    });
  });

  describe('Int', () => {
    it('coerces numeric strings to numbers', () => {
      expect(coerceValueForField(scalar('Int'), '42')).toBe(42);
      expect(coerceValueForField(scalar('Int'), '-7')).toBe(-7);
      expect(coerceValueForField(scalar('Int'), '0')).toBe(0);
    });

    it('passes through numbers unchanged', () => {
      expect(coerceValueForField(scalar('Int'), 99)).toBe(99);
    });

    it('throws on non-numeric inputs', () => {
      expect(() => coerceValueForField(scalar('Int'), 'abc')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalar('Int'), 'NaN')).toThrow(/Cannot coerce/);
    });
  });

  describe('Boolean', () => {
    it('passes through real booleans', () => {
      expect(coerceValueForField(scalar('Boolean'), true)).toBe(true);
      expect(coerceValueForField(scalar('Boolean'), false)).toBe(false);
    });

    it("coerces 'true' and 'false' strings", () => {
      expect(coerceValueForField(scalar('Boolean'), 'true')).toBe(true);
      expect(coerceValueForField(scalar('Boolean'), 'false')).toBe(false);
    });

    it("rejects '1', 'yes', or non-boolean strings", () => {
      expect(() => coerceValueForField(scalar('Boolean'), '1')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalar('Boolean'), 'yes')).toThrow(/Cannot coerce/);
      expect(() => coerceValueForField(scalar('Boolean'), 0)).toThrow(/Cannot coerce/);
    });
  });

  describe('DateTime', () => {
    it('passes through valid Date instances', () => {
      const d = new Date('2026-05-10T12:00:00Z');
      expect(coerceValueForField(scalar('DateTime'), d)).toBe(d);
    });

    it('throws on Invalid Date instances', () => {
      expect(() => coerceValueForField(scalar('DateTime'), new Date('not-a-date'))).toThrow(/Invalid Date/);
    });

    it('coerces ISO strings', () => {
      const result = coerceValueForField(scalar('DateTime'), '2026-05-10T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe('2026-05-10T12:00:00.000Z');
    });

    it('coerces numeric ms-timestamp (number form)', () => {
      const result = coerceValueForField(scalar('DateTime'), 1715353200000);
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(1715353200000);
    });

    it('coerces numeric ms-timestamp (string form)', () => {
      const result = coerceValueForField(scalar('DateTime'), '1715353200000');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getTime()).toBe(1715353200000);
    });

    it('throws on garbage strings', () => {
      expect(() => coerceValueForField(scalar('DateTime'), 'not-a-date')).toThrow(/Cannot coerce/);
    });
  });

  describe('Json', () => {
    it('always throws — JSON fields are not searchable via this surface', () => {
      expect(() => coerceValueForField(scalar('Json'), { foo: 'bar' })).toThrow(/JSON fields aren't searchable/);
      expect(() => coerceValueForField(scalar('Json'), 'anything')).toThrow(/JSON fields aren't searchable/);
    });
  });

  describe('arrays', () => {
    it('maps over arrays for in/notIn operands', () => {
      expect(coerceValueForField(scalar('Int'), ['1', '2', '3'])).toEqual([1, 2, 3]);
    });

    it('throws on first uncoercible element', () => {
      expect(() => coerceValueForField(scalar('Int'), ['1', 'bad'])).toThrow(/Cannot coerce/);
    });
  });

  describe('relations and unknown types', () => {
    it('passes through values for object-kind fields (relations are handled separately)', () => {
      const objField: FieldDef = { kind: 'object', type: 'User' };
      expect(coerceValueForField(objField, 'whatever')).toBe('whatever');
    });
  });
});
