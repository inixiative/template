/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses feature:auditLogs
 */
import { registerTransactionContextProvider } from '@template/db';
import { auditActorContextProvider } from '@template/db/lib/auditActorContext';

// Every context a hook reads ambiently has to be registered here, or it is silently absent in hook
// frames: Prisma's extension continuations do not carry async-local storage, so db.txn() captures
// each registered provider at open and the mutation extension re-enters them around hook execution.
// Called from every process boot (api, worker, test preload); re-registering the same provider is a
// no-op, so the extra calls are safe.
export const registerTransactionContextProviders = () => {
  registerTransactionContextProvider(auditActorContextProvider);
};
