import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventUpdateManyMutationInputObjectSchema as WebhookEventUpdateManyMutationInputObjectSchema } from './objects/WebhookEventUpdateManyMutationInput.schema';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './objects/WebhookEventWhereInput.schema';

export const WebhookEventUpdateManyAndReturnSchema: z.ZodType<Prisma.WebhookEventUpdateManyAndReturnArgs> = z.object({  data: WebhookEventUpdateManyMutationInputObjectSchema, where: WebhookEventWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventUpdateManyAndReturnArgs>;

export const WebhookEventUpdateManyAndReturnZodSchema = z.object({  data: WebhookEventUpdateManyMutationInputObjectSchema, where: WebhookEventWhereInputObjectSchema.optional() }).strict();