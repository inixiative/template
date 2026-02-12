import { type RouteConfig, z } from '@hono/zod-openapi';

const errorDescriptions: { code: string; description: string }[] = [
  { code: '400', description: 'Bad Request' },
  { code: '401', description: 'Unauthorized' },
  { code: '403', description: 'Forbidden' },
  { code: '404', description: 'Not Found' },
  { code: '405', description: 'Method Not Allowed' },
  { code: '409', description: 'Conflict' },
  { code: '410', description: 'Gone' },
  { code: '413', description: 'Payload Too Large' },
  { code: '415', description: 'Unsupported Media Type' },
  { code: '422', description: 'Unprocessable Entity' },
  { code: '429', description: 'Too Many Requests' },
  { code: '500', description: 'Internal Server Error' },
  { code: '502', description: 'Bad Gateway' },
  { code: '503', description: 'Service Unavailable' },
  { code: '504', description: 'Gateway Timeout' },
];

export const errorSchema = z
  .object({
    error: z.string(),
    message: z.string(),
    guidance: z.string(),
    fieldErrors: z.record(z.array(z.string())).optional(),
    requestId: z.string(),
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
