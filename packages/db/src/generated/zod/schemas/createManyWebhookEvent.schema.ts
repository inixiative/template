import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventCreateManyInputObjectSchema as WebhookEventCreateManyInputObjectSchema } from './objects/WebhookEventCreateManyInput.schema';

export const WebhookEventCreateManySchema: z.ZodType<Prisma.WebhookEventCreateManyArgs> = z.object({ data: z.union([ WebhookEventCreateManyInputObjectSchema, z.array(WebhookEventCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventCreateManyArgs>;

export const WebhookEventCreateManyZodSchema = z.object({ data: z.union([ WebhookEventCreateManyInputObjectSchema, z.array(WebhookEventCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();