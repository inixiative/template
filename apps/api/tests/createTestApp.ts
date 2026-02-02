import '#tests/mocks/queue';
import { OpenAPIHono } from '@hono/zod-openapi';
import { db, type Db } from '@template/db';
import type { OrganizationUser, SpaceUser, User } from '@template/db/generated/client/client';
import { registerTestTracker } from '@template/db/test';
import { auth } from '#/lib/auth';
import type { TokenWithRelations } from '#/lib/context/getToken';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';
import { errorHandlerMiddleware } from '#/middleware/error/errorHandlerMiddleware';
import { notFoundHandlerMiddleware } from '#/middleware/error/notFoundHandlerMiddleware';
import { prepareRequest } from '#/middleware/prepareRequest';
import type { AppEnv } from '#/types/appEnv';

registerTestTracker();

type MountFn = (app: OpenAPIHono<AppEnv>) => void;

type CreateTestAppOptions = {
  mockUser?: User | null;
  mockOrganizationUsers?: OrganizationUser[];
  mockSpaceUsers?: SpaceUser[];
  mockToken?: TokenWithRelations | null;
  mount?: MountFn[];
};

export function createTestApp(options?: CreateTestAppOptions) {
  const app = new OpenAPIHono<AppEnv>();

  app.onError(errorHandlerMiddleware);

  app.use('*', prepareRequest);

  app.use('*', async (c, next) => {
    if (options?.mockUser) {
      c.set('user', options.mockUser);
      c.get('permix').setUserId(options.mockUser.id);
    }
    if (options?.mockOrganizationUsers) c.set('organizationUsers', options.mockOrganizationUsers);
    if (options?.mockSpaceUsers) c.set('spaceUsers', options.mockSpaceUsers);
    if (options?.mockToken) c.set('token', options.mockToken);
    await setupOrgPermissions(c);
    await setupSpacePermissions(c);
    await setupUserPermissions(c);
    await next();
  });

  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

  if (options?.mount) {
    for (const mountFn of options.mount) {
      mountFn(app);
    }
  }

  app.notFound(notFoundHandlerMiddleware);

  const fetch = async (request: Request): Promise<Response> => app.fetch(request);

  return {
    app,
    fetch,
    db: db as Db,
  };
}
