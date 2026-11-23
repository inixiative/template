/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import type { EntitlementInput } from '@template/db/entitlements/entitlementRow';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import type {
  IntegrationResourceKey,
  RequestedEntitlement,
} from '#/modules/inquiry/services/changeEntitlements/schema';
import { registerIntegrationResource } from '#/modules/integration/services/registerIntegrationResource';
import { validateIntegrationResourceKey } from '#/modules/integration/validations/validateIntegrationResourceKey';

export const fetchIntegrationNamedByKey = async ({
  integrationId,
  kind,
  externalId,
}: IntegrationResourceKey) => {
  const integration = await db.integration.findUnique({ where: { id: integrationId } });
  if (!integration)
    throw makeError({
      status: 422,
      message: `No integration ${integrationId} to name a resource on`,
    });
  validateIntegrationResourceKey(integration, kind, externalId);
  return integration;
};

/**
 * The approved entitlements, each anchored by id. One naming an integration resource by its key
 * anchors at the live resource registered under that key. When there is none, or it was removed,
 * the approval registers it through the `register` transition as the approver: new keys come in
 * tracked, a removed one as it was, and a removed untracked one tracked, since approving access to it
 * is a person tracking it. Asking never creates a resource; approving does (Aron, 2026-11-23).
 */
export const resolveRequestedEntitlements = async (
  approver: Permix,
  requested: RequestedEntitlement[],
): Promise<EntitlementInput[]> => {
  const resolved: EntitlementInput[] = [];
  for (const entitlement of requested) {
    if (!('source' in entitlement)) {
      resolved.push(entitlement);
      continue;
    }
    const { source, ...rest } = entitlement;
    const integration = await fetchIntegrationNamedByKey(source);
    const stored = await db.withDeleted(() =>
      db.integrationResource.findUnique({ where: { integrationId_kind_externalId: source } }),
    );
    const resource =
      stored && !stored.deletedAt
        ? stored
        : await registerIntegrationResource(approver, integration, {
            kind: source.kind,
            externalId: source.externalId,
            name: stored?.name ?? source.externalId,
            metadata: (stored?.metadata ?? {}) as Prisma.InputJsonValue,
            ...(stored?.status === IntegrationResourceStatus.untracked
              ? { status: IntegrationResourceStatus.tracked }
              : {}),
          });
    resolved.push({ ...rest, sourceId: resource.id });
  }
  return resolved;
};
