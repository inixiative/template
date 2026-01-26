import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  organizationId: z.string(),
  userId: z.string()
}).strict();
export const OrganizationUserOrganizationIdUserIdCompoundUniqueInputObjectSchema: z.ZodType<Prisma.OrganizationUserOrganizationIdUserIdCompoundUniqueInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserOrganizationIdUserIdCompoundUniqueInput>;
export const OrganizationUserOrganizationIdUserIdCompoundUniqueInputObjectZodSchema = makeSchema();
