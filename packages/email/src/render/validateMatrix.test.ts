import { describe, expect, it } from 'bun:test';
import { assertValidMatrix, MatrixValidationError, validateMatrix } from '@template/email/render/validateMatrix';

const lenses = {
  senders: { Organization: { parent: 'Organization' }, Space: { parent: 'Space' } },
  recipients: { OrgUsers: { parent: 'User' }, OrgAdmins: { parent: 'User' } },
};

describe('validateMatrix', () => {
  it('treats an absent matrix as valid (open)', () => {
    expect(validateMatrix(null, lenses)).toEqual([]);
    expect(validateMatrix(undefined, lenses)).toEqual([]);
  });

  it('accepts a matrix whose keys all reference declared lenses', () => {
    const matrix = { paths: [{ from: 'Organization', to: ['OrgAdmins', 'OrgUsers'] }, { from: 'Space', to: ['OrgUsers'] }] };
    expect(validateMatrix(matrix, lenses)).toEqual([]);
  });

  it('rejects a matrix when no lenses are declared to reference', () => {
    expect(validateMatrix({ paths: [{ from: 'Organization', to: ['OrgUsers'] }] }, null).length).toBeGreaterThan(0);
  });

  it('rejects a non-Action shape', () => {
    expect(validateMatrix({ foo: 1 }, lenses).length).toBeGreaterThan(0);
    expect(validateMatrix([], lenses).length).toBeGreaterThan(0);
  });

  it('rejects empty paths', () => {
    const issues = validateMatrix({ paths: [] }, lenses);
    expect(issues[0].path).toBe('$.paths');
  });

  it('rejects a `from` key that is not a declared sender lens', () => {
    const issues = validateMatrix({ paths: [{ from: 'Nope', to: ['OrgUsers'] }] }, lenses);
    expect(issues.some((i) => i.path.includes('paths[0].from') && /Nope/.test(i.message))).toBe(true);
  });

  it('rejects a `to` key that is not a declared recipient lens', () => {
    const issues = validateMatrix({ paths: [{ from: 'Organization', to: ['OrgUsers', 'Ghost'] }] }, lenses);
    expect(issues.some((i) => i.path.includes('paths[0].to') && /Ghost/.test(i.message))).toBe(true);
  });

  it('rejects an empty or non-array `to`', () => {
    expect(validateMatrix({ paths: [{ from: 'Organization', to: [] }] }, lenses).length).toBeGreaterThan(0);
    expect(validateMatrix({ paths: [{ from: 'Organization', to: 'OrgUsers' }] }, lenses).length).toBeGreaterThan(0);
  });

  it('assertValidMatrix throws MatrixValidationError carrying issues', () => {
    try {
      assertValidMatrix({ paths: [{ from: 'Nope', to: ['OrgUsers'] }] }, lenses);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(MatrixValidationError);
      expect((err as MatrixValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it('assertValidMatrix is a no-op for a valid matrix', () => {
    expect(() => assertValidMatrix({ paths: [{ from: 'Organization', to: ['OrgUsers'] }] }, lenses)).not.toThrow();
  });
});
