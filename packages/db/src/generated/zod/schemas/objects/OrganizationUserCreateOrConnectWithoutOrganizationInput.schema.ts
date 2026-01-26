import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserCreateWithoutOrganizationInputObjectSchema as OrganizationUserCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserCreateWithoutOrganizationInput.schema';
import { OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema as OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutOrganizationInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutOrganizationInputObjectSchema)])
}).strict();
export const OrganizationUserCreateOrConnectWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateOrConnectWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateOrConnectWithoutOrganizationInput>;
export const OrganizationUserCreateOrConnectWithoutOrganizationInputObjectZodSchema = makeSchema();
