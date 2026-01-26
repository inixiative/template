import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookSubscriptionSelectObjectSchema as WebhookSubscriptionSelectObjectSchema } from './objects/WebhookSubscriptionSelect.schema';
import { WebhookSubscriptionCreateManyInputObjectSchema as WebhookSubscriptionCreateManyInputObjectSchema } from './objects/WebhookSubscriptionCreateManyInput.schema';

export const WebhookSubscriptionCreateManyAndReturnSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyAndReturnArgs> = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), data: z.union([ WebhookSubscriptionCreateManyInputObjectSchema, z.array(WebhookSubscriptionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyAndReturnArgs>;

export const WebhookSubscriptionCreateManyAndReturnZodSchema = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), data: z.union([ WebhookSubscriptionCreateManyInputObjectSchema, z.array(WebhookSubscriptionCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();