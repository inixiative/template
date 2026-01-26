import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserScalarWhereInputObjectSchema as OrganizationUserScalarWhereInputObjectSchema } from './OrganizationUserScalarWhereInput.schema';
import { OrganizationUserUpdateManyMutationInputObjectSchema as OrganizationUserUpdateManyMutationInputObjectSchema } from './OrganizationUserUpdateManyMutationInput.schema';
import { OrganizationUserUncheckedUpdateManyWithoutUserInputObjectSchema as OrganizationUserUncheckedUpdateManyWithoutUserInputObjectSchema } from './OrganizationUserUncheckedUpdateManyWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => OrganizationUserUpdateManyMutationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateManyWithoutUserInputObjectSchema)])
}).strict();
export const OrganizationUserUpdateManyWithWhereWithoutUserInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateManyWithWhereWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateManyWithWhereWithoutUserInput>;
export const OrganizationUserUpdateManyWithWhereWithoutUserInputObjectZodSchema = makeSchema();
