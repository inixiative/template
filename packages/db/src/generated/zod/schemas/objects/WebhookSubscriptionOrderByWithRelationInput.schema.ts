import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { UserOrderByWithRelationInputObjectSchema as UserOrderByWithRelationInputObjectSchema } from './UserOrderByWithRelationInput.schema';
import { OrganizationOrderByWithRelationInputObjectSchema as OrganizationOrderByWithRelationInputObjectSchema } from './OrganizationOrderByWithRelationInput.schema';
import { WebhookEventOrderByRelationAggregateInputObjectSchema as WebhookEventOrderByRelationAggregateInputObjectSchema } from './WebhookEventOrderByRelationAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  model: SortOrderSchema.optional(),
  url: SortOrderSchema.optional(),
  secret: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  isActive: SortOrderSchema.optional(),
  ownerModel: SortOrderSchema.optional(),
  userId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  organizationId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputObjectSchema).optional(),
  organization: z.lazy(() => OrganizationOrderByWithRelationInputObjectSchema).optional(),
  events: z.lazy(() => WebhookEventOrderByRelationAggregateInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionOrderByWithRelationInput>;
export const WebhookSubscriptionOrderByWithRelationInputObjectZodSchema = makeSchema();
