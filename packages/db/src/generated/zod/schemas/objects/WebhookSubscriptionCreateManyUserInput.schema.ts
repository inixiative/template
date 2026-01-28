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
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  organizationId: z.string().max(36).optional().nullable()
}).strict();
export const WebhookSubscriptionCreateManyUserInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyUserInput>;
export const WebhookSubscriptionCreateManyUserInputObjectZodSchema = makeSchema();
