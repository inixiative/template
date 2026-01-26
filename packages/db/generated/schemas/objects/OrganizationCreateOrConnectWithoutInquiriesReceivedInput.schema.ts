import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesReceivedInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)])
}).strict();
export const OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutInquiriesReceivedInput>;
export const OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
