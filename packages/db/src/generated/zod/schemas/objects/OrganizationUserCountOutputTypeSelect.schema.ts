import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserCountOutputTypeCountTokensArgsObjectSchema as OrganizationUserCountOutputTypeCountTokensArgsObjectSchema } from './OrganizationUserCountOutputTypeCountTokensArgs.schema'

const makeSchema = () => z.object({
  tokens: z.union([z.boolean(), z.lazy(() => OrganizationUserCountOutputTypeCountTokensArgsObjectSchema)]).optional()
}).strict();
export const OrganizationUserCountOutputTypeSelectObjectSchema: z.ZodType<Prisma.OrganizationUserCountOutputTypeSelect> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCountOutputTypeSelect>;
export const OrganizationUserCountOutputTypeSelectObjectZodSchema = makeSchema();
