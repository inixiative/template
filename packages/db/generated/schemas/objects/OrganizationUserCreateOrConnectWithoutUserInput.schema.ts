import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserCreateWithoutUserInputObjectSchema as OrganizationUserCreateWithoutUserInputObjectSchema } from './OrganizationUserCreateWithoutUserInput.schema';
import { OrganizationUserUncheckedCreateWithoutUserInputObjectSchema as OrganizationUserUncheckedCreateWithoutUserInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutUserInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutUserInputObjectSchema)])
}).strict();
export const OrganizationUserCreateOrConnectWithoutUserInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateOrConnectWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateOrConnectWithoutUserInput>;
export const OrganizationUserCreateOrConnectWithoutUserInputObjectZodSchema = makeSchema();
