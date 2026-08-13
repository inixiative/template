/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Db, TransactionState } from '@template/db/clientTypes';
import { readPrismaTransaction } from '@template/db/extensions/prismaTransaction';

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

export const closeTransactionRegistration = (registrationToken: string, transactionState: TransactionState): void => {
  pendingRegistrations.delete(registrationToken);
  if (transactionState.prismaTransactionId) itxToTransactionState.delete(transactionState.prismaTransactionId);
  transactionState.prismaTransactionId = null;
};

const registrationTokenFrom = (args: unknown): string | undefined => {
  const identifier = (args as { where?: { id?: unknown } } | undefined)?.where?.id;
  return typeof identifier === 'string' && pendingRegistrations.has(identifier) ? identifier : undefined;
};

// Runs on every findFirst, so the token lookup is the cheap first gate.
export const claimPendingRegistration = (params: { args: unknown }): void => {
  const registrationToken = registrationTokenFrom(params.args);
  if (!registrationToken) return;

  const prismaTransaction = readPrismaTransaction(params);
  if (prismaTransaction?.kind !== 'itx') return;

  const transactionState = pendingRegistrations.get(registrationToken);
  if (!transactionState) return;

  pendingRegistrations.delete(registrationToken);
  transactionState.prismaTransactionId = String(prismaTransaction.id);
  itxToTransactionState.set(transactionState.prismaTransactionId, transactionState);
};

export const resolveTransactionState = (model: string, operation: string, params: unknown): TransactionState | null => {
  const prismaTransaction = readPrismaTransaction(params);
  if (!prismaTransaction) return null;

  if (prismaTransaction.kind === 'itx') {
    const transactionState = itxToTransactionState.get(String(prismaTransaction.id));
    if (transactionState) return transactionState;
  }

  throw new Error(
    `${model}.${operation} ran inside a transaction that db.txn() did not open. ` +
      'Hooked mutations must go through db.txn() — inside a raw $transaction their hooks and ' +
      'onCommit callbacks have no transaction to bind to.',
  );
};

export const transactionClient = (transactionState: TransactionState): Db => {
  if (!transactionState.txn) throw new Error('Transaction state has no client - its transaction has already ended');
  return transactionState.txn;
};
