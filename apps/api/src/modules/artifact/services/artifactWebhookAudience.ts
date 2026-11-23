/**
 * @atlas
 * @kind service
 * @partOf feature:files, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db, rowPolymorphicAxisPointsAt } from '@template/db';
import type { Artifact, ArtifactPermission } from '@template/db/generated/client/client';
import type { WebhookAudienceResolver } from '#/hooks/webhooks/audiences';
import { partyKey, type Party as WebhookParty } from '#/hooks/webhooks/parties';
import {
  type ArtifactPrincipal,
  granteePrincipal,
  ownerPrincipal,
} from '#/modules/artifact/lib/artifactPrincipal';

const directParty = ({ kind, ids }: ArtifactPrincipal): WebhookParty | null => {
  switch (kind) {
    case 'User':
      return { model: 'User', id: ids[0]! };
    case 'Organization':
    case 'OrganizationManager':
      return { model: 'Organization', id: ids[0]! };
    case 'Space':
    case 'SpaceManager':
      return { model: 'Space', id: ids[0]! };
    case 'OrganizationUser':
      return { model: 'User', id: ids[1]! };
    case 'SpaceUser':
      return { model: 'User', id: ids[2]! };
    default:
      return null;
  }
};

const customerParties = async (
  customerRelationshipIds: string[],
): Promise<Map<string, WebhookParty>> => {
  const customerRelationships = await db.customerRelationship.findMany({
    where: { id: { in: customerRelationshipIds } },
  });
  const parties = new Map<string, WebhookParty>();
  for (const customerRelationship of customerRelationships) {
    const customer = rowPolymorphicAxisPointsAt(
      customerRelationship,
      'CustomerRelationship',
      'customerModel',
    );
    if (customer) parties.set(customerRelationship.id, customer as WebhookParty);
  }
  return parties;
};

const principalParties = async (
  principalsByArtifact: Map<string, ArtifactPrincipal[]>,
): Promise<Map<string, WebhookParty[]>> => {
  const customerRelationshipIds = [...principalsByArtifact.values()]
    .flat()
    .filter((principal) => principal.kind === 'CustomerRelationship')
    .map((principal) => principal.ids[0]!);
  const customers = customerRelationshipIds.length
    ? await customerParties(customerRelationshipIds)
    : new Map();

  const audiences = new Map<string, WebhookParty[]>();
  for (const [artifactId, principals] of principalsByArtifact) {
    const parties = new Map<string, WebhookParty>();
    for (const principal of principals) {
      const party =
        principal.kind === 'CustomerRelationship'
          ? customers.get(principal.ids[0]!)
          : directParty(principal);
      if (party) parties.set(partyKey(party), party);
    }
    audiences.set(artifactId, [...parties.values()]);
  }
  return audiences;
};

const diedWith = (childDeletedAt: Date | null, parentDeletedAt: Date): boolean =>
  childDeletedAt === null || childDeletedAt.getTime() === parentDeletedAt.getTime();

const isActivePermission = (permission: ArtifactPermission, now: Date): boolean =>
  !permission.expiresAt || permission.expiresAt > now;

export const artifactWebhookAudience: WebhookAudienceResolver = async (rows) => {
  const now = new Date();
  const artifacts = rows as unknown as Artifact[];
  const principalsByArtifact = new Map<string, ArtifactPrincipal[]>(
    artifacts.map((artifact) => [artifact.id, [ownerPrincipal(artifact)]]),
  );

  const liveIds = artifacts.filter((row) => !(row.deletedAt instanceof Date)).map((row) => row.id);
  const deadRows = artifacts.filter((row) => row.deletedAt instanceof Date);

  if (liveIds.length > 0) {
    const effective = await db.artifactEffectivePermission.findMany({
      where: { artifactId: { in: liveIds } },
      include: { permission: true },
    });
    for (const row of effective) {
      if (!row.permission || row.permission.deletedAt || !isActivePermission(row.permission, now)) {
        continue;
      }
      principalsByArtifact.get(row.artifactId)?.push(granteePrincipal(row.permission));
    }
  }

  if (deadRows.length > 0) {
    const deadById = new Map(deadRows.map((row) => [row.id, row]));
    const deadIds = [...deadById.keys()];
    const tombstones = deadRows.map((row) => row.deletedAt!);

    const [directPerms, deadPlacements] = await db.withDeleted(() =>
      Promise.all([
        db.artifactPermission.findMany({
          where: {
            artifactId: { in: deadIds },
            OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }],
          },
        }),
        db.artifactPlacement.findMany({
          where: {
            artifactId: { in: deadIds },
            OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }],
          },
          select: { artifactId: true, containerArtifactId: true, deletedAt: true },
        }),
      ]),
    );

    for (const permission of directPerms) {
      const parent = deadById.get(permission.artifactId);
      if (!parent || !diedWith(permission.deletedAt, parent.deletedAt!)) continue;
      if (!isActivePermission(permission, now)) continue;
      principalsByArtifact.get(parent.id)?.push(granteePrincipal(permission));
    }

    const inheritedPairs = deadPlacements.filter((placement) => {
      const child = deadById.get(placement.artifactId);
      return child && child.access !== 'private' && diedWith(placement.deletedAt, child.deletedAt!);
    });
    const containerIds = [...new Set(inheritedPairs.map((pair) => pair.containerArtifactId))];
    if (containerIds.length > 0) {
      const containerEffective = await db.artifactEffectivePermission.findMany({
        where: { artifactId: { in: containerIds } },
        include: { permission: true },
      });
      const permsByContainer = new Map<string, ArtifactPermission[]>();
      for (const row of containerEffective) {
        if (!row.permission || row.permission.deletedAt || !isActivePermission(row.permission, now))
          continue;
        const list = permsByContainer.get(row.artifactId) ?? [];
        list.push(row.permission);
        permsByContainer.set(row.artifactId, list);
      }
      for (const { artifactId, containerArtifactId } of inheritedPairs) {
        for (const permission of permsByContainer.get(containerArtifactId) ?? []) {
          principalsByArtifact.get(artifactId)?.push(granteePrincipal(permission));
        }
      }
    }
  }

  return principalParties(principalsByArtifact);
};

export const artifactPermissionGranteeAudience: WebhookAudienceResolver = async (rows) => {
  const principalsByArtifact = new Map<string, ArtifactPrincipal[]>();
  for (const row of rows as unknown as ArtifactPermission[]) {
    const list = principalsByArtifact.get(row.artifactId) ?? [];
    list.push(granteePrincipal(row));
    principalsByArtifact.set(row.artifactId, list);
  }
  return principalParties(principalsByArtifact);
};
