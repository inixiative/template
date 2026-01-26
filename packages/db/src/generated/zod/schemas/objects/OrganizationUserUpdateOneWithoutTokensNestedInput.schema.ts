import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserCreateWithoutTokensInputObjectSchema as OrganizationUserCreateWithoutTokensInputObjectSchema } from './OrganizationUserCreateWithoutTokensInput.schema';
import { OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutTokensInput.schema';
import { OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema as OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema } from './OrganizationUserCreateOrConnectWithoutTokensInput.schema';
import { OrganizationUserUpsertWithoutTokensInputObjectSchema as OrganizationUserUpsertWithoutTokensInputObjectSchema } from './OrganizationUserUpsertWithoutTokensInput.schema';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema';
import { OrganizationUserWhereUniqueInputObjectSchema as OrganizationUserWhereUniqueInputObjectSchema } from './OrganizationUserWhereUniqueInput.schema';
import { OrganizationUserUpdateToOneWithWhereWithoutTokensInputObjectSchema as OrganizationUserUpdateToOneWithWhereWithoutTokensInputObjectSchema } from './OrganizationUserUpdateToOneWithWhereWithoutTokensInput.schema';
import { OrganizationUserUpdateWithoutTokensInputObjectSchema as OrganizationUserUpdateWithoutTokensInputObjectSchema } from './OrganizationUserUpdateWithoutTokensInput.schema';
import { OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema as OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationUserCreateOrConnectWithoutTokensInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUserUpsertWithoutTokensInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => OrganizationUserWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => OrganizationUserWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => OrganizationUserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUserUpdateToOneWithWhereWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUpdateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema)]).optional()
}).strict();
export const OrganizationUserUpdateOneWithoutTokensNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateOneWithoutTokensNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateOneWithoutTokensNestedInput>;
export const OrganizationUserUpdateOneWithoutTokensNestedInputObjectZodSchema = makeSchema();
