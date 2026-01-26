import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventSelectObjectSchema as WebhookEventSelectObjectSchema } from './objects/WebhookEventSelect.schema';
import { WebhookEventIncludeObjectSchema as WebhookEventIncludeObjectSchema } from './objects/WebhookEventInclude.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';

export const WebhookEventFindUniqueOrThrowSchema: z.ZodType<Prisma.WebhookEventFindUniqueOrThrowArgs> = z.object({ select: WebhookEventSelectObjectSchema.optional(), include: WebhookEventIncludeObjectSchema.optional(), where: WebhookEventWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookEventFindUniqueOrThrowArgs>;

export const WebhookEventFindUniqueOrThrowZodSchema = z.object({ select: WebhookEventSelectObjectSchema.optional(), include: WebhookEventIncludeObjectSchema.optional(), where: WebhookEventWhereUniqueInputObjectSchema }).strict();