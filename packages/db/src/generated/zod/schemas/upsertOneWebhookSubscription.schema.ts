import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookSubscriptionWhereUniqueInputObjectSchema as WebhookSubscriptionWhereUniqueInputObjectSchema } from './objects/WebhookSubscriptionWhereUniqueInput.schema';
import { WebhookSubscriptionCreateInputObjectSchema as WebhookSubscriptionCreateInputObjectSchema } from './objects/WebhookSubscriptionCreateInput.schema';
import { WebhookSubscriptionUncheckedCreateInputObjectSchema as WebhookSubscriptionUncheckedCreateInputObjectSchema } from './objects/WebhookSubscriptionUncheckedCreateInput.schema';
import { WebhookSubscriptionUpdateInputObjectSchema as WebhookSubscriptionUpdateInputObjectSchema } from './objects/WebhookSubscriptionUpdateInput.schema';
import { WebhookSubscriptionUncheckedUpdateInputObjectSchema as WebhookSubscriptionUncheckedUpdateInputObjectSchema } from './objects/WebhookSubscriptionUncheckedUpdateInput.schema';

export const WebhookSubscriptionUpsertOneSchema: z.ZodType<Prisma.WebhookSubscriptionUpsertArgs> = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema, create: z.union([ WebhookSubscriptionCreateInputObjectSchema, WebhookSubscriptionUncheckedCreateInputObjectSchema ]), update: z.union([ WebhookSubscriptionUpdateInputObjectSchema, WebhookSubscriptionUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.WebhookSubscriptionUpsertArgs>;

export const WebhookSubscriptionUpsertOneZodSchema = z.object({   where: WebhookSubscriptionWhereUniqueInputObjectSchema, create: z.union([ WebhookSubscriptionCreateInputObjectSchema, WebhookSubscriptionUncheckedCreateInputObjectSchema ]), update: z.union([ WebhookSubscriptionUpdateInputObjectSchema, WebhookSubscriptionUncheckedUpdateInputObjectSchema ]) }).strict();