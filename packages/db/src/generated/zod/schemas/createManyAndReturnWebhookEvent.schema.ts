import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventSelectObjectSchema as WebhookEventSelectObjectSchema } from './objects/WebhookEventSelect.schema';
import { WebhookEventCreateManyInputObjectSchema as WebhookEventCreateManyInputObjectSchema } from './objects/WebhookEventCreateManyInput.schema';

export const WebhookEventCreateManyAndReturnSchema: z.ZodType<Prisma.WebhookEventCreateManyAndReturnArgs> = z.object({ select: WebhookEventSelectObjectSchema.optional(), data: z.union([ WebhookEventCreateManyInputObjectSchema, z.array(WebhookEventCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventCreateManyAndReturnArgs>;

export const WebhookEventCreateManyAndReturnZodSchema = z.object({ select: WebhookEventSelectObjectSchema.optional(), data: z.union([ WebhookEventCreateManyInputObjectSchema, z.array(WebhookEventCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();