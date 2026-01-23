import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';

export const WebhookEventFindUniqueSchema: z.ZodType<Prisma.WebhookEventFindUniqueArgs> = z.object({   where: WebhookEventWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookEventFindUniqueArgs>;

export const WebhookEventFindUniqueZodSchema = z.object({   where: WebhookEventWhereUniqueInputObjectSchema }).strict();