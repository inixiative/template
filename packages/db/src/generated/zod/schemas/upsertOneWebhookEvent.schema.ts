import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';
import { WebhookEventCreateInputObjectSchema as WebhookEventCreateInputObjectSchema } from './objects/WebhookEventCreateInput.schema';
import { WebhookEventUncheckedCreateInputObjectSchema as WebhookEventUncheckedCreateInputObjectSchema } from './objects/WebhookEventUncheckedCreateInput.schema';
import { WebhookEventUpdateInputObjectSchema as WebhookEventUpdateInputObjectSchema } from './objects/WebhookEventUpdateInput.schema';
import { WebhookEventUncheckedUpdateInputObjectSchema as WebhookEventUncheckedUpdateInputObjectSchema } from './objects/WebhookEventUncheckedUpdateInput.schema';

export const WebhookEventUpsertOneSchema: z.ZodType<Prisma.WebhookEventUpsertArgs> = z.object({   where: WebhookEventWhereUniqueInputObjectSchema, create: z.union([ WebhookEventCreateInputObjectSchema, WebhookEventUncheckedCreateInputObjectSchema ]), update: z.union([ WebhookEventUpdateInputObjectSchema, WebhookEventUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.WebhookEventUpsertArgs>;

export const WebhookEventUpsertOneZodSchema = z.object({   where: WebhookEventWhereUniqueInputObjectSchema, create: z.union([ WebhookEventCreateInputObjectSchema, WebhookEventUncheckedCreateInputObjectSchema ]), update: z.union([ WebhookEventUpdateInputObjectSchema, WebhookEventUncheckedUpdateInputObjectSchema ]) }).strict();