import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  model: z.literal(true).optional(),
  url: z.literal(true).optional(),
  secret: z.literal(true).optional(),
  isActive: z.literal(true).optional(),
  ownerModel: z.literal(true).optional(),
  userId: z.literal(true).optional(),
  organizationId: z.literal(true).optional()
}).strict();
export const WebhookSubscriptionMinAggregateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionMinAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionMinAggregateInputType>;
export const WebhookSubscriptionMinAggregateInputObjectZodSchema = makeSchema();
