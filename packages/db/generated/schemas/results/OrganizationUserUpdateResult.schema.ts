import * as z from 'zod';
export const OrganizationUserUpdateResultSchema = z.nullable(z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.unknown(),
  entitlements: z.unknown().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  organization: z.unknown(),
  user: z.unknown(),
  tokens: z.array(z.unknown())
}));