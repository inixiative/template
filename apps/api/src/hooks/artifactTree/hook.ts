/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { reparentOrphanedArtifacts } from '#/hooks/artifactTree/reparentOrphanedArtifacts';
import { syncArtifactAncestors } from '#/hooks/artifactTree/syncArtifactAncestors';
import { syncPermissionDescendants } from '#/hooks/artifactTree/syncPermissionDescendants';
import { ALL_MUTATION_ACTIONS, changedPairs } from '#/hooks/shared/hookRows';

export const registerArtifactTreeHook = () => {
  registerDbHook(
    'artifactTree:placement',
    'ArtifactPlacement',
    HookTiming.after,
    ALL_MUTATION_ACTIONS,
    async (options: HookOptions) => {
      const pairs = changedPairs(options);
      const isDelete = options.action === DbAction.delete || options.action === DbAction.deleteMany;
      const artifactIds = pairs.flatMap(({ result, previous }) => {
        const id = result?.artifactId ?? previous?.artifactId;
        return typeof id === 'string' ? [id] : [];
      });

      const reparentedIds = isDelete
        ? await reparentOrphanedArtifacts(artifactIds)
        : new Set<string>();
      const remainingIds = artifactIds.filter((id) => !reparentedIds.has(id));
      await syncArtifactAncestors(remainingIds);
    },
  );

  registerDbHook(
    'artifactTree:permission',
    'ArtifactPermission',
    HookTiming.after,
    ALL_MUTATION_ACTIONS,
    async (options: HookOptions) => {
      const permissionIds = changedPairs(options).flatMap(({ result, previous }) => {
        const id = result?.id ?? previous?.id;
        return typeof id === 'string' ? [id] : [];
      });
      await syncPermissionDescendants(permissionIds);
    },
  );
};
