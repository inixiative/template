import { z } from 'zod';
import { Role } from '@template/db/generated/client/enums';

export const inviteOrganizationUserContentSchema = z.object({
  role: z.nativeEnum(Role).default('member'),
});

export type InviteOrganizationUserContent = z.infer<typeof inviteOrganizationUserContentSchema>;
