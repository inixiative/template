import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionCreateManyInputObjectSchema as WebhookSubscriptionCreateManyInputObjectSchema } from './objects/WebhookSubscriptionCreateManyInput.schema';

export const WebhookSubscriptionCreateManyAndReturnSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyAndReturnArgs> = z.object({  data: z.union([ WebhookSubscriptionCreateManyInputObjectSchema, z.array(WebhookSubscriptionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyAndReturnArgs>;

export const WebhookSubscriptionCreateManyAndReturnZodSchema = z.object({  data: z.union([ WebhookSubscriptionCreateManyInputObjectSchema, z.array(WebhookSubscriptionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();