import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCreateWithoutTokensInputObjectSchema as OrganizationCreateWithoutTokensInputObjectSchema } from './OrganizationCreateWithoutTokensInput.schema';
import { OrganizationUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUncheckedCreateWithoutTokensInput.schema';
import { OrganizationCreateOrConnectWithoutTokensInputObjectSchema as OrganizationCreateOrConnectWithoutTokensInputObjectSchema } from './OrganizationCreateOrConnectWithoutTokensInput.schema';
import { OrganizationUpsertWithoutTokensInputObjectSchema as OrganizationUpsertWithoutTokensInputObjectSchema } from './OrganizationUpsertWithoutTokensInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationUpdateToOneWithWhereWithoutTokensInputObjectSchema as OrganizationUpdateToOneWithWhereWithoutTokensInputObjectSchema } from './OrganizationUpdateToOneWithWhereWithoutTokensInput.schema';
import { OrganizationUpdateWithoutTokensInputObjectSchema as OrganizationUpdateWithoutTokensInputObjectSchema } from './OrganizationUpdateWithoutTokensInput.schema';
import { OrganizationUncheckedUpdateWithoutTokensInputObjectSchema as OrganizationUncheckedUpdateWithoutTokensInputObjectSchema } from './OrganizationUncheckedUpdateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutTokensInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutTokensInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutTokensInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUpdateToOneWithWhereWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUpdateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutTokensInputObjectSchema)]).optional()
}).strict();
export const OrganizationUpdateOneWithoutTokensNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateOneWithoutTokensNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateOneWithoutTokensNestedInput>;
export const OrganizationUpdateOneWithoutTokensNestedInputObjectZodSchema = makeSchema();
