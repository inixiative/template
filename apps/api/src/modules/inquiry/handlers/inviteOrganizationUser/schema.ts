/**
 * @atlas
 * @kind handler, schema
 * @partOf feature:inquiry
 * @uses none
 */
import { Role } from '@template/db/generated/client/enums';
import { z } from 'zod';

export const contentSchema = z.object({
  role: z.nativeEnum(Role).default('member'),
});

export type InviteOrganizationUserContent = z.infer<typeof contentSchema>;
