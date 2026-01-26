import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserUpdateWithoutTokensInputObjectSchema as OrganizationUserUpdateWithoutTokensInputObjectSchema } from './OrganizationUserUpdateWithoutTokensInput.schema';
import { OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema as OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutTokensInput.schema';
import { OrganizationUserCreateWithoutTokensInputObjectSchema as OrganizationUserCreateWithoutTokensInputObjectSchema } from './OrganizationUserCreateWithoutTokensInput.schema';
import { OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedCreateWithoutTokensInput.schema';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUserUpdateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationUserCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema)]),
  where: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUserUpsertWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpsertWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpsertWithoutTokensInput>;
export const OrganizationUserUpsertWithoutTokensInputObjectZodSchema = makeSchema();
