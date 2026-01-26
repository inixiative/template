import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateManyOrganizationUserInputObjectSchema as TokenCreateManyOrganizationUserInputObjectSchema } from './TokenCreateManyOrganizationUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => TokenCreateManyOrganizationUserInputObjectSchema), z.lazy(() => TokenCreateManyOrganizationUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const TokenCreateManyOrganizationUserInputEnvelopeObjectSchema: z.ZodType<Prisma.TokenCreateManyOrganizationUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateManyOrganizationUserInputEnvelope>;
export const TokenCreateManyOrganizationUserInputEnvelopeObjectZodSchema = makeSchema();
