import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionUpdateManyMutationInputObjectSchema as WebhookSubscriptionUpdateManyMutationInputObjectSchema } from './objects/WebhookSubscriptionUpdateManyMutationInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './objects/WebhookSubscriptionWhereInput.schema';

export const WebhookSubscriptionUpdateManySchema: z.ZodType<Prisma.WebhookSubscriptionUpdateManyArgs> = z.object({ data: WebhookSubscriptionUpdateManyMutationInputObjectSchema, where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateManyArgs>;

export const WebhookSubscriptionUpdateManyZodSchema = z.object({ data: WebhookSubscriptionUpdateManyMutationInputObjectSchema, where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict();