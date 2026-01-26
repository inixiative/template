import type { ExtendedPrismaClient, OrganizationUser, Prisma, Session, User } from '@template/db';
import type { Permix } from '@template/permissions';
import type { TokenWithRelations } from '#/lib/context/getToken';

export type AppVars = {
  db: ExtendedPrismaClient;
  txn: Prisma.TransactionClient | undefined;
  user: User | null;
  organizationUsers: OrganizationUser[] | null;
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
