/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@template/db/generated/client/client';
import type { ModelName } from '@template/db/utils/modelNames';
import type { ConcurrencyType } from '@template/shared/utils';

export type AfterCommitFn = () => Promise<void> | void;

export type FinallyFn = () => Promise<void> | void;

// `upserting` fences a row that may not exist yet: a Redis lock on the where-key is taken before
// the SELECT ... FOR UPDATE and dropped when the transaction ends. `waitMs` bounds the wait for it.
export type FindForUpdateOptions = { upserting?: boolean; waitMs?: number };

export type ScopeContext = 'api' | 'worker';

export type DbMethods = {
  raw: Db;
  scope: <T>(scopeId: string | undefined, fn: () => Promise<T>, context?: ScopeContext) => Promise<T>;
  txn: <T>(fn: () => Promise<T>, options?: { timeout?: number; maxWait?: number }) => Promise<T>;
  onCommit: (callbacks: AfterCommitFn | AfterCommitFn[], types?: ConcurrencyType | ConcurrencyType[]) => void;
  onFinally: (callbacks: FinallyFn | FinallyFn[]) => void;
  parallel: {
    <T>(thunks: Array<() => Promise<T>>, options?: { concurrency?: number; resolution?: 'all' }): Promise<T[]>;
    <T>(
      thunks: Array<() => Promise<T>>,
      options: { concurrency?: number; resolution: 'allSettled' },
    ): Promise<PromiseSettledResult<T>[]>;
  };
  withDeleted: <T>(fn: () => T | Promise<T>) => Promise<Awaited<T>>;
  getScopeId: () => string | null;
  getScope: () => ScopeContext | null;
  isInTxn: () => boolean;
  findForUpdate: <T = unknown>(
    model: ModelName,
    where: Record<string, unknown>,
    options?: FindForUpdateOptions,
  ) => Promise<T[]>;
};

export type Db = PrismaClient & DbMethods;

// Async-local stores a hook declared it needs, paired with the value read at db.txn() open.
export type BridgedContext = [AsyncLocalStorage<unknown>, unknown][];

export type CommitBatch = { fns: AfterCommitFn[]; concurrency?: number; types?: ConcurrencyType[] };

// What the async-local store holds. db.scope and db.parallel create one with no transaction; db.txn
// attaches an OpenTransaction for the life of that transaction and detaches it after.
export type Scope = {
  scopeId: string | null;
  scopeContext: ScopeContext | null;
  openTransaction: OpenTransaction | null;
};

// prismaTransactionId is learned through the registration handshake in db.txn(); it is the key the
// mutation extension matches an executing write against.
export type OpenTransaction = {
  scope: Scope;
  client: Db;
  prismaTransactionId: string | null;
  afterCommitBatches: CommitBatch[];
  // Drained once the database transaction has settled, commit or rollback, before the on-commit
  // batches run.
  finallyFns: FinallyFn[];
  // Upserting findForUpdate lock keys this transaction holds, so a second fence on the same key
  // does not wait on itself.
  heldLockKeys: Set<string>;
  bridgedContext: BridgedContext;
};
