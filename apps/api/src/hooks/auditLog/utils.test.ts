import { describe, expect, it } from 'bun:test';
import { maskSensitiveFieldsInChangeDiff } from '@template/db';
import {
  buildContextFkFields,
  buildSubjectColumns,
  computeDiff,
  maskSensitiveAndOmitNoopFieldsForAudit,
} from '#/hooks/auditLog/utils';

describe('auditLog/utils', () => {
  describe('maskSensitiveAndOmitNoopFieldsForAudit', () => {
    it('removes updatedAt from all models', () => {
      const data = { id: '1', name: 'test', updatedAt: new Date() };
      const result = maskSensitiveAndOmitNoopFieldsForAudit('Organization', data);
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).toHaveProperty('id', '1');
    });

    it('removes User model-specific ignored fields', () => {
      const data = {
        id: '1',
        email: 'test@example.com',
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      };
      const result = maskSensitiveAndOmitNoopFieldsForAudit('User', data);
      expect(result).not.toHaveProperty('lastLoginAt');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('masks sensitive Account fields', () => {
      const data = { id: '1', accountId: 'acc-1', password: 'secret', providerId: 'email' };
      const result = maskSensitiveAndOmitNoopFieldsForAudit('Account', data);
      expect(result.password).toBe('[MASKED]');
      expect(result.providerId).toBe('email');
    });

    it('masks keyHash on Token', () => {
      const data = { id: '1', name: 'tok', keyHash: 'sha256-hash' };
      const result = maskSensitiveAndOmitNoopFieldsForAudit('Token', data);
      expect(result.keyHash).toBe('[MASKED]');
      expect(result.name).toBe('tok');
    });

    it('strips orderedList position field for Contact so ordering-only updates produce no diff', () => {
      const before = maskSensitiveAndOmitNoopFieldsForAudit('Contact', {
        id: '1',
        value: { e164: '+15551234567' },
        position: 3,
      });
      const after = maskSensitiveAndOmitNoopFieldsForAudit('Contact', {
        id: '1',
        value: { e164: '+15551234567' },
        position: 1,
      });
      expect(before).not.toHaveProperty('position');
      expect(after).not.toHaveProperty('position');
      expect(computeDiff(before, after)).toEqual({});
    });
  });

  // The audit diff is computed on unmasked data, so a changed sensitive field IS in the diff;
  // maskSensitiveFieldsInChangeDiff then masks both sides so the row records THAT it changed without the value.
  // This is what keeps a sensitive-only change from vanishing under the empty-diff guard.
  describe('maskSensitiveFieldsInChangeDiff', () => {
    it('masks both sides of a changed sensitive field, leaving other changes intact', () => {
      const changes = {
        password: { before: 'old', after: 'new' },
        providerId: { before: 'email', after: 'oauth' },
      };
      const masked = maskSensitiveFieldsInChangeDiff('Account', changes);
      expect(masked.password).toEqual({ before: '[MASKED]', after: '[MASKED]' });
      expect(masked.providerId).toEqual({ before: 'email', after: 'oauth' });
    });

    it('returns the diff untouched for a model with no sensitive fields', () => {
      const changes = { name: { before: 'A', after: 'B' } };
      expect(maskSensitiveFieldsInChangeDiff('Organization', changes)).toBe(changes);
    });
  });

  describe('buildSubjectColumns', () => {
    it('returns subjectUserId for User model', () => {
      const record = { id: 'user-123', email: 'test@example.com' };
      const result = buildSubjectColumns('User', record);
      expect(result).toEqual({ subjectId: 'user-123', subjectUserId: 'user-123' });
    });

    it('returns subjectOrganizationId for Organization model using record.id', () => {
      const record = { id: 'org-123', name: 'Acme' };
      const result = buildSubjectColumns('Organization', record);
      expect(result).toEqual({ subjectId: 'org-123', subjectOrganizationId: 'org-123' });
    });

    it('returns subjectSpaceId for Space model using record.id', () => {
      const record = { id: 'space-123', name: 'My Space', organizationId: 'org-456' };
      const result = buildSubjectColumns('Space', record);
      expect(result).toEqual({ subjectId: 'space-123', subjectSpaceId: 'space-123' });
    });

    it('returns composite FK fields for OrganizationUser', () => {
      const record = { id: 'ou-123', organizationId: 'org-456', userId: 'user-789' };
      const result = buildSubjectColumns('OrganizationUser', record);
      expect(result).toEqual({
        subjectId: 'ou-123',
        subjectOrganizationId: 'org-456',
        subjectUserId: 'user-789',
      });
    });

    it('returns composite FK fields for SpaceUser', () => {
      const record = {
        id: 'su-123',
        organizationId: 'org-456',
        spaceId: 'space-789',
        userId: 'user-321',
      };
      const result = buildSubjectColumns('SpaceUser', record);
      expect(result).toEqual({
        subjectId: 'su-123',
        subjectOrganizationId: 'org-456',
        subjectSpaceId: 'space-789',
        subjectUserId: 'user-321',
      });
    });

    it('returns subjectTokenId for Token model', () => {
      const record = { id: 'tok-123', name: 'API Key' };
      const result = buildSubjectColumns('Token', record);
      expect(result).toEqual({ subjectId: 'tok-123', subjectTokenId: 'tok-123' });
    });

    it('returns subjectInquiryId for Inquiry model', () => {
      const record = { id: 'inq-123' };
      const result = buildSubjectColumns('Inquiry', record);
      expect(result).toEqual({ subjectId: 'inq-123', subjectInquiryId: 'inq-123' });
    });

    it('returns subjectAuthProviderId for AuthProvider model', () => {
      const record = { id: 'ap-123' };
      const result = buildSubjectColumns('AuthProvider', record);
      expect(result).toEqual({ subjectId: 'ap-123', subjectAuthProviderId: 'ap-123' });
    });

    it('returns empty object for unknown model', () => {
      const record = { id: 'x-123' };
      const result = buildSubjectColumns('UnknownModel', record);
      expect(result).toEqual({ subjectId: 'x-123' });
    });

    it('a gone subject keeps its dual id and drops its typed keys', () => {
      expect(buildSubjectColumns('Session', { id: 'sess-1' }, { withKeys: false })).toEqual({
        subjectId: 'sess-1',
      });
    });
  });

  describe('buildContextFkFields', () => {
    it('uses record.id as contextOrganizationId for Organization', () => {
      const result = buildContextFkFields('Organization', { id: 'org-123' });
      expect(result).toEqual({
        contextOrganizationId: 'org-123',
        contextSpaceId: null,
        contextUserId: null,
      });
    });

    it('uses organizationId plus record.id for Space', () => {
      const result = buildContextFkFields('Space', { id: 'space-123', organizationId: 'org-123' });
      expect(result).toEqual({
        contextOrganizationId: 'org-123',
        contextSpaceId: 'space-123',
        contextUserId: null,
      });
    });

    it('passes through organizationId and spaceId for composite members', () => {
      const result = buildContextFkFields('SpaceUser', {
        organizationId: 'org-123',
        spaceId: 'space-123',
        userId: 'user-123',
      });
      expect(result).toEqual({
        contextOrganizationId: 'org-123',
        contextSpaceId: 'space-123',
        contextUserId: 'user-123',
      });
    });
  });

  describe('computeDiff', () => {
    it('returns empty object when before and after are the same', () => {
      const before = { id: '1', name: 'test', status: 'active' };
      const after = { id: '1', name: 'test', status: 'active' };
      const diff = computeDiff(before, after);
      expect(diff).toEqual({});
    });

    it('returns changed fields with before/after values', () => {
      const before = { id: '1', name: 'old-name', status: 'active' };
      const after = { id: '1', name: 'new-name', status: 'active' };
      const diff = computeDiff(before, after);
      expect(diff).toEqual({
        name: { before: 'old-name', after: 'new-name' },
      });
    });

    it('does not include unchanged fields', () => {
      const before = { id: '1', name: 'test', updatedAt: new Date('2020-01-01') };
      const after = { id: '1', name: 'test', updatedAt: new Date('2021-01-01') };
      // computeDiff is a pure diff — caller should pass pre-processed (filtered) data
      const diff = computeDiff(before, after);
      expect(diff).toHaveProperty('updatedAt');
      // the caller (buildAuditEntry) passes maskSensitiveAndOmitNoopFieldsForAudit output which strips updatedAt first
    });

    it('handles multiple changed fields', () => {
      const before = { id: '1', name: 'old', slug: 'old-slug' };
      const after = { id: '1', name: 'new', slug: 'new-slug' };
      const diff = computeDiff(before, after);
      expect(Object.keys(diff)).toHaveLength(2);
      expect(diff.name).toEqual({ before: 'old', after: 'new' });
      expect(diff.slug).toEqual({ before: 'old-slug', after: 'new-slug' });
    });

    it('handles added fields (present in after, absent in before)', () => {
      const before = { id: '1', name: 'test' };
      const after = { id: '1', name: 'test', description: 'new desc' };
      const diff = computeDiff(before, after);
      expect(diff.description).toEqual({ before: undefined, after: 'new desc' });
    });

    it('handles removed fields (present in before, absent in after)', () => {
      const before = { id: '1', name: 'test', description: 'old desc' };
      const after = { id: '1', name: 'test' };
      const diff = computeDiff(before, after);
      expect(diff.description).toEqual({ before: 'old desc', after: undefined });
    });

    it('uses deep equality for object fields', () => {
      const before = { id: '1', meta: { a: 1, b: 2 } };
      const after = { id: '1', meta: { a: 1, b: 2 } };
      const diff = computeDiff(before, after);
      expect(diff).toEqual({});
    });
  });
});
