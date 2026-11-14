/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { ensureOrganizationUserFolder } from '#/modules/artifact/services/ensureOrganizationUserFolder';

export const registerOrganizationUserFolderHook = () => {
  registerDbHook(
    'organizationUserFolder',
    'OrganizationUser',
    HookTiming.after,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ result }: HookOptions) => {
      for (const row of castArray(result ?? []) as { organizationId: string; userId: string }[]) {
        await ensureOrganizationUserFolder(row.organizationId, row.userId);
      }
    },
  );
};
