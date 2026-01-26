import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { OrganizationOrderByWithRelationInputObjectSchema as OrganizationOrderByWithRelationInputObjectSchema } from './OrganizationOrderByWithRelationInput.schema';
import { UserOrderByWithRelationInputObjectSchema as UserOrderByWithRelationInputObjectSchema } from './UserOrderByWithRelationInput.schema';
import { TokenOrderByRelationAggregateInputObjectSchema as TokenOrderByRelationAggregateInputObjectSchema } from './TokenOrderByRelationAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  organizationId: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  role: SortOrderSchema.optional(),
  entitlements: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  organization: z.lazy(() => OrganizationOrderByWithRelationInputObjectSchema).optional(),
  user: z.lazy(() => UserOrderByWithRelationInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenOrderByRelationAggregateInputObjectSchema).optional()
}).strict();
export const OrganizationUserOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.OrganizationUserOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserOrderByWithRelationInput>;
export const OrganizationUserOrderByWithRelationInputObjectZodSchema = makeSchema();
