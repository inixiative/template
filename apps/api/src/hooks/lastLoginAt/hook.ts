/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';

export const registerLastLoginAtHook = () => {
  registerDbHook(
    'lastLoginAt:session',
    'Session',
    HookTiming.after,
    [DbAction.create],
    async (options: HookOptions) => {
      const { result, db: hookDb } = options as HookOptions & { action: SingleAction };
      const userId = (result as { userId?: string } | undefined)?.userId;
      if (!userId) return;
      await hookDb.$executeRaw`UPDATE "User" SET "lastLoginAt" = ${new Date()} WHERE id = ${userId}`;
    },
  );
};
