import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUpdateWithoutOrganizationUsersInputObjectSchema as OrganizationUpdateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUpdateWithoutOrganizationUsersInput.schema';
import { OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema as OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema } from './OrganizationUncheckedUpdateWithoutOrganizationUsersInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUpdateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutOrganizationUsersInputObjectSchema)])
}).strict();
export const OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInput>;
export const OrganizationUpdateToOneWithWhereWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
