import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserOrganizationIdUserIdCompoundUniqueInputObjectSchema as OrganizationUserOrganizationIdUserIdCompoundUniqueInputObjectSchema } from './OrganizationUserOrganizationIdUserIdCompoundUniqueInput.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  organizationId_userId: z.lazy(() => OrganizationUserOrganizationIdUserIdCompoundUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationUserWhereUniqueInputObjectSchema: z.ZodType<Prisma.OrganizationUserWhereUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserWhereUniqueInput>;
export const OrganizationUserWhereUniqueInputObjectZodSchema = makeSchema();
