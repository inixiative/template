import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.string().max(36).optional()
}).strict();
export const WebhookEventWhereUniqueInputObjectSchema: z.ZodType<Prisma.WebhookEventWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventWhereUniqueInput>;
export const WebhookEventWhereUniqueInputObjectZodSchema = makeSchema();
