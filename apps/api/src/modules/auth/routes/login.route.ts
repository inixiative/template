import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from '@src/lib/requestTemplates/errorResponses';
import { AuthResponseSchema, LoginBodySchema } from '../schemas/auth.schema';

export const loginRoute = createRoute({
  operationId: 'login',
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: 'Login to existing account',
  description: 'Authenticate with email and password to receive a JWT token.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ data: AuthResponseSchema }),
        },
      },
      description: 'Login successful.',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
      description: 'Invalid credentials.',
    },
    ...errorResponses,
  },
});
