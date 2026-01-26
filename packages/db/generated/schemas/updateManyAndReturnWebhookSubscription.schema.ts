import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookSubscriptionSelectObjectSchema as WebhookSubscriptionSelectObjectSchema } from './objects/WebhookSubscriptionSelect.schema';
import { WebhookSubscriptionUpdateManyMutationInputObjectSchema as WebhookSubscriptionUpdateManyMutationInputObjectSchema } from './objects/WebhookSubscriptionUpdateManyMutationInput.schema';
import { WebhookSubscriptionWhereInputObjectSchema as WebhookSubscriptionWhereInputObjectSchema } from './objects/WebhookSubscriptionWhereInput.schema';

export const WebhookSubscriptionUpdateManyAndReturnSchema: z.ZodType<Prisma.WebhookSubscriptionUpdateManyAndReturnArgs> = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), data: WebhookSubscriptionUpdateManyMutationInputObjectSchema, where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpdateManyAndReturnArgs>;

export const WebhookSubscriptionUpdateManyAndReturnZodSchema = z.object({ select: WebhookSubscriptionSelectObjectSchema.optional(), data: WebhookSubscriptionUpdateManyMutationInputObjectSchema, where: WebhookSubscriptionWhereInputObjectSchema.optional() }).strict();