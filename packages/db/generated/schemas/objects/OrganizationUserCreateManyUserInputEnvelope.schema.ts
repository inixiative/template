import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserCreateManyUserInputObjectSchema as OrganizationUserCreateManyUserInputObjectSchema } from './OrganizationUserCreateManyUserInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => OrganizationUserCreateManyUserInputObjectSchema), z.lazy(() => OrganizationUserCreateManyUserInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const OrganizationUserCreateManyUserInputEnvelopeObjectSchema: z.ZodType<Prisma.OrganizationUserCreateManyUserInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateManyUserInputEnvelope>;
export const OrganizationUserCreateManyUserInputEnvelopeObjectZodSchema = makeSchema();
