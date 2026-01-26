import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUpdateWithoutTokensInputObjectSchema as OrganizationUpdateWithoutTokensInputObjectSchema } from './OrganizationUpdateWithoutTokensInput.schema';
import { OrganizationUncheckedUpdateWithoutTokensInputObjectSchema as OrganizationUncheckedUpdateWithoutTokensInputObjectSchema } from './OrganizationUncheckedUpdateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUpdateWithoutTokensInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutTokensInputObjectSchema)])
}).strict();
export const OrganizationUpdateToOneWithWhereWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutTokensInput>;
export const OrganizationUpdateToOneWithWhereWithoutTokensInputObjectZodSchema = makeSchema();
