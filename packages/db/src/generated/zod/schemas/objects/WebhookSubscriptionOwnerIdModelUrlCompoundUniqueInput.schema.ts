import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema'

const makeSchema = () => z.object({
  ownerId: z.string(),
  model: WebhookModelSchema,
  url: z.string()
}).strict();
export const WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInput>;
export const WebhookSubscriptionOwnerIdModelUrlCompoundUniqueInputObjectZodSchema = makeSchema();
