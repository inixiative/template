import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';

export const WebhookEventFindUniqueOrThrowSchema: z.ZodType<Prisma.WebhookEventFindUniqueOrThrowArgs> = z.object({   where: WebhookEventWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookEventFindUniqueOrThrowArgs>;

export const WebhookEventFindUniqueOrThrowZodSchema = z.object({   where: WebhookEventWhereUniqueInputObjectSchema }).strict();