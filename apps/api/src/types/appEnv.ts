/**
 * @atlas
 * @kind type
 * @uses infrastructure:prisma, primitive:authz, feature:auth, feature:tenancy, feature:users
 */
import type { OpenAPIHono, RouteConfig } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import type { AccessorName, Db, Prisma } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions';
import type { TokenWithRelations } from '#/lib/context/types';
import type { RouteArgs } from '#/lib/routeTemplates/types';
import type { BracketQueryRecord } from '#/lib/utils/parseBracketNotation';

export type AppVars = {
  app: OpenAPIHono<AppEnv>;
  db: Db;
  txn: Prisma.TransactionClient | undefined;
  user: User | null;
  organizationUsers: OrganizationUser[] | null;
  organizations: Organization[] | null;
  spaceUsers: SpaceUser[] | null;
  spaces: Space[] | null;
  token: TokenWithRelations | null;
  spoofedBy: User | null;
  permix: Permix;
  requestId: string;
  resource: unknown;
  resourceType: AccessorName | null;
  routeConfig: (RouteConfig & Pick<RouteArgs, 'model' | 'submodel'>) | null;
  filterLens: LensNarrowing | null;
  bracketQuery: BracketQueryRecord;
};

export type AppEnv = {
  Variables: AppVars;
};
