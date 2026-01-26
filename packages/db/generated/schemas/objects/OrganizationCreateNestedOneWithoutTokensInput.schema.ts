import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCreateWithoutTokensInputObjectSchema as OrganizationCreateWithoutTokensInputObjectSchema } from './OrganizationCreateWithoutTokensInput.schema';
import { OrganizationUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUncheckedCreateWithoutTokensInput.schema';
import { OrganizationCreateOrConnectWithoutTokensInputObjectSchema as OrganizationCreateOrConnectWithoutTokensInputObjectSchema } from './OrganizationCreateOrConnectWithoutTokensInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutTokensInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutTokensInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationCreateNestedOneWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutTokensInput>;
export const OrganizationCreateNestedOneWithoutTokensInputObjectZodSchema = makeSchema();
