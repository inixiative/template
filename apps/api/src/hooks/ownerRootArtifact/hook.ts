/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, db, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { ArtifactKind, type ArtifactOwnerModel } from '@template/db/generated/client/enums';
import { changedPairs } from '#/hooks/shared/hookRows';
import {
  artifactOwner,
  type OwnerRef,
  ownerColumns,
  ownerRefForRow,
} from '#/modules/artifact/services/artifactOwner';

const OWNER_MODELS: readonly ArtifactOwnerModel[] = [
  'User',
  'Organization',
  'Space',
  'OrganizationUser',
  'SpaceUser',
];

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
        await db.withoutDeleted(() =>
          db.artifact.createManyAndReturn({
            data: sortedOwners.map((owner) => ({
              ...ownerColumns(owner),
              kind: ArtifactKind.root,
              name: 'Root',
            })),
            skipDuplicates: true,
          }),
        );
      },
    );
  }
};
