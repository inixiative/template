import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditActor = {
  actorUserId: string | null;
  actorSpoofUserId: string | null;
  actorTokenId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

const store = new AsyncLocalStorage<AuditActor>();

export const auditActorContext = {
  run: <T>(actor: AuditActor, fn: () => T): T => store.run(actor, fn),
  get: (): AuditActor | null => store.getStore() ?? null,
};
