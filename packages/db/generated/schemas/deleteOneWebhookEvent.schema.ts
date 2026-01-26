import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookEventSelectObjectSchema as WebhookEventSelectObjectSchema } from './objects/WebhookEventSelect.schema';
import { WebhookEventIncludeObjectSchema as WebhookEventIncludeObjectSchema } from './objects/WebhookEventInclude.schema';
import { WebhookEventWhereUniqueInputObjectSchema as WebhookEventWhereUniqueInputObjectSchema } from './objects/WebhookEventWhereUniqueInput.schema';

export const WebhookEventDeleteOneSchema: z.ZodType<Prisma.WebhookEventDeleteArgs> = z.object({ select: WebhookEventSelectObjectSchema.optional(), include: WebhookEventIncludeObjectSchema.optional(), where: WebhookEventWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WebhookEventDeleteArgs>;

export const WebhookEventDeleteOneZodSchema = z.object({ select: WebhookEventSelectObjectSchema.optional(), include: WebhookEventIncludeObjectSchema.optional(), where: WebhookEventWhereUniqueInputObjectSchema }).strict();