import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionSelectObjectSchema as WebhookSubscriptionSelectObjectSchema } from './objects/WebhookSubscriptionSelect.schema';
import { WebhookSubscriptionIncludeObjectSchema as WebhookSubscriptionIncludeObjectSchema } from './objects/WebhookSubscriptionInclude.schema';
import { WebhookSubscriptionUpdateInputObjectSchema as WebhookSubscriptionUpdateInputObjectSchema } from './objects/WebhookSubscriptionUpdateInput.schema';
import { WebhookSubscriptionUncheckedUpdateInputObjectSchema as WebhookSubscriptionUncheckedUpdateInputObjectSchema } from './objects/WebhookSubscriptionUncheckedUpdateInput.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';

export const WebhookSubscriptionUpdateOneSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateArgs> = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), include: WebhookSubscriptionIncludeObjectSchema.optional(), data: z.union([WebhookSubscriptionUpdateInputObjectSchema, WebhookSubscriptionUncheckedUpdateInputObjectSchema]), where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateArgs>;

export const WebhookSubscriptionUpdateOneZodSchema = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), include: WebhookSubscriptionIncludeObjectSchema.optional(), data: z.union([WebhookSubscriptionUpdateInputObjectSchema, WebhookSubscriptionUncheckedUpdateInputObjectSchema]), where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict();