import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';

export const WebhookEventDeleteOneSchema: z.ZodType<Prisma.WebhookEventDeleteArgs> = z.object({   where: WebhookEventWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookEventDeleteArgs>;

export const WebhookEventDeleteOneZodSchema = z.object({   where: WebhookEventWhereUniqueInputObjectSchema }).strict();