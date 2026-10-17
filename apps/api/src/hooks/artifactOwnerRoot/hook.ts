/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import type { ArtifactOwnerModel } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';
import { ensureOwnerRoot } from '#/modules/artifact/services/ensureOwnerRoot';

const ownerColumn: Record<ArtifactOwnerModel, 'userId' | 'organizationId' | 'spaceId'> = {
  User: 'userId',
  Organization: 'organizationId',
  Space: 'spaceId',
};

export const registerArtifactOwnerRootHook = () => {
  registerDbHook(
    'artifactOwnerRoot',
    Object.keys(ownerColumn),
    HookTiming.after,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, result }: HookOptions) => {
      const ownerModel = model as ArtifactOwnerModel;
      for (const row of castArray(result ?? []) as { id: string }[]) {
        await ensureOwnerRoot({
          ownerModel,
          userId: null,
          organizationId: null,
          spaceId: null,
          [ownerColumn[ownerModel]]: row.id,
        });
      }
    },
  );
};
