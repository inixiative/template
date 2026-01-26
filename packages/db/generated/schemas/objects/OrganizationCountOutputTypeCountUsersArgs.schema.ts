import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional()
}).strict();
export const OrganizationCountOutputTypeCountUsersArgsObjectSchema = makeSchema();
export const OrganizationCountOutputTypeCountUsersArgsObjectZodSchema = makeSchema();
