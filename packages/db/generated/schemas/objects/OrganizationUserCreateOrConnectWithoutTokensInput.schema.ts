import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserCreateWithoutTokensInputObjectSchema as OrganizationUserCreateWithoutTokensInputObjectSchema } from './OrganizationUserCreateWithoutTokensInput.schema';
import { OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema)])
}).strict();
export const OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateOrConnectWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateOrConnectWithoutTokensInput>;
export const OrganizationUserCreateOrConnectWithoutTokensInputObjectZodSchema = makeSchema();
