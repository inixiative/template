import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { WebhookEventSelectObjectSchema as WebhookEventSelectObjectSchema } from './objects/WebhookEventSelect.schema';
import { WebhookEventIncludeObjectSchema as WebhookEventIncludeObjectSchema } from './objects/WebhookEventInclude.schema';
import { WebhookEventCreateInputObjectSchema as WebhookEventCreateInputObjectSchema } from './objects/WebhookEventCreateInput.schema';
import { WebhookEventUncheckedCreateInputObjectSchema as WebhookEventUncheckedCreateInputObjectSchema } from './objects/WebhookEventUncheckedCreateInput.schema';

export const WebhookEventCreateOneSchema: z.ZodType<Prisma.WebhookEventCreateArgs> = z.object({ select: WebhookEventSelectObjectSchema.optional(), include: WebhookEventIncludeObjectSchema.optional(), data: z.union([WebhookEventCreateInputObjectSchema, WebhookEventUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.WebhookEventCreateArgs>;

export const WebhookEventCreateOneZodSchema = z.object({ select: WebhookEventSelectObjectSchema.optional(), include: WebhookEventIncludeObjectSchema.optional(), data: z.union([WebhookEventCreateInputObjectSchema, WebhookEventUncheckedCreateInputObjectSchema]) }).strict();