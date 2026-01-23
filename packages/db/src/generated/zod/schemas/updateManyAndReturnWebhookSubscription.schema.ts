import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionUpdateManyMutationInputObjectSchema as WebhookSubscriptionUpdateManyMutationInputObjectSchema } from './objects/WebhookSubscriptionUpdateManyMutationInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './objects/WebhookSubscriptionWhereInput.schema';

export const WebhookSubscriptionUpdateManyAndReturnSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateManyAndReturnArgs> = z.object({  data: WebhookSubscriptionUpdateManyMutationInputObjectSchema, where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateManyAndReturnArgs>;

export const WebhookSubscriptionUpdateManyAndReturnZodSchema = z.object({  data: WebhookSubscriptionUpdateManyMutationInputObjectSchema, where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict();