/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, db, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import type { ArtifactOwnerModel } from '@template/db/generated/client/enums';
import { changedPairs, type HookEntityRow } from '#/hooks/shared/hookRows';
import {
  artifactOwner,
  type OwnerRef,
  ownerColumns,
} from '#/modules/artifact/services/artifactOwner';
import { ensureOwnerRootArtifact } from '#/modules/artifact/services/ownerRootArtifact';

const OWNER_MODELS: readonly ArtifactOwnerModel[] = [
  'User',
  'Organization',
  'Space',
  'OrganizationUser',
  'SpaceUser',
];

const ownerRefForRow = (model: ArtifactOwnerModel, row: HookEntityRow): OwnerRef | null => {
  switch (model) {
    case 'User':
      return typeof row.id === 'string' ? { ownerModel: 'User', userId: row.id } : null;
    case 'Organization':
      return typeof row.id === 'string'
        ? { ownerModel: 'Organization', organizationId: row.id }
        : null;
    case 'Space':
      return typeof row.id === 'string' && typeof row.organizationId === 'string'
        ? { ownerModel: 'Space', organizationId: row.organizationId, spaceId: row.id }
        : null;
    case 'OrganizationUser':
      return typeof row.organizationId === 'string' && typeof row.userId === 'string'
        ? {
            ownerModel: 'OrganizationUser',
            organizationId: row.organizationId,
            userId: row.userId,
          }
        : null;
    case 'SpaceUser':
      return typeof row.organizationId === 'string' &&
        typeof row.spaceId === 'string' &&
        typeof row.userId === 'string'
        ? {
            ownerModel: 'SpaceUser',
            organizationId: row.organizationId,
            spaceId: row.spaceId,
            userId: row.userId,
          }
        : null;
  }
};

export const registerOwnerRootArtifactHook = () => {
  for (const model of OWNER_MODELS) {
    registerDbHook(
      `ownerRootArtifact:${model}`,
      model,
      HookTiming.after,
      [
        DbAction.create,
        DbAction.createManyAndReturn,
        DbAction.upsert,
        DbAction.update,
        DbAction.updateManyAndReturn,
      ],
      async (options: HookOptions) => {
        const isCreate =
          options.action === DbAction.create || options.action === DbAction.createManyAndReturn;
        const ownersByKey = new Map<string, OwnerRef>();
        for (const { result, previous } of changedPairs(options)) {
          if (!result || result.deletedAt != null) continue;
          // why: upsert inserts have previous === undefined; only skip updates where the row was already not-deleted.
          if (!isCreate && previous != null && previous.deletedAt == null) continue;
          const ref = ownerRefForRow(model, result);
          if (!ref) continue;
          const { ownerModel, ownerId } = artifactOwner(ownerColumns(ref));
          ownersByKey.set(`${ownerModel}:${ownerId}`, ref);
        }
        if (ownersByKey.size === 0) return;
        const sortedOwners = [...ownersByKey.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, ref]) => ref);
        await db.withoutDeleted(async () => {
          for (const owner of sortedOwners) {
            await ensureOwnerRootArtifact(owner);
          }
        });
      },
    );
  }
};
