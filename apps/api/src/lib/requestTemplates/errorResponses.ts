import { type RouteConfig, z } from '@hono/zod-openapi';

const errorDescriptions: { code: string; description: string }[] = [
  { code: '400', description: 'Bad Request' },
  { code: '401', description: 'Unauthorized' },
  { code: '403', description: 'Forbidden' },
  { code: '404', description: 'Not Found' },
  { code: '409', description: 'Conflict' },
  { code: '422', description: 'Unprocessable Entity' },
  { code: '500', description: 'Internal Server Error' },
];

export const errorSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    guidance: z.string().optional(),
  })
  .openapi('Error');

export const errorResponses: RouteConfig['responses'] = errorDescriptions.reduce(
  (acc, { code, description }) => {
    acc[code] = {
      content: {
        'application/json': {
          schema: errorSchema,
        },
      },
      description,
    };
    return acc;
  },
  {} as RouteConfig['responses'],
);
