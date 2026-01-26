import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { UserOrderByWithRelationInputObjectSchema as UserOrderByWithRelationInputObjectSchema } from './UserOrderByWithRelationInput.schema';
import { OrganizationOrderByWithRelationInputObjectSchema as OrganizationOrderByWithRelationInputObjectSchema } from './OrganizationOrderByWithRelationInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  sentAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  type: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  content: SortOrderSchema.optional(),
  resolution: SortOrderSchema.optional(),
  sourceModel: SortOrderSchema.optional(),
  sourceUserId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  sourceOrganizationId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  targetModel: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  targetUserId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  targetOrganizationId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  sourceUser: z.lazy(() => UserOrderByWithRelationInputObjectSchema).optional(),
  sourceOrganization: z.lazy(() => OrganizationOrderByWithRelationInputObjectSchema).optional(),
  targetUser: z.lazy(() => UserOrderByWithRelationInputObjectSchema).optional(),
  targetOrganization: z.lazy(() => OrganizationOrderByWithRelationInputObjectSchema).optional()
}).strict();
export const InquiryOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.InquiryOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.InquiryOrderByWithRelationInput>;
export const InquiryOrderByWithRelationInputObjectZodSchema = makeSchema();
