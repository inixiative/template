import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookSubscriptionSelectObjectSchema as WebhookSubscriptionSelectObjectSchema } from './objects/WebhookSubscriptionSelect.schema';
import { WebhookSubscriptionIncludeObjectSchema as WebhookSubscriptionIncludeObjectSchema } from './objects/WebhookSubscriptionInclude.schema';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';

export const WebhookSubscriptionDeleteOneSchema: z.ZodType<Prisma.WebhookSubscriptionDeleteArgs> = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), include: WebhookSubscriptionIncludeObjectSchema.optional(), where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionDeleteArgs>;

export const WebhookSubscriptionDeleteOneZodSchema = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), include: WebhookSubscriptionIncludeObjectSchema.optional(), where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict();