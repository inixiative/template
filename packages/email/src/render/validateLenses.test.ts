import { describe, expect, it } from 'bun:test';
import { assertValidLenses, LensesValidationError, validateLenses } from '@template/email/render/validateLenses';

const recipient = (extra: Record<string, unknown> = {}) => ({
  parent: 'User',
  picks: ['id', 'name', 'email'],
  ...extra,
});

const okLenses = () => ({
  senders: { Organization: { parent: 'Organization', bindings: { organizationId: 'data.organizationId' } } },
  recipients: {
    OrgUsers: recipient({ where: { field: 'organizationUser.organizationId', operator: 'equals', value: 'o1' } }),
  },
});

describe('validateLenses', () => {
  it('treats absent lenses as valid', () => {
    expect(validateLenses(null)).toEqual([]);
    expect(validateLenses(undefined)).toEqual([]);
  });

  it('accepts a well-formed lenses block', () => {
    expect(validateLenses(okLenses())).toEqual([]);
  });

  it('rejects a non-object lenses block', () => {
    expect(validateLenses('nope').length).toBeGreaterThan(0);
    expect(validateLenses([]).length).toBeGreaterThan(0);
  });

  it('requires senders and recipients to be objects', () => {
    expect(validateLenses({ senders: [], recipients: {} }).some((i) => i.path.includes('senders'))).toBe(true);
    expect(validateLenses({ senders: {}, recipients: 5 }).some((i) => i.path.includes('recipients'))).toBe(true);
  });

  it('requires every lens to declare a parent model', () => {
    const issues = validateLenses({ senders: { X: { picks: ['id'] } }, recipients: { OrgUsers: recipient() } });
    expect(issues.some((i) => i.path.includes('senders.X') && /parent/.test(i.message))).toBe(true);
  });

  it('requires recipient lenses to be parent: User', () => {
    const issues = validateLenses({
      senders: { Organization: { parent: 'Organization' } },
      recipients: { Bad: { parent: 'Organization', picks: ['id', 'name', 'email'] } },
    });
    expect(issues.some((i) => i.path.includes('recipients.Bad') && /User/.test(i.message))).toBe(true);
  });

  it('requires recipient lenses to pick the id/name/email leaf', () => {
    const issues = validateLenses({
      senders: { Organization: { parent: 'Organization' } },
      recipients: { OrgUsers: { parent: 'User', picks: ['id'] } },
    });
    expect(issues.some((i) => i.path.includes('recipients.OrgUsers') && /email/.test(i.message))).toBe(true);
  });

  it('rejects a malformed lens where (invalid json-rules)', () => {
    const issues = validateLenses({
      senders: { Organization: { parent: 'Organization', where: 'not-a-condition' } },
      recipients: { OrgUsers: recipient() },
    });
    expect(issues.some((i) => i.path.includes('senders.Organization') && /where/i.test(i.message))).toBe(true);
  });

  it('assertValidLenses throws LensesValidationError with issues', () => {
    try {
      assertValidLenses({ senders: {}, recipients: { Bad: { parent: 'Organization', picks: [] } } });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(LensesValidationError);
      expect((err as LensesValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});
