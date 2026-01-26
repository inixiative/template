import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema'

const makeSchema = () => z.object({
  userId: z.string(),
  model: WebhookModelSchema,
  url: z.string()
}).strict();
export const WebhookSubscriptionUserIdModelUrlCompoundUniqueInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionUserIdModelUrlCompoundUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionUserIdModelUrlCompoundUniqueInput>;
export const WebhookSubscriptionUserIdModelUrlCompoundUniqueInputObjectZodSchema = makeSchema();
