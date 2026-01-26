import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema'

const makeSchema = () => z.object({
  id: z.boolean().optional(),
  createdAt: z.boolean().optional(),
  updatedAt: z.boolean().optional(),
  sentAt: z.boolean().optional(),
  type: z.boolean().optional(),
  status: z.boolean().optional(),
  content: z.boolean().optional(),
  resolution: z.boolean().optional(),
  sourceModel: z.boolean().optional(),
  sourceUserId: z.boolean().optional(),
  sourceOrganizationId: z.boolean().optional(),
  sourceUser: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  sourceOrganization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  targetModel: z.boolean().optional(),
  targetUserId: z.boolean().optional(),
  targetOrganizationId: z.boolean().optional(),
  targetUser: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  targetOrganization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional()
}).strict();
export const InquirySelectObjectSchema: z.ZodType<Prisma.InquirySelect> = makeSchema() as unknown as z.ZodType<Prisma.InquirySelect>;
export const InquirySelectObjectZodSchema = makeSchema();
