/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses feature:auditLogs
 */
import { z } from '@hono/zod-openapi';
import {
  InquiryScalarSchema,
  IntegrationScalarSchema,
  OrganizationScalarSchema,
  ProjectScalarSchema,
  SpaceScalarSchema,
  TokenScalarSchema,
} from '@template/db';
import { auditLogResponseSchema } from '#/modules/admin/auditLog/schemas/auditLogResponseSchema';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const tokenPartySchema = TokenScalarSchema.omit({ keyHash: true }).nullable();

const bothSides = {
  sourceUser: userResponseSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  sourceIntegration: IntegrationScalarSchema.nullable(),
  sourceToken: tokenPartySchema,
  sourceProject: ProjectScalarSchema.nullable(),
  targetUser: userResponseSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
  targetIntegration: IntegrationScalarSchema.nullable(),
  targetToken: tokenPartySchema,
  targetProject: ProjectScalarSchema.nullable(),
  auditLogsAsSubject: z.array(auditLogResponseSchema),
};

export const inquiryResponseSchema = InquiryScalarSchema.extend(bothSides).openapi('InquiryItem');

export const inquirySentResponseSchema =
  InquiryScalarSchema.extend(bothSides).openapi('InquirySentItem');

export const inquiryReceivedResponseSchema =
  InquiryScalarSchema.extend(bothSides).openapi('InquiryReceivedItem');
