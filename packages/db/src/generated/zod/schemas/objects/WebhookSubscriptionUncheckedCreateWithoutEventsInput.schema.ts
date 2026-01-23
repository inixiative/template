import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  model: WebhookModelSchema,
  url: z.string(),
  secret: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  ownerType: WebhookOwnerTypeSchema,
  ownerId: z.string()
}).strict();
export const WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutEventsInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUncheckedCreateWithoutEventsInput>;
export const WebhookSubscriptionUncheckedCreateWithoutEventsInputObjectZodSchema = makeSchema();
