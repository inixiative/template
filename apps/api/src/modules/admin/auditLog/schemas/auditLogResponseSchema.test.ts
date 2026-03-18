import { describe, expect, it } from 'bun:test';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

const baseAuditLog = {
  id: 'log-1',
  createdAt: new Date(),
  actorUserId: null,
  actorSpoofUserId: null,
  actorTokenId: null,
  actorJobName: null,
  ipAddress: null,
  userAgent: null,
  action: 'create' as const,
  subjectModel: 'User' as const,
  before: null,
  after: null,
  changes: null,
  contextOrganizationId: null,
  contextSpaceId: null,
  sourceInquiryId: null,
  subjectOrganizationId: null,
  subjectSpaceId: null,
  subjectUserId: null,
  subjectAccountId: null,
  subjectSessionId: null,
  subjectVerificationId: null,
  subjectInquiryId: null,
  subjectTokenId: null,
  subjectAuthProviderId: null,
  subjectCronJobId: null,
  subjectEmailTemplateId: null,
  subjectEmailComponentId: null,
  subjectCustomerRefId: null,
  actorUser: null,
  actorSpoofUser: null,
  actorToken: null,
  contextOrganization: null,
  contextSpace: null,
};

describe('auditLogResponseSchema', () => {
  describe('actorToken', () => {
    it('strips keyHash from actorToken', () => {
      const payload = {
        ...baseAuditLog,
        actorToken: {
          id: 'tok-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          name: 'My Token',
          keyHash: 'super-secret-hash',
          keyPrefix: 'tok_',
          ownerModel: 'User' as const,
          userId: 'user-1',
          organizationId: null,
          spaceId: null,
          role: 'member' as const,
          entitlements: {},
          rateLimitPerSecond: null,
          expiresAt: null,
          lastUsedAt: null,
          isActive: true,
        },
      };

      const result = auditLogResponseSchema.parse(payload);
      expect(result.actorToken).not.toHaveProperty('keyHash');
    });

    it('preserves all other token fields', () => {
      const payload = {
        ...baseAuditLog,
        actorToken: {
          id: 'tok-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          name: 'My Token',
          keyHash: 'super-secret-hash',
          keyPrefix: 'tok_',
          ownerModel: 'User' as const,
          userId: 'user-1',
          organizationId: null,
          spaceId: null,
          role: 'member' as const,
          entitlements: {},
          rateLimitPerSecond: null,
          expiresAt: null,
          lastUsedAt: null,
          isActive: true,
        },
      };

      const result = auditLogResponseSchema.parse(payload);
      expect(result.actorToken).toMatchObject({
        id: 'tok-1',
        name: 'My Token',
        keyPrefix: 'tok_',
        userId: 'user-1',
        isActive: true,
      });
    });

    it('allows null actorToken', () => {
      const result = auditLogResponseSchema.parse(baseAuditLog);
      expect(result.actorToken).toBeNull();
    });
  });
});
