import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookEventUpdateManyMutationInputObjectSchema as WebhookEventUpdateManyMutationInputObjectSchema } from './objects/WebhookEventUpdateManyMutationInput.schema';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './objects/WebhookEventWhereInput.schema';

export const WebhookEventUpdateManySchema: z.ZodType<Prisma.WebhookEventUpdateManyArgs> = z.object({ data: WebhookEventUpdateManyMutationInputObjectSchema, where: WebhookEventWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventUpdateManyArgs>;

export const WebhookEventUpdateManyZodSchema = z.object({ data: WebhookEventUpdateManyMutationInputObjectSchema, where: WebhookEventWhereInputObjectSchema.optional() }).strict();