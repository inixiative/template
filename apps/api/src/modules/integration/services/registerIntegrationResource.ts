/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import type { Integration, IntegrationResource } from '@template/db/generated/client/client';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { assertTransition } from '#/lib/permissions/assertTransition';
import { validateIntegrationResourceKey } from '#/modules/integration/validations/validateIntegrationResourceKey';

export type IntegrationResourceRegistration = {
  kind: string;
  externalId: string;
  name: string;
  metadata?: Prisma.InputJsonValue;
  status?: IntegrationResourceStatus;
};

/**
 * Registers the integration's resource named by its kind and external id: a key the provider does not
 * declare is a 400, a new key is created tracked, a live or removed one is upserted, and the move is the
 * `register` transition the caller must be allowed.
 */
export const registerIntegrationResource = (
  permix: Permix,
  integration: Pick<Integration, 'id' | 'provider'>,
  { kind, externalId, name, metadata = {}, status }: IntegrationResourceRegistration,
): Promise<IntegrationResource> =>
  db.txn(async () => {
    validateIntegrationResourceKey(integration, kind, externalId);
    const key = { integrationId: integration.id, kind, externalId };
    const [existing] = await db.withDeleted(() =>
      db.findForUpdate<IntegrationResource>('IntegrationResource', key, { upserting: true }),
    );
    const registering = {
      kind,
      externalId,
      name,
      metadata,
      deletedAt: null,
      status: status ?? existing?.status ?? IntegrationResourceStatus.tracked,
    };
    await assertTransition(permix, 'integrationResource', 'register', existing ?? key, registering);
    return db.withDeleted(() =>
      db.integrationResource.upsert({
        where: { integrationId_kind_externalId: key },
        create: { ...registering, integrationId: integration.id },
        update: registering,
      }),
    );
  });
