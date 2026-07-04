import { describe, expect, it } from 'bun:test';
import { assertValidMatrix, MatrixValidationError, validateMatrix } from '@template/email/render/validateMatrix';

const path = (fromValue: string, toValue: string) => ({
  from: { predicate: { field: 'type', operator: 'equals', value: fromValue } },
  to: { predicate: { field: 'type', operator: 'equals', value: toValue } },
});

describe('validateMatrix', () => {
  it('treats an absent matrix as valid (open)', () => {
    expect(validateMatrix(null)).toEqual([]);
    expect(validateMatrix(undefined)).toEqual([]);
  });

  it('accepts a well-formed single-path Action', () => {
    expect(validateMatrix({ paths: [path('Organization', 'User')] })).toEqual([]);
  });

  it('accepts an OR-in-side predicate (A|B => C)', () => {
    const matrix = {
      paths: [
        {
          from: {
            predicate: {
              any: [
                { field: 'type', operator: 'equals', value: 'Organization' },
                { field: 'type', operator: 'equals', value: 'Space' },
              ],
            },
          },
          to: { predicate: { field: 'type', operator: 'equals', value: 'User' } },
        },
      ],
    };
    expect(validateMatrix(matrix)).toEqual([]);
  });

  it('accepts a serializable per-side permission delegation', () => {
    const matrix = {
      paths: [
        {
          from: { predicate: { field: 'type', operator: 'equals', value: 'Organization' }, permission: { rel: 'admin', action: 'send' } },
          to: { predicate: { field: 'type', operator: 'equals', value: 'User' } },
        },
      ],
    };
    expect(validateMatrix(matrix)).toEqual([]);
  });

  it('rejects a non-Action shape', () => {
    expect(validateMatrix({ foo: 1 }).length).toBeGreaterThan(0);
    expect(validateMatrix([]).length).toBeGreaterThan(0);
    expect(validateMatrix('nope').length).toBeGreaterThan(0);
  });

  it('rejects an empty paths array (a matrix that permits nothing is a mistake)', () => {
    const issues = validateMatrix({ paths: [] });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].path).toBe('$.paths');
  });

  it('rejects a path missing a side predicate, attributing the path index', () => {
    const issues = validateMatrix({ paths: [{ from: {}, to: { predicate: { field: 'type', operator: 'equals', value: 'User' } } }] });
    expect(issues.some((i) => i.path.startsWith('$.paths[0].from'))).toBe(true);
  });

  it('rejects a malformed permission ActionRule shape', () => {
    const matrix = {
      paths: [
        {
          from: { predicate: { field: 'type', operator: 'equals', value: 'Organization' }, permission: { bogus: true } },
          to: { predicate: { field: 'type', operator: 'equals', value: 'User' } },
        },
      ],
    };
    expect(validateMatrix(matrix).some((i) => i.path.includes('permission'))).toBe(true);
  });

  it('assertValidMatrix throws MatrixValidationError carrying issues', () => {
    try {
      assertValidMatrix({ paths: [] });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(MatrixValidationError);
      expect((err as MatrixValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it('assertValidMatrix is a no-op for a valid matrix', () => {
    expect(() => assertValidMatrix({ paths: [path('Organization', 'User')] })).not.toThrow();
  });
});
