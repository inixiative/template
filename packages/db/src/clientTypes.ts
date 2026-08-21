/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { PrismaClient } from '@template/db/generated/client/client';
import type { ModelName } from '@template/db/utils/modelNames';
import type { ConcurrencyType } from '@template/shared/utils';

export type AfterCommitFn = () => Promise<void> | void;

export type ScopeContext = 'api' | 'worker';

export type DbMethods = {
  raw: Db;
  scope: <T>(scopeId: string | undefined, fn: () => Promise<T>, context?: ScopeContext) => Promise<T>;
  txn: <T>(fn: () => Promise<T>, options?: { timeout?: number }) => Promise<T>;
  onCommit: (callbacks: AfterCommitFn | AfterCommitFn[], types?: ConcurrencyType | ConcurrencyType[]) => void;
  parallel: {
    <T>(thunks: Array<() => Promise<T>>, options?: { concurrency?: number; resolution?: 'all' }): Promise<T[]>;
    <T>(
      thunks: Array<() => Promise<T>>,
      options: { concurrency?: number; resolution: 'allSettled' },
    ): Promise<PromiseSettledResult<T>[]>;
  };
  getScopeId: () => string | null;
  getScope: () => ScopeContext | null;
  isInTxn: () => boolean;
  findForUpdate: <T = unknown>(model: ModelName, where: Record<string, unknown>) => Promise<T[]>;
};

export type Db = PrismaClient & DbMethods;
