import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationCreateWithoutInquiriesSentInputObjectSchema as OrganizationCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesSentInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema)])
}).strict();
export const OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutInquiriesSentInput>;
export const OrganizationCreateOrConnectWithoutInquiriesSentInputObjectZodSchema = makeSchema();
