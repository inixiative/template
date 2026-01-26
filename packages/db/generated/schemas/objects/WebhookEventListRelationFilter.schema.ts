import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventWhereInputObjectSchema as WebhookEventWhereInputObjectSchema } from './WebhookEventWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => WebhookEventWhereInputObjectSchema).optional(),
  some: z.lazy(() => WebhookEventWhereInputObjectSchema).optional(),
  none: z.lazy(() => WebhookEventWhereInputObjectSchema).optional()
}).strict();
export const WebhookEventListRelationFilterObjectSchema: z.ZodType<Prisma.WebhookEventListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventListRelationFilter>;
export const WebhookEventListRelationFilterObjectZodSchema = makeSchema();
