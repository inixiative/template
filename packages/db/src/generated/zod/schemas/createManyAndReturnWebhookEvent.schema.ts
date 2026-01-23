import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WebhookEventCreateManyInputObjectSchema as WebhookEventCreateManyInputObjectSchema } from './objects/WebhookEventCreateManyInput.schema';

export const WebhookEventCreateManyAndReturnSchema: z.ZodType<Prisma.WebhookEventCreateManyAndReturnArgs> = z.object({  data: z.union([ WebhookEventCreateManyInputObjectSchema, z.array(WebhookEventCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.WebhookEventCreateManyAndReturnArgs>;

export const WebhookEventCreateManyAndReturnZodSchema = z.object({  data: z.union([ WebhookEventCreateManyInputObjectSchema, z.array(WebhookEventCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();