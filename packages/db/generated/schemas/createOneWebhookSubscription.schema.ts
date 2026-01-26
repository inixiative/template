import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookSubscriptionSelectObjectSchema as WebhookSubscriptionSelectObjectSchema } from './objects/WebhookSubscriptionSelect.schema';
import { WebhookSubscriptionIncludeObjectSchema as WebhookSubscriptionIncludeObjectSchema } from './objects/WebhookSubscriptionInclude.schema';
import { WebhookSubscriptionCreateInputObjectSchema as WebhookSubscriptionCreateInputObjectSchema } from './objects/WebhookSubscriptionCreateInput.schema';
import { WebhookSubscriptionUncheckedCreateInputObjectSchema as WebhookSubscriptionUncheckedCreateInputObjectSchema } from './objects/WebhookSubscriptionUncheckedCreateInput.schema';

export const WebhookSubscriptionCreateOneSchema: z.ZodType<Prisma.WebhookSubscriptionCreateArgs> = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), include: WebhookSubscriptionIncludeObjectSchema.optional(), data: z.union([WebhookSubscriptionCreateInputObjectSchema, WebhookSubscriptionUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateArgs>;

export const WebhookSubscriptionCreateOneZodSchema = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), include: WebhookSubscriptionIncludeObjectSchema.optional(), data: z.union([WebhookSubscriptionCreateInputObjectSchema, WebhookSubscriptionUncheckedCreateInputObjectSchema]) }).strict();