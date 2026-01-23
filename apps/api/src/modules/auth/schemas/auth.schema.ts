import { z } from '@hono/zod-openapi';

export const SignupBodySchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().min(8).openapi({ example: 'securepassword123' }),
    name: z.string().min(1).optional().openapi({ example: 'John Doe' }),
  })
  .openapi('SignupBody');

export const LoginBodySchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().min(1).openapi({ example: 'securepassword123' }),
  })
  .openapi('LoginBody');

export const AuthResponseSchema = z
  .object({
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string().nullable(),
      emailVerified: z.boolean(),
    }),
  })
  .openapi('AuthResponse');

export const UserResponseSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    emailVerified: z.boolean(),
    kycStatus: z.enum(['NONE', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']),
    createdAt: z.string().datetime(),
  })
  .openapi('UserResponse');
