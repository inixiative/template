import type { Db, Prisma } from '@template/db';
import type { RouteConfig } from '@hono/zod-openapi';
import type {
  Organization,
  OrganizationUser,
  Session,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions';
import type { Hono } from 'hono';
import type { TokenWithRelations } from '#/lib/context/types';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';

export type AppVars = {
  app: Hono<AppEnv>;
  db: Db;
  txn: Prisma.TransactionClient | undefined;
  user: User | null;
  organizationUsers: OrganizationUser[] | null;
  organizations: Organization[] | null;
  spaceUsers: SpaceUser[] | null;
  spaces: Space[] | null;
  session: Session | null;
  token: TokenWithRelations | null;
  spoofedBy: User | null;
  permix: Permix;
  requestId: string;
  resource: unknown;
  resourceType: string | null;
  routeConfig: RouteConfig | null;
  searchableFields: readonly string[] | null;
  bracketQuery: BracketQueryRecord;
};

export type AppEnv = {
  Variables: AppVars;
};
