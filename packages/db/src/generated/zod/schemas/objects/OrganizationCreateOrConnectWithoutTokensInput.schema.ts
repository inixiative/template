import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationCreateWithoutTokensInputObjectSchema as OrganizationCreateWithoutTokensInputObjectSchema } from './OrganizationCreateWithoutTokensInput.schema';
import { OrganizationUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUncheckedCreateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutTokensInputObjectSchema)])
}).strict();
export const OrganizationCreateOrConnectWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutTokensInput>;
export const OrganizationCreateOrConnectWithoutTokensInputObjectZodSchema = makeSchema();
