import { OpenAPIHono } from '@hono/zod-openapi';
import { errorHandlerMiddleware } from '@src/middleware/error/errorHandlerMiddleware';
import { notFoundHandlerMiddleware } from '@src/middleware/error/notFoundHandlerMiddleware';
import type { AppEnv } from '@src/types/appEnv';
import { createMockDb, type MockPrismaClient } from './mocks/db.mock';

type CreateTestAppOptions = {
  mockDb?: MockPrismaClient;
  mockUser?: { id: string; email: string } | null;
};

export function createTestApp(options?: CreateTestAppOptions) {
  const app = new OpenAPIHono<AppEnv>();

  // Error handler
  app.onError(errorHandlerMiddleware);

  // Mock database
  const db = options?.mockDb ?? createMockDb();

  // Inject context
  app.use('*', async (c, next) => {
    c.set('db', db as any);
    c.set('requestId', 'test-request-id');
    c.set('user', options?.mockUser ?? null);
    await next();
  });

  // Not found handler
  app.notFound(notFoundHandlerMiddleware);

  const fetch = (request: Request) => app.fetch(request);

  return {
    app,
    fetch,
    db,
  };
}
