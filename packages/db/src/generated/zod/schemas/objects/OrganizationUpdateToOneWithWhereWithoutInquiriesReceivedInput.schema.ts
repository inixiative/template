import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema as OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUpdateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedUpdateWithoutInquiriesReceivedInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema)])
}).strict();
export const OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInput>;
export const OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
