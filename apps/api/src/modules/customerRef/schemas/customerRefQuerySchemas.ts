import { z } from '@hono/zod-openapi';
import { CustomerModelSchema, ProviderModelSchema } from '@template/db';

// Filter by provider model and ID
export const providerFilterSchema = z.object({
  providerModel: ProviderModelSchema.optional(),
  providerSpaceId: z.string().uuid().optional(),
  providerOrganizationId: z.string().uuid().optional(),
});

// Filter by customer model and ID
export const customerFilterSchema = z.object({
  customerModel: CustomerModelSchema.optional(),
  customerUserId: z.string().uuid().optional(),
  customerOrganizationId: z.string().uuid().optional(),
  customerSpaceId: z.string().uuid().optional(),
});

// Combined filters for admin/org views
export const customerRefFilterSchema = providerFilterSchema.merge(customerFilterSchema);
