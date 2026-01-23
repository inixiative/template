import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './objects/WebhookSubscriptionWhereInput.schema';

export const WebhookSubscriptionDeleteManySchema: z.ZodType<Prisma.WebhookSubscriptionDeleteManyArgs> = z.object({ where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionDeleteManyArgs>;

export const WebhookSubscriptionDeleteManyZodSchema = z.object({ where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict();