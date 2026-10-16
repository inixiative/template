/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { ROLES } from '@template/shared/auth/roles';
import { z } from 'zod';

export const inviteOrganizationUserContentSchema = z.object({
  role: z.enum(ROLES).default('member'),
});

export type InviteOrganizationUserContent = z.infer<typeof inviteOrganizationUserContentSchema>;
