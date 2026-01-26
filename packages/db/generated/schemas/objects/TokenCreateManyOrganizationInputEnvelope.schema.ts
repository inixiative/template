import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { TokenCreateManyOrganizationInputObjectSchema as TokenCreateManyOrganizationInputObjectSchema } from './TokenCreateManyOrganizationInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => TokenCreateManyOrganizationInputObjectSchema), z.lazy(() => TokenCreateManyOrganizationInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const TokenCreateManyOrganizationInputEnvelopeObjectSchema: z.ZodType<Prisma.TokenCreateManyOrganizationInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.TokenCreateManyOrganizationInputEnvelope>;
export const TokenCreateManyOrganizationInputEnvelopeObjectZodSchema = makeSchema();
