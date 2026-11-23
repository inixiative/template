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
import {
  invalidateInheritingDescendants,
  syncArtifactPermissionEffective,
  syncArtifactSubgraph,
} from '#/hooks/artifactClosure/syncArtifactClosure';
import { isManyAction } from '#/hooks/shared/hookRows';

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

const ALL_MUTATIONS = [
  DbAction.create,
  DbAction.update,
  DbAction.delete,
  DbAction.upsert,
  DbAction.createManyAndReturn,
  DbAction.updateManyAndReturn,
  DbAction.deleteMany,
];

export const registerArtifactClosureHook = () => {
  registerDbHook(
    'artifactClosure:placement',
    'ArtifactPlacement',
    HookTiming.after,
    ALL_MUTATIONS,
    async (options: HookOptions) => {
      const artifactIds = changedPairs(options).flatMap(({ result, previous }) => {
        const ids: string[] = [];
        if (typeof result?.artifactId === 'string') ids.push(result.artifactId);
        if (typeof previous?.artifactId === 'string') ids.push(previous.artifactId);
        return ids;
      });
      await syncArtifactSubgraph(artifactIds);
    },
  );

  registerDbHook(
    'artifactClosure:permission',
    'ArtifactPermission',
    HookTiming.after,
    ALL_MUTATIONS,
    async (options: HookOptions) => {
      const permissionIds = changedPairs(options).flatMap(({ result, previous }) => {
        const id = result?.id ?? previous?.id;
        return typeof id === 'string' ? [id] : [];
      });
      await syncArtifactPermissionEffective(permissionIds);
    },
  );

  registerDbHook(
    'artifactClosure:artifact',
    'Artifact',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async (options: HookOptions) => {
      const pairs = changedPairs(options);
      const subgraphIds: string[] = [];
      const publicChangedIds: string[] = [];
      for (const { result, previous } of pairs) {
        if (!result || typeof result.id !== 'string') continue;
        const { id } = result;
        const accessChanged = previous && result.access !== previous.access;
        const revived = previous?.deletedAt != null && result.deletedAt == null;
        if (accessChanged || revived) subgraphIds.push(id);
        if (accessChanged && (result.access === 'public' || previous.access === 'public')) {
          publicChangedIds.push(id);
        }
      }
      await syncArtifactSubgraph(subgraphIds);
      await invalidateInheritingDescendants(publicChangedIds);
    },
  );
};
