import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUpdateWithoutInquiriesSentInputObjectSchema as OrganizationUpdateWithoutInquiriesSentInputObjectSchema } from './OrganizationUpdateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedUpdateWithoutInquiriesSentInput.schema';
import { OrganizationCreateWithoutInquiriesSentInputObjectSchema as OrganizationCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesSentInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUpdateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema)]),
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUpsertWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationUpsertWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpsertWithoutInquiriesSentInput>;
export const OrganizationUpsertWithoutInquiriesSentInputObjectZodSchema = makeSchema();
