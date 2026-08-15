/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';

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

export const auditActorStore = new AsyncLocalStorage<AuditActor>();

export const auditActorContext = {
  // Await inside the store — a returned lazy thenable would otherwise execute after the scope exits.
  scope: <T>(actor: AuditActor, fn: () => T | Promise<T>): Promise<T> =>
    auditActorStore.run(actor, async () => await fn()),
  getScope: (): AuditActor | null => auditActorStore.getStore() ?? null,
  extend: (partial: Partial<AuditActor>): void => {
    const current = auditActorStore.getStore();
    if (current) Object.assign(current, partial);
  },
};
