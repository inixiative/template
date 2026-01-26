import { OpenAPIHono } from '@hono/zod-openapi';
import { errorHandlerMiddleware } from '#/middleware/error/errorHandlerMiddleware';
import { notFoundHandlerMiddleware } from '#/middleware/error/notFoundHandlerMiddleware';
import { Tags } from '#/modules/tags';
import { routes } from '#/routes';
import type { AppEnv } from '#/types/appEnv';

import '#/events';

export const app = new OpenAPIHono<AppEnv>();

// Error handling
app.onError(errorHandlerMiddleware);

// Mount all routes
app.route('/', routes);

// OpenAPI
app.doc31('/openapi/docs', {
  openapi: '3.1.0',
  info: { title: 'API', version: '0.1.0' },
  tags: Object.values(Tags).map((name) => ({ name })),
});

// Not found (must be last)
app.notFound(notFoundHandlerMiddleware);
