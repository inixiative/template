import { DbAction, HookTiming, registerDbHook, SOFT_DELETE_MODEL_SET } from '@template/db';

/**
 * Block `db.x.delete()` and `db.x.deleteMany()` on any soft-delete model.
 * Soft-delete models (every audit-enabled model + the SOFT_DELETE_ONLY
 * extras) must be deleted by setting `deletedAt`, not via Prisma DELETE.
 *
 * Hard-delete on these models is intentionally inaccessible through Prisma.
 * Special cases (test cleanup, GDPR purge, migrations) use `db.$executeRaw`
 * which bypasses Prisma hooks; GDPR specifically should go through the
 * redact service (anonymise in place) rather than physical deletion.
 */
export const registerPreventHardDeleteHook = () => {
  registerDbHook(
    'preventHardDelete',
    '*',
    HookTiming.before,
    [DbAction.delete, DbAction.deleteMany],
    async ({ model, action }) => {
      if (!SOFT_DELETE_MODEL_SET.has(model)) return;
      throw new Error(
        `[preventHardDelete] ${model} is soft-delete; refusing ${action}. ` +
          `Use update({ data: { deletedAt: new Date() } }) instead, or go through the redact service for GDPR purges.`,
      );
    },
  );
};
