/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import {
  type RemovedPlacement,
  reparentOrphanedArtifacts,
} from '#/hooks/artifactTree/reparentOrphanedArtifacts';
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
      const isHardDelete =
        options.action === DbAction.delete || options.action === DbAction.deleteMany;
      const removed: RemovedPlacement[] = [];
      const artifactIds: string[] = [];

      for (const { result, previous } of pairs) {
        if (typeof result?.artifactId === 'string') artifactIds.push(result.artifactId);
        if (typeof previous?.artifactId === 'string') artifactIds.push(previous.artifactId);

        const softDeleted =
          !isHardDelete && previous?.deletedAt == null && result?.deletedAt != null;
        const hardDeleted = isHardDelete && previous != null && previous.deletedAt == null;
        if (softDeleted || hardDeleted) {
          const source = previous ?? result;
          if (
            typeof source?.artifactId === 'string' &&
            typeof source?.containerArtifactId === 'string'
          ) {
            removed.push({
              artifactId: source.artifactId,
              containerArtifactId: source.containerArtifactId,
            });
          }
        }
      }

      const reparentedIds =
        removed.length > 0 ? await reparentOrphanedArtifacts(removed) : new Set<string>();
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

  registerDbHook(
    'artifactTree:artifact',
    'Artifact',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async (options: HookOptions) => {
      const revivedIds = changedPairs(options).flatMap(({ result, previous }) => {
        if (!result || typeof result.id !== 'string') return [];
        const revived = previous?.deletedAt != null && result.deletedAt == null;
        return revived ? [result.id] : [];
      });
      await syncArtifactAncestors(revivedIds);
    },
  );
};
