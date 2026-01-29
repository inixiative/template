import type { PrismaClient } from '@template/db/generated/client/client';
import type { ConcurrencyType } from '@template/shared/utils';

export type AfterCommitFn = () => Promise<void> | void;

export type ScopeContext = 'api' | 'worker';

export type DbMethods = {
  raw: PrismaClient;
  scope: <T>(scopeId: string | undefined, fn: () => Promise<T>, context?: ScopeContext) => Promise<T>;
  txn: <T>(fn: () => Promise<T>, options?: { timeout?: number }) => Promise<T>;
  onCommit: (callbacks: AfterCommitFn | AfterCommitFn[], types?: ConcurrencyType | ConcurrencyType[]) => void;
  getScopeId: () => string | null;
  getScopeContext: () => ScopeContext | null;
  isInTxn: () => boolean;
};

export type Db = PrismaClient & DbMethods;
