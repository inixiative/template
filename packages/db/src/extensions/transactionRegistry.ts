/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { readPrismaTransaction } from '@template/db/extensions/prismaTransaction';

// Prisma never hands the caller the id of the interactive transaction it just opened, but every
// query interceptor is told which transaction its op is executing on. db.txn() therefore opens a
// registration, issues one token-carrying read, and the interceptor that sees the token binds the
// two together — the only link between the caller frame and the extension that does not depend on
// async-local storage surviving a Prisma-internal continuation.
const pendingRegistrations = new Map<string, OpenTransaction>();
const itxToOpenTransaction = new Map<string, OpenTransaction>();

// Ports point this at any model whose unique field is string-typed — the token must miss, never throw.
export const registrationProbe = { model: 'session', field: 'id' } as const;

export const openTransactionRegistration = (openTransaction: OpenTransaction): string => {
  const registrationToken = crypto.randomUUID();
  pendingRegistrations.set(registrationToken, openTransaction);
  return registrationToken;
};

export const closeTransactionRegistration = (registrationToken: string, openTransaction: OpenTransaction): void => {
  pendingRegistrations.delete(registrationToken);
  if (openTransaction.prismaTransactionId) itxToOpenTransaction.delete(openTransaction.prismaTransactionId);
  openTransaction.prismaTransactionId = null;
};

const registrationTokenFrom = (args: unknown): string | undefined => {
  const identifier = (args as { where?: Record<string, unknown> } | undefined)?.where?.[registrationProbe.field];
  return typeof identifier === 'string' && pendingRegistrations.has(identifier) ? identifier : undefined;
};

// Runs on every findFirst, so the token lookup is the cheap first gate.
export const claimPendingRegistration = (params: { args: unknown }): void => {
  const registrationToken = registrationTokenFrom(params.args);
  if (!registrationToken) return;

  const prismaTransaction = readPrismaTransaction(params);
  if (prismaTransaction?.kind !== 'itx') return;

  const openTransaction = pendingRegistrations.get(registrationToken);
  if (!openTransaction) return;

  pendingRegistrations.delete(registrationToken);
  openTransaction.prismaTransactionId = String(prismaTransaction.id);
  itxToOpenTransaction.set(openTransaction.prismaTransactionId, openTransaction);
};

// Null = no transaction: the mutation came in on db.raw, which opts out of the life cycle.
export const getCurrentTransaction = (model: string, operation: string, params: unknown): OpenTransaction | null => {
  const prismaTransaction = readPrismaTransaction(params);
  if (!prismaTransaction) return null;

  if (prismaTransaction.kind === 'itx') {
    const openTransaction = itxToOpenTransaction.get(String(prismaTransaction.id));
    if (openTransaction) return openTransaction;
  }

  throw new Error(
    `${model}.${operation} ran inside a transaction that db.txn() did not open. ` +
      'Hooked mutations must go through db.txn() — inside a raw $transaction their hooks and ' +
      'onCommit callbacks have no transaction to bind to.',
  );
};
