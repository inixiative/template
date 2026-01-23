import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';

export const WebhookSubscriptionDeleteOneSchema: z.ZodType<Prisma.WebhookSubscriptionDeleteArgs> = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionDeleteArgs>;

export const WebhookSubscriptionDeleteOneZodSchema = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema }).strict();