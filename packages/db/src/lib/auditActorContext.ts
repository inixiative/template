/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type ActorSnapshot = {
  token?: {
    id: string;
    name: string;
    keyPrefix: string;
    ownerModel: string;
    userId: string | null;
    organizationId: string | null;
    spaceId: string | null;
    integrationId: string | null;
  };
};

export type AuditActor = {
  actorUserId: string | null;
  actorSpoofUserId: string | null;
  actorTokenId: string | null;
  actor: ActorSnapshot | null;
  actorJobName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sourceInquiryId: string | null;
  integrationId: string | null;
  bypassSoftDeleteScope: boolean;
};

export const nullAuditActor: AuditActor = {
  actorUserId: null,
  actorSpoofUserId: null,
  actorTokenId: null,
  actor: null,
  actorJobName: null,
  ipAddress: null,
  userAgent: null,
  sourceInquiryId: null,
  integrationId: null,
  bypassSoftDeleteScope: false,
};

export const auditActorStore = new AsyncLocalStorage<AuditActor>();

export const auditActorContext = {
  // Await inside the store — a returned lazy thenable would otherwise execute after the scope exits.
  scope: <T>(actor: AuditActor, fn: () => T | PromiseLike<T>): Promise<T> =>
    auditActorStore.run(actor, async () => await fn()),
  getScope: (): AuditActor | null => auditActorStore.getStore() ?? null,
  extend: (partial: Partial<AuditActor>): void => {
    const current = auditActorStore.getStore();
    if (current) Object.assign(current, partial);
  },
  isSoftDeleteBypassed: (): boolean => auditActorStore.getStore()?.bypassSoftDeleteScope ?? false,
  withDeleted: <T>(fn: () => T | Promise<T>): Promise<Awaited<T>> => {
    const current = auditActorStore.getStore() ?? nullAuditActor;
    return auditActorStore.run(
      { ...current, bypassSoftDeleteScope: true },
      async (): Promise<Awaited<T>> => await fn(),
    );
  },
  // Inside a withDeleted block, restores the live-row scope for one read that must not see tombstones.
  withoutDeleted: <T>(fn: () => T | Promise<T>): Promise<Awaited<T>> => {
    const current = auditActorStore.getStore() ?? nullAuditActor;
    return auditActorStore.run(
      { ...current, bypassSoftDeleteScope: false },
      async (): Promise<Awaited<T>> => await fn(),
    );
  },
};
