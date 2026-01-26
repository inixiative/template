import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesReceivedInput.schema';
import { OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema as OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema } from './OrganizationCreateOrConnectWithoutInquiriesReceivedInput.schema';
import { OrganizationUpsertWithoutInquiriesReceivedInputObjectSchema as OrganizationUpsertWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUpsertWithoutInquiriesReceivedInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema as OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInput.schema';
import { OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema as OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUpdateWithoutInquiriesReceivedInput.schema';
import { OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema as OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema } from './OrganizationUncheckedUpdateWithoutInquiriesReceivedInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutInquiriesReceivedInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutInquiriesReceivedInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUpdateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema)]).optional()
}).strict();
export const OrganizationUpdateOneWithoutInquiriesReceivedNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateOneWithoutInquiriesReceivedNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateOneWithoutInquiriesReceivedNestedInput>;
export const OrganizationUpdateOneWithoutInquiriesReceivedNestedInputObjectZodSchema = makeSchema();
