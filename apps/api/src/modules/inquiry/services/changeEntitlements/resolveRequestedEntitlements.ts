/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { fetchReadableIntegrationOrThrow } from '#/modules/inquiry/services/changeEntitlements/fetchReadableIntegrationOrThrow';
import type { RequestedEntitlement } from '#/modules/inquiry/services/changeEntitlements/schema';
import { registerIntegrationResource } from '#/modules/integration/services/registerIntegrationResource';
import { validateIntegrationResourceKey } from '#/modules/integration/validations/validateIntegrationResourceKey';

type EntitlementAnchoredById = Extract<RequestedEntitlement, { sourceId: string }>;

/**
 * The approved entitlements, each anchored by id. One naming an integration resource by its key
 * anchors at the live resource under that key when it is tracked or missing. Otherwise the approval
 * registers it, as the approver, through the `register` transition: a new key comes in tracked, a
 * removed one as it was, and an untracked one, live or removed, tracked, since approving access to it
 * is a person tracking it. Asking never creates a resource; approving does (Aron, 2026-11-23).
 */
export const resolveRequestedEntitlements = async (
  approver: Permix,
  requested: RequestedEntitlement[],
): Promise<EntitlementAnchoredById[]> => {
  const resolved: EntitlementAnchoredById[] = [];
  for (const entitlement of requested) {
    if (!('source' in entitlement)) {
      resolved.push(entitlement);
      continue;
    }
    const { source, ...rest } = entitlement;
    const integration = await fetchReadableIntegrationOrThrow(approver, source.integrationId);
    validateIntegrationResourceKey(integration, source.kind, source.externalId);
    const stored = await db.withDeleted(() =>
      db.integrationResource.findUnique({ where: { integrationId_kind_externalId: source } }),
    );
    const untracked = stored?.status === IntegrationResourceStatus.untracked;
    const resource =
      stored && !stored.deletedAt && !untracked
        ? stored
        : await registerIntegrationResource(approver, integration, {
            kind: source.kind,
            externalId: source.externalId,
            name: stored?.name ?? source.externalId,
            metadata: (stored?.metadata ?? {}) as Prisma.InputJsonValue,
            ...(untracked ? { status: IntegrationResourceStatus.tracked } : {}),
          });
    resolved.push({ ...rest, sourceId: resource.id });
  }
  return resolved;
};
