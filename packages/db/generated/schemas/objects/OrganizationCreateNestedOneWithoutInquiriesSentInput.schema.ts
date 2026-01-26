import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCreateWithoutInquiriesSentInputObjectSchema as OrganizationCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesSentInput.schema';
import { OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema as OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateOrConnectWithoutInquiriesSentInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationCreateNestedOneWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutInquiriesSentInput>;
export const OrganizationCreateNestedOneWithoutInquiriesSentInputObjectZodSchema = makeSchema();
