import { OpenAPIHono } from '@hono/zod-openapi';
import { type Db, db } from '@template/db';
import type { OrganizationUser, SpaceUser, User } from '@template/db/generated/client/client';
import { auth } from '#/lib/auth';
import type { TokenWithRelations } from '#/lib/context/types';
import { validationDefaultHook } from '#/lib/openapi/validationDefaultHook';
import { buildPermix } from '#/lib/permissions/buildPermix';
import { principalFromContext } from '#/lib/permissions/principalContext';
import { errorHandlerMiddleware } from '#/middleware/error/errorHandlerMiddleware';
import { notFoundHandlerMiddleware } from '#/middleware/error/notFoundHandlerMiddleware';
import { prepareRequest } from '#/middleware/prepareRequest';
import type { AppEnv } from '#/types/appEnv';

export type MountFn = (app: OpenAPIHono<AppEnv>) => void;

type CreateTestAppOptions = {
  mockUser?: User | null;
  mockOrganizationUsers?: OrganizationUser[];
  mockSpaceUsers?: SpaceUser[];
  mockToken?: TokenWithRelations | null;
  mount?: MountFn[];
};

export const createTestApp = (options?: CreateTestAppOptions) => {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationDefaultHook });

  app.onError(errorHandlerMiddleware);

  app.use('*', (c, next) => {
    c.set('app', app);
    return next();
  });

  app.use('*', prepareRequest);

  app.use('*', async (c, next) => {
    if (options?.mockUser) {
      c.set('user', options.mockUser);
    }
    if (options?.mockOrganizationUsers) {
      c.set('organizationUsers', options.mockOrganizationUsers);
      const orgIds = options.mockOrganizationUsers.map((ou) => ou.organizationId);
      const organizations = await db.organization.findMany({
        where: { id: { in: orgIds } },
      });
      c.set('organizations', organizations);
    }
    if (options?.mockSpaceUsers) {
      c.set('spaceUsers', options.mockSpaceUsers);
      const spaceIds = options.mockSpaceUsers.map((su) => su.spaceId);
      const spaces = await db.space.findMany({
        where: { id: { in: spaceIds } },
      });
      c.set('spaces', spaces);
    }
    if (options?.mockToken) c.set('token', options.mockToken);
    c.set('permix', await buildPermix(principalFromContext(c)));
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
};
