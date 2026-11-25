/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import {
  DbAction,
  type HookOptions,
  HookTiming,
  type ManyAction,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import { keyBy } from 'lodash-es';
import { syncArtifactAncestors } from '#/hooks/artifactTree/syncArtifactAncestors';
import { syncPermissionDescendants } from '#/hooks/artifactTree/syncPermissionDescendants';
import { ALL_MUTATION_ACTIONS, isManyAction } from '#/hooks/shared/hookRows';

type Row = Record<string, unknown> & { id?: string };

const changedPairs = (options: HookOptions): { result?: Row; previous?: Row }[] => {
  if (isManyAction(options.action)) {
    const { result, previous } = options as HookOptions & { action: ManyAction };
    const results = (result ?? []) as Row[];
    const previousList = (previous ?? []) as Row[];
    const previousById = keyBy(previousList, 'id');
    if (results.length > 0) {
      return results.map((row) => ({
        result: row,
        previous: row.id ? previousById[row.id] : undefined,
      }));
    }
    return previousList.map((row) => ({ previous: row }));
  }
  const { result, previous } = options as HookOptions & { action: SingleAction };
  return [{ result: result as Row | undefined, previous: previous as Row | undefined }];
};

export const registerArtifactTreeHook = () => {
  registerDbHook(
    'artifactTree:placement',
    'ArtifactPlacement',
    HookTiming.after,
    ALL_MUTATION_ACTIONS,
    async (options: HookOptions) => {
      const artifactIds = changedPairs(options).flatMap(({ result, previous }) => {
        const ids: string[] = [];
        if (typeof result?.artifactId === 'string') ids.push(result.artifactId);
        if (typeof previous?.artifactId === 'string') ids.push(previous.artifactId);
        return ids;
      });
      await syncArtifactAncestors(artifactIds);
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
