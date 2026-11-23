/**
 * @atlas
 * @kind service
 * @partOf feature:files, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db, rowPolymorphicAxisPointsAt } from '@template/db';
import type { ArtifactPermission } from '@template/db/generated/client/client';
import type { WebhookAudienceResolver } from '#/hooks/webhooks/audiences';
import { partyKey, type Party as WebhookParty } from '#/hooks/webhooks/parties';
import { type ArtifactPrincipal, granteePrincipal } from '#/modules/artifact/lib/artifactPrincipal';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

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

export const artifactWebhookAudience: WebhookAudienceResolver = async (rows) => {
  const deletedAtByArtifactId = new Map<string, Date>();
  for (const row of rows) {
    if (row.deletedAt instanceof Date) deletedAtByArtifactId.set(row.id, row.deletedAt);
  }
  const resolutions = await resolveArtifactAccess(
    rows.map((row) => row.id),
    deletedAtByArtifactId.size > 0 ? { deletedAtByArtifactId } : undefined,
  );
  return principalParties(
    new Map(
      [...resolutions.values()].map((resolution) => [
        resolution.artifactId,
        resolution.grants
          .filter((grant) => !(resolution.memberScoped && grant.implicit))
          .map((grant) => grant.principal),
      ]),
    ),
  );
};

export const artifactPermissionGranteeAudience: WebhookAudienceResolver = async (rows) => {
  const principalsByArtifact = new Map<string, ArtifactPrincipal[]>();
  for (const row of rows as unknown as ArtifactPermission[]) {
    const held = principalsByArtifact.get(row.artifactId) ?? [];
    principalsByArtifact.set(row.artifactId, [...held, granteePrincipal(row)]);
  }
  return principalParties(principalsByArtifact);
};
