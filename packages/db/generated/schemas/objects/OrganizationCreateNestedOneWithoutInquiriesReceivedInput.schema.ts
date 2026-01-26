import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateOrConnectWithoutInquiriesReceivedInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationCreateNestedOneWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutInquiriesReceivedInput>;
export const OrganizationCreateNestedOneWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
