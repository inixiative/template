/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type ActorSnapshot = { model: string; record: Record<string, unknown> };

export type UserMerge = {
  sourceUserId: string;
  targetUserId: string;
  plannedWrites: Map<string, Set<string | null>>;
  plannedDeletes: Set<string>;
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
  userMerge: UserMerge | null;
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
  userMerge: null,
};

export const auditActorStore = new AsyncLocalStorage<AuditActor>();

const runWithActorChanges = <T>(
  patch: Partial<AuditActor>,
  fn: () => T | Promise<T>,
): Promise<Awaited<T>> =>
  auditActorStore.run(
    { ...(auditActorStore.getStore() ?? nullAuditActor), ...patch },
    async (): Promise<Awaited<T>> => await fn(),
  );

export const auditActorContext = {
  // Await inside the store — a returned lazy thenable would otherwise execute after the scope exits.
  scope: <T>(actor: AuditActor, fn: () => T | PromiseLike<T>): Promise<T> =>
    auditActorStore.run(actor, async () => await fn()),
  currentActor: (): AuditActor | null => auditActorStore.getStore() ?? null,
  extend: (partial: Partial<AuditActor>): void => {
    const current = auditActorStore.getStore();
    if (current) Object.assign(current, partial);
  },
  isSoftDeleteBypassed: (): boolean => auditActorStore.getStore()?.bypassSoftDeleteScope ?? false,
  withDeleted: <T>(fn: () => T | Promise<T>): Promise<Awaited<T>> =>
    runWithActorChanges({ bypassSoftDeleteScope: true }, fn),
  // Inside a withDeleted block, restores the not-deleted-row scope for one read that must not see tombstones.
  withoutDeleted: <T>(fn: () => T | Promise<T>): Promise<Awaited<T>> =>
    runWithActorChanges({ bypassSoftDeleteScope: false }, fn),
  currentUserMerge: (): UserMerge | null => auditActorStore.getStore()?.userMerge ?? null,
};
