/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses feature:auditLogs
 */
import { z } from '@hono/zod-openapi';
import { InquiryScalarSchema, OrganizationScalarSchema, SpaceScalarSchema } from '@template/db';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

export const inquiryResponseSchema = InquiryScalarSchema.extend({
  sourceUser: userResponseSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  targetUser: userResponseSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
}).openapi('InquiryItem');

export const inquirySentResponseSchema = InquiryScalarSchema.extend({
  targetUser: userResponseSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
}).openapi('InquirySentItem');

export const inquiryReceivedResponseSchema = InquiryScalarSchema.extend({
  sourceUser: userResponseSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
}).openapi('InquiryReceivedItem');
