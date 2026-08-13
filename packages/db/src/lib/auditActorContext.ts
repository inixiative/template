/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TransactionContextProvider } from '@template/db/lib/transactionContext';

export type AuditActor = {
  actorUserId: string | null;
  actorSpoofUserId: string | null;
  actorTokenId: string | null;
  actorJobName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sourceInquiryId: string | null;
  integrationId: string | null;
};

export const nullAuditActor: AuditActor = {
  actorUserId: null,
  actorSpoofUserId: null,
  actorTokenId: null,
  actorJobName: null,
  ipAddress: null,
  userAgent: null,
  sourceInquiryId: null,
  integrationId: null,
};

const store = new AsyncLocalStorage<AuditActor>();

export const auditActorContext = {
  scope: <T>(actor: AuditActor, fn: () => T): T => store.run(actor, fn),
  getScope: (): AuditActor | null => store.getStore() ?? null,
  extend: (partial: Partial<AuditActor>): void => {
    const current = store.getStore();
    if (current) Object.assign(current, partial);
  },
};

// auditLog, emailVersioning's snapshot and the webhook origin check all call getScope() from hook
// frames, which are Prisma extension continuations that have lost async-local storage. Registered in
// lib/transactionContext.ts. The snapshot is the actor object itself, not a copy, so extend() from
// either side stays visible to the other, as it is without a transaction.
export const auditActorContextProvider: TransactionContextProvider<AuditActor | null> = {
  name: 'auditActor',
  capture: () => store.getStore() ?? null,
  restore: (actor, fn) => (actor ? store.run(actor, fn) : fn()),
};
