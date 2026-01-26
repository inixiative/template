import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenScalarWhereInputObjectSchema as TokenScalarWhereInputObjectSchema } from './TokenScalarWhereInput.schema';
import { TokenUpdateManyMutationInputObjectSchema as TokenUpdateManyMutationInputObjectSchema } from './TokenUpdateManyMutationInput.schema';
import { TokenUncheckedUpdateManyWithoutOrganizationInputObjectSchema as TokenUncheckedUpdateManyWithoutOrganizationInputObjectSchema } from './TokenUncheckedUpdateManyWithoutOrganizationInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => TokenUpdateManyMutationInputObjectSchema), z.lazy(() => TokenUncheckedUpdateManyWithoutOrganizationInputObjectSchema)])
}).strict();
export const TokenUpdateManyWithWhereWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.TokenUpdateManyWithWhereWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateManyWithWhereWithoutOrganizationInput>;
export const TokenUpdateManyWithWhereWithoutOrganizationInputObjectZodSchema = makeSchema();
