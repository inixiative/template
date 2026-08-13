/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { AfterCommitFn, TransactionState } from '@template/db/clientTypes';
import { type ConcurrencyType, getConcurrency } from '@template/shared/utils';
import { castArray } from 'lodash-es';

// Prisma never hands the caller the id of the interactive transaction it just opened, but every
// query interceptor is told which transaction its op is executing on. db.txn() therefore opens a
// registration, issues one token-carrying read, and the interceptor that sees the token binds the
// two together — the only link between the caller frame and the extension that does not depend on
// async-local storage surviving a Prisma-internal continuation.
const pendingRegistrations = new Map<string, TransactionState>();
const itxToTransactionState = new Map<string, TransactionState>();

export const openTransactionRegistration = (transactionState: TransactionState): string => {
  const registrationToken = crypto.randomUUID();
  pendingRegistrations.set(registrationToken, transactionState);
  return registrationToken;
};

export const pendingRegistrationToken = (args: unknown): string | undefined => {
  const identifier = (args as { where?: { id?: unknown } } | undefined)?.where?.id;
  return typeof identifier === 'string' && pendingRegistrations.has(identifier) ? identifier : undefined;
};

export const claimTransactionRegistration = (registrationToken: string, prismaTransactionId: string): void => {
  const transactionState = pendingRegistrations.get(registrationToken);
  if (!transactionState) return;
  pendingRegistrations.delete(registrationToken);
  transactionState.prismaTransactionId = prismaTransactionId;
  itxToTransactionState.set(prismaTransactionId, transactionState);
};

export const closeTransactionRegistration = (registrationToken: string, transactionState: TransactionState): void => {
  pendingRegistrations.delete(registrationToken);
  if (transactionState.prismaTransactionId) itxToTransactionState.delete(transactionState.prismaTransactionId);
  transactionState.prismaTransactionId = null;
};

export const transactionStateFor = (prismaTransactionId: string): TransactionState | undefined =>
  itxToTransactionState.get(prismaTransactionId);

export const pushAfterCommit = (
  transactionState: TransactionState,
  callbacks: AfterCommitFn | AfterCommitFn[],
  types?: ConcurrencyType | ConcurrencyType[],
): void => {
  const callbackList = castArray(callbacks);
  const typeList = types ? castArray(types) : undefined;
  transactionState.afterCommitBatches.push({
    fns: callbackList,
    concurrency: getConcurrency(typeList),
    types: typeList,
  });
};
