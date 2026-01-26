import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenCreateManyUserInputObjectSchema as TokenCreateManyUserInputObjectSchema } from './TokenCreateManyUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => TokenCreateManyUserInputObjectSchema), z.lazy(() => TokenCreateManyUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const TokenCreateManyUserInputEnvelopeObjectSchema: z.ZodType<Prisma.TokenCreateManyUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateManyUserInputEnvelope>;
export const TokenCreateManyUserInputEnvelopeObjectZodSchema = makeSchema();
