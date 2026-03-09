import {
  AuditLogScalarSchema,
  OrganizationScalarSchema,
  type Prisma,
  SpaceScalarSchema,
  TokenScalarSchema,
  UserScalarSchema,
} from '@template/db';

const auditActorTokenSchema = TokenScalarSchema.omit({ keyHash: true });

export const includeAuditLogResponse = {
  actorUser: true,
  actorSpoofUser: true,
  actorToken: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      name: true,
      ownerModel: true,
      userId: true,
      organizationId: true,
      spaceId: true,
      role: true,
      expiresAt: true,
      lastUsedAt: true,
      isActive: true,
    },
  },
  contextOrganization: true,
  contextSpace: true,
} as const satisfies Prisma.AuditLogInclude;

export const auditLogResponseSchema = AuditLogScalarSchema.extend({
  actorUser: UserScalarSchema.nullable(),
  actorSpoofUser: UserScalarSchema.nullable(),
  actorToken: auditActorTokenSchema.nullable(),
  contextOrganization: OrganizationScalarSchema.nullable(),
  contextSpace: SpaceScalarSchema.nullable(),
});
