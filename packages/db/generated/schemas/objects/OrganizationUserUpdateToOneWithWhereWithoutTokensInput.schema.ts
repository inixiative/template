import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema';
import { OrganizationUserUpdateWithoutTokensInputObjectSchema as OrganizationUserUpdateWithoutTokensInputObjectSchema } from './OrganizationUserUpdateWithoutTokensInput.schema';
import { OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema as OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema } from './OrganizationUserUncheckedUpdateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUserUpdateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUserUncheckedUpdateWithoutTokensInputObjectSchema)])
}).strict();
export const OrganizationUserUpdateToOneWithWhereWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateToOneWithWhereWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateToOneWithWhereWithoutTokensInput>;
export const OrganizationUserUpdateToOneWithWhereWithoutTokensInputObjectZodSchema = makeSchema();
