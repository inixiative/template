import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditActor = {
  actorUserId: string | null;
  actorSpoofUserId: string | null;
  actorTokenId: string | null;
  actorJobName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sourceInquiryId: string | null;
};

export const nullAuditActor: AuditActor = {
  actorUserId: null,
  actorSpoofUserId: null,
  actorTokenId: null,
  actorJobName: null,
  ipAddress: null,
  userAgent: null,
  sourceInquiryId: null,
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
