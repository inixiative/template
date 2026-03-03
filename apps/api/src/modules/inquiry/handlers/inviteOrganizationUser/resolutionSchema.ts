import { z } from 'zod';
import { Role } from '@template/db/generated/client/enums';

export const inviteOrganizationUserResolutionSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  explanation: z.string().optional(),
});

export type InviteOrganizationUserResolution = z.infer<typeof inviteOrganizationUserResolutionSchema>;
