import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional().nullable(),
  name: z.string(),
  slug: z.string()
}).strict();
export const OrganizationCreateManyInputObjectSchema: z.ZodType<Prisma.OrganizationCreateManyInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateManyInput>;
export const OrganizationCreateManyInputObjectZodSchema = makeSchema();
