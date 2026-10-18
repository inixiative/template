/**
 * @atlas
 * @kind helper
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { getPolymorphismConfig } from '@template/db';
import type { ArtifactPermission } from '@template/db/generated/client/client';
import type {
  ArtifactOwnerModel,
  ArtifactPermissionGranteeModel,
} from '@template/db/generated/client/enums';

export type ArtifactPrincipalKind =
  | ArtifactPermissionGranteeModel
  | 'OrganizationManager'
  | 'OrganizationOwner'
  | 'SpaceManager';

export type ArtifactPrincipal = { kind: ArtifactPrincipalKind; ids: string[] };

export const principalKey = ({ kind, ids }: ArtifactPrincipal): string => [kind, ...ids].join(':');

const granteeKeyColumns = (granteeModel: ArtifactPermissionGranteeModel): string[] => {
  const axis = getPolymorphismConfig('ArtifactPermission')?.axes.find(
    (candidate) => candidate.field === 'granteeModel',
  );
  return (axis?.fkMap as Record<string, string[] | undefined>)[granteeModel] ?? [];
};

export const granteePrincipal = (permission: ArtifactPermission): ArtifactPrincipal => ({
  kind: permission.granteeModel,
  ids: granteeKeyColumns(permission.granteeModel).map((column) =>
    String((permission as Record<string, unknown>)[column]),
  ),
});

type OwnedRow = {
  ownerModel: ArtifactOwnerModel;
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
};

export const ownerPrincipal = (artifact: OwnedRow, memberScoped = false): ArtifactPrincipal => {
  if (artifact.ownerModel === 'Organization')
    return {
      kind: memberScoped ? 'OrganizationOwner' : 'OrganizationManager',
      ids: [artifact.organizationId!],
    };
  if (artifact.ownerModel === 'Space') return { kind: 'SpaceManager', ids: [artifact.spaceId!] };
  return { kind: 'User', ids: [artifact.userId!] };
};
