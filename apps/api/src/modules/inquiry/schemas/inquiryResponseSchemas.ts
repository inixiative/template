/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { InquiryScalarSchema, OrganizationScalarSchema, SpaceScalarSchema } from '@template/db';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

export const inquiryResponseSchema = InquiryScalarSchema.extend({
  sourceUser: userResponseSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  targetUser: userResponseSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
}).openapi('InquiryItem');

export const inquirySentResponseSchema = InquiryScalarSchema.extend({
  targetUser: userResponseSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
}).openapi('InquirySentItem');

export const inquiryReceivedResponseSchema = InquiryScalarSchema.extend({
  sourceUser: userResponseSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
}).openapi('InquiryReceivedItem');
