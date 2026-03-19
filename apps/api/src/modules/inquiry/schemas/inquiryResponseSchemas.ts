import { z } from '@hono/zod-openapi';
import { InquiryScalarSchema, OrganizationScalarSchema, SpaceScalarSchema, UserScalarSchema } from '@template/db';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';

export const inquiryResponseSchema = InquiryScalarSchema.extend({
  sourceUser: UserScalarSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  targetUser: UserScalarSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
}).openapi('InquiryItem');

export const inquirySentResponseSchema = InquiryScalarSchema.extend({
  targetUser: UserScalarSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
}).openapi('InquirySentItem');

export const inquiryReceivedResponseSchema = InquiryScalarSchema.extend({
  sourceUser: UserScalarSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
}).openapi('InquiryReceivedItem');
