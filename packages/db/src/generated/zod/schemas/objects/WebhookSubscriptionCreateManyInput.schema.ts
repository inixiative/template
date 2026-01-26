import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  secret: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  userId: z.string().max(36).optional().nullable(),
  organizationId: z.string().max(36).optional().nullable()
}).strict();
export const WebhookSubscriptionCreateManyInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyInput>;
export const WebhookSubscriptionCreateManyInputObjectZodSchema = makeSchema();
