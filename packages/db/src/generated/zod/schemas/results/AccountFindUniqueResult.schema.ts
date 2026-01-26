import * as z from 'zod';
export const AccountFindUniqueResultSchema = z.nullable(z.object({
  id: z.string(),
  userId: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  accessTokenExpiresAt: z.date().optional(),
  refreshTokenExpiresAt: z.date().optional(),
  scope: z.string().optional(),
  idToken: z.string().optional(),
  password: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.unknown()
}));