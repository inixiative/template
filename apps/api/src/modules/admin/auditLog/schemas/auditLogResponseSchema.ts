/**
 * @atlas
 * @kind schema
 * @partOf feature:auditLogs, superadmin
 * @uses none
 */
import {
  AuditLogScalarSchema,
  OrganizationScalarSchema,
  type Prisma,
  SpaceScalarSchema,
  TokenScalarSchema,
} from '@template/db';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const auditActorTokenSchema = TokenScalarSchema.omit({ keyHash: true }).strip();

export const includeAuditLogResponse = {
  actorUser: true,
  actorSpoofUser: true,
  actorToken: true,
  contextOrganization: true,
  contextSpace: true,
} as const satisfies Prisma.AuditLogInclude;

export const auditLogResponseSchema = AuditLogScalarSchema.extend({
  actorUser: userResponseSchema.nullable(),
  actorSpoofUser: userResponseSchema.nullable(),
  actorToken: auditActorTokenSchema.nullable(),
  contextOrganization: OrganizationScalarSchema.nullable(),
  contextSpace: SpaceScalarSchema.nullable(),
});
