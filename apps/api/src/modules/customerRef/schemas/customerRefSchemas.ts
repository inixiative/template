import { CustomerRefScalarSchema, OrganizationScalarSchema, SpaceScalarSchema, UserScalarSchema } from '@template/db';
import { Tags } from '#/modules/tags';

// Customer side - who is the customer (User, Org, or Space)
const customerSchema = {
  customerUser: UserScalarSchema.nullable(),
  customerOrganization: OrganizationScalarSchema.nullable(),
  customerSpace: SpaceScalarSchema.extend({
    organization: OrganizationScalarSchema,
  }).nullable(),
};

// Provider side - who is the provider (Space for now)
const providerSchema = {
  providerSpace: SpaceScalarSchema.extend({
    organization: OrganizationScalarSchema,
  }).nullable(),
};

// Complete CustomerRef with all relations
export const customerRefCompleteSchema = CustomerRefScalarSchema.extend({
  ...customerSchema,
  ...providerSchema,
});

// CustomerRef from customer's perspective (provider details expanded)
export const customerRefAsCustomerSchema = CustomerRefScalarSchema.extend({
  ...providerSchema,
});

// CustomerRef from provider's perspective (customer details expanded)
export const customerRefAsProviderSchema = CustomerRefScalarSchema.extend({
  ...customerSchema,
});

// Combined tags for CustomerRef routes (alphabetized)
export const customerRefTags = [
  Tags.customer,
  Tags.customerRef,
  Tags.organization,
  Tags.provider,
  Tags.space,
  Tags.user,
] as const;
