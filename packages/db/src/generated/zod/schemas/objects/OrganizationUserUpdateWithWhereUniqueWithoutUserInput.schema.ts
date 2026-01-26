import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateWithoutUserInputObjectSchema as OrganizationUserUpdateWithoutUserInputObjectSchema } from './OrganizationUserUpdateWithoutUserInput.schema';
import { OrganizationUserUncheckedUpdateWithoutUserInputObjectSchema as OrganizationUserUncheckedUpdateWithoutUserInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => OrganizationUserUpdateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutUserInputObjectSchema)])
}).strict();
export const OrganizationUserUpdateWithWhereUniqueWithoutUserInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateWithWhereUniqueWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateWithWhereUniqueWithoutUserInput>;
export const OrganizationUserUpdateWithWhereUniqueWithoutUserInputObjectZodSchema = makeSchema();
