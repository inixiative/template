import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserCreateWithoutTokensInputObjectSchema as OrganizationUserCreateWithoutTokensInputObjectSchema } from './OrganizationUserCreateWithoutTokensInput.schema';
import { OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutTokensInput.schema';
import { OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema as OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema } from './OrganizationUserCreateOrConnectWithoutTokensInput.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationUserCreateNestedOneWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateNestedOneWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateNestedOneWithoutTokensInput>;
export const OrganizationUserCreateNestedOneWithoutTokensInputObjectZodSchema = makeSchema();
