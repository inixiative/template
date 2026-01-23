import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionCreateInputObjectSchema as WebhookSubscriptionCreateInputObjectSchema } from './objects/WebhookSubscriptionCreateInput.schema';
import { WebhookSubscriptionUncheckedCreateInputObjectSchema as WebhookSubscriptionUncheckedCreateInputObjectSchema } from './objects/WebhookSubscriptionUncheckedCreateInput.schema';

export const WebhookSubscriptionCreateOneSchema: z.ZodType<Prisma.WebhookSubscriptionCreateArgs> = z.object({   data: z.union([WebhookSubscriptionCreateInputObjectSchema, WebhookSubscriptionUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateArgs>;

export const WebhookSubscriptionCreateOneZodSchema = z.object({   data: z.union([WebhookSubscriptionCreateInputObjectSchema, WebhookSubscriptionUncheckedCreateInputObjectSchema]) }).strict();