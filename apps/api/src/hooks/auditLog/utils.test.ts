import { describe, expect, it } from 'bun:test';
import { buildContextFkFields, buildSubjectFkFields, computeDiff, processAuditData } from '#/hooks/auditLog/utils';

describe('auditLog/utils', () => {
  describe('processAuditData', () => {
    it('removes updatedAt from all models', () => {
      const data = { id: '1', name: 'test', updatedAt: new Date() };
      const result = processAuditData('Organization', data);
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).toHaveProperty('id', '1');
    });

    it('removes User model-specific ignored fields', () => {
      const data = { id: '1', email: 'test@example.com', lastLoginAt: new Date(), updatedAt: new Date() };
      const result = processAuditData('User', data);
      expect(result).not.toHaveProperty('lastLoginAt');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('redacts sensitive Account fields', () => {
      const data = { id: '1', accountId: 'acc-1', password: 'secret', providerId: 'email' };
      const result = processAuditData('Account', data);
      expect(result.password).toBe('[REDACTED]');
      expect(result.providerId).toBe('email');
    });

    it('redacts sensitive Token fields', () => {
      const data = { id: '1', name: 'tok', value: 'tok_secret', hashedValue: 'hash' };
      const result = processAuditData('Token', data);
      expect(result.value).toBe('[REDACTED]');
      expect(result.hashedValue).toBe('[REDACTED]');
      expect(result.name).toBe('tok');
    });
  });

  describe('buildSubjectFkFields', () => {
    it('returns subjectUserId for User model', () => {
      const record = { id: 'user-123', email: 'test@example.com' };
      const result = buildSubjectFkFields('User', record);
      expect(result).toEqual({ subjectUserId: 'user-123' });
    });

    it('returns subjectOrganizationId for Organization model using record.id', () => {
      const record = { id: 'org-123', name: 'Acme' };
      const result = buildSubjectFkFields('Organization', record);
      expect(result).toEqual({ subjectOrganizationId: 'org-123' });
    });

    it('returns subjectSpaceId for Space model using record.id', () => {
      const record = { id: 'space-123', name: 'My Space', organizationId: 'org-456' };
      const result = buildSubjectFkFields('Space', record);
      expect(result).toEqual({ subjectSpaceId: 'space-123' });
    });

    it('returns composite FK fields for OrganizationUser', () => {
      const record = { id: 'ou-123', organizationId: 'org-456', userId: 'user-789' };
      const result = buildSubjectFkFields('OrganizationUser', record);
      expect(result).toEqual({ subjectOrganizationId: 'org-456', subjectUserId: 'user-789' });
    });

    it('returns composite FK fields for SpaceUser', () => {
      const record = { id: 'su-123', organizationId: 'org-456', spaceId: 'space-789', userId: 'user-321' };
      const result = buildSubjectFkFields('SpaceUser', record);
      expect(result).toEqual({
        subjectOrganizationId: 'org-456',
        subjectSpaceId: 'space-789',
        subjectUserId: 'user-321',
      });
    });

    it('returns subjectTokenId for Token model', () => {
      const record = { id: 'tok-123', name: 'API Key' };
      const result = buildSubjectFkFields('Token', record);
      expect(result).toEqual({ subjectTokenId: 'tok-123' });
    });

    it('returns subjectInquiryId for Inquiry model', () => {
      const record = { id: 'inq-123' };
      const result = buildSubjectFkFields('Inquiry', record);
      expect(result).toEqual({ subjectInquiryId: 'inq-123' });
    });

    it('returns subjectAuthProviderId for AuthProvider model', () => {
      const record = { id: 'ap-123' };
      const result = buildSubjectFkFields('AuthProvider', record);
      expect(result).toEqual({ subjectAuthProviderId: 'ap-123' });
    });

    it('returns empty object for unknown model', () => {
      const record = { id: 'x-123' };
      const result = buildSubjectFkFields('UnknownModel', record);
      expect(result).toEqual({});
    });
  });

  describe('buildContextFkFields', () => {
    it('uses record.id as contextOrganizationId for Organization', () => {
      const result = buildContextFkFields('Organization', { id: 'org-123' });
      expect(result).toEqual({ contextOrganizationId: 'org-123', contextSpaceId: null });
    });

    it('uses organizationId plus record.id for Space', () => {
      const result = buildContextFkFields('Space', { id: 'space-123', organizationId: 'org-123' });
      expect(result).toEqual({ contextOrganizationId: 'org-123', contextSpaceId: 'space-123' });
    });

    it('passes through organizationId and spaceId for composite members', () => {
      const result = buildContextFkFields('SpaceUser', {
        organizationId: 'org-123',
        spaceId: 'space-123',
        userId: 'user-123',
      });
      expect(result).toEqual({ contextOrganizationId: 'org-123', contextSpaceId: 'space-123' });
    });
  });

  describe('computeDiff', () => {
    it('returns empty object when before and after are the same', () => {
      const before = { id: '1', name: 'test', status: 'active' };
      const after = { id: '1', name: 'test', status: 'active' };
      const diff = computeDiff('Organization', before, after);
      expect(diff).toEqual({});
    });

    it('returns changed fields with before/after values', () => {
      const before = { id: '1', name: 'old-name', status: 'active' };
      const after = { id: '1', name: 'new-name', status: 'active' };
      const diff = computeDiff('Organization', before, after);
      expect(diff).toEqual({
        name: { before: 'old-name', after: 'new-name' },
      });
    });

    it('excludes ignored fields like updatedAt from diff', () => {
      const before = { id: '1', name: 'test', updatedAt: new Date('2020-01-01') };
      const after = { id: '1', name: 'test', updatedAt: new Date('2021-01-01') };
      const diff = computeDiff('Organization', before, after);
      expect(diff).not.toHaveProperty('updatedAt');
      expect(diff).toEqual({});
    });

    it('handles multiple changed fields', () => {
      const before = { id: '1', name: 'old', slug: 'old-slug' };
      const after = { id: '1', name: 'new', slug: 'new-slug' };
      const diff = computeDiff('Organization', before, after);
      expect(Object.keys(diff)).toHaveLength(2);
      expect(diff.name).toEqual({ before: 'old', after: 'new' });
      expect(diff.slug).toEqual({ before: 'old-slug', after: 'new-slug' });
    });

    it('handles added fields (present in after, absent in before)', () => {
      const before = { id: '1', name: 'test' };
      const after = { id: '1', name: 'test', description: 'new desc' };
      const diff = computeDiff('Organization', before, after);
      expect(diff.description).toEqual({ before: undefined, after: 'new desc' });
    });

    it('handles removed fields (present in before, absent in after)', () => {
      const before = { id: '1', name: 'test', description: 'old desc' };
      const after = { id: '1', name: 'test' };
      const diff = computeDiff('Organization', before, after);
      expect(diff.description).toEqual({ before: 'old desc', after: undefined });
    });

    it('redacts sensitive fields in diff values', () => {
      const before = { id: '1', password: 'old-pass', providerId: 'email' };
      const after = { id: '1', password: 'new-pass', providerId: 'email' };
      const diff = computeDiff('Account', before, after);
      // password changes but after redaction both become [REDACTED], so no diff
      expect(diff).not.toHaveProperty('password');
    });
  });
});
