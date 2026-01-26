import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema as OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUpdateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedUpdateWithoutInquiriesReceivedInput.schema';
import { OrganizationCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)]),
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUpsertWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.OrganizationUpsertWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpsertWithoutInquiriesReceivedInput>;
export const OrganizationUpsertWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
