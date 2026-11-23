/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { polymorphicKeyColumns } from '@template/db';
import type { ArtifactPermission } from '@template/db/generated/client/client';
import type {
  ArtifactOwnerModel,
  ArtifactPermissionGranteeModel,
} from '@template/db/generated/client/enums';

export type ArtifactPrincipalKind =
  | ArtifactPermissionGranteeModel
  | 'OrganizationManager'
  | 'SpaceManager';

export type ArtifactPrincipal = { kind: ArtifactPrincipalKind; ids: string[] };

export const principalKey = ({ kind, ids }: ArtifactPrincipal): string => [kind, ...ids].join(':');

export const granteePrincipal = (permission: ArtifactPermission): ArtifactPrincipal => ({
  kind: permission.granteeModel,
  ids: polymorphicKeyColumns('ArtifactPermission', 'granteeModel', permission.granteeModel).map(
    (column) => String((permission as Record<string, unknown>)[column]),
  ),
});

type OwnedRow = {
  ownerModel: ArtifactOwnerModel;
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
};

export const ownerPrincipal = (artifact: OwnedRow): ArtifactPrincipal => {
  switch (artifact.ownerModel) {
    case 'User':
      return { kind: 'User', ids: [artifact.userId!] };
    case 'Organization':
      return { kind: 'OrganizationManager', ids: [artifact.organizationId!] };
    case 'Space':
      return { kind: 'SpaceManager', ids: [artifact.spaceId!] };
    case 'OrganizationUser':
      return { kind: 'OrganizationUser', ids: [artifact.organizationId!, artifact.userId!] };
    case 'SpaceUser':
      return {
        kind: 'SpaceUser',
        ids: [artifact.organizationId!, artifact.spaceId!, artifact.userId!],
      };
  }
};
