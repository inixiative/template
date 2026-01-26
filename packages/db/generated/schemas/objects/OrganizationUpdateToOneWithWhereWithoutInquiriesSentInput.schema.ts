import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUpdateWithoutInquiriesSentInputObjectSchema as OrganizationUpdateWithoutInquiriesSentInputObjectSchema } from './OrganizationUpdateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedUpdateWithoutInquiriesSentInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUpdateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema)])
}).strict();
export const OrganizationUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutInquiriesSentInput>;
export const OrganizationUpdateToOneWithWhereWithoutInquiriesSentInputObjectZodSchema = makeSchema();
