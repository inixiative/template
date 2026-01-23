import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from '@src/lib/requestTemplates/errorResponses';
import { AuthResponseSchema, SignupBodySchema } from '../schemas/auth.schema';

export const signupRoute = createRoute({
  operationId: 'signup',
  method: 'post',
  path: '/signup',
  tags: ['Auth'],
  summary: 'Create a new account',
  description: 'Register a new user account with email and password.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SignupBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({ data: AuthResponseSchema }),
        },
      },
      description: 'Account created successfully.',
    },
    409: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
      description: 'Email already exists.',
    },
    ...errorResponses,
  },
});
