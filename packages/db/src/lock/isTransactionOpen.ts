/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';

// db.txn detaches the transaction from its scope in the callback's finally, before `settled` is set
// once $transaction has committed or rolled back. A transaction in that window is already over.
export const isTransactionOpen = (openTransaction: OpenTransaction): boolean =>
  !openTransaction.settled && openTransaction.scope.openTransaction === openTransaction;
