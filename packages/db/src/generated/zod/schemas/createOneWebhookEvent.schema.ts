import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventCreateInputObjectSchema as WebhookEventCreateInputObjectSchema } from './objects/WebhookEventCreateInput.schema';
import { WebhookEventUncheckedCreateInputObjectSchema as WebhookEventUncheckedCreateInputObjectSchema } from './objects/WebhookEventUncheckedCreateInput.schema';

export const WebhookEventCreateOneSchema: z.ZodType<Prisma.WebhookEventCreateArgs> = z.object({   data: z.union([WebhookEventCreateInputObjectSchema, WebhookEventUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.WebhookEventCreateArgs>;

export const WebhookEventCreateOneZodSchema = z.object({   data: z.union([WebhookEventCreateInputObjectSchema, WebhookEventUncheckedCreateInputObjectSchema]) }).strict();