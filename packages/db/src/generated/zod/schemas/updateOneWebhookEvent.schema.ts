import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventUpdateInputObjectSchema as WebhookEventUpdateInputObjectSchema } from './objects/WebhookEventUpdateInput.schema';
import { WebhookEventUncheckedUpdateInputObjectSchema as WebhookEventUncheckedUpdateInputObjectSchema } from './objects/WebhookEventUncheckedUpdateInput.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';

export const WebhookEventUpdateOneSchema: z.ZodType<Prisma.WebhookEventUpdateArgs> = z.object({   data: z.union([WebhookEventUpdateInputObjectSchema, WebhookEventUncheckedUpdateInputObjectSchema]), where: WebhookEventWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookEventUpdateArgs>;

export const WebhookEventUpdateOneZodSchema = z.object({   data: z.union([WebhookEventUpdateInputObjectSchema, WebhookEventUncheckedUpdateInputObjectSchema]), where: WebhookEventWhereUniqueInputObjectSchema }).strict();