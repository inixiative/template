import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserArgsObjectSchema as UserArgsObjectSchema } from './UserArgs.schema';
import { OrganizationArgsObjectSchema as OrganizationArgsObjectSchema } from './OrganizationArgs.schema'

const makeSchema = () => z.object({
  sourceUser: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  sourceOrganization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional(),
  targetUser: z.union([z.boolean(), z.lazy(() => UserArgsObjectSchema)]).optional(),
  targetOrganization: z.union([z.boolean(), z.lazy(() => OrganizationArgsObjectSchema)]).optional()
}).strict();
export const InquiryIncludeObjectSchema: z.ZodType<Prisma.InquiryInclude> = makeSchema() as unknown as z.ZodType<Prisma.InquiryInclude>;
export const InquiryIncludeObjectZodSchema = makeSchema();
