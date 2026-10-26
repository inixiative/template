/**
 * @atlas
 * @kind schema
 * @partOf feature:auth
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { passwordLength } from '@template/shared/auth/passwordLength';

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(passwordLength.max),
  newPassword: z.string().min(passwordLength.min).max(passwordLength.max),
});

export const changePasswordResponseSchema = z.object({
  token: z.string().regex(/^[\w-]+\.[\w-]+\.[\w-]+$/),
  expiresAt: z.string().datetime(),
});
