import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookSubscriptionCreateManyInputObjectSchema as WebhookSubscriptionCreateManyInputObjectSchema } from './objects/WebhookSubscriptionCreateManyInput.schema';

export const WebhookSubscriptionCreateManySchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyArgs> = z.object({ data: z.union([ WebhookSubscriptionCreateManyInputObjectSchema, z.array(WebhookSubscriptionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyArgs>;

export const WebhookSubscriptionCreateManyZodSchema = z.object({ data: z.union([ WebhookSubscriptionCreateManyInputObjectSchema, z.array(WebhookSubscriptionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();