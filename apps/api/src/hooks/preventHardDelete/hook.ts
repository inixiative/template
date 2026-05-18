import { DbAction, HookTiming, registerDbHook, SOFT_DELETE_MODEL_SET } from '@template/db';

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
