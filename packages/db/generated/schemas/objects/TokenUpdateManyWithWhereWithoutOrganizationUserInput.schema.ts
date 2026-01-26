import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenScalarWhereInputObjectSchema as TokenScalarWhereInputObjectSchema } from './TokenScalarWhereInput.schema';
import { TokenUpdateManyMutationInputObjectSchema as TokenUpdateManyMutationInputObjectSchema } from './TokenUpdateManyMutationInput.schema';
import { TokenUncheckedUpdateManyWithoutOrganizationUserInputObjectSchema as TokenUncheckedUpdateManyWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedUpdateManyWithoutOrganizationUserInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => TokenScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => TokenUpdateManyMutationInputObjectSchema), z.lazy(() => TokenUncheckedUpdateManyWithoutOrganizationUserInputObjectSchema)])
}).strict();
export const TokenUpdateManyWithWhereWithoutOrganizationUserInputObjectSchema: z.ZodType<Prisma.TokenUpdateManyWithWhereWithoutOrganizationUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUpdateManyWithWhereWithoutOrganizationUserInput>;
export const TokenUpdateManyWithWhereWithoutOrganizationUserInputObjectZodSchema = makeSchema();
