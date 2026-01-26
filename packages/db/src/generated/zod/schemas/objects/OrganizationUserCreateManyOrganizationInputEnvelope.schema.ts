import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserCreateManyOrganizationInputObjectSchema as OrganizationUserCreateManyOrganizationInputObjectSchema } from './OrganizationUserCreateManyOrganizationInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => OrganizationUserCreateManyOrganizationInputObjectSchema), z.lazy(() => OrganizationUserCreateManyOrganizationInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const OrganizationUserCreateManyOrganizationInputEnvelopeObjectSchema: z.ZodType<Prisma.OrganizationUserCreateManyOrganizationInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateManyOrganizationInputEnvelope>;
export const OrganizationUserCreateManyOrganizationInputEnvelopeObjectZodSchema = makeSchema();
