import type { Prisma } from '@template/db';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export type TokenWithRelations = Prisma.TokenGetPayload<{
  include: {
    user: true;
    organization: true;
    organizationUser: {
      include: {
        user: true;
        organization: true;
      };
    };
    space: {
      include: {
        organization: true;
      };
    };
    spaceUser: {
      include: {
        user: true;
        space: {
          include: {
            organization: true;
          };
        };
      };
    };
  };
}>;

export const getToken = (c: Context<AppEnv>): TokenWithRelations | null => c.get('token');
