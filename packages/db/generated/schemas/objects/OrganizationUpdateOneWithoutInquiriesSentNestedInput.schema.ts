import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationCreateWithoutInquiriesSentInputObjectSchema as OrganizationCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedCreateWithoutInquiriesSentInput.schema';
import { OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema as OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema } from './OrganizationCreateOrConnectWithoutInquiriesSentInput.schema';
import { OrganizationUpsertWithoutInquiriesSentInputObjectSchema as OrganizationUpsertWithoutInquiriesSentInputObjectSchema } from './OrganizationUpsertWithoutInquiriesSentInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema as OrganizationUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema } from './OrganizationUpdateToOneWithWhereWithoutInquiriesSentInput.schema';
import { OrganizationUpdateWithoutInquiriesSentInputObjectSchema as OrganizationUpdateWithoutInquiriesSentInputObjectSchema } from './OrganizationUpdateWithoutInquiriesSentInput.schema';
import { OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema as OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema } from './OrganizationUncheckedUpdateWithoutInquiriesSentInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutInquiriesSentInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutInquiriesSentInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutInquiriesSentInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUpdateWithoutInquiriesSentInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutInquiriesSentInputObjectSchema)]).optional()
}).strict();
export const OrganizationUpdateOneWithoutInquiriesSentNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateOneWithoutInquiriesSentNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateOneWithoutInquiriesSentNestedInput>;
export const OrganizationUpdateOneWithoutInquiriesSentNestedInputObjectZodSchema = makeSchema();
