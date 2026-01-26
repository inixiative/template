import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationUserWhereInputObjectSchema).optional()
}).strict();
export const UserCountOutputTypeCountOrganizationsArgsObjectSchema = makeSchema();
export const UserCountOutputTypeCountOrganizationsArgsObjectZodSchema = makeSchema();
