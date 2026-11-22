/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { castArray, keyBy } from 'lodash-es';
import { ensureOrganizationUserFolder } from '#/modules/artifact/services/ensureOrganizationUserFolder';

type OrganizationUserRow = {
  id: string;
  organizationId: string;
  userId: string;
  deletedAt: Date | null;
};

export const registerOrganizationUserFolderHook = () => {
  registerDbHook(
    'organizationUserFolder',
    'OrganizationUser',
    HookTiming.after,
    [
      DbAction.create,
      DbAction.createManyAndReturn,
      DbAction.update,
      DbAction.updateManyAndReturn,
      DbAction.upsert,
    ],
    async ({ action, result, previous }: HookOptions) => {
      const before = keyBy(castArray(previous ?? []) as OrganizationUserRow[], 'id');
      const isCreate = action === DbAction.create || action === DbAction.createManyAndReturn;
      for (const row of castArray(result ?? []) as OrganizationUserRow[]) {
        if (row.deletedAt != null) continue;
        const prev = before[row.id];
        if (isCreate || !prev || prev.deletedAt != null) {
          await ensureOrganizationUserFolder(row.organizationId, row.userId);
        }
      }
    },
  );
};
