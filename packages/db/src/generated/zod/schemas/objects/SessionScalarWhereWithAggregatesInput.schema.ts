import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { StringNullableWithAggregatesFilterObjectSchema as StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema'

const sessionscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => SessionScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => SessionScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => SessionScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => SessionScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => SessionScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  userId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  token: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(255)]).optional(),
  expiresAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  ipAddress: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(45)]).optional().nullable(),
  userAgent: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(512)]).optional().nullable(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional()
}).strict();
export const SessionScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.SessionScalarWhereWithAggregatesInput> = sessionscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.SessionScalarWhereWithAggregatesInput>;
export const SessionScalarWhereWithAggregatesInputObjectZodSchema = sessionscalarwherewithaggregatesinputSchema;
