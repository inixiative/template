/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  type ManyAction,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import { keyBy } from 'lodash-es';
import {
  clearDescendantCaches,
  syncArtifactAncestors,
} from '#/hooks/artifactTree/syncArtifactAncestors';
import { syncPermissionDescendants } from '#/hooks/artifactTree/syncPermissionDescendants';
import { ALL_MUTATION_ACTIONS, isManyAction } from '#/hooks/shared/hookRows';
import { makeError } from '#/lib/errors';
import { type OwnedArtifact, sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

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
    'artifactTree:placementOwner',
    'ArtifactPlacement',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async (options: HookOptions) => {
      const rawData = (options.args as { data?: Row | Row[] } | undefined)?.data;
      const rows = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
      const containerIds = [
        ...new Set(
          rows.flatMap((row) =>
            typeof row.containerArtifactId === 'string' ? [row.containerArtifactId] : [],
          ),
        ),
      ];
      if (containerIds.length === 0) return;
      const containers = await db.withoutDeleted(() =>
        db.artifact.findMany({
          where: { id: { in: containerIds } },
          select: { id: true, ownerModel: true, userId: true, organizationId: true, spaceId: true },
        }),
      );
      const containerById = new Map(containers.map((container) => [container.id, container]));
      for (const row of rows) {
        if (typeof row.containerArtifactId !== 'string') continue;
        const container = containerById.get(row.containerArtifactId);
        if (!container) continue;
        const candidate = {
          ownerModel: row.ownerModel,
          userId: row.userId ?? null,
          organizationId: row.organizationId ?? null,
          spaceId: row.spaceId ?? null,
        } as OwnedArtifact;
        if (!sameArtifactOwner(candidate, container)) {
          throw makeError({
            status: 422,
            message: 'ArtifactPlacement owner must match its containerArtifact owner',
          });
        }
      }
    },
  );

  registerDbHook(
    'artifactTree:placement',
    'ArtifactPlacement',
    HookTiming.after,
    ALL_MUTATION_ACTIONS,
    async (options: HookOptions) => {
      const artifactIds = changedPairs(options).flatMap(({ result, previous }) => {
        if (!result?.containerArtifactId && !previous?.containerArtifactId) return [];
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
      const pairs = changedPairs(options);
      const ancestorSyncIds: string[] = [];
      const visibilityChangedIds: string[] = [];
      for (const { result, previous } of pairs) {
        if (!result || typeof result.id !== 'string') continue;
        const { id } = result;
        const accessChanged = Boolean(previous && result.access !== previous.access);
        const revived = previous?.deletedAt != null && result.deletedAt == null;
        if (accessChanged || revived) ancestorSyncIds.push(id);
        const visibilityChanged =
          accessChanged &&
          (result.access === 'public' ||
            previous?.access === 'public' ||
            result.access === 'tenant' ||
            previous?.access === 'tenant');
        if (visibilityChanged) visibilityChangedIds.push(id);
      }
      await syncArtifactAncestors(ancestorSyncIds);
      await clearDescendantCaches(visibilityChangedIds);
    },
  );
};
