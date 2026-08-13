/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses feature:auditLogs
 */

import { auditActorContext } from '@template/db/lib/auditActorContext';

// Async-local storage does not survive into Prisma's query-extension continuations: a mutation
// issued inside db.txn() reaches the interceptor with store.getStore() === undefined even though
// __internalParams reports an active interactive transaction. Anything a hook needs from the
// caller's context therefore has to be carried across that gap explicitly.
//
// A capture runs in the caller frame at db.txn() open, where storage is reliable, and returns the
// wrapper that re-enters what it saw. The extension applies that wrapper around hook invocation, so
// hooks keep reading their own ambient storage and never take a client parameter.
//
// Contract: capture happens at db.txn() open, so context entered after the transaction is already
// open is not visible to hooks on the lost-storage path. Set it at the request, job, or scope
// boundary. A capture that saw nothing returns a pass-through, leaving whatever the hook frame
// still has alone.

export type RestoreContext = <TResult>(fn: () => TResult) => TResult;
export type CaptureContext = () => RestoreContext;

const passThrough: RestoreContext = (fn) => fn();

const captures: CaptureContext[] = [];

export const registerCaptureContext = (capture: CaptureContext): void => {
  captures.push(capture);
};

// Called once per transaction; the composed wrapper is what every hook boundary runs.
export const captureTransactionContext = (): RestoreContext =>
  captures.map((capture) => capture()).reduce((composed, restore) => (fn) => composed(() => restore(fn)), passThrough);

registerCaptureContext(() => {
  const actor = auditActorContext.getScope();
  return actor ? (fn) => auditActorContext.scope(actor, fn) : passThrough;
});
