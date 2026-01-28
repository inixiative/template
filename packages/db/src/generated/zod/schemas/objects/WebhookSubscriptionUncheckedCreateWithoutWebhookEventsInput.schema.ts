import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  isActive: z.boolean().optional(),
  ownerModel: WebhookOwnerModelSchema,
  userId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable()
}).strict();
export const WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInput>;
export const WebhookSubscriptionUncheckedCreateWithoutWebhookEventsInputObjectZodSchema = makeSchema();
