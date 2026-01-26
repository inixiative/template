import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateWithoutOrganizationInputObjectSchema as OrganizationUserUpdateWithoutOrganizationInputObjectSchema } from './OrganizationUserUpdateWithoutOrganizationInput.schema';
import { OrganizationUserUncheckedUpdateWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedUpdateWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => OrganizationUserUpdateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutOrganizationInputObjectSchema)])
}).strict();
export const OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInput>;
export const OrganizationUserUpdateWithWhereUniqueWithoutOrganizationInputObjectZodSchema = makeSchema();
