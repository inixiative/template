import { InquiryScalarSchema, OrganizationScalarSchema, SpaceScalarSchema, UserScalarSchema } from '@template/db';

export const inquiryResponseSchema = InquiryScalarSchema.extend({
  sourceUser: UserScalarSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
  targetUser: UserScalarSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
});

export const inquirySentResponseSchema = InquiryScalarSchema.extend({
  targetUser: UserScalarSchema.nullable(),
  targetOrganization: OrganizationScalarSchema.nullable(),
  targetSpace: SpaceScalarSchema.nullable(),
});

export const inquiryReceivedResponseSchema = InquiryScalarSchema.extend({
  sourceUser: UserScalarSchema.nullable(),
  sourceOrganization: OrganizationScalarSchema.nullable(),
  sourceSpace: SpaceScalarSchema.nullable(),
});
