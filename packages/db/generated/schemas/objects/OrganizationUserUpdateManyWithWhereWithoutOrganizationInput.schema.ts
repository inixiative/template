import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserScalarWhereInputObjectSchema as OrganizationUserScalarWhereInputObjectSchema } from './OrganizationUserScalarWhereInput.schema';
import { OrganizationUserUpdateManyMutationInputObjectSchema as OrganizationUserUpdateManyMutationInputObjectSchema } from './OrganizationUserUpdateManyMutationInput.schema';
import { OrganizationUserUncheckedUpdateManyWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedUpdateManyWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedUpdateManyWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => OrganizationUserUpdateManyMutationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateManyWithoutOrganizationInputObjectSchema)])
}).strict();
export const OrganizationUserUpdateManyWithWhereWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateManyWithWhereWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateManyWithWhereWithoutOrganizationInput>;
export const OrganizationUserUpdateManyWithWhereWithoutOrganizationInputObjectZodSchema = makeSchema();
