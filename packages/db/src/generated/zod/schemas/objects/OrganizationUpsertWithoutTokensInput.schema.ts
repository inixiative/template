import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUpdateWithoutTokensInputObjectSchema as OrganizationUpdateWithoutTokensInputObjectSchema } from './OrganizationUpdateWithoutTokensInput.schema';
import { OrganizationUncheckedUpdateWithoutTokensInputObjectSchema as OrganizationUncheckedUpdateWithoutTokensInputObjectSchema } from './OrganizationUncheckedUpdateWithoutTokensInput.schema';
import { OrganizationCreateWithoutTokensInputObjectSchema as OrganizationCreateWithoutTokensInputObjectSchema } from './OrganizationCreateWithoutTokensInput.schema';
import { OrganizationUncheckedCreateWithoutTokensInputObjectSchema as OrganizationUncheckedCreateWithoutTokensInputObjectSchema } from './OrganizationUncheckedCreateWithoutTokensInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUpdateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutTokensInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationCreateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutTokensInputObjectSchema)]),
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUpsertWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUpsertWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpsertWithoutTokensInput>;
export const OrganizationUpsertWithoutTokensInputObjectZodSchema = makeSchema();
