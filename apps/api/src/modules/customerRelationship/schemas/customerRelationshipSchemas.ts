/**
 * @atlas
 * @kind schema
 * @partOf feature:customer
 * @uses none
 */
import {
  CustomerRelationshipScalarSchema,
  OrganizationScalarSchema,
  SpaceScalarSchema,
} from '@template/db';
import { OpenApiTags } from '#/modules/openApiTags';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

// Customer side - who is the customer (User, Org, or Space)
const customerSchema = {
  customerUser: userResponseSchema.nullable(),
  customerOrganization: OrganizationScalarSchema.nullable(),
  customerSpace: SpaceScalarSchema.extend({
    organization: OrganizationScalarSchema,
  }).nullable(),
};

// Provider side - who is the provider (User, Org, or Space)
const providerSchema = {
  providerUser: userResponseSchema.nullable(),
  providerOrganization: OrganizationScalarSchema.nullable(),
  providerSpace: SpaceScalarSchema.extend({
    organization: OrganizationScalarSchema,
  }).nullable(),
};

// CustomerRelationship from customer's perspective (provider details expanded)
export const customerRelationshipAsCustomerSchema = CustomerRelationshipScalarSchema.extend({
  ...providerSchema,
});

// CustomerRelationship from provider's perspective (customer details expanded)
export const customerRelationshipAsProviderSchema = CustomerRelationshipScalarSchema.extend({
  ...customerSchema,
});

// Combined tags for CustomerRelationship routes (alphabetized)
export const customerRelationshipTags = [
  OpenApiTags.customer,
  OpenApiTags.customerRelationship,
  OpenApiTags.organization,
  OpenApiTags.provider,
  OpenApiTags.space,
  OpenApiTags.user,
] as const;
