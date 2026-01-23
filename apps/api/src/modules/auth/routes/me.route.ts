import { createRoute, z } from '@hono/zod-openapi';
import { errorResponses } from '@src/lib/requestTemplates/errorResponses';
import { UserResponseSchema } from '../schemas/auth.schema';

export const meRoute = createRoute({
  operationId: 'getMe',
  method: 'get',
  path: '/me',
  tags: ['Auth'],
  summary: 'Get current user',
  description: 'Returns the currently authenticated user. Requires Authorization header.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ data: UserResponseSchema }),
        },
      },
      description: 'Current user details.',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string(), message: z.string() }),
        },
      },
      description: 'Not authenticated.',
    },
    ...errorResponses,
  },
});
