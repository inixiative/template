/**
 * @atlas
 * @kind service
 * @partOf feature:files, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db, polymorphicTarget } from '@template/db';
import type { ArtifactPermission } from '@template/db/generated/client/client';
import type { WebhookAudienceResolver, WebhookParty } from '#/hooks/webhooks/webhookParty';
import { type ArtifactPrincipal, granteePrincipal } from '#/modules/artifact/lib/artifactPrincipal';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

const directParty = ({ kind, ids }: ArtifactPrincipal): WebhookParty | null => {
  switch (kind) {
    case 'User':
      return { kind: 'User', id: ids[0]! };
    case 'Organization':
    case 'OrganizationManager':
      return { kind: 'Organization', id: ids[0]! };
    case 'Space':
    case 'SpaceManager':
      return { kind: 'Space', id: ids[0]! };
    case 'OrganizationUser':
      return { kind: 'User', id: ids[1]! };
    case 'SpaceUser':
      return { kind: 'User', id: ids[2]! };
    default:
      return null;
  }
};

const customerParties = async (customerRefIds: string[]): Promise<Map<string, WebhookParty>> => {
  const customerRefs = await db.customerRef.findMany({ where: { id: { in: customerRefIds } } });
  const parties = new Map<string, WebhookParty>();
  for (const customerRef of customerRefs) {
    const customer = polymorphicTarget(customerRef, 'CustomerRef', 'customerModel');
    if (customer) parties.set(customerRef.id, customer as WebhookParty);
  }
  return parties;
};

const partyKey = (party: WebhookParty) => `${party.kind}:${party.id}`;

const principalParties = async (
  principalsByArtifact: Map<string, ArtifactPrincipal[]>,
): Promise<Map<string, WebhookParty[]>> => {
  const customerRefIds = [...principalsByArtifact.values()]
    .flat()
    .filter((principal) => principal.kind === 'CustomerRef')
    .map((principal) => principal.ids[0]!);
  const customers = customerRefIds.length ? await customerParties(customerRefIds) : new Map();

  const audiences = new Map<string, WebhookParty[]>();
  for (const [artifactId, principals] of principalsByArtifact) {
    const parties = new Map<string, WebhookParty>();
    for (const principal of principals) {
      const party =
        principal.kind === 'CustomerRef'
          ? customers.get(principal.ids[0]!)
          : directParty(principal);
      if (party) parties.set(partyKey(party), party);
    }
    audiences.set(artifactId, [...parties.values()]);
  }
  return audiences;
};

export const artifactWebhookAudience: WebhookAudienceResolver = async (rows) => {
  const resolutions = await resolveArtifactAccess(rows.map((row) => row.id));
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
