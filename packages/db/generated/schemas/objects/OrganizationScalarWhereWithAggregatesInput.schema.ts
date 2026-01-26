import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { DateTimeNullableWithAggregatesFilterObjectSchema as DateTimeNullableWithAggregatesFilterObjectSchema } from './DateTimeNullableWithAggregatesFilter.schema'

const organizationscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => OrganizationScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => OrganizationScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => OrganizationScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => OrganizationScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => OrganizationScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  deletedAt: z.union([z.lazy(() => DateTimeNullableWithAggregatesFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  name: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  slug: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional()
}).strict();
export const OrganizationScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.OrganizationScalarWhereWithAggregatesInput> = organizationscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.OrganizationScalarWhereWithAggregatesInput>;
export const OrganizationScalarWhereWithAggregatesInputObjectZodSchema = organizationscalarwherewithaggregatesinputSchema;
