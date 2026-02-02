import type { Db, Prisma } from '@template/db';
import type { OrganizationUser, Session, SpaceUser, User } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions';
import type { TokenWithRelations } from '#/lib/context/getToken';

export type AppVars = {
  db: Db;
  txn: Prisma.TransactionClient | undefined;
  user: User | null;
  organizationUsers: OrganizationUser[] | null;
  spaceUsers: SpaceUser[] | null;
  session: Session | null;
  token: TokenWithRelations | null;
  spoofedBy: User | null;
  permix: Permix;
  requestId: string;
  resource: unknown;
  resourceType: string | null;
};

export type AppEnv = {
  Variables: AppVars;
};
