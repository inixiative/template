import { z } from 'zod';

export const inviteOrganizationUserResolutionSchema = z.object({
  explanation: z.string().optional(),
});

export type InviteOrganizationUserResolution = z.infer<typeof inviteOrganizationUserResolutionSchema>;
