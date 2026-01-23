import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string().max(512),
  secret: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
  ownerType: WebhookOwnerTypeSchema,
  ownerId: z.string().max(36)
}).strict();
export const WebhookSubscriptionCreateManyInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyInput>;
export const WebhookSubscriptionCreateManyInputObjectZodSchema = makeSchema();
