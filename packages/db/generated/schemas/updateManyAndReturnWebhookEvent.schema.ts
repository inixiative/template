import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookEventSelectObjectSchema as WebhookEventSelectObjectSchema } from './objects/WebhookEventSelect.schema';
import { WebhookEventUpdateManyMutationInputObjectSchema as WebhookEventUpdateManyMutationInputObjectSchema } from './objects/WebhookEventUpdateManyMutationInput.schema';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './objects/WebhookEventWhereInput.schema';

export const WebhookEventUpdateManyAndReturnSchema: z.ZodType<Prisma.WebhookEventUpdateManyAndReturnArgs> = z.object({ select: WebhookEventSelectObjectSchema.optional(), data: WebhookEventUpdateManyMutationInputObjectSchema, where: WebhookEventWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventUpdateManyAndReturnArgs>;

export const WebhookEventUpdateManyAndReturnZodSchema = z.object({ select: WebhookEventSelectObjectSchema.optional(), data: WebhookEventUpdateManyMutationInputObjectSchema, where: WebhookEventWhereInputObjectSchema.optional() }).strict();